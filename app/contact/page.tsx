import type { Metadata } from "next";
import { ContactContent } from "@/components/marketing/contact-content";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { isContactInquiryType } from "@/lib/marketing/contact";
import { getMarketingNavState } from "@/lib/supabase/post-auth-destination";

export const metadata: Metadata = {
  title: "Contact Dentora",
  description: "Get in touch with Dentora -- ask a question, request a quote, ask about Enterprise, or schedule a demo with our team.",
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const [navState, { type }] = await Promise.all([getMarketingNavState(), searchParams]);
  const defaultInquiryType = isContactInquiryType(type) ? type : "general";

  return (
    <>
      <MarketingHeader navState={navState} />
      <ContactContent key={defaultInquiryType} defaultInquiryType={defaultInquiryType} />
      <MarketingFooter navState={navState} />
    </>
  );
}
