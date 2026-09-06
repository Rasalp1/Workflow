import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "quiet"
  | "danger"
  | "danger-quiet"
  | "success"
  | "agent";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  busy?: boolean;
  size?: "small" | "normal";
}

export function Button({
  variant = "secondary",
  busy = false,
  size = "normal",
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`ui-button ui-button--${variant} ui-button--${size} ${className}`}
    >
      {busy && (
        <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
