import { Suspense } from "react";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import SemaforoSection from "@/components/landing/SemaforoSection";
import Pricing from "@/components/landing/Pricing";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import PwaLaunchRedirect from "@/components/pwa/PwaLaunchRedirect";

export default function LandingPage() {
  return (
    <>
      <Suspense fallback={null}>
        <PwaLaunchRedirect />
      </Suspense>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <SemaforoSection />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
