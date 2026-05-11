const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3004").replace(/\/$/, "");
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15_000);

const routes = [
  "/",
  "/market",
  "/portfolio",
  "/faq",
  "/artist",
  "/admin/login",
  "/coin/ZDaUDL4XFdEct7UgeztrFQAptsvh4ZdhyZDZ1RpxYAK",
  "/api/coins?sort=quality",
  "/api/launch/status",
  "/api/health",
];

const failures = [];

for (const route of routes) {
  const url = `${baseUrl}${route}`;
  const started = Date.now();
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: "manual", signal: ctrl.signal });
    const text = await res.text();
    const ms = Date.now() - started;
    const broken =
      res.status >= 500 ||
      /Application error|Unhandled Runtime Error|Cannot find module|Failed to pipe response/i.test(text);
    const ok = res.status < 500 && !broken;
    console.log(`${ok ? "ok" : "fail"} ${res.status} ${String(ms).padStart(5)}ms ${route}`);
    if (!ok) failures.push({ route, status: res.status });
  } catch (error) {
    const ms = Date.now() - started;
    const message = error instanceof Error && error.name === "AbortError"
      ? `timed out after ${timeoutMs}ms`
      : error instanceof Error ? error.message : String(error);
    console.log(`fail 000 ${String(ms).padStart(5)}ms ${route} ${message}`);
    failures.push({ route, status: 0 });
  } finally {
    clearTimeout(timeout);
  }
}

if (failures.length) {
  console.error(`\nSmoke failed for ${failures.length} route(s).`);
  process.exit(1);
}

console.log("\nSmoke passed.");
