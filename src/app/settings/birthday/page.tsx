import { createClient } from "@/lib/supabase/server";
import { saveBirthdaySettings, runBirthdayCheckNow } from "./actions";

export default async function BirthdaySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("birthday_settings").select("active, percent, valid_days").eq("id", 1).maybeSingle();
  const settings = data ?? { active: true, percent: 10, valid_days: 14 };

  return (
    <main className="page-medium">
      <header className="top">
        <h1>Definições</h1>
      </header>

      <form action={saveBirthdaySettings} className="card">
        <h2>Vale de aniversário</h2>
        <label className="check">
          <input type="checkbox" name="active" defaultChecked={settings.active} />
          <span>Criar vales de aniversário automaticamente</span>
        </label>
        <p className="hint" style={{ marginTop: "calc(var(--sp-8) * -1)", marginBottom: "var(--sp-24)" }}>
          Só são criados vales de aniversário para clientes que querem receber mensagens.
        </p>
        <label>
          Percentagem de desconto
          <input type="number" name="percent" inputMode="decimal" min="1" max="100" step="0.01" defaultValue={settings.percent} required />
          <span className="hint">Desconto do vale de aniversário. Exemplo: 10 (para 10%).</span>
        </label>
        <label>
          Validade em dias a partir do aniversário
          <input type="number" name="valid_days" inputMode="numeric" min="1" step="1" defaultValue={settings.valid_days} required />
          <span className="hint">Quantos dias, a contar do aniversário, o vale continua válido. Exemplo: 14.</span>
        </label>
        {error ? <p className="err" role="alert">{error}</p> : null}
        {message ? <p className="notice">{message}</p> : null}
        <div className="actions">
          <button type="submit" className="btn primary">Guardar definições</button>
        </div>
      </form>

      <form action={runBirthdayCheckNow} className="card">
        <h2>Testar agora</h2>
        <p className="meta" style={{ marginBottom: "var(--sp-16)" }}>
          Cria um vale de aniversário para quem faz anos hoje e quer receber mensagens. Pode usar este botão
          quantas vezes quiser, sem criar vales a mais.
        </p>
        <div className="actions">
          <button type="submit" className="btn">Criar vales de aniversário agora</button>
        </div>
      </form>
    </main>
  );
}
