import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HeroSection from "@/components/landing/HeroSection";
import PainPoints from "@/components/landing/PainPoints";
import Features from "@/components/landing/Features";
import AIHighlight from "@/components/landing/AIHighlight";
import Pricing from "@/components/landing/Pricing";
import Comparison from "@/components/landing/Comparison";
import Specialties from "@/components/landing/Specialties";
import HowItWorks from "@/components/landing/HowItWorks";
import Testimonials from "@/components/landing/Testimonials";
import FinalCTA from "@/components/landing/FinalCTA";
import LandingFooter from "@/components/landing/LandingFooter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:
    "Agenda4U - Sistema de Agendamento com IA para Profissionais da Saúde",
  description:
    "Agenda online, prontuário, anamnese e transcrição por IA. A partir de R$ 29,90/mês. 14 dias grátis.",
  openGraph: {
    title:
      "Agenda4U - Sistema de Agendamento com IA para Profissionais da Saúde",
    description:
      "Agenda online, prontuário, anamnese e transcrição por IA. A partir de R$ 29,90/mês. 14 dias grátis.",
    type: "website",
    url: "https://appagenda4u.com",
    siteName: "Agenda4U",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agenda4U - IA inclusa para profissionais da saúde",
    description:
      "Agenda, prontuário, transcrição por IA. A partir de R$ 29,90/mês. 14 dias grátis.",
  },
};

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/inicio");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 [scroll-behavior:smooth]">
      <HeroSection />
      <PainPoints />
      <Features />
      <AIHighlight />
      <Pricing />
      <Comparison />
      <Specialties />
      <HowItWorks />
      <Testimonials />
      <FinalCTA />
      <LandingFooter />
    </main>
  );
}
