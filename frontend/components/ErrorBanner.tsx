export default function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3.5 text-sm text-danger sm:flex-row sm:items-center sm:justify-between">
      <span className="break-words">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
        >
          Try again
        </button>
      )}
    </div>
  );
}
