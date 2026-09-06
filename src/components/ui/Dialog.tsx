"use client";

import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Button";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  icon: ReactNode;
  tone?: "accent" | "danger" | "success" | "warning";
  size?: "small" | "normal" | "wide";
  busy?: boolean;
  children: ReactNode;
  footer: ReactNode;
  bodyClassName?: string;
}

/** Native modal behavior keeps keyboard focus inside and restores the opener on close. */
export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  icon,
  tone = "accent",
  size = "normal",
  busy = false,
  children,
  footer,
  bodyClassName = "",
}: DialogProps) {
  const mounted = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  const ref = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();

  useEffect(() => {
    if (!mounted || !isOpen) return;
    const dialog = ref.current;
    if (!dialog) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.showModal();
    headingRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [mounted, isOpen]);

  if (!mounted || !isOpen) return null;
  return createPortal(
    <dialog
      ref={ref}
      className={`app-dialog app-dialog--${size}`}
      data-tone={tone}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      aria-busy={busy || undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="dialog-shell">
        <header className="dialog-header">
          <div className="dialog-icon" aria-hidden="true">
            {icon}
          </div>
          <div className="dialog-heading">
            <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1}>
              {title}
            </h2>
            {description && <p id={`${id}-description`}>{description}</p>}
          </div>
          <Button
            variant="quiet"
            className="icon-button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </Button>
        </header>
        <div className={`dialog-body ${bodyClassName}`}>{children}</div>
        <footer className="dialog-footer">{footer}</footer>
      </div>
    </dialog>,
    document.body,
  );
}
