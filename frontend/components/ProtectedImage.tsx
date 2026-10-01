"use client";
import { useEffect, useState } from "react";
import { fetchAsset, isSampleMode } from "@/lib/api";
import { stateForProtectedSource, type ProtectedImageState } from "@/lib/protected-media";

export default function ProtectedImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const protectedAsset = src.startsWith("/api/") && !isSampleMode();
  if (!protectedAsset) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img loading="lazy" decoding="async" src={src} alt={alt} className={className} />;
  }
  return <ProtectedImageRequest src={src} alt={alt} className={className} />;
}

function ProtectedImageRequest({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [settled, setSettled] = useState<ProtectedImageState>({ source: src, url: "", error: false });
  const state = stateForProtectedSource(settled, src);
  useEffect(() => {
    let active = true, objectUrl = "";
    fetchAsset(src)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSettled({ source: src, url: objectUrl, error: false });
      })
      .catch(() => {
        if (active) setSettled({ source: src, url: "", error: true });
      });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);
  if (state.error) return <div role="img" aria-label={`${alt}. Image unavailable.`} className={`${className ?? ""} flex min-h-32 items-center justify-center border border-warning/40 bg-background p-4 text-sm text-muted`}>Image unavailable. Sign in again or retry.</div>;
  if (!state.url) return <div role="status" aria-label={`Loading ${alt}`} className={`${className ?? ""} min-h-32 animate-pulse bg-surface-raised`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img loading="lazy" decoding="async" src={state.url} alt={alt} className={className} />;
}
