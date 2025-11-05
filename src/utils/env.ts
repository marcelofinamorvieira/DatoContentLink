/**
 * Runtime environment helpers shared across the package.
 */

/**
 * Determine whether the current environment should be treated as development.
 * Defaults to true when process.env is unavailable (e.g. browser bundles).
 */
export function isDevelopment(): boolean {
  if (typeof process === 'undefined') {
    return true;
  }

  const nodeEnv = process.env?.NODE_ENV;
  return nodeEnv ? nodeEnv !== 'production' : true;
}

