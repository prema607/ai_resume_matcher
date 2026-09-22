import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import { cx } from "@/lib/utils";
import { resumesApi, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { ResumeUploadResponse } from "@/lib/types";

interface UploadDropzoneProps {
  onUploaded: (resume: ResumeUploadResponse) => void;
}

export function UploadDropzone({ onUploaded }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") {
        notify("Only PDF files are accepted.", "error");
        return;
      }
      setUploading(true);
      setProgress(0);
      setFileName(file.name);
      try {
        // The backend parses, embeds, and stores the resume in one request
        // (see POST /api/v1/resumes) -- this can take a few seconds while
        // the LLM parse runs, so progress reflects the upload phase and a
        // spinner covers the processing phase after that.
        const resume = await resumesApi.upload(file, setProgress);
        notify(`${resume.candidate_name}'s resume was parsed and added.`);
        onUploaded(resume);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Upload failed. Please try again.";
        notify(message, "error");
      } finally {
        setUploading(false);
        setFileName(null);
        setProgress(0);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [notify, onUploaded]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
      className={cx(
        "relative flex flex-col items-center justify-center rounded-xl2 border-2 border-dashed px-6 py-10 text-center transition-colors",
        isDragging ? "border-signal bg-signal-50" : "border-line bg-surface",
        uploading && "pointer-events-none opacity-80"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {uploading ? (
        <>
          <Loader2 className="mb-3 h-7 w-7 animate-spin text-signal" />
          <p className="text-sm font-medium text-ink">
            {progress < 100 ? `Uploading “${fileName}”…` : "Parsing and embedding…"}
          </p>
          <div className="mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-signal transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-500">
            {progress < 100 ? `${progress}%` : "This can take a few seconds"}
          </p>
        </>
      ) : (
        <>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-signal-50 text-signal">
            <UploadCloud className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-ink">
            Drop a resume PDF here, or{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-signal underline underline-offset-2 hover:text-signal-600"
            >
              browse files
            </button>
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-500">
            <FileText className="h-3.5 w-3.5" /> PDF only, up to 10MB
          </p>
        </>
      )}
    </div>
  );
}
