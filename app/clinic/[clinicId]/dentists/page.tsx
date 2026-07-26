import Link from "next/link";
import { NewDentistDialog } from "@/components/dentists/new-dentist-dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const { data: dentists } = await supabase
    .from("dentists")
    .select("id, full_name, specialty, is_active")
    .eq("clinic_id", clinicId)
    .order("full_name");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Dentists</h1>
          <p className="mt-1 text-sm text-muted-foreground">Dentists practicing at this clinic.</p>
        </div>
        {canManage && <NewDentistDialog clinicId={clinicId} />}
      </div>

      {!dentists || dentists.length === 0 ? (
        <p className="text-sm text-muted-foreground">No dentists yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead>Status</TableHead>
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
                <TableCell>{dentist.specialty ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={dentist.is_active ? "secondary" : "outline"}>
                    {dentist.is_active ? "Active" : "Inactive"}
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
