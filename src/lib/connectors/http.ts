import type { z } from 'zod';

export class FetchError extends Error {
  status: number;
  headers: Headers;

  constructor(status: number, message: string, headers: Headers = new Headers()) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.headers = headers;
  }
}

type FetchJsonOptions<T> = RequestInit & {
  timeoutMs?: number;
  schema?: z.ZodType<T>;
};

export async function fetchJson<T>(url: string | URL, options: FetchJsonOptions<T> = {}): Promise<T> {
  const { timeoutMs = 15_000, schema, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) throw new FetchError(response.status, text || response.statusText, response.headers);

    let json: unknown;
    try {
      json = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      throw new FetchError(200, 'invalid JSON response', response.headers);
    }

    return schema ? schema.parse(json) : (json as T);
  } finally {
    clearTimeout(timer);
  }
}
