import Link from "next/link";
import { logout } from "@/app/login/actions";

const LINKS = [
  { key: "clients", href: "/", label: "Clientes" },
  { key: "codes", href: "/codes", label: "Códigos" },
  { key: "promotions", href: "/promotions", label: "Promoções" },
  { key: "campaigns", href: "/campaigns/new", label: "Campanhas" },
  { key: "settings", href: "/settings/birthday", label: "Definições" },
] as const;

export default function TopNav({ current }: { current: (typeof LINKS)[number]["key"] }) {
  return (
    <nav className="topnav" aria-label="Navegação principal">
      {LINKS.map((l) => (
        <Link
          key={l.key}
          href={l.href}
          className={l.key === current ? "navbtn active" : "navbtn"}
          aria-current={l.key === current ? "page" : undefined}
        >
          {l.label}
        </Link>
      ))}
      <form action={logout}>
        <button type="submit" className="navbtn">Sair</button>
      </form>
    </nav>
  );
}
