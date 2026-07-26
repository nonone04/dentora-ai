import { signOut } from "@/app/actions/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ClinicRole } from "@/lib/supabase/clinic";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ClinicHeader({
  clinicName,
  role,
  userDisplayName,
}: {
  clinicName: string;
  role: ClinicRole;
  userDisplayName: string;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-2">
        <span className="font-medium">{clinicName}</span>
        <Badge variant="secondary" className="capitalize">
          {role}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarFallback>{initials(userDisplayName)}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">{userDisplayName}</span>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
