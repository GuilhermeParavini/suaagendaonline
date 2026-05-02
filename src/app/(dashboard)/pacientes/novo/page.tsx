import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NovoPacienteForm from "@/components/pacientes/NovoPacienteForm";

export const dynamic = "force-dynamic";

export default async function NovoPacientePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <NovoPacienteForm />;
}
