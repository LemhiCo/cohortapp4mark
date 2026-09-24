import { readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

const [, , manifestArgument, filesArgument] = process.argv;
if (!manifestArgument) {
  console.error("Usage: node scripts/upload-starter-assets.mjs <manifest.json> [files-directory]");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !secretKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
  process.exit(1);
}

const manifestPath = resolve(manifestArgument);
const filesDirectory = resolve(filesArgument ?? dirname(manifestPath));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const validCategories = new Set(["documentation", "marketing_asset", "transcript", "recording", "link"]);

if (!manifest.programId || !Array.isArray(manifest.assets) || manifest.assets.length !== 19) {
  console.error("The manifest must include programId and exactly 19 assets.");
  process.exit(1);
}

const mimeTypes = {
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
};

function safeFileName(fileName) {
  const normalized = basename(fileName).normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return normalized.replace(/^[-.]+|[-.]+$/g, "") || "file";
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: program, error: programError } = await supabase
  .from("programs")
  .select("id, name")
  .eq("id", manifest.programId)
  .single();
if (programError || !program) {
  console.error("The target program does not exist.");
  process.exit(1);
}

for (const [index, asset] of manifest.assets.entries()) {
  if (!asset.title || !asset.file || !validCategories.has(asset.category)) {
    console.error(`Asset ${index + 1} needs title, file, and a valid category.`);
    process.exit(1);
  }

  const filePath = resolve(filesDirectory, asset.file);
  const fileStats = await stat(filePath);
  const fileName = safeFileName(asset.file);
  const storagePath = `program/${program.id}/starter/${fileName}`;
  const mimeType = asset.mimeType ?? mimeTypes[extname(fileName).toLowerCase()] ?? "application/octet-stream";
  const { data: existing } = await supabase.from("assets").select("id").eq("storage_path", storagePath).maybeSingle();
  const assetId = existing?.id ?? crypto.randomUUID();

  const { error: metadataError } = await supabase.from("assets").upsert({
    category: asset.category,
    id: assetId,
    kind: "file",
    mime_type: mimeType,
    program_id: program.id,
    scope: "program",
    size_bytes: fileStats.size,
    status: "pending",
    storage_path: storagePath,
    title: asset.title,
  }, { onConflict: "storage_path" });
  if (metadataError) throw metadataError;

  const file = new Uint8Array(await readFile(filePath));
  const { error: uploadError } = await supabase.storage.from("portal-assets").upload(storagePath, file, {
    contentType: mimeType,
    upsert: true,
  });
  if (uploadError) {
    await supabase.from("assets").update({ status: "failed" }).eq("id", assetId);
    throw uploadError;
  }

  const { error: readyError } = await supabase.from("assets").update({ status: "ready" }).eq("id", assetId);
  if (readyError) throw readyError;
  console.log(`[${index + 1}/19] ${asset.title}`);
}

console.log(`Uploaded 19 starter assets to ${program.name}.`);
