"use client";

import { useEffect, useId, useRef, useState } from "react";
import SubmitButton from "./SubmitButton";

// A "…" (more actions) menu whose only item deletes something. Choosing it opens an
// in-page confirmation naming the item, with "Cancelar" and a red "Eliminar".
// Keyboard: Enter/Space/↓ open the menu on its first item, ↑ on the last; ↑/↓/Home/End
// move; Escape closes and returns to the "…" button; Tab closes.
export default function DeleteMenu({
  menuLabel,
  itemLabel,
  title,
  description,
  action,
  fields,
}: {
  menuLabel: string;
  itemLabel: string;
  title: string;
  description: string;
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const focusOnOpen = useRef<"first" | "last">("first");
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return;
    const list = items();
    (focusOnOpen.current === "last" ? list[list.length - 1] : list[0])?.focus();

    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function openMenu(focus: "first" | "last") {
    focusOnOpen.current = focus;
    setOpen(true);
  }

  function onButtonKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openMenu(e.key === "ArrowUp" ? "last" : "first");
    }
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    }
  }

  function chooseDelete() {
    setOpen(false);
    dialogRef.current?.showModal();
  }

  return (
    <div className="more" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="btn more-btn"
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu("first"))}
        onKeyDown={onButtonKeyDown}
      >
        <span aria-hidden="true">…</span>
      </button>

      {open ? (
        <div ref={menuRef} id={`${id}-menu`} role="menu" aria-label={menuLabel} className="more-menu" onKeyDown={onMenuKeyDown}>
          <button type="button" role="menuitem" tabIndex={-1} className="more-item danger" onClick={chooseDelete}>
            {itemLabel}
          </button>
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        className="confirm-dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        onClose={() => buttonRef.current?.focus()}
        // A tap on the dimmed area around the box cancels too.
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="confirm-dialog-body">
          <h2 id={`${id}-title`}>{title}</h2>
          <p id={`${id}-desc`}>{description}</p>
          <div className="confirm-actions">
            <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
              Cancelar
            </button>
            <form action={action}>
              {Object.entries(fields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <SubmitButton className="btn danger solid" pendingText="A eliminar…">
                Eliminar
              </SubmitButton>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  );
}
