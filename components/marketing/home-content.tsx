import { FaqSection } from "@/components/marketing/sections/faq-section";
import { FinalCtaSection } from "@/components/marketing/sections/final-cta-section";
import { HeroSection } from "@/components/marketing/sections/hero-section";
import { HowItWorksSection } from "@/components/marketing/sections/how-it-works-section";
import { PricingPreviewSection } from "@/components/marketing/sections/pricing-preview-section";
import { ShowcaseSections } from "@/components/marketing/sections/showcase-sections";
import { TestimonialsSection } from "@/components/marketing/sections/testimonials-section";
import { TrustBarSection } from "@/components/marketing/sections/trust-bar-section";
import { SectionDivider } from "@/components/marketing/motion/section-divider";

export function MarketingHomeContent() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <TrustBarSection />
      <ShowcaseSections />
      <SectionDivider />
      <HowItWorksSection />
      <SectionDivider />
      <TestimonialsSection />
      <SectionDivider />
      <PricingPreviewSection />
      <SectionDivider />
      <FaqSection />
      <FinalCtaSection />
    </div>
  );
}
