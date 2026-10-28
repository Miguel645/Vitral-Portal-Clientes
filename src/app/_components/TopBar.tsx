"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/login/actions";

const LINKS = [
  { href: "/balcao", label: "Balcão", section: "/balcao" },
  { href: "/", label: "Clientes", section: "/" },
  { href: "/codes", label: "Vales", section: "/codes" },
  { href: "/promotions", label: "Promoções", section: "/promotions" },
  { href: "/campaigns/new", label: "Campanhas", section: "/campaigns" },
  { href: "/settings/birthday", label: "Definições", section: "/settings" },
] as const;

function isActive(pathname: string, section: string) {
  if (section === "/") return pathname === "/" || pathname.startsWith("/clients/");
  return pathname === section || pathname.startsWith(`${section}/`);
}

export default function TopBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname.startsWith("/login") || pathname.startsWith("/u/")) return null;

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="topbar-brand">Vitral</Link>

        <nav className="topbar-nav" aria-label="Navegação principal">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={isActive(pathname, l.section) ? "topbar-link active" : "topbar-link"}
              aria-current={isActive(pathname, l.section) ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <details className="topbar-menu" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
          <summary className="topbar-menu-btn">Menu</summary>
          <div className="topbar-menu-panel">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={isActive(pathname, l.section) ? "topbar-menu-link active" : "topbar-menu-link"}
                aria-current={isActive(pathname, l.section) ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </details>

        <form action={logout} className="topbar-signout">
          <button type="submit" className="signout-btn">Sair</button>
        </form>
      </div>
    </header>
  );
}
