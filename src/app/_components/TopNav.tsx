import Link from "next/link";

const LINKS = [
  { key: "clients", href: "/", label: "Clientes" },
  { key: "codes", href: "/codes", label: "Códigos" },
  { key: "promotions", href: "/promotions", label: "Promoções" },
  { key: "settings", href: "/settings/birthday", label: "Definições" },
] as const;

export default function TopNav({ current }: { current: (typeof LINKS)[number]["key"] }) {
  return (
    <nav className="topnav">
      {LINKS.map((l) => (
        <Link key={l.key} href={l.href} className={l.key === current ? "navlink active" : "navlink"}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
