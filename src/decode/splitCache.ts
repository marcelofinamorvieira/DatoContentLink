import { vercelStegaSplit } from '@vercel/stega';

const MAX_CACHE_SIZE = 2000;

const cache = new Map<string, ReturnType<typeof vercelStegaSplit>>();

export function splitStegaCached(input: string): ReturnType<typeof vercelStegaSplit> {
  const existing = cache.get(input);
  if (existing) {
    cache.delete(input);
    cache.set(input, existing);
    return existing;
  }

  const result = vercelStegaSplit(input);
  cache.set(input, result);

  if (cache.size > MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }

  return result;
}
