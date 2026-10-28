"use client";

import { useEffect } from "react";

// Shows a "saved/deleted" message that arrived via the URL, then removes it from the
// address bar so it doesn't come back when the page is refreshed. `clear` lists other
// params that came with it (e.g. "saved", which highlights what was just created).
export default function Notice({ message, param = "message", clear = [] }: { message?: string; param?: string; clear?: string[] }) {
  const clearKey = clear.join(",");
  useEffect(() => {
    if (!message) return;
    const url = new URL(window.location.href);
    const names = [param, ...(clearKey ? clearKey.split(",") : [])].filter((n) => url.searchParams.has(n));
    if (names.length) {
      for (const n of names) url.searchParams.delete(n);
      window.history.replaceState(window.history.state, "", url);
    }
  }, [message, param, clearKey]);

  if (!message) return null;
  return (
    <p className="notice" role="status">
      {message}
    </p>
  );
}
