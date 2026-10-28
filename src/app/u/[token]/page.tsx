import { createAdminClient } from "@/lib/supabase/admin";
import SubmitButton from "@/app/_components/SubmitButton";
import { unsubscribe } from "./actions";

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
          <h2>Link inválido</h2>
          <p className="meta">Este link de cancelamento não é válido. Para deixar de receber mensagens, fale connosco na loja.</p>
        </div>
      </main>
    );
  }

  if (client.consent) {
    return (
      <main className="page-narrow">
        <form action={unsubscribe} className="card">
          <h2>Deixar de receber mensagens</h2>
          <p className="meta">Quer deixar de receber mensagens da Vitral (promoções, saldos e novidades)?</p>
          <input type="hidden" name="token" value={token} />
          <div className="actions">
            <SubmitButton pendingText="A cancelar…">Confirmar cancelamento</SubmitButton>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="page-narrow">
      <div className="card" role="status">
        <h2>Subscrição cancelada</h2>
        <p className="meta">
          Já não vai receber mensagens da Vitral. Pode voltar a inscrever-se junto da loja em qualquer momento.
        </p>
      </div>
    </main>
  );
}
