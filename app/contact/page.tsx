import type { Metadata } from "next";
import { ContactContent } from "@/components/marketing/contact-content";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { getMarketingNavState } from "@/lib/supabase/post-auth-destination";

export const metadata: Metadata = {
  title: "Contact Sales -- Dentora AI",
  description: "Tell us about your clinic -- request a quote, ask about Enterprise, or schedule a demo with our team.",
};

export default async function ContactPage() {
  const navState = await getMarketingNavState();
  return (
    <>
      <MarketingHeader navState={navState} />
      <ContactContent />
      <MarketingFooter navState={navState} />
    </>
  );
}
