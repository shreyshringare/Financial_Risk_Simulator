import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import StatStrip from "@/components/landing/StatStrip";
import FeatureGrid from "@/components/landing/FeatureGrid";
import HowItWorks from "@/components/landing/HowItWorks";
import TechStrip from "@/components/landing/TechStrip";
import CTABanner from "@/components/landing/CTABanner";
import Footer from "@/components/landing/Footer";

export default function Landing() {
  return (
    <div className="landing">
      <Nav />
      <Hero />
      <StatStrip />
      <FeatureGrid />
      <HowItWorks />
      <TechStrip />
      <CTABanner />
      <Footer />
    </div>
  );
}
