import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-narrow">
      <div className="card">
        <h2>Página não encontrada</h2>
        <p>Esta página não existe ou já foi eliminada. Volte à lista e tente outra vez.</p>
        <div className="actions">
          <Link href="/" className="btn primary">Voltar aos clientes</Link>
        </div>
      </div>
    </main>
  );
}
