"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { type AssetAttachment, type FileAssetDetails, uploadFileAsset } from "@/lib/upload-asset";

type Scope = "program" | "cohort" | "msp";
type UploadOption = { id: string; label: string };
type AttachmentOption = UploadOption & { cohortId?: string; mspId?: string; type: "program_week" | "program_task" | "cohort_week" | "cohort_task" };

type AssetUploadFormProps = {
  cohorts: UploadOption[];
  msps: Array<UploadOption & { cohortId: string }>;
  programs: UploadOption[];
  attachments: AttachmentOption[];
};

const fieldClass = "min-h-12 w-full rounded-md border border-line bg-white px-4 text-base font-normal shadow-sm focus:border-evergreen focus:outline-none";

export function AssetUploadForm({ attachments, cohorts, msps, programs }: AssetUploadFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [scope, setScope] = useState<Scope>("program");
  const [scopeId, setScopeId] = useState(programs[0]?.id ?? "");
  const [kind, setKind] = useState<"file" | "link">("file");
  const [pending, setPending] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const scopeOptions = scope === "program" ? programs : scope === "cohort" ? cohorts : msps;
  const selectedMsp = scope === "msp" ? msps.find((msp) => msp.id === scopeId) : undefined;
  const attachmentOptions = useMemo(() => attachments.filter((attachment) => {
    if (scope === "program") return attachment.type.startsWith("program_");
    if (scope === "cohort") return attachment.cohortId === scopeId && attachment.type.startsWith("cohort_");
    return attachment.cohortId === selectedMsp?.cohortId && (!attachment.mspId || attachment.mspId === scopeId) && attachment.type.startsWith("cohort_");
  }), [attachments, scope, scopeId, selectedMsp?.cohortId]);

  function changeScope(nextScope: Scope) {
    setScope(nextScope);
    const options = nextScope === "program" ? programs : nextScope === "cohort" ? cohorts : msps;
    setScopeId(options[0]?.id ?? "");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setUploadPercent(0);
    setMessage(null);
    const formData = new FormData(event.currentTarget);
    const attachmentValue = String(formData.get("attachment") ?? "");
    const [attachmentType, attachmentId] = attachmentValue.split(":");
    const file = formData.get("file");

    try {
      const attachment: AssetAttachment = attachmentType && attachmentId
        ? { id: attachmentId, type: attachmentType as NonNullable<AssetAttachment>["type"] }
        : null;
      const category = String(formData.get("category")) as FileAssetDetails["category"];
      const title = String(formData.get("title") ?? "");

      if (kind === "file") {
        if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload.");
        await uploadFileAsset({ attachment, category, scope, scopeId, title }, file, setUploadPercent);
      } else {
        const response = await fetch("/api/admin/assets", {
          body: JSON.stringify({ attachment, category, externalUrl: formData.get("externalUrl"), kind, scope, scopeId, title }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "The asset could not be created.");
      }

      formRef.current?.reset();
      setKind("file");
      setMessage({ type: "success", text: "Asset added to the library." });
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "The asset could not be created." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit} ref={formRef}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Title</span>
          <input className={fieldClass} name="title" required />
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Category</span>
          <select className={fieldClass} name="category" defaultValue="documentation">
            <option value="documentation">Documentation</option>
            <option value="marketing_asset">Marketing asset</option>
            <option value="transcript">Transcript</option>
            <option value="recording">Recording</option>
            <option value="link">Link</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Resource type</span>
          <select className={fieldClass} name="kind" onChange={(event) => setKind(event.target.value as "file" | "link")} value={kind}>
            <option value="file">File</option>
            <option value="link">External link</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Who can see it</span>
          <select className={fieldClass} name="scope" onChange={(event) => changeScope(event.target.value as Scope)} value={scope}>
            <option value="program">Every MSP</option>
            <option value="cohort">One cohort</option>
            <option value="msp">One MSP</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>{scope === "program" ? "Program" : scope === "cohort" ? "Cohort" : "MSP"}</span>
          <select className={fieldClass} name="scopeId" onChange={(event) => setScopeId(event.target.value)} required value={scopeId}>
            {scopeOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Attach to <span className="font-normal text-muted">(optional)</span></span>
          <select className={fieldClass} name="attachment" defaultValue="">
            <option value="">General library</option>
            {attachmentOptions.map((option) => <option value={`${option.type}:${option.id}`} key={`${option.type}:${option.id}`}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {kind === "file" ? (
        <label className="block space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>File</span>
          <input className="block min-h-12 w-full rounded-md border border-dashed border-line bg-white px-4 py-3 text-sm" name="file" type="file" required />
        </label>
      ) : (
        <label className="block space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Full URL</span>
          <input className={fieldClass} name="externalUrl" type="url" placeholder="https://…" required />
        </label>
      )}

      <button className="min-h-12 rounded-md bg-evergreen px-5 font-semibold text-white hover:bg-dark-evergreen disabled:opacity-50" disabled={pending || !scopeId} type="submit">
        {pending ? (kind === "file" ? `Uploading… ${uploadPercent}%` : "Adding…") : kind === "file" ? "Upload to library" : "Add link"}
      </button>
      {pending && kind === "file" ? <div aria-label={`Upload ${uploadPercent}% complete`} className="h-2 overflow-hidden rounded-full bg-sage"><div className="h-full rounded-full bg-evergreen transition-[width]" style={{ width: `${uploadPercent}%` }} /></div> : null}
      {message ? <p className={`rounded-md px-4 py-3 text-sm ${message.type === "success" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`} role="status">{message.text}</p> : null}
    </form>
  );
}
