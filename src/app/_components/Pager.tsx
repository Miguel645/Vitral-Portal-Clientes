import Link from "next/link";

export const PAGE_SIZE = 100;

// The page number from the address bar (?page=2), 1 when missing or not a number.
export function pageFromParam(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

// "Anterior / Seguinte" under a list of PAGE_SIZE rows. Hidden when everything fits on one page.
export default function Pager({ page, total, href }: { page: number; total: number; href: (page: number) => string }) {
  const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (last === 1 && page === 1) return null;
  return (
    <nav className="pager" aria-label="Páginas">
      {page > 1 ? <Link className="btn" href={href(page - 1)}>Anterior</Link> : null}
      <span className="meta">Página {page} de {last}</span>
      {page < last ? <Link className="btn" href={href(page + 1)}>Seguinte</Link> : null}
    </nav>
  );
}
