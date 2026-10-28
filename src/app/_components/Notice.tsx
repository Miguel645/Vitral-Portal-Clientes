"use client";

import { useEffect } from "react";

// Shows a "saved/deleted" message that arrived via the URL, then removes it from the
// address bar so it doesn't come back when the page is refreshed.
export default function Notice({ message, param = "message" }: { message?: string; param?: string }) {
  useEffect(() => {
    if (!message) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      window.history.replaceState(window.history.state, "", url);
    }
  }, [message, param]);

  if (!message) return null;
  return (
    <p className="notice" role="status">
      {message}
    </p>
  );
}
