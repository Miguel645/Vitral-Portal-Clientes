import Link from "next/link";
import CampaignEditor from "../CampaignEditor";
import { loadEditorData } from "../editorData";
import { appUrlError } from "@/lib/optOut";

// "Enviar campanha" sends one SMS per client in small groups, which can take a while.
export const maxDuration = 60;

export default async function NewCampaignPage() {
  const editor = await loadEditorData();

  return (
    <main className="page-medium">
      <header className="top">
        <div>
          <Link className="navlink" href="/campaigns">Voltar às campanhas</Link>
          <h1>Nova campanha</h1>
        </div>
      </header>

      {appUrlError() ? <p className="err" role="alert">{appUrlError()}</p> : null}
      <CampaignEditor {...editor} />
    </main>
  );
}
