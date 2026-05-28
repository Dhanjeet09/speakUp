import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import Levels from "@/components/landing/Levels";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "SpeakUp – Practice English Speaking with Real People",
  description:
    "Practice English speaking with real people face-to-face. Find a partner, video call, and improve your fluency.",
  openGraph: {
    title: "SpeakUp – Practice English Speaking with Real People",
    description:
      "Practice English speaking with real people face-to-face. Find a partner, video call, and improve your fluency.",
    type: "website",
    siteName: "SpeakUp",
  },
};

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <HowItWorks />
        <Features />
        <Levels />
      </main>
      <Footer />
    </>
  );
}
