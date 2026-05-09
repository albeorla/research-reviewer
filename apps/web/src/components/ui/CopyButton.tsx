import { useState } from "react";
import { Copy, Check } from "lucide-react";
import clsx from "clsx";

interface Props {
  text: string;
  label?: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
}

export function CopyButton({
  text,
  label = "Copy",
  className,
  variant = "secondary",
  size = "md",
  disabled,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (disabled || !text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  const base =
    variant === "primary"
      ? "btn-primary"
      : variant === "ghost"
        ? "btn-ghost"
        : "btn-secondary";

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled || !text}
      className={clsx(base, size === "sm" && "px-2 py-1 text-xs", className)}
    >
      {copied ? <Check size={size === "sm" ? 12 : 14} /> : <Copy size={size === "sm" ? 12 : 14} />}
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}
