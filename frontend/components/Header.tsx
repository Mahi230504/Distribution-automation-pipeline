"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getHealth, isSampleMode } from "@/lib/api";
import Badge from "./Badge";

const LINKS = [
  { href: "/", label: "History" },
  { href: "/new", label: "New run" },
  { href: "/brand", label: "Brand kit" },
];

export default function Header() {
  const pathname = usePathname();
  const [mode, setMode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (isSampleMode()) return;
    let cancelled = false;
    const check = () =>
      getHealth()
        .then((h) => {
          if (!cancelled) {
            setMode(h.mode);
            setError(null);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setMode(null);
            setError(e.message);
          }
        });
    void check();
    const timer = setInterval(check, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm text-accent-foreground">
              V
            </span>
            <span>VPO Studio</span>
          </Link>
          {isSampleMode() && <Badge tone="warning">SAMPLE DATA</Badge>}
          {mode === "test" && <Badge tone="warning">TEST MODE</Badge>}
          {mode === "live" && <Badge>LIVE</Badge>}
          {error && (
            <span role="alert" className="text-xs text-warning max-w-xs">
              {error}
            </span>
          )}
        </div>
        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  active
                    ? "bg-surface-raised text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
