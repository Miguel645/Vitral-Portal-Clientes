"use client";

import { useEffect, useState } from "react";

// How long a "just saved" message or highlight stays on screen.
export const JUST_SAVED_MS = 5000;

// The "Acabado de guardar · " label on a list row; gone after 5 seconds, together
// with the row's highlight (`li.just-saved` fades out in globals.css).
export default function JustSavedLabel({ text }: { text: string }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShown(false), JUST_SAVED_MS);
    return () => clearTimeout(timer);
  }, []);
  return shown ? <span className="just-saved-label">{text} · </span> : null;
}
