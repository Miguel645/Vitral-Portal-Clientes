import Link from "next/link";

export default function BalcaoPage() {
  return (
    <main className="page-medium">
      <header className="top">
        <h1>Balcão</h1>
      </header>

      <div className="cards-grid">
        <Link href="/codes/new" className="btn primary balcao-btn">Criar vale</Link>
        <Link href="/balcao/verificar" className="btn balcao-btn">Verificar vale</Link>
      </div>
    </main>
  );
}
