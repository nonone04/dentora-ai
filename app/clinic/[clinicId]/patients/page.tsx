import Link from "next/link";
import { NewPatientDialog } from "@/components/patients/new-patient-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

export default async function PatientsPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const supabase = await createClient();

  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, phone, email, preferred_language")
    .eq("clinic_id", clinicId)
    .order("full_name");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Patients</h1>
          <p className="mt-1 text-sm text-muted-foreground">Patients registered at this clinic.</p>
        </div>
        <NewPatientDialog clinicId={clinicId} />
      </div>

      {!patients || patients.length === 0 ? (
        <p className="text-sm text-muted-foreground">No patients yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Language</TableHead>
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
                <TableCell>{patient.phone ?? "—"}</TableCell>
                <TableCell>{patient.email ?? "—"}</TableCell>
                <TableCell className="uppercase">{patient.preferred_language}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
