// API secret must match API_SECRET in Code.gs
const SW_SECRET = "sw_pipal_2026_secret";

const fetchWithTimeout = (url, options = {}, ms = 10000) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

export async function sheetsGet(url) {
  const r = await fetchWithTimeout(url + "?action=getAll", {}, 10000);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error);
  return j.data;
}

export async function sheetsPost(url, body) {
  const r = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ ...body, secret: SW_SECRET })
  }, 12000);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error);
  return j;
}

export async function syncEnt(url, entity, rows) {
  return sheetsPost(url, { action: "syncAll", entity, rows });
}
