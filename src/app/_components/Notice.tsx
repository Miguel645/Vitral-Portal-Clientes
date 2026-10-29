"use client";

import { useEffect, useState } from "react";
import { JUST_SAVED_MS } from "./JustSaved";

// Shows a "saved/deleted" message that arrived via the URL, then removes it from the
// address bar so it doesn't come back when the page is refreshed. `clear` lists other
// params that came with it (e.g. "saved", which highlights what was just created).
// `autoHide` removes the message after 5 seconds (only for success messages: errors stay).
export default function Notice({
  message,
  param = "message",
  clear = [],
  autoHide = false,
  error = false,
}: {
  message?: string;
  param?: string;
  clear?: string[];
  autoHide?: boolean;
  // Something didn't work: shown in the error colour, read out at once, never hidden by itself.
  error?: boolean;
}) {
  const clearKey = clear.join(",");
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!message) return;
    const url = new URL(window.location.href);
    const names = [param, ...(clearKey ? clearKey.split(",") : [])].filter((n) => url.searchParams.has(n));
    if (names.length) {
      for (const n of names) url.searchParams.delete(n);
      window.history.replaceState(window.history.state, "", url);
    }
  }, [message, param, clearKey]);

  useEffect(() => {
    setHidden(false);
    if (!message || !autoHide || error) return;
    const timer = setTimeout(() => setHidden(true), JUST_SAVED_MS);
    return () => clearTimeout(timer);
  }, [message, autoHide, error]);

  if (!message || hidden) return null;
  return (
    <p className={error ? "notice error" : "notice"} role={error ? "alert" : "status"}>
      {message}
    </p>
  );
}
