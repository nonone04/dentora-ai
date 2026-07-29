import Link from "next/link";
import { CsvImportWizard } from "@/components/import/csv-import-wizard";
import { NewPatientDialog } from "@/components/patients/new-patient-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getServerDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function PatientsPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const supabase = await createClient();

  const [{ data: patients }, t] = await Promise.all([
    supabase
      .from("patients")
      .select("id, full_name, phone, email, preferred_language")
      .eq("clinic_id", clinicId)
      .order("full_name"),
    getServerDictionary(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t.patients.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.patients.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvImportWizard clinicId={clinicId} entity="patients" />
          <NewPatientDialog clinicId={clinicId} />
        </div>
      </div>

      {!patients || patients.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.patients.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.patients.name}</TableHead>
              <TableHead>{t.patients.phone}</TableHead>
              <TableHead>{t.patients.email}</TableHead>
              <TableHead>{t.patients.language}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map((patient) => (
              <TableRow key={patient.id}>
                <TableCell>
                  <Link
                    href={`/clinic/${clinicId}/patients/${patient.id}`}
                    className="font-medium hover:underline"
                  >
                    {patient.full_name}
                  </Link>
                </TableCell>
                <TableCell>{patient.phone ?? t.common.dash}</TableCell>
                <TableCell>{patient.email ?? t.common.dash}</TableCell>
                <TableCell className="uppercase">{patient.preferred_language}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
