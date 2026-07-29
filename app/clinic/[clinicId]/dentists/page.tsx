import Link from "next/link";
import { NewDentistDialog } from "@/components/dentists/new-dentist-dialog";
import { CsvImportWizard } from "@/components/import/csv-import-wizard";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getServerDictionary } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

export default async function DentistsPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const user = await requireUser();
  const membership = await requireClinicMembership(clinicId, user.id);
  const canManage = membership.role === "owner" || membership.role === "admin";

  const supabase = await createClient();
  const [{ data: dentists }, t] = await Promise.all([
    supabase.from("dentists").select("id, full_name, specialty, is_active").eq("clinic_id", clinicId).order("full_name"),
    getServerDictionary(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t.dentists.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.dentists.description}</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <CsvImportWizard clinicId={clinicId} entity="dentists" />
            <NewDentistDialog clinicId={clinicId} />
          </div>
        )}
      </div>

      {!dentists || dentists.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.dentists.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.dentists.name}</TableHead>
              <TableHead>{t.dentists.specialty}</TableHead>
              <TableHead>{t.dentists.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dentists.map((dentist) => (
              <TableRow key={dentist.id}>
                <TableCell>
                  <Link
                    href={`/clinic/${clinicId}/dentists/${dentist.id}`}
                    className="font-medium hover:underline"
                  >
                    {dentist.full_name}
                  </Link>
                </TableCell>
                <TableCell>{dentist.specialty ?? t.common.dash}</TableCell>
                <TableCell>
                  <Badge variant={dentist.is_active ? "secondary" : "outline"}>
                    {dentist.is_active ? t.common.active : t.common.inactive}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
