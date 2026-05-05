import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getConvitePorToken } from "@/actions/convites";
import ConviteFlow from "@/components/convite/ConviteFlow";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ConvitePage({ params }: PageProps) {
  const { token } = await params;
  if (!token || !/^[a-zA-Z0-9]+$/.test(token)) notFound();

  const result = await getConvitePorToken(token);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = (user?.email ?? "").trim().toLowerCase();

  if (!result.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {result.error}
      </div>
    );
  }

  return (
    <ConviteFlow
      token={token}
      convite={result.data}
      userEmail={userEmail || null}
    />
  );
}
