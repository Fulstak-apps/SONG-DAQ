const DEFAULT_ADMIN_AUDIUS_NAMES = ["Darnell Williams"];

function splitList(value?: string) {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminAudiusProfile(profile?: { name?: string | null; handle?: string | null; userId?: string | null } | null) {
  if (!profile) return false;
  const names = [
    ...DEFAULT_ADMIN_AUDIUS_NAMES.map((name) => name.toLowerCase()),
    ...splitList(process.env.ADMIN_AUDIUS_NAMES),
  ];
  const handles = splitList(process.env.ADMIN_AUDIUS_HANDLES);
  const ids = splitList(process.env.ADMIN_AUDIUS_USER_IDS);
  return (
    (profile.name ? names.includes(profile.name.trim().toLowerCase()) : false) ||
    (profile.handle ? handles.includes(profile.handle.trim().replace(/^@/, "").toLowerCase()) : false) ||
    (profile.userId ? ids.includes(String(profile.userId).trim().toLowerCase()) : false)
  );
}
