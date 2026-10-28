"use client";

import { useEffect, useRef } from "react";

// The code box at the till: no auto-correct or auto-capitals from phone keyboards,
// and the last code is selected so the next one can be typed straight over it.
export default function CodeInput({ defaultValue }: { defaultValue: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, [defaultValue]);

  return (
    <input
      ref={ref}
      id="code"
      type="text"
      name="code"
      defaultValue={defaultValue}
      maxLength={8}
      autoCapitalize="characters"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      aria-describedby="code-hint"
      style={{ textTransform: "uppercase" }}
      required
    />
  );
}
