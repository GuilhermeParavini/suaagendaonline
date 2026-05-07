"use client";

import ChecklistOnboarding from "./ChecklistOnboarding";
import type { ProgressoOnboarding } from "@/actions/onboarding";

interface ChecklistOnboardingWrapperProps {
  progresso: ProgressoOnboarding;
}

/**
 * Wrapper client-side: o ChecklistOnboarding precisa de localStorage e do
 * callback `onIniciarTour`. Aqui disparamos um evento global que o
 * `<TourGuiado>` (renderizado no layout) escuta para iniciar o tour.
 */
function ChecklistOnboardingWrapper({
  progresso,
}: ChecklistOnboardingWrapperProps) {
  const iniciarTour = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("sao:iniciar-tour"));
  };

  return (
    <ChecklistOnboarding progresso={progresso} onIniciarTour={iniciarTour} />
  );
}

export default ChecklistOnboardingWrapper;
