const DEFAULT_TIMEOUT_MS = 5_000;

async function responseMessage(res: Response) {
  const fallback = `request failed: ${res.status}`;
  try {
    const text = await res.text();
    if (!text) return fallback;
    try {
      const json = JSON.parse(text);
      return json?.error || json?.message || json?.detail || text.slice(0, 240);
    } catch {
      return text.slice(0, 240);
    }
  } catch {
    return fallback;
  }
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(await responseMessage(res));
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchText(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(await responseMessage(res));
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}
