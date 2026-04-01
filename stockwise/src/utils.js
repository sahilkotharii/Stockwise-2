export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export const today = () => new Date().toISOString().split("T")[0];
export const fmtCur = n => "₹" + Number(n || 0).toLocaleString("en-IN");
export const fmtDate = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtTs = ts => new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const fmtMon = d => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
export const calcMgn = (m, p) => m > 0 ? (((m - p) / m) * 100).toFixed(1) : "0";
export const inRange = (d, f, t) => {
  if (!f && !t) return true;
  const dt = new Date(d);
  if (f && dt < new Date(f)) return false;
  if (t && dt > new Date(t + "T23:59:59")) return false;
  return true;
};
export const toCSV = (rows, hs) => [hs.join(","), ...rows.map(r => hs.map(k => `"${String(r[k] || "").replace(/"/g, '""')}"`).join(","))].join("\n");
export const dlCSV = (csv, name) => { const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv); a.download = name + ".csv"; a.click(); };
export const getLast12Months = () => {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), year: d.getFullYear(), month: d.getMonth() });
  }
  return months;
};
export const monthOf = d => d ? d.slice(0, 7) : "";
