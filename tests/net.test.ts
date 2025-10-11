import { describe, expect, it, vi } from 'vitest';
import { withContentLinkHeaders } from '../src/net/withContentLinkHeaders.js';

describe('withContentLinkHeaders', () => {
  it('throws when X-Base-Editing-Url header is missing', async () => {
    const mockFetch = vi.fn();
    const fetchWithHeaders = withContentLinkHeaders(mockFetch as unknown as typeof fetch);

    await expect(fetchWithHeaders('https://example.com', {})).rejects.toThrow('X-Base-Editing-Url missing');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('applies default base editing url when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const defaultUrl = 'https://acme.admin.datocms.com';
    const fetchWithHeaders = withContentLinkHeaders(
      mockFetch as unknown as typeof fetch,
      defaultUrl
    );

    await fetchWithHeaders('https://example.com', {});

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get('X-Visual-Editing')).toBe('vercel-v1');
    expect(headers.get('X-Base-Editing-Url')).toBe(defaultUrl);
  });

  it('merges headers from Request input and overlays init headers and defaults', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const defaultUrl = 'https://acme.admin.datocms.com';
    const fetchWithHeaders = withContentLinkHeaders(
      mockFetch as unknown as typeof fetch,
      defaultUrl
    );

    const request = new Request('https://example.com', {
      headers: { Authorization: 'Bearer abc' }
    });

    await fetchWithHeaders(request, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [callRequest] = mockFetch.mock.calls[0] as [Request];
    expect(callRequest instanceof Request).toBe(true);
    const headers = callRequest.headers;
    expect(headers.get('Authorization')).toBe('Bearer abc');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Visual-Editing')).toBe('vercel-v1');
    expect(headers.get('X-Base-Editing-Url')).toBe(defaultUrl);
  });

  it('preserves request bodies when cloning Request inputs', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const defaultUrl = 'https://acme.admin.datocms.com';
    const fetchWithHeaders = withContentLinkHeaders(
      mockFetch as unknown as typeof fetch,
      defaultUrl
    );

    const originalBody = JSON.stringify({ ok: true });
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer abc',
        'Content-Type': 'application/json'
      },
      body: originalBody
    });

    await fetchWithHeaders(request);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [callRequest] = mockFetch.mock.calls[0] as [Request];
    expect(callRequest instanceof Request).toBe(true);
    expect(callRequest.headers.get('Authorization')).toBe('Bearer abc');
    expect(callRequest.headers.get('Content-Type')).toBe('application/json');
    expect(callRequest.headers.get('X-Base-Editing-Url')).toBe(defaultUrl);
    const clonedBody = await callRequest.clone().text();
    expect(clonedBody).toBe(originalBody);
  });

  it('preserves duplex option when provided in init', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const defaultUrl = 'https://acme.admin.datocms.com';
    const fetchWithHeaders = withContentLinkHeaders(
      mockFetch as unknown as typeof fetch,
      defaultUrl
    );

    const init = {
      method: 'POST',
      body: JSON.stringify({ ok: true }),
      headers: {
        'Content-Type': 'application/json'
      },
      duplex: 'half'
    } as RequestInit & { duplex: unknown };

    await fetchWithHeaders('https://example.com/api', init);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, callInit] = mockFetch.mock.calls[0] as [RequestInfo | URL, RequestInit & { duplex?: unknown }];
    expect((callInit).duplex).toBe('half');
    const headers = callInit.headers as Headers;
    expect(headers.get('X-Base-Editing-Url')).toBe(defaultUrl);
    expect(headers.get('X-Visual-Editing')).toBe('vercel-v1');
  });

  it('accepts lowercase x-base-editing-url header without overriding', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const fetchWithHeaders = withContentLinkHeaders(mockFetch as unknown as typeof fetch);

    await fetchWithHeaders('https://example.com/graphql', {
      headers: { 'x-base-editing-url': 'https://acme.admin.datocms.com' }
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, callInit] = mockFetch.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const headers = callInit.headers as Headers;
    expect(headers.get('X-Base-Editing-Url')).toBe('https://acme.admin.datocms.com');
  });

  it('preserves referrerPolicy when cloning Request inputs', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const defaultUrl = 'https://acme.admin.datocms.com';
    const fetchWithHeaders = withContentLinkHeaders(
      mockFetch as unknown as typeof fetch,
      defaultUrl
    );

    const request = new Request('https://example.com/graphql', {
      method: 'POST',
      headers: { Authorization: 'Bearer abc' },
      referrer: 'https://preview.example.com/page',
      referrerPolicy: 'strict-origin-when-cross-origin'
    });

    await fetchWithHeaders(request, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [callRequest] = mockFetch.mock.calls[0] as [Request];
    expect(callRequest instanceof Request).toBe(true);
    expect(callRequest.referrerPolicy).toBe('strict-origin-when-cross-origin');
  });
});
