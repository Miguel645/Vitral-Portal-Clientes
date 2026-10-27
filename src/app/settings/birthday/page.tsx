import { createClient } from "@/lib/supabase/server";
import TopNav from "@/app/_components/TopNav";
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
    <main className="narrow">
      <header className="top">
        <h1>Definições</h1>
      </header>

      <TopNav current="settings" />

      <form action={saveBirthdaySettings} className="card">
        <h2>Código de aniversário</h2>
        <label className="check">
          <input type="checkbox" name="active" defaultChecked={settings.active} />
          <span>Criar códigos de aniversário automaticamente</span>
        </label>
        <label>
          Percentagem de desconto
          <input type="number" name="percent" min="1" max="100" step="0.01" defaultValue={settings.percent} required />
        </label>
        <label>
          Validade em dias a partir do aniversário
          <input type="number" name="valid_days" min="1" step="1" defaultValue={settings.valid_days} required />
        </label>
        {error ? <p className="err" role="alert">{error}</p> : null}
        {message ? <p className="notice">{message}</p> : null}
        <div className="actions">
          <button type="submit" className="btn primary">Guardar definições</button>
        </div>
      </form>

      <form action={runBirthdayCheckNow} className="card" style={{ marginTop: 16 }}>
        <h2>Testar agora</h2>
        <p className="meta" style={{ marginBottom: 12 }}>
          Cria códigos de aniversário para quem faz anos hoje e tem consentimento. Pode ser executado várias vezes
          sem criar duplicados.
        </p>
        <div className="actions">
          <button type="submit" className="btn">Executar verificação de aniversários agora</button>
        </div>
      </form>
    </main>
  );
}
