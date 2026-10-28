import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Notice from "@/app/_components/Notice";
import SettingsForm from "./birthday/SettingsForm";
import WelcomeForm from "./welcome/WelcomeForm";
import { appUrlError, previewBaseUrl } from "@/lib/optOut";
import { DEFAULT_WELCOME_TEXT, type WelcomeSettings } from "@/lib/welcome";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: welcomeData }] = await Promise.all([
    supabase.from("birthday_settings").select("active, percent, valid_days").eq("id", 1).maybeSingle(),
    supabase
      .from("welcome_settings")
      .select("active, sms_text, vale_percent, vale_amount_eur, vale_valid_days")
      .eq("id", 1)
      .maybeSingle<WelcomeSettings>(),
  ]);
  const settings = data ?? { active: true, percent: 10, valid_days: 14 };
  const welcome: WelcomeSettings = welcomeData ?? {
    active: false,
    sms_text: DEFAULT_WELCOME_TEXT,
    vale_percent: null,
    vale_amount_eur: null,
    vale_valid_days: null,
  };

  return (
    <main className="page-medium">
      <header className="top">
        <h1>Definições</h1>
      </header>

      <Notice message={message} />
      {appUrlError() ? <p className="err" role="alert">{appUrlError()}</p> : null}

      <SettingsForm settings={settings} />

      <WelcomeForm settings={welcome} appUrl={previewBaseUrl()} />

      <div className="card">
        <h2>Histórico de envios</h2>
        <p className="meta" style={{ marginBottom: "var(--sp-16)" }}>
          As últimas mensagens enviadas (campanhas, vales, boas-vindas e testes), com o estado de cada uma.
        </p>
        <div className="actions">
          <Link href="/campaigns/log" className="btn">Ver histórico de envios</Link>
        </div>
      </div>
    </main>
  );
}
