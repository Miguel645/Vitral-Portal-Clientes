"use client";

import { useFormStatus } from "react-dom";

// A submit button that disables itself and shows progress while its form is being sent,
// so nothing gets tapped twice.
export default function SubmitButton({
  children,
  pendingText = "A guardar…",
  className = "btn primary",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
