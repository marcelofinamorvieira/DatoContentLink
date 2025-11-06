export type DatoQueryArgs<TVariables extends Record<string, unknown>> = {
  query: string;
  variables?: TVariables;
  preview?: boolean;
};

type GraphQLResponse<TData> = {
  data: TData;
  errors?: Array<{ message: string }>;
};

export async function datoQuery<TData, TVariables extends Record<string, unknown> = Record<string, never>>({
  query,
  variables = {} as TVariables,
  preview = false
}: DatoQueryArgs<TVariables>): Promise<TData> {
  const endpoint = preview
    ? process.env.DATO_PREVIEW_API_URL ?? 'https://graphql.datocms.com/preview'
    : process.env.DATO_API_URL ?? 'https://graphql.datocms.com/';
  const token = preview
    ? process.env.DATO_PREVIEW_API_TOKEN
    : process.env.DATO_API_TOKEN;
  const baseEditingUrl = process.env.NEXT_PUBLIC_DATO_BASE_EDITING_URL;

  if (!token) {
    throw new Error('DatoCMS API token is missing');
  }
  if (!baseEditingUrl) {
    throw new Error('NEXT_PUBLIC_DATO_BASE_EDITING_URL is required for visual editing');
  }

  const normalizedBaseEditingUrl = normalizeBaseEditingUrl(baseEditingUrl);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Visual-Editing': 'vercel-v1',
    'X-Base-Editing-Url': normalizedBaseEditingUrl
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });

  const payload = (await response.json()) as GraphQLResponse<TData>;

  if (!response.ok) {
    throw new Error(payload.errors?.[0]?.message ?? 'DatoCMS request failed');
  }

  return payload.data;
}

function normalizeBaseEditingUrl(url: string): string {
  const trimmed = url.trim();
  const sanitized = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;

  const parsed = new URL(sanitized);
  return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
}
