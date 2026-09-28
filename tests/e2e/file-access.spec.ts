import { randomBytes, randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// Creates its own cohort, two MSPs and their owners, so it only ever runs
// against a local Supabase stack and a local app. It never touches production.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Without a local env file the guard below skips the whole file.
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const isLocal = (value: string) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(value);
const canRun = Boolean(publishableKey && secretKey) && isLocal(supabaseUrl) && isLocal(baseUrl);

const bucket = "portal-assets";
const suffix = randomBytes(4).toString("hex");
const password = () => randomBytes(18).toString("base64url");

type Owner = { email: string; password: string; userId: string };
const fixture: {
  admin?: SupabaseClient;
  adminEmail: string;
  adminUserId?: string;
  cohortId?: string;
  mspA?: string;
  mspB?: string;
  ownerA?: Owner;
  ownerB?: Owner;
  assetA?: { id: string; path: string };
  assetB?: { id: string; path: string };
} = { adminEmail: `file-access-admin-${suffix}@lemhi.com` };

function must<R extends { data: unknown; error: unknown }>(result: R): NonNullable<R["data"]> {
  if (result.error) throw result.error;
  return result.data as NonNullable<R["data"]>;
}

async function signedInAs(owner: Owner) {
  const client = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false } });
  must(await client.auth.signInWithPassword({ email: owner.email, password: owner.password }));
  return client;
}

test.describe("private file access", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!canRun, "Runs only against a local Supabase stack and a local app.");

  test.beforeAll(async () => {
    if (!canRun) return;
    const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    fixture.admin = admin;

    must(await admin.from("admin_allowlist").upsert({ email: fixture.adminEmail, active: true }));
    const adminUser = must(await admin.auth.admin.createUser({ email: fixture.adminEmail, password: password(), email_confirm: true })).user!;
    fixture.adminUserId = adminUser.id;

    const cohort = must(await admin.from("cohorts").insert({
      program_id: "10000000-0000-4000-8000-000000000001",
      name: `File access ${suffix}`,
      start_date: new Date().toISOString().slice(0, 10),
      timezone: "America/New_York",
      session_weekday: 1,
      session_time: "11:00",
    }).select("id").single());
    fixture.cohortId = cohort.id;

    const createOwner = async (label: string) => {
      const msp = must(await admin.from("msps").insert({ cohort_id: cohort.id, name: `MSP ${label} ${suffix}` }).select("id").single());
      const owner = { email: `owner-${label.toLowerCase()}-${suffix}@example.test`, password: password(), userId: "" };
      must(await admin.from("invitations").insert({
        email: owner.email,
        role: "msp_owner",
        msp_id: msp.id,
        invited_by: adminUser.id,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      }));
      owner.userId = must(await admin.auth.admin.createUser({ email: owner.email, password: owner.password, email_confirm: true })).user!.id;
      return { mspId: msp.id, owner };
    };

    const a = await createOwner("A");
    const b = await createOwner("B");
    fixture.mspA = a.mspId;
    fixture.ownerA = a.owner;
    fixture.mspB = b.mspId;
    fixture.ownerB = b.owner;

    const createPrivateAsset = async (mspId: string, label: string) => {
      const id = randomUUID();
      const path = `msp/${mspId}/${id}/private-${label}.txt`;
      must(await admin.storage.from(bucket).upload(path, new Blob([`only for MSP ${label}`], { type: "text/plain" })));
      must(await admin.from("assets").insert({
        id,
        title: `Private ${label}`,
        category: "documentation",
        kind: "file",
        status: "ready",
        scope: "msp",
        msp_id: mspId,
        storage_path: path,
        mime_type: "text/plain",
      }));
      return { id, path };
    };

    fixture.assetA = await createPrivateAsset(a.mspId, "A");
    fixture.assetB = await createPrivateAsset(b.mspId, "B");
  });

  test.afterAll(async () => {
    const { admin } = fixture;
    if (!admin) return;
    const paths = [fixture.assetA?.path, fixture.assetB?.path].filter((path): path is string => Boolean(path));
    if (paths.length) await admin.storage.from(bucket).remove(paths);
    for (const owner of [fixture.ownerA, fixture.ownerB]) {
      if (owner?.userId) await admin.auth.admin.deleteUser(owner.userId);
    }
    const msps = [fixture.mspA, fixture.mspB].filter((id): id is string => Boolean(id));
    if (msps.length) await admin.from("msps").delete().in("id", msps);
    if (fixture.cohortId) await admin.from("cohorts").delete().eq("id", fixture.cohortId);
    if (fixture.adminUserId) await admin.auth.admin.deleteUser(fixture.adminUserId);
    await admin.from("admin_allowlist").delete().eq("email", fixture.adminEmail);
  });

  test("an MSP can open its own private file through a signed URL", async () => {
    const client = await signedInAs(fixture.ownerA!);
    const signed = must(await client.storage.from(bucket).createSignedUrl(fixture.assetA!.path, 60));
    const response = await fetch(signed.signedUrl);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("only for MSP A");
  });

  test("an MSP cannot see, sign or download another MSP's private file", async () => {
    const client = await signedInAs(fixture.ownerA!);

    const { data: rows } = await client.from("assets").select("id").eq("id", fixture.assetB!.id);
    expect(rows).toEqual([]);

    const signed = await client.storage.from(bucket).createSignedUrl(fixture.assetB!.path, 60);
    expect(signed.error).not.toBeNull();
    expect(signed.data).toBeNull();

    const download = await client.storage.from(bucket).download(fixture.assetB!.path);
    expect(download.error).not.toBeNull();
  });

  test("a signed URL stops working once it expires", async () => {
    const client = await signedInAs(fixture.ownerA!);
    const signed = must(await client.storage.from(bucket).createSignedUrl(fixture.assetA!.path, 1));
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const response = await fetch(signed.signedUrl);
    expect(response.ok).toBe(false);
  });

  test("the portal's file route serves only files the signed-in MSP may open", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Work email").fill(fixture.ownerA!.email);
    await page.getByLabel(/^Password/).fill(fixture.ownerA!.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/cohort$/);

    const own = await page.request.get(`/api/assets/${fixture.assetA!.id}`, { maxRedirects: 0 });
    expect(own.status()).toBe(307);
    expect(own.headers().location).toContain(`/object/sign/${bucket}/`);

    const foreign = await page.request.get(`/api/assets/${fixture.assetB!.id}`, { maxRedirects: 0 });
    expect(foreign.status()).toBe(404);
  });
});
