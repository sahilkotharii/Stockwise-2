export const SK = {
  users: "sw_u",
  products: "sw_p",
  categories: "sw_c",
  vendors: "sw_v",
  transactions: "sw_t",
  channels: "sw_ch",
  bills: "sw_b",
  sheetsUrl: "sw_url",
  seeded: "sw_ok",
  theme: "sw_th",
  changeReqs: "sw_cr",
  actLog: "sw_al",
  session: "sw_sess",
  invoiceSettings: "sw_inv"
};

export const lsGet = async (key, def) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
};
export const lsSet = async (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
};
