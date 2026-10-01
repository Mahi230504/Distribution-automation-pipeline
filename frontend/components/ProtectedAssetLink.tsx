"use client";
import { useState } from "react";
import { fetchAsset } from "@/lib/api";
import { openFetchedProtectedAsset } from "@/lib/protected-media";

export default function ProtectedAssetLink({ path, children }: { path: string; children: React.ReactNode }) {
  const [error, setError] = useState<string | null>(null);
  async function open() {
    setError(null);
    try {
      const result = await openFetchedProtectedAsset({
        openBlank: () => window.open("", "_blank"),
        detachOpener: (tab) => { tab.opener = null; },
        prepare: (tab) => {
          tab.document.title = "Loading protected image…";
          tab.document.body.textContent = "Loading protected image…";
        },
        fetch: () => fetchAsset(path),
        createUrl: (blob) => URL.createObjectURL(blob),
        navigate: (tab, url) => tab.location.replace(url),
        close: (tab) => tab.close(),
        download: (url) => {
          const download = document.createElement("a");
          download.href = url;
          download.download = "vpo-archived-image.png";
          document.body.appendChild(download);
          download.click();
          download.remove();
        },
        revokeLater: (url) => window.setTimeout(() => URL.revokeObjectURL(url), 60_000),
      });
      if (result === "download") {
        setError("Your browser blocked the preview tab, so the image was downloaded instead.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image unavailable. Try again.");
    }
  }
  return <span className="block"><button type="button" onClick={() => void open()} className="min-h-11 text-left underline">{children}</button>{error && <span role="alert" className="ml-2 text-xs text-warning">{error}</span>}</span>;
}
