/**
 * Tiny wrapper around @vercel/stega split so we can mock it in tests and keep
 * the rest of the codebase agnostic of the upstream implementation.
 */
import { vercelStegaSplit } from '@vercel/stega';

export type SplitResult = ReturnType<typeof vercelStegaSplit>;

// Convenience export to avoid importing the third-party helper everywhere.
export function splitStega(input: string): SplitResult {
  return vercelStegaSplit(input);
}
