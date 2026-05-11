"use client";

import { errorFromJson, readJson } from "./safeJson";

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("accept", "application/json");
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(path, { ...init, headers, body, cache: "no-store" });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(errorFromJson(data, `HTTP ${res.status}`));
  }
  return data as T;
}
