export async function safeJson<T = any>(response: Response): Promise<T | Record<string, never>> {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as T;
  } catch {
    return {};
  }
}

export async function readJson<T = any>(response: Response): Promise<T | null> {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function errorFromJson(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const message = record.error || record.message || record.detail;
    if (message) return String(message);
  }
  return fallback;
}
