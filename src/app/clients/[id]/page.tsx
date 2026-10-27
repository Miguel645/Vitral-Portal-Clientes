import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClientForm from "../ClientForm";

export default async function EditClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, phone, email, birth_date, consent")
    .eq("id", id)
    .maybeSingle();

  if (!client) notFound();
  return <ClientForm title="Editar cliente" client={client} error={error} />;
}
