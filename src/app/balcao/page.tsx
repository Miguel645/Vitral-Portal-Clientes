import Link from "next/link";
import TopNav from "@/app/_components/TopNav";

export default function BalcaoPage() {
  return (
    <main className="narrow">
      <header className="top">
        <h1>Balcão</h1>
      </header>

      <TopNav current="balcao" />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Link href="/balcao/criar-vale" className="btn primary balcao-btn">Criar vale</Link>
        <Link href="/balcao/verificar" className="btn balcao-btn">Verificar vale</Link>
      </div>
    </main>
  );
}
