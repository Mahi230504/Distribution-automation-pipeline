"use client";

import { useState } from "react";

export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied by the browser; fail visibly, not silently.
      window.prompt("Copy this text manually:", text);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-foreground"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
