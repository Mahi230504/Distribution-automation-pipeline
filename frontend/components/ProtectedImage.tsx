"use client";
import { useEffect, useState } from "react";
import { fetchAsset, isSampleMode } from "@/lib/api";

export default function ProtectedImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const protectedAsset = src.startsWith("/api/") && !isSampleMode();
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!protectedAsset) return;
    let active = true, objectUrl = "";
    fetchAsset(src).then((blob) => { if (!active) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }).catch(() => { if (active) setError(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, protectedAsset]);
  const displayUrl = protectedAsset ? url : src;
  if (error) return <div role="img" aria-label={`${alt}. Image unavailable.`} className={`${className ?? ""} flex min-h-32 items-center justify-center border border-warning/40 bg-background p-4 text-sm text-muted`}>Image unavailable. Sign in again or retry.</div>;
  if (!displayUrl) return <div role="status" aria-label={`Loading ${alt}`} className={`${className ?? ""} min-h-32 animate-pulse bg-surface-raised`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img loading="lazy" decoding="async" src={displayUrl} alt={alt} className={className} />;
}
