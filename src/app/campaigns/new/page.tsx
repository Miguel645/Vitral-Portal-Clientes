import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { clientFirstName } from "@/lib/smsText";
import CampaignComposer from "../CampaignComposer";

// "Enviar a todos" sends one SMS per client, which can take a while.
export const maxDuration = 60;

export default async function NewCampaignPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("clients")
    .select("name")
    .eq("consent", true)
    .neq("phone", "");

  return (
    <main className="page-medium">
      <header className="top">
        <h1>Campanhas</h1>
      </header>

      <CampaignComposer
        recipientNames={(data ?? []).map((c) => clientFirstName(c.name))}
        appUrl={process.env.APP_URL ?? ""}
        simulated={process.env.SMS_MODE !== "twilio"}
      />

      <p className="meta" style={{ textAlign: "center" }}>
        <Link className="navlink" href="/campaigns/log">Ver registo de SMS</Link>
      </p>
    </main>
  );
}
