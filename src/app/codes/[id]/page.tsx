import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CodeForm from "../CodeForm";

export default async function EditCodePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: code }, { data: clients }] = await Promise.all([
    supabase
      .from("discount_codes")
      .select("id, code, type, value, expires_at, max_uses, times_used, client_id, active")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  if (!code) notFound();
  return <CodeForm title="Editar código" code={code} clients={clients ?? []} error={error} />;
}
