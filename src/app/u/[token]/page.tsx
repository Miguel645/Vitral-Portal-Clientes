import { createAdminClient } from "@/lib/supabase/admin";

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, consent")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (!client) {
    return (
      <main className="page-narrow">
        <div className="card">
          <h2>Ligação inválida</h2>
          <p className="meta">Este link de cancelamento não é válido.</p>
        </div>
      </main>
    );
  }

  if (client.consent) {
    await supabase.from("clients").update({ consent: false }).eq("id", client.id);
  }

  return (
    <main className="page-narrow">
      <div className="card">
        <h2>Subscrição cancelada</h2>
        <p className="meta">
          Já não vai receber mensagens da Vitral. Pode voltar a inscrever-se junto da loja em qualquer momento.
        </p>
      </div>
    </main>
  );
}
