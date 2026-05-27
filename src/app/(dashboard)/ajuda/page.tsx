import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AjudaClient from "@/components/ajuda/AjudaClient";

export const metadata = { title: "Ajuda" };
export const dynamic = "force-dynamic";

export default async function AjudaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <AjudaClient />;
}
