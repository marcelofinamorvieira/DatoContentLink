export function withContentLinkHeaders(fetchImpl: typeof fetch = fetch) {
  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers ?? undefined);
    headers.set('X-Visual-Editing', 'vercel-v1');
    if (!headers.has('X-Base-Editing-Url')) {
      throw new Error('X-Base-Editing-Url missing');
    }

    return fetchImpl(input, {
      ...init,
      headers
    });
  };
}
