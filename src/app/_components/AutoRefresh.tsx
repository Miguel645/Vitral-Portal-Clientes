"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Reloads the page's data every few seconds while something is being sent in the
// background, so the progress ("120 de 250") moves on its own. Renders nothing.
export default function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
