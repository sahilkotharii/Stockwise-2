// API secret must match API_SECRET in Code.gs
const SW_SECRET = "sw_pipal_2026_secret";

export async function sheetsGet(url) {
  const r = await fetch(url + "?action=getAll");
  const j = await r.json();
  if (!j.ok) throw new Error(j.error);
  return j.data;
}

export async function sheetsPost(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ ...body, secret: SW_SECRET })
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error);
  return j;
}

export async function syncEnt(url, entity, rows) {
  return sheetsPost(url, { action: "syncAll", entity, rows });
}
