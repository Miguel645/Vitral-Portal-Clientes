import { createClient } from "@/lib/supabase/server";
import Notice from "@/app/_components/Notice";
import SubmitButton from "@/app/_components/SubmitButton";
import SettingsForm from "./SettingsForm";
import { runBirthdayCheckNow } from "./actions";

export default async function BirthdaySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("birthday_settings").select("active, percent, valid_days").eq("id", 1).maybeSingle();
  const settings = data ?? { active: true, percent: 10, valid_days: 14 };

  return (
    <main className="page-medium">
      <header className="top">
        <h1>Definições</h1>
      </header>

      <Notice message={message} />

      <SettingsForm settings={settings} />

      <form action={runBirthdayCheckNow} className="card">
        <h2>Testar agora</h2>
        <p className="meta" style={{ marginBottom: "var(--sp-16)" }}>
          Cria um vale de aniversário para quem faz anos hoje e quer receber mensagens. Pode usar este botão
          quantas vezes quiser, sem criar vales a mais.
        </p>
        <div className="actions">
          <SubmitButton className="btn" pendingText="A criar…">Criar vales de aniversário agora</SubmitButton>
        </div>
      </form>
    </main>
  );
}
