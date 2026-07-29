import type { Metadata } from "next";
import { DemoContent } from "@/components/marketing/demo-content";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";

export const metadata: Metadata = {
  title: "Interactive Demo -- Dentora AI",
  description: "Explore Dentora AI with realistic sample clinic data -- no signup required.",
};

export default function DemoPage() {
  return (
    <>
      <MarketingHeader />
      <DemoContent />
      <MarketingFooter />
    </>
  );
}
