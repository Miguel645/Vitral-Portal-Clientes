import CodeForm from "../CodeForm";
import { createClient } from "@/lib/supabase/server";

export default async function NewCodePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");

  return <CodeForm title="Novo código" clients={clients ?? []} error={error} />;
}
