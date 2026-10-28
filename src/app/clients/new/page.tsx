import Link from "next/link";
import ClientForm from "../ClientForm";

export default function NewClientPage() {
  return (
    <main className="page-medium">
      <header className="top">
        <div>
          <Link className="navlink" href="/">Voltar aos clientes</Link>
          <h1>Novo cliente</h1>
        </div>
      </header>
      <ClientForm />
    </main>
  );
}
