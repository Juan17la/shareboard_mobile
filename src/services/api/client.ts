import { API_BASE_URL } from '@/constants/config';

import { resolveEndpoint, type EndpointKey } from './endpoints';
import type { ApiErrorBody } from './types';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export interface RequestOptions {
  params?: Record<string, string | number>;
  body?: unknown;
  /** The caller's persistent user id -> `X-User-Id`. */
  userId?: string;
  /** Board token from `join` -> `Authorization: Bearer`. */
  token?: string;
  signal?: AbortSignal;
}

/**
 * Typed fetch wrapper. Throws `ApiError` for non-2xx responses, decoding the
 * `{ error: { code, message } }` envelope documented in docs/02-backend-connection.
 */
export async function request<T>(endpoint: EndpointKey, opts: RequestOptions = {}): Promise<T> {
  const { method, path } = resolveEndpoint(endpoint, opts.params);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.userId) headers['X-User-Id'] = opts.userId;
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    throw new ApiError('NETWORK', (err as Error).message || 'Network request failed', 0);
  }

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const body = data as ApiErrorBody | null;
    throw new ApiError(
      body?.error?.code ?? 'HTTP_ERROR',
      body?.error?.message ?? `Request failed (${res.status})`,
      res.status,
    );
  }
  return data as T;
}
