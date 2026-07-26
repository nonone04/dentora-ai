export function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}
