"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createRun, getBrandKit } from "@/lib/api";
import {
  AspectRatio,
  BrandKit,
  NewRunInput,
  Platform,
  PLATFORM_LABELS,
} from "@/lib/types";
import { countWords } from "@/lib/format";
import ErrorBanner from "@/components/ErrorBanner";

const ALL_PLATFORMS: Platform[] = [
  "instagram_reels",
  "youtube_shorts",
  "linkedin",
];
const inputClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
      {children}
    </label>
  );
}

export default function NewRunPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"topic" | "script">("topic");
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);

  const [objective, setObjective] = useState<
    "promote" | "explain" | "demonstrate" | "tell a story"
  >("promote");
  const [productDetails, setProductDetails] = useState("");
  const [visualPreferences, setVisualPreferences] = useState("");
  const [summary, setSummary] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [brandSelection, setBrandSelection] = useState<
    "none" | "saved" | "custom"
  >("none");
  const [customBrand, setCustomBrand] = useState({
    brandName: "",
    palette: [] as string[],
    characterDescription: "",
    tone: "",
    constraints: "",
    preferredPlatforms: [] as Platform[],
  });
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram_reels");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [targetVideoModel, setTargetVideoModel] = useState("Veo 3.1");
  const [sourceLinks, setSourceLinks] = useState("");
  const [notes, setNotes] = useState("");
  const [pastedScript, setPastedScript] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getBrandKit()
      .then((kit) => {
        setBrandKit(kit);
      })
      .catch((e) => setSubmitError(e.message));
  }, []);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setPastedScript(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!confirmed || summary.trim().length < 10)
      next.interpretation =
        "Confirm the content interpretation before starting.";
    if (
      brandSelection !== "none" &&
      /clothing|shoe|fashion|sneaker/i.test(topic) &&
      /coffee|barista/i.test(
        JSON.stringify(brandSelection === "saved" ? brandKit : customBrand),
      )
    )
      next.interpretation =
        "This coffee Brand kit conflicts with your brief. Choose no kit or edit the run copy.";
    if (
      tab === "topic" &&
      objective === "promote" &&
      /^(clothing|shoe|fashion|apparel|footwear)( brand)?$/i.test(
        topic.trim(),
      ) &&
      !productDetails.trim()
    )
      next.interpretation =
        "Specify which product to show in Product details before starting.";
    if (!topic.trim()) next.topic = "Give this run a topic.";
    if (durationSeconds < 15 || durationSeconds > 60)
      next.durationSeconds = "Duration must be between 15 and 60 seconds.";
    if (tab === "script" && countWords(pastedScript) < 5)
      next.pastedScript = "Paste or upload a script first.";
    if (!targetVideoModel.trim())
      next.targetVideoModel = "Choose a target video model.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    const input: NewRunInput = {
      interpretation: {
        subject: topic.trim(),
        objective,
        productDetails,
        visualPreferences,
        factualConstraints: "No unsupported brand-specific claims",
        summary,
        confirmed,
      },
      brandSelection,
      ...(brandSelection === "custom" ? { brandKit: customBrand } : {}),
      topic: topic.trim(),
      audience: audience.trim(),
      platform,
      aspectRatio,
      durationSeconds,
      targetVideoModel: targetVideoModel.trim(),
      sourceLinks: sourceLinks
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      notes: notes.trim(),
      pastedScript: tab === "script" ? pastedScript.trim() : null,
    };
    try {
      const run = await createRun(input);
      router.push(`/runs/${run.id}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not start this run.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New run</h1>
        <p className="mt-1 text-sm text-muted">
          Tell VPO Studio what you want, or bring your own script.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1 sm:w-fit">
        {(
          [
            { key: "topic", label: "Start from a topic" },
            { key: "script", label: "I have a script" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
              tab === t.key
                ? "bg-surface-raised text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {submitError && <ErrorBanner message={submitError} />}

      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <Field label="What should this content achieve?">
          <select
            value={objective}
            onChange={(e) => {
              setObjective(e.target.value as typeof objective);
              setConfirmed(false);
            }}
            className={inputClass}
          >
            {["promote", "explain", "demonstrate", "tell a story"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Brand kit for this run">
          <select
            value={brandSelection}
            onChange={(e) => {
              setBrandSelection(e.target.value as typeof brandSelection);
              if (e.target.value === "custom" && brandKit)
                setCustomBrand(brandKit);
              setConfirmed(false);
            }}
            className={inputClass}
          >
            <option value="none">Continue without a Brand kit</option>
            <option value="saved">
              {brandKit?.origin === "demo"
                ? "Demo preset"
                : brandKit?.origin === "legacy"
                  ? "Previously stored kit (origin unknown)"
                  : "User-saved kit"}
              : {brandKit?.brandName || "No saved brand"}
            </option>
            <option value="custom">Edit a run-specific copy</option>
          </select>
        </Field>
        {brandSelection === "saved" && (
          <p className="text-sm">
            {brandKit?.brandName} · {brandKit?.characterDescription}
          </p>
        )}
        {brandSelection === "custom" && (
          <div className="grid gap-3">
            {(
              [
                "brandName",
                "characterDescription",
                "tone",
                "constraints",
              ] as const
            ).map((k) => (
              <Field key={k} label={k}>
                <input
                  value={customBrand[k]}
                  onChange={(e) =>
                    setCustomBrand({ ...customBrand, [k]: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
            ))}
            <Field label="Palette (comma separated)">
              <input
                value={customBrand.palette.join(",")}
                onChange={(e) =>
                  setCustomBrand({
                    ...customBrand,
                    palette: e.target.value.split(",").filter(Boolean),
                  })
                }
                className={inputClass}
              />
            </Field>
            <p className="text-xs">
              This does not change the global Brand kit.
            </p>
          </div>
        )}

        {tab === "topic" && (
          <Field label="Topic" hint="What is this run about?">
            <input
              className={inputClass}
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setConfirmed(false);
              }}
              placeholder="e.g. a clothing collection launch"
            />
            {errors.topic && (
              <span className="text-xs text-danger">{errors.topic}</span>
            )}
          </Field>
        )}

        {tab === "script" && (
          <>
            <Field
              label="Topic"
              hint="A short label for this run, shown in History."
            >
              <input
                className={inputClass}
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  setConfirmed(false);
                }}
                placeholder="e.g. a clothing collection launch"
              />
              {errors.topic && (
                <span className="text-xs text-danger">{errors.topic}</span>
              )}
            </Field>
            <Field
              label="Your script"
              hint="Paste it below, or upload a .txt or .md file."
            >
              <textarea
                className={`${inputClass} min-h-40 resize-y font-mono text-xs`}
                value={pastedScript}
                onChange={(e) => setPastedScript(e.target.value)}
                placeholder={'[0:00–0:05] VISUAL: ... VO: "..." ON-SCREEN: ...'}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
                >
                  Upload .txt or .md
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
                <span className="text-xs text-muted">
                  {countWords(pastedScript)} words
                </span>
              </div>
              {errors.pastedScript && (
                <span className="text-xs text-danger">
                  {errors.pastedScript}
                </span>
              )}
            </Field>
          </>
        )}

        <Field
          label="Product or subject details"
          hint="What is actually being shown? Leave materials, price and performance unspecified unless you have evidence."
        >
          <textarea
            value={productDetails}
            onChange={(e) => {
              setProductDetails(e.target.value);
              setConfirmed(false);
            }}
            className={inputClass}
          />
        </Field>
        <Field label="Visual preferences">
          <textarea
            value={visualPreferences}
            onChange={(e) => setVisualPreferences(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field
          label="What we’re creating"
          hint="For a broad topic such as clothing brand, confirm an explicit interpretation. Platform below controls distribution, not the subject."
        >
          <textarea
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              setConfirmed(false);
            }}
            className={inputClass}
          />
          <button
            type="button"
            className="border rounded p-2"
            onClick={() => {
              setSummary(
                `${objective} ${topic || "the specified product"} for ${audience || "the chosen audience"}, focusing on ${productDetails.trim() || "the subject and visible product details"}. No invented brand-specific claims.`,
              );
              setConfirmed(false);
            }}
          >
            Propose interpretation
          </button>
        </Field>
        <label className="text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          I confirm this content interpretation and Brand kit choice
        </label>
        {errors.interpretation && (
          <p role="alert" className="text-warning">
            {errors.interpretation}
          </p>
        )}
        <Field label="Audience" hint="Who is this for?">
          <input
            className={inputClass}
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. young adults choosing their everyday style"
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Platform">
            <select
              className={inputClass}
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
            >
              {ALL_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Target video model">
            <input
              className={inputClass}
              value={targetVideoModel}
              onChange={(e) => setTargetVideoModel(e.target.value)}
            />
            {errors.targetVideoModel && (
              <span className="text-xs text-danger">
                {errors.targetVideoModel}
              </span>
            )}
          </Field>

          <Field label="Aspect ratio">
            <div className="flex gap-2">
              {(["9:16", "16:9"] as AspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                    aspectRatio === ratio
                      ? "border-accent/40 bg-accent/15 text-accent-strong"
                      : "border-border text-muted hover:text-foreground"
                  }`}
                >
                  {ratio} {ratio === "9:16" ? "vertical" : "horizontal"}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Duration" hint="15–60 seconds">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={15}
                max={60}
                step={5}
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Number(e.target.value))}
                className="flex-1 accent-[var(--accent)]"
              />
              <span className="w-12 text-right text-sm tabular-nums">
                {durationSeconds}s
              </span>
            </div>
            {errors.durationSeconds && (
              <span className="text-xs text-danger">
                {errors.durationSeconds}
              </span>
            )}
          </Field>
        </div>

        <Field
          label="Source links"
          hint="Optional, one per line. Facts are still verified against live search results."
        >
          <textarea
            className={`${inputClass} min-h-16 resize-y`}
            value={sourceLinks}
            onChange={(e) => setSourceLinks(e.target.value)}
            placeholder={"https://example.com/article"}
          />
        </Field>

        <Field label="Notes" hint="Optional, anything else worth knowing.">
          <textarea
            className={`${inputClass} min-h-16 resize-y`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <div className="border-t border-border pt-5">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
          >
            {submitting ? "Starting…" : "Start run"}
          </button>
        </div>
      </div>
    </div>
  );
}
