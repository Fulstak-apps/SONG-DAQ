export async function safeJson<T = any>(response: Response): Promise<T | Record<string, never>> {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as T;
  } catch {
    return {};
  }
}
