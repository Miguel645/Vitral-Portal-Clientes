"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

// The search box on the clients list: the list filters from the first letter or digit
// typed, without pressing a button. The search still runs in the database (the page
// reads `?q=`); each keystroke just updates the address, and only the newest answer shows.
export default function ClientSearch({ q }: { q: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(q);
  const [pending, startTransition] = useTransition();

  // Back/forward or a link changed the search: show it in the box.
  useEffect(() => {
    if (!pending) setValue((v) => (v.trim() === q.trim() ? v : q));
    // Only when the page's search changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function search(text: string) {
    setValue(text);
    const term = text.trim();
    startTransition(() => {
      router.replace(term ? `${pathname}?q=${encodeURIComponent(term)}` : pathname, { scroll: false });
    });
  }

  return (
    // Without JavaScript, pressing Enter still searches.
    <form method="get" role="search" onSubmit={(e) => { e.preventDefault(); search(value); }}>
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => search(e.target.value)}
        placeholder="Procurar por nome, telefone ou email"
        aria-label="Procurar clientes"
        aria-busy={pending}
        autoComplete="off"
      />
    </form>
  );
}
