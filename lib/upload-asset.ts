import { Upload } from "tus-js-client";

import { getPublicSupabaseEnv } from "@/lib/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export type AssetAttachment = {
  id: string;
  type: "program_week" | "program_task" | "cohort_week" | "cohort_task";
} | null;

export type FileAssetDetails = {
  actionItems?: string[];
  attachment: AssetAttachment;
  category: "recording" | "transcript" | "documentation" | "marketing_asset" | "link";
  scope: "program" | "cohort" | "msp";
  scopeId: string;
  sessionId?: string;
  summary?: string;
  title: string;
};

function resumableEndpoint() {
  const { url } = getPublicSupabaseEnv();
  const parsed = new URL(url);
  if (parsed.hostname.endsWith(".supabase.co")) {
    const projectId = parsed.hostname.split(".")[0];
    return `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`;
  }
  return `${url.replace(/\/$/, "")}/storage/v1/upload/resumable`;
}

function uploadResumable(file: File, path: string, accessToken: string, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const { publishableKey } = getPublicSupabaseEnv();
    const upload = new Upload(file, {
      chunkSize: 6 * 1024 * 1024,
      endpoint: resumableEndpoint(),
      headers: { apikey: publishableKey, authorization: `Bearer ${accessToken}` },
      metadata: {
        bucketName: "portal-assets",
        cacheControl: "3600",
        contentType: file.type || "application/octet-stream",
        objectName: path,
      },
      onError: reject,
      onProgress(bytesUploaded, bytesTotal) {
        onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => resolve(),
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
    });

    // Each submit creates a new asset with its own path, so an earlier attempt
    // of the same file targets a different object. Resuming it would finish
    // the old object and leave this asset "ready" with no file behind it.
    void upload.findPreviousUploads().then((previousUploads) => {
      const samePath = previousUploads.find((previous) => previous.metadata.objectName === path);
      if (samePath) upload.resumeFromPreviousUpload(samePath);
      upload.start();
    }).catch(reject);
  });
}

async function setStatus(assetId: string, status: "ready" | "failed") {
  return fetch(`/api/admin/assets/${assetId}`, {
    body: JSON.stringify({ status }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
}

/**
 * Creates the asset record, uploads the file straight to private storage, and
 * marks it ready only once the server confirms the object exists. Throws with
 * a message to show the admin; a failed upload leaves the asset "failed".
 */
export async function uploadFileAsset(details: FileAssetDetails, file: File, onProgress: (percent: number) => void) {
  if (file.size === 0) throw new Error(`“${file.name}” is empty.`);

  const response = await fetch("/api/admin/assets", {
    body: JSON.stringify({
      ...details,
      fileName: file.name,
      kind: "file",
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "The asset could not be created.");

  try {
    const supabase = createBrowserSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Your session expired. Sign in and try again.");
    await uploadResumable(file, result.path, session.access_token, onProgress);
    const ready = await setStatus(result.assetId, "ready");
    if (!ready.ok) {
      const { error } = await ready.json().catch(() => ({ error: null }));
      throw new Error(error ?? "The file could not be finalized. Upload it again.");
    }
  } catch (uploadError) {
    await setStatus(result.assetId, "failed");
    throw uploadError;
  }

  return result.assetId as string;
}
