// Bounded I/O fan-out; retain input order so grounding chunk IDs stay stable.
export async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const result = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from(
      { length: Math.min(items.length, Math.max(1, Math.floor(concurrency))) },
      async () => {
        while (next < items.length) {
          const index = next++;
          result[index] = await fn(items[index], index);
        }
      },
    ),
  );
  return result;
}
