"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/login/actions";

const LINKS = [
  { href: "/", label: "Clientes", section: "/" },
  { href: "/codes", label: "Vales", section: "/codes" },
  { href: "/verificar", label: "Verificar vale", section: "/verificar" },
  { href: "/campaigns", label: "Campanhas", section: "/campaigns" },
  { href: "/settings", label: "Definições", section: "/settings" },
] as const;

function isActive(pathname: string, section: string) {
  if (section === "/") return pathname === "/" || pathname.startsWith("/clients/");
  return pathname === section || pathname.startsWith(`${section}/`);
}

// `simulation`: MESSAGING_MODE is "simulation", so a banner says nothing is really sent.
export default function TopBar({ simulation }: { simulation: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);

  // Close the phone menu when tapping outside it or pressing Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (pathname.startsWith("/login") || pathname.startsWith("/u/")) return null;

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="topbar-brand">
          <span className="topbar-brand-name">Vitral</span>
          <span className="topbar-brand-sub">Portal de Clientes</span>
        </Link>

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

        <details ref={menuRef} className="topbar-menu" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
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
      {simulation ? <p className="sim-banner">Modo simulação — nenhuma SMS é enviada de verdade</p> : null}
    </header>
  );
}
