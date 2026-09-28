"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createOneOnOneSession } from "@/app/admin/recordings/actions";
import { type AssetAttachment, uploadFileAsset } from "@/lib/upload-asset";

export type GroupSessionOption = {
  cohortId: string;
  cohortWeekId: string | null;
  id: string;
  label: string;
  title: string;
};

export type PackageMspOption = {
  id: string;
  label: string;
  name: string;
};

type SessionPackageFormProps = {
  defaultSessionId: string;
  groupSessions: GroupSessionOption[];
  msps: PackageMspOption[];
};

const fieldClass = "min-h-12 w-full rounded-md border border-line bg-white px-4 text-base font-normal shadow-sm focus:border-evergreen focus:outline-none";
const labelClass = "block space-y-2 text-sm font-semibold text-dark-evergreen";

function callLabel(localStartsAt: string) {
  const [date, time] = localStartsAt.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(year, month - 1, day, hour, minute));
}

export function SessionPackageForm({ defaultSessionId, groupSessions, msps }: SessionPackageFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<"group" | "one_on_one">(groupSessions.length ? "group" : "one_on_one");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setProgress({});
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const recording = formData.get("recording");
    const transcript = formData.get("transcript");
    const summary = String(formData.get("summary") ?? "").trim();
    const actionItems = String(formData.get("actionItems") ?? "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const files = [
      { category: "recording" as const, file: recording, label: "Recording" },
      { category: "transcript" as const, file: transcript, label: "Transcript" },
    ].filter((entry): entry is { category: "recording" | "transcript"; file: File; label: string } => entry.file instanceof File && entry.file.size > 0);

    const uploaded: string[] = [];
    let current = "";
    try {
      if (!files.length) throw new Error("Add the recording, the transcript, or both.");

      let scope: "cohort" | "msp";
      let scopeId: string;
      let sessionId: string;
      let attachment: AssetAttachment = null;
      let baseTitle: string;

      if (mode === "group") {
        const session = groupSessions.find((option) => option.id === formData.get("sessionId"));
        if (!session) throw new Error("Choose the group session.");
        scope = "cohort";
        scopeId = session.cohortId;
        sessionId = session.id;
        attachment = session.cohortWeekId ? { id: session.cohortWeekId, type: "cohort_week" } : null;
        baseTitle = session.title;
      } else {
        const msp = msps.find((option) => option.id === formData.get("mspId"));
        const localStartsAt = String(formData.get("localStartsAt") ?? "");
        if (!msp || !localStartsAt) throw new Error("Choose the MSP and the call’s date and time.");
        baseTitle = `1:1 with ${msp.name} · ${callLabel(localStartsAt)}`;
        const created = await createOneOnOneSession({ localStartsAt, mspId: msp.id, title: baseTitle });
        if (!created.sessionId) throw new Error(created.error ?? "The 1:1 session could not be created.");
        scope = "msp";
        scopeId = msp.id;
        sessionId = created.sessionId;
      }

      for (const [index, entry] of files.entries()) {
        current = entry.label;
        await uploadFileAsset(
          {
            // The summary and action items live on the first file, normally the
            // recording, which MSPs open as the session's main page.
            actionItems: index === 0 && actionItems.length ? actionItems : undefined,
            attachment,
            category: entry.category,
            scope,
            scopeId,
            sessionId,
            summary: index === 0 && summary ? summary : undefined,
            title: `${baseTitle} · ${entry.label}`,
          },
          entry.file,
          (percent) => setProgress((previous) => ({ ...previous, [entry.label]: percent })),
        );
        uploaded.push(entry.label);
      }

      formRef.current?.reset();
      setMessage({
        type: "success",
        text: mode === "group"
          ? "Session package uploaded. Every MSP in the cohort can see it now."
          : "Session package uploaded. Only that MSP can see it.",
      });
      router.refresh();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "The upload failed.";
      const done = uploaded.length ? `${uploaded.join(" and ")} uploaded. ` : "";
      setMessage({ type: "error", text: current ? `${done}${current} failed: ${reason}` : reason });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit} ref={formRef}>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-dark-evergreen">Which session?</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-4">
            <input checked={mode === "group"} disabled={!groupSessions.length} name="mode" onChange={() => setMode("group")} type="radio" value="group" />
            Group session
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-4">
            <input checked={mode === "one_on_one"} disabled={!msps.length} name="mode" onChange={() => setMode("one_on_one")} type="radio" value="one_on_one" />
            1:1 with an MSP
          </label>
        </div>
      </fieldset>

      {mode === "group" ? (
        <label className={labelClass}>
          <span>Group session <span className="font-normal text-muted">(shared with every MSP in its cohort)</span></span>
          <select className={fieldClass} defaultValue={defaultSessionId} name="sessionId" required>
            {groupSessions.map((session) => <option key={session.id} value={session.id}>{session.label}</option>)}
          </select>
        </label>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            <span>MSP <span className="font-normal text-muted">(only this MSP will see it)</span></span>
            <select className={fieldClass} name="mspId" required>
              {msps.map((msp) => <option key={msp.id} value={msp.id}>{msp.label}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            <span>Call date &amp; time <span className="font-normal text-muted">(the cohort’s time zone)</span></span>
            <input className={fieldClass} name="localStartsAt" required type="datetime-local" />
          </label>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          <span>Recording</span>
          <input accept="video/*,audio/*" className="block min-h-12 w-full rounded-md border border-dashed border-line bg-white px-4 py-3 text-sm" name="recording" type="file" />
        </label>
        <label className={labelClass}>
          <span>Transcript</span>
          <input className="block min-h-12 w-full rounded-md border border-dashed border-line bg-white px-4 py-3 text-sm" name="transcript" type="file" />
        </label>
      </div>

      <label className={labelClass}>
        <span>Summary <span className="font-normal text-muted">(optional)</span></span>
        <textarea className={`${fieldClass} min-h-28 py-3`} maxLength={5000} name="summary" placeholder="What the session covered and decided." />
      </label>
      <label className={labelClass}>
        <span>Action items <span className="font-normal text-muted">(optional, one per line)</span></span>
        <textarea className={`${fieldClass} min-h-24 py-3`} name="actionItems" placeholder={"Finish tenant setup\nBring the target account list to Week 2"} />
      </label>

      <button
        className="flex min-h-12 w-full items-center justify-center rounded-md bg-evergreen px-5 text-base font-semibold text-white transition hover:bg-dark-evergreen disabled:cursor-wait disabled:opacity-65"
        disabled={pending}
        type="submit"
      >
        {pending ? "Uploading…" : "Upload session package"}
      </button>

      {Object.entries(progress).map(([label, percent]) => (
        <div className="space-y-1" key={label}>
          <p className="text-sm font-semibold text-dark-evergreen">{label} · {percent}%</p>
          <div aria-label={`${label} ${percent}% uploaded`} className="h-2 overflow-hidden rounded-full bg-sage" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-evergreen transition-[width]" style={{ width: `${percent}%` }} />
          </div>
        </div>
      ))}

      {message ? (
        <p className={`rounded-md px-4 py-3 text-sm leading-6 ${message.type === "success" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`} role="status">
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
