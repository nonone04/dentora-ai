"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadIcon } from "lucide-react";
import { importDentistsAction, importPatientsAction, importServicesAction, type ImportResult } from "@/app/actions/import";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { parseCsv, toCsvTable } from "@/lib/import/csv";
import {
  buildTemplateCsv,
  IMPORT_FIELDS,
  validateDentistRow,
  validatePatientRow,
  validateServiceRow,
  type ImportEntity,
  type RowValidationError,
} from "@/lib/import/schemas";
import { interpolate, useTranslations } from "@/lib/i18n";

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

type Step = "upload" | "map" | "preview" | "results";

type ValidatedRow = { raw: Record<string, string>; ok: boolean; errors: RowValidationError[] };

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function autoMap(headers: string[], fieldKeys: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    const match = fieldKeys.find((key) => normalizeHeader(key) === normalized);
    if (match) mapping[index] = match;
  });
  return mapping;
}

function validateRow(entity: ImportEntity, raw: Record<string, string>): { ok: boolean; errors: RowValidationError[] } {
  const result =
    entity === "patients" ? validatePatientRow(raw) : entity === "dentists" ? validateDentistRow(raw) : validateServiceRow(raw);
  return result.ok ? { ok: true, errors: [] } : { ok: false, errors: result.errors };
}

function runImportAction(entity: ImportEntity, clinicId: string, rows: Record<string, string>[]): Promise<ImportResult> {
  if (entity === "patients") return importPatientsAction(clinicId, rows);
  if (entity === "dentists") return importDentistsAction(clinicId, rows);
  return importServicesAction(clinicId, rows);
}

export function CsvImportWizard({ clinicId, entity }: { clinicId: string; entity: ImportEntity }) {
  const t = useTranslations();
  const router = useRouter();
  const fields = IMPORT_FIELDS[entity];

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [pasteText, setPasteText] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setStep("upload");
    setPasteText("");
    setUploadError(null);
    setHeaders([]);
    setDataRows([]);
    setMapping({});
    setImporting(false);
    setResult(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      const didImport = result !== null && result.imported > 0;
      reset();
      if (didImport) router.refresh();
    }
  }

  async function handleFile(file: File) {
    const text = await file.text();
    loadCsvText(text);
  }

  function loadCsvText(text: string) {
    const parsed = parseCsv(text);
    const table = toCsvTable(parsed);
    if (table.headers.length === 0 || table.rows.length === 0) {
      setUploadError(t.import.upload.parseError);
      return;
    }
    setUploadError(null);
    setHeaders(table.headers);
    setDataRows(table.rows);
    setMapping(autoMap(table.headers, fields.map((f) => f.key)));
    setStep("map");
  }

  function handleUploadContinue() {
    if (pasteText.trim()) {
      loadCsvText(pasteText);
      return;
    }
    setUploadError(t.import.upload.emptyError);
  }

  function mappedRows(): Record<string, string>[] {
    return dataRows.map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((_, colIndex) => {
        const fieldKey = mapping[colIndex];
        if (fieldKey) record[fieldKey] = row[colIndex] ?? "";
      });
      return record;
    });
  }

  const validatedRows: ValidatedRow[] = useMemo(() => {
    if (step !== "preview" && step !== "results") return [];
    return dataRows
      .map((row) => {
        const raw: Record<string, string> = {};
        headers.forEach((_, colIndex) => {
          const fieldKey = mapping[colIndex];
          if (fieldKey) raw[fieldKey] = row[colIndex] ?? "";
        });
        return raw;
      })
      .map((raw) => {
        const { ok, errors } = validateRow(entity, raw);
        return { raw, ok, errors };
      });
  }, [step, dataRows, mapping, headers, entity]);

  const readyCount = validatedRows.filter((r) => r.ok).length;
  const invalidCount = validatedRows.length - readyCount;

  function handleMapContinue() {
    const requiredKeys = fields.filter((f) => f.required).map((f) => f.key);
    const mappedKeys = new Set(Object.values(mapping));
    const missing = requiredKeys.some((key) => !mappedKeys.has(key));
    if (missing) {
      setUploadError(t.import.map.missingRequired);
      return;
    }
    setUploadError(null);
    setStep("preview");
  }

  async function handleImport() {
    setImporting(true);
    const rows = mappedRows();
    const outcome = await runImportAction(entity, clinicId, rows);
    setResult(outcome);
    setImporting(false);
    setStep("results");
  }

  function downloadTemplate() {
    const csv = buildTemplateCsv(entity);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${entity}-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" className="gap-1.5" />}>
        <UploadIcon className="size-4" aria-hidden="true" />
        {t.import.button}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{interpolate(t.import.title, { entity: t.import.entities[entity] })}</DialogTitle>
          <DialogDescription>
            {step === "upload" && t.import.upload.description}
            {step === "map" && t.import.map.description}
            {step === "preview" && t.import.preview.description}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t.import.upload.fileLabel}</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                className="text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t.import.upload.pasteLabel}</label>
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={t.import.upload.pastePlaceholder}
                rows={6}
                dir="ltr"
                className="font-mono text-xs"
              />
            </div>
            <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={downloadTemplate}>
              {t.import.upload.downloadTemplate}
            </Button>
            {uploadError && (
              <p role="alert" className="text-sm text-destructive">
                {uploadError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" onClick={handleUploadContinue}>
                {t.import.upload.continue}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "map" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              {headers.map((header, index) => (
                <div key={index} className="grid grid-cols-2 items-center gap-2">
                  <span className="truncate text-sm" title={header}>
                    {header}
                  </span>
                  <select
                    className={selectClass}
                    value={mapping[index] ?? ""}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [index]: e.target.value }))
                    }
                  >
                    <option value="">{t.import.map.unmapped}</option>
                    {fields.map((field) => (
                      <option key={field.key} value={field.key}>
                        {t.import.fields[field.key as keyof typeof t.import.fields]}
                        {field.required ? " *" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {uploadError && (
              <p role="alert" className="text-sm text-destructive">
                {uploadError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep("upload")}>
                {t.import.map.back}
              </Button>
              <Button type="button" onClick={handleMapContinue}>
                {t.import.map.continue}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{interpolate(t.import.preview.readyCount, { count: readyCount })}</Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive">{interpolate(t.import.preview.invalidCount, { count: invalidCount })}</Badge>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              <ul className="divide-y divide-border">
                {validatedRows.map((row, index) => (
                  <li key={index} className="flex items-start justify-between gap-2 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{interpolate(t.import.preview.row, { number: index + 1 })}</span>
                    <span className="min-w-0 flex-1 truncate text-end">
                      {Object.values(row.raw).filter(Boolean).slice(0, 3).join(" · ")}
                    </span>
                    {row.ok ? (
                      <Badge variant="secondary">OK</Badge>
                    ) : (
                      <Badge variant="destructive">
                        {row.errors.map((e) => t.import.fieldErrors[e.code]).join(", ")}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {readyCount === 0 && <p className="text-sm text-destructive">{t.import.preview.noneReady}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep("map")}>
                {t.import.preview.back}
              </Button>
              <Button type="button" onClick={handleImport} disabled={importing || readyCount === 0}>
                {importing ? t.import.preview.importing : interpolate(t.import.preview.import, { count: readyCount })}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "results" && result && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{interpolate(t.import.results.imported, { count: result.imported })}</Badge>
              {result.skipped > 0 && (
                <Badge variant="secondary">{interpolate(t.import.results.skipped, { count: result.skipped })}</Badge>
              )}
              {result.errors > 0 && (
                <Badge variant="destructive">{interpolate(t.import.results.errors, { count: result.errors })}</Badge>
              )}
            </div>
            {(result.skipped > 0 || result.errors > 0) && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                <ul className="divide-y divide-border">
                  {result.rows
                    .filter((r) => r.status !== "imported")
                    .map((r) => (
                      <li key={r.index} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">{interpolate(t.import.preview.row, { number: r.index + 1 })}</span>
                        <span>
                          {r.reason && r.reason in t.import.results.reasons
                            ? t.import.results.reasons[r.reason as keyof typeof t.import.results.reasons]
                            : r.reason}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                {t.import.results.done}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
