import { vercelStegaSplit } from '@vercel/stega';

export type SplitResult = ReturnType<typeof vercelStegaSplit>;

export function splitStega(input: string): SplitResult {
  return vercelStegaSplit(input);
}
