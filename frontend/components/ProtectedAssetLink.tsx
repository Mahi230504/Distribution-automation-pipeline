"use client";
import { useState } from "react";
import { fetchAsset } from "@/lib/api";

export default function ProtectedAssetLink({ path, children }: { path: string; children: React.ReactNode }) {
  const [error, setError] = useState<string | null>(null);
  async function open() {
    setError(null);
    try {
      const blob = await fetchAsset(path);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { setError(e instanceof Error ? e.message : "Image unavailable."); }
  }
  return <span className="block"><button type="button" onClick={() => void open()} className="min-h-11 text-left underline">{children}</button>{error && <span role="alert" className="ml-2 text-xs text-warning">{error}</span>}</span>;
}
