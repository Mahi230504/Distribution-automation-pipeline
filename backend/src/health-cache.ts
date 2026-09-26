// Model availability is disposable metadata, never job or run state.
export function cachedHealth<T extends { healthy: boolean }>(
  load: () => Promise<T>,
  now = Date.now,
) {
  let value: T | undefined;
  let expires = 0;
  let pending: Promise<T> | undefined;
  return () => {
    if (value && now() < expires) return Promise.resolve(value);
    if (pending) return pending;
    pending = load()
      .then((result) => {
        value = result;
        expires = now() + (result.healthy ? 300_000 : 10_000);
        return result;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
}
