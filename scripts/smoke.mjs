const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3004").replace(/\/$/, "");

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
];

const failures = [];

for (const route of routes) {
  const url = `${baseUrl}${route}`;
  const started = Date.now();
  try {
    const res = await fetch(url, { redirect: "manual" });
    const text = await res.text();
    const ms = Date.now() - started;
    const broken =
      res.status >= 500 ||
      /Application error|Unhandled Runtime Error|Cannot find module|Failed to pipe response/i.test(text);
    const ok = res.status < 500 && !broken;
    console.log(`${ok ? "ok" : "fail"} ${res.status} ${String(ms).padStart(5)}ms ${route}`);
    if (!ok) failures.push({ route, status: res.status });
  } catch (error) {
    console.log(`fail 000 -----ms ${route} ${error instanceof Error ? error.message : String(error)}`);
    failures.push({ route, status: 0 });
  }
}

if (failures.length) {
  console.error(`\nSmoke failed for ${failures.length} route(s).`);
  process.exit(1);
}

console.log("\nSmoke passed.");
