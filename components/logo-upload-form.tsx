"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function LogoUploadForm({ hasLogo, mspId }: { hasLogo: boolean; mspId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(file: File) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/logos", {
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, mspId, sizeBytes: file.size }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The logo could not be uploaded.");

      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.storage.from("msp-logos").uploadToSignedUrl(result.path, result.token, file, { contentType: file.type });
      if (error) throw new Error("The logo upload failed.");

      const complete = await fetch("/api/admin/logos", {
        body: JSON.stringify({ mspId, path: result.path }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!complete.ok) throw new Error("The logo could not be saved.");
      setMessage("Logo saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The logo could not be uploaded.");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-3">
      <label className="inline-flex min-h-9 cursor-pointer items-center rounded-md border border-line px-3 text-sm font-semibold text-evergreen hover:border-evergreen">
        {pending ? "Uploading…" : hasLogo ? "Replace logo" : "Upload logo"}
        <input
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="sr-only"
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
          ref={inputRef}
          type="file"
        />
      </label>
      {message ? <p className="mt-2 text-xs text-muted" role="status">{message}</p> : null}
    </div>
  );
}
