"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="page-narrow">
      <div className="card" role="alert">
        <h2>Algo correu mal</h2>
        <p>Não foi possível mostrar esta página. Verifique a ligação à internet e tente outra vez.</p>
        <div className="actions">
          <Link href="/" className="btn">Voltar aos clientes</Link>
          <button type="button" className="btn primary" onClick={() => reset()}>Tentar outra vez</button>
        </div>
      </div>
    </main>
  );
}
