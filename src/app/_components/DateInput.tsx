"use client";

import { useState } from "react";
import { formatDate, formatDateTyping, INVALID_DATE, parseDisplayDate } from "@/lib/date";

// A date box that always shows and accepts dd/mm/aaaa, whatever the browser's language
// (a native date picker shows mm/dd/yyyy on some). Slashes go in by themselves and phones
// show the number keyboard. The form sends what's typed; the server action turns it
// into an ISO date with parseDisplayDate. Renders the input, its hint and its error.
export default function DateInput({
  id,
  name,
  defaultValue,
  hint,
  error,
  required,
  autoFocus,
  onChange,
}: {
  id: string;
  name: string;
  // ISO date from the database, or the text typed before a failed save.
  defaultValue?: string | null;
  hint: string;
  // An error from the server (or the parent form) about this field.
  error?: string;
  required?: boolean;
  autoFocus?: boolean;
  onChange?: (text: string) => void;
}) {
  const initial = defaultValue && /^\d{4}-\d{2}-\d{2}$/.test(defaultValue) ? formatDate(defaultValue) : (defaultValue ?? "");
  const [text, setText] = useState(initial);
  // Only complain about the format once the person has left the field.
  const [touched, setTouched] = useState(false);

  const ownError = touched && text !== "" && !parseDisplayDate(text) ? INVALID_DATE : undefined;
  const shown = ownError ?? error;

  return (
    <>
      <input
        id={id}
        type="text"
        name={name}
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        maxLength={10}
        value={text}
        onChange={(e) => {
          const next = formatDateTyping(e.target.value);
          setText(next);
          setTouched(false);
          onChange?.(next);
        }}
        onBlur={() => setTouched(true)}
        required={required}
        autoFocus={autoFocus}
        aria-invalid={!!shown}
        aria-describedby={shown ? `${id}-hint ${id}-err` : `${id}-hint`}
      />
      <span className="hint" id={`${id}-hint`}>{hint}</span>
      {shown ? <span className="err" id={`${id}-err`} role="alert">{shown}</span> : null}
    </>
  );
}
