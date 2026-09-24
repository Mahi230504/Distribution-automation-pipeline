"use client";

import { useEffect, useState } from "react";
import { getBrandKit, saveBrandKit } from "@/lib/api";
import { BrandKit, Platform, PLATFORM_LABELS } from "@/lib/types";
import ErrorBanner from "@/components/ErrorBanner";

const ALL_PLATFORMS: Platform[] = ["instagram_reels", "youtube_shorts", "linkedin"];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
      {children}
    </label>
  );
}

const inputClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

export default function BrandKitPage() {
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getBrandKit()
      .then((data) => {
        if (cancelled) return;
        setKit(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load your Brand kit.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadIndex]);

  function retry() {
    setReloadIndex((i) => i + 1);
  }

  function update<K extends keyof BrandKit>(key: K, value: BrandKit[K]) {
    setKit((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updatePaletteColor(index: number, value: string) {
    if (!kit) return;
    const palette = [...kit.palette];
    palette[index] = value;
    update("palette", palette);
  }

  function addColor() {
    if (!kit) return;
    update("palette", [...kit.palette, "#8b7cf6"]);
  }

  function removeColor(index: number) {
    if (!kit) return;
    update(
      "palette",
      kit.palette.filter((_, i) => i !== index)
    );
  }

  function togglePlatform(platform: Platform) {
    if (!kit) return;
    const has = kit.preferredPlatforms.includes(platform);
    update(
      "preferredPlatforms",
      has ? kit.preferredPlatforms.filter((p) => p !== platform) : [...kit.preferredPlatforms, platform]
    );
  }

  async function handleSave() {
    if (!kit) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveBrandKit(kit);
      setKit(saved);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your Brand kit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brand kit</h1>
        <p className="mt-1 text-sm text-muted">
          Saved once and applied to every new run, so it never needs re-entering.
        </p>
      </div>

      {error && <ErrorBanner message={error} onRetry={retry} />}

      {!kit && !error && (
        <div className="h-96 animate-pulse rounded-2xl border border-border bg-surface" />
      )}

      {kit && (
        <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <Field label="Brand name">
            <input
              className={inputClass}
              value={kit.brandName}
              onChange={(e) => update("brandName", e.target.value)}
            />
          </Field>

          <Field label="Colour palette" hint="Used to keep every generated frame on-brand.">
            <div className="flex flex-wrap gap-2">
              {kit.palette.map((color, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-lg border border-border bg-background p-1.5">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#8b7cf6"}
                    onChange={(e) => updatePaletteColor(i, e.target.value)}
                    className="h-7 w-7 cursor-pointer rounded"
                  />
                  <input
                    className="w-20 bg-transparent text-xs outline-none"
                    value={color}
                    onChange={(e) => updatePaletteColor(i, e.target.value)}
                  />
                  <button
                    onClick={() => removeColor(i)}
                    className="text-muted hover:text-danger"
                    aria-label="Remove colour"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={addColor}
                className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent-strong"
              >
                + Add colour
              </button>
            </div>
          </Field>

          <Field label="Character description" hint="Kept consistent across every frame of every run.">
            <textarea
              className={`${inputClass} min-h-24 resize-y`}
              value={kit.characterDescription}
              onChange={(e) => update("characterDescription", e.target.value)}
            />
          </Field>

          <Field label="Tone of voice">
            <textarea
              className={`${inputClass} min-h-16 resize-y`}
              value={kit.tone}
              onChange={(e) => update("tone", e.target.value)}
            />
          </Field>

          <Field label="Constraints" hint="Things every run must always avoid or always include.">
            <textarea
              className={`${inputClass} min-h-16 resize-y`}
              value={kit.constraints}
              onChange={(e) => update("constraints", e.target.value)}
            />
          </Field>

          <Field label="Preferred platforms">
            <div className="flex flex-wrap gap-2">
              {ALL_PLATFORMS.map((platform) => {
                const active = kit.preferredPlatforms.includes(platform);
                return (
                  <button
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "border-accent/40 bg-accent/15 text-accent-strong"
                        : "border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {PLATFORM_LABELS[platform]}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="flex items-center gap-3 border-t border-border pt-5">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Brand kit"}
            </button>
            {savedAt && !saving && <span className="text-xs text-success">Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}
