import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClientForm from "../ClientForm";
import PurchasesSection from "../PurchasesSection";

export default async function EditClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; perror?: string; pmessage?: string }>;
}) {
  const { id } = await params;
  const { error, perror, pmessage } = await searchParams;
  const supabase = await createClient();

  const [{ data: client }, { data: purchases }, { data: codes }] = await Promise.all([
    supabase.from("clients").select("id, name, phone, email, birth_date, consent").eq("id", id).maybeSingle(),
    supabase
      .from("purchases")
      .select("id, amount, purchased_at, note")
      .eq("client_id", id)
      .order("purchased_at", { ascending: false }),
    supabase
      .from("discount_codes")
      .select("id, code, kind, percent, valid_from, valid_to, used_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!client) notFound();

  return (
    <main className="narrow">
      <ClientForm title="Editar cliente" client={client} error={error} />
      <PurchasesSection clientId={id} purchases={purchases ?? []} codes={codes ?? []} error={perror} message={pmessage} />
    </main>
  );
}
