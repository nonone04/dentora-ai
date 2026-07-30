"use client";

import { useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * Drag-and-drop logo upload for the single-page clinic-creation form. Owns
 * only the drop/click/validate mechanics -- the resulting File and its
 * object URL live in the parent (CreateClinicForm) so the same preview can
 * also drive the separate "live preview" identity card, and so the real
 * <input type="file" name="logo"> stays part of the form's FormData on
 * submit (a plain onChange handler wouldn't see files delivered via drop).
 */
export function LogoUploadField({
  label,
  helper,
  dragHint,
  changeLabel,
  removeLabel,
  invalidTypeMessage,
  tooLargeMessage,
  previewUrl,
  fileName,
  onFileSelect,
}: {
  label: string;
  helper: string;
  dragHint: string;
  changeLabel: string;
  removeLabel: string;
  invalidTypeMessage: string;
  tooLargeMessage: string;
  previewUrl: string | null;
  fileName: string | null;
  onFileSelect: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function acceptFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(invalidTypeMessage);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(tooLargeMessage);
      return;
    }
    setError(null);
    onFileSelect(file);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    if (inputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      inputRef.current.files = transfer.files;
    }
    acceptFile(file);
  }

  function handleRemove(event: React.MouseEvent) {
    event.stopPropagation();
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onFileSelect(null);
  }

  function openPicker() {
    inputRef.current?.click();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="logo" className="text-sm font-medium text-white/90">
        {label}
      </label>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={openPicker}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker();
          }
        }}
        className={cn(
          "group relative flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-4 transition-colors hover:border-blue-400/40 hover:bg-white/[0.05]",
          dragActive && "border-blue-400/60 bg-blue-400/[0.08]",
        )}
      >
        <input
          ref={inputRef}
          id="logo"
          type="file"
          name="logo"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) acceptFile(file);
          }}
        />

        <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URL preview, next/image needs a remote loader it doesn't have
            <img src={previewUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-6 text-white/30" aria-hidden="true" />
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80">
            <Upload className="size-3.5 text-white/40" aria-hidden="true" />
            {fileName ?? dragHint}
          </span>
          <span className="truncate text-xs text-white/40">{fileName ? changeLabel : helper}</span>
        </div>

        {previewUrl && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-white/50 hover:bg-white/10 hover:text-white"
            onClick={handleRemove}
            aria-label={removeLabel}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
