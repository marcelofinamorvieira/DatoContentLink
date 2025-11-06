/**
 * Wrap a fetch implementation so every request carries the headers required
 * for DatoCMS visual editing (X-Visual-Editing + X-Base-Editing-Url). This
 * keeps preview queries lightweight for integrators.
 */
import { normalizeBaseUrl } from '../utils/url.js';

export function withContentLinkHeaders(
  fetchImpl: typeof fetch = fetch,
  baseEditingUrl: string
) {
  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (!baseEditingUrl) {
      throw new Error('baseEditingUrl is required');
    }

    const headers = cloneAndMergeHeaders(input, init);
    ensureBaseEditingHeaders(headers, baseEditingUrl);

    const finalInit = buildFinalInit(init, headers);
    copyReferrerPolicy(input, finalInit);
    propagateDuplex(init, finalInit);

    if (input instanceof Request) {
      return handleRequestInput(fetchImpl, input, finalInit, headers);
    }

    return fetchImpl(input, finalInit);
  };
}

type RequestInitWithDuplex = RequestInit & { duplex?: unknown };

function cloneAndMergeHeaders(input: RequestInfo | URL, init: RequestInit): Headers {
  const baseHeaders = input instanceof Request ? input.headers : undefined;
  const headers = new Headers(baseHeaders);
  const initHeaders = new Headers(init.headers ?? undefined);
  initHeaders.forEach((value, key) => {
    headers.set(key, value);
  });
  return headers;
}

function ensureBaseEditingHeaders(headers: Headers, baseEditingUrl: string): void {
  headers.set('X-Visual-Editing', 'vercel-v1');
  const normalized = normalizeBaseUrl(baseEditingUrl);
  headers.set('X-Base-Editing-Url', normalized);
}

function buildFinalInit(init: RequestInit, headers: Headers): RequestInitWithDuplex {
  return {
    ...init,
    headers
  } as RequestInitWithDuplex;
}

function copyReferrerPolicy(input: RequestInfo | URL, finalInit: RequestInitWithDuplex): void {
  if (input instanceof Request && finalInit.referrerPolicy === undefined) {
    finalInit.referrerPolicy = input.referrerPolicy;
  }
}

function propagateDuplex(source: RequestInit, target: RequestInitWithDuplex): void {
  const sourceWithDuplex = source as RequestInitWithDuplex;
  if (sourceWithDuplex.duplex !== undefined && target.duplex === undefined) {
    target.duplex = sourceWithDuplex.duplex;
  }
}

function handleRequestInput(
  fetchImpl: typeof fetch,
  input: Request,
  finalInit: RequestInitWithDuplex,
  headers: Headers
) {
  if (finalInit.duplex === undefined) {
    return fetchImpl(new Request(input, finalInit));
  }

  const cloned = input.clone();
  const baseInit = buildBaseRequestInit(cloned, headers);
  const mergedInit: RequestInitWithDuplex = {
    ...baseInit,
    ...finalInit
  };
  if (mergedInit.body === undefined) {
    mergedInit.body = cloned.body ?? undefined;
  }
  return fetchImpl(cloned.url, mergedInit);
}

function buildBaseRequestInit(request: Request, headers: Headers): RequestInitWithDuplex {
  return {
    method: request.method,
    headers,
    body: request.body ?? undefined,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    mode: request.mode,
    credentials: request.credentials,
    cache: request.cache,
    redirect: request.redirect,
    integrity: request.integrity,
    keepalive: request.keepalive,
    signal: request.signal
  };
}
