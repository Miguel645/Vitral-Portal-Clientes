import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CampaignComposer from "../CampaignComposer";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; testOk?: string; testError?: string }>;
}) {
  const { message = "", testOk, testError } = await searchParams;
  const supabase = await createClient();

  const { count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("consent", true)
    .neq("phone", "");

  return (
    <main className="page-medium">
      <header className="top">
        <h1>Campanhas</h1>
      </header>

      <CampaignComposer
        initialMessage={message}
        recipientCount={count ?? 0}
        appUrl={process.env.APP_URL ?? ""}
        testOk={testOk}
        testError={testError}
      />

      <p className="meta" style={{ textAlign: "center" }}>
        <Link className="navlink" href="/campaigns/log">Ver registo de SMS</Link>
      </p>
    </main>
  );
}
