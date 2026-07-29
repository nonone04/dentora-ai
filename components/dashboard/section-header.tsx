import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Consistent title/description/optional-link header for every dashboard widget card. */
export function SectionHeader({
  title,
  description,
  href,
  hrefLabel,
}: {
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <CardHeader className="border-b">
      <CardTitle>{title}</CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
      {href && (
        <CardAction>
          <Link
            href={href}
            className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {hrefLabel}
            <ArrowRight className="size-3 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </CardAction>
      )}
    </CardHeader>
  );
}
