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
  actLog: "sw_al"
};

export const lsGet = async (k, fb) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }
  catch { return fb; }
};

export const lsSet = async (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); }
  catch {}
};
