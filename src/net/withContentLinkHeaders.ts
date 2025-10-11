export function withContentLinkHeaders(
  fetchImpl: typeof fetch = fetch,
  defaultBaseEditingUrl?: string
) {
  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const baseHeaders = input instanceof Request ? input.headers : undefined;
    const headers = new Headers(baseHeaders);
    const initHeaders = new Headers(init.headers ?? undefined);
    initHeaders.forEach((value, key) => {
      headers.set(key, value);
    });

    headers.set('X-Visual-Editing', 'vercel-v1');
    let baseEditingUrl = headers.get('X-Base-Editing-Url') ?? headers.get('x-base-editing-url');
    if (!baseEditingUrl && defaultBaseEditingUrl) {
      headers.set('X-Base-Editing-Url', defaultBaseEditingUrl);
      baseEditingUrl = defaultBaseEditingUrl;
    }
    if (!baseEditingUrl) {
      throw new Error('X-Base-Editing-Url missing');
    }

    const finalInit: RequestInit = {
      ...init,
      headers
    };
    if (input instanceof Request && finalInit.referrerPolicy === undefined) {
      finalInit.referrerPolicy = input.referrerPolicy;
    }

    const initWithDuplex = init as RequestInit & { duplex?: unknown };
    if (initWithDuplex.duplex !== undefined) {
      (finalInit as typeof initWithDuplex).duplex ??= initWithDuplex.duplex;
    }

    if (input instanceof Request) {
      const finalInitWithDuplex = finalInit as RequestInit & { duplex?: unknown };
      if (finalInitWithDuplex.duplex !== undefined) {
        const cloned = input.clone();
        const baseInit: RequestInit & { duplex?: unknown } = {
          method: cloned.method,
          headers,
          body: cloned.body ?? undefined,
          referrer: cloned.referrer,
          referrerPolicy: cloned.referrerPolicy,
          mode: cloned.mode,
          credentials: cloned.credentials,
          cache: cloned.cache,
          redirect: cloned.redirect,
          integrity: cloned.integrity,
          keepalive: cloned.keepalive,
          signal: cloned.signal
        };
        const mergedInit: RequestInit & { duplex?: unknown } = {
          ...baseInit,
          ...finalInitWithDuplex
        };
        if (mergedInit.body === undefined) {
          mergedInit.body = cloned.body ?? undefined;
        }
        return fetchImpl(cloned.url, mergedInit);
      }
      return fetchImpl(new Request(input, finalInit));
    }

    return fetchImpl(input, finalInit);
  };
}
