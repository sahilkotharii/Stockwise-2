export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export const today = () => new Date().toISOString().split("T")[0];
export const fmtCur = n => "₹" + Number(n || 0).toLocaleString("en-IN");
export const fmtDate = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtTs = ts => new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const fmtMon = d => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
export const calcMgn = (m, p) => m > 0 ? (((m - p) / m) * 100).toFixed(1) : "0";
export const inRange = (d, f, t) => {
  if (!f && !t) return true;
  if (!d) return false;
  const ds = safeDate(d);
  if (!ds) return false;
  if (f && ds < f) return false;
  if (t && ds > t) return false;
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
export const monthOf = d => {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 7);
  if (d instanceof Date && !isNaN(d)) return d.toISOString().slice(0, 7);
  return "";
};

// Safe date → always YYYY-MM-DD string (handles any date format)
export const safeDate = v => {
  if (!v) return "";
  if (typeof v === "string") {
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    // Try parsing any other string (handles "Wed Apr 08 2026...", ISO etc.)
    const d = new Date(v);
    if (!isNaN(d)) return d.toISOString().split("T")[0];
    return "";
  }
  if (v instanceof Date && !isNaN(v)) return v.toISOString().split("T")[0];
  if (typeof v === "number") return new Date(v).toISOString().split("T")[0];
  return "";
};

// ── Reliable GST recalculation from bill items ─────────────────────────────
// Works for both old bills (missing effectivePrice) and new bills.
// Sale: MRP incl GST  →  GST = price × rate / (100 + rate)
// Purchase: cost ex-GST →  GST = price × rate / 100
export const calcBillGst = (bill) => {
  if (!bill) return 0;
  const isPurchase = bill.type === "purchase";

  // Try items first (most accurate)
  if (Array.isArray(bill.items) && bill.items.length > 0) {
    const gstFromItems = bill.items.reduce((s, i) => {
      const rate = Number(i.gstRate || 0);
      if (!rate) return s;
      // Use effectivePrice if available (after discount), else price
      const price = Number(i.effectivePrice ?? i.price ?? i.mrp ?? 0) || 0;
      const qty = Number(i.qty ?? 0) || 0;
      if (!price || !qty) return s;
      return s + (isPurchase
        ? qty * price * rate / 100
        : qty * price * rate / (100 + rate));
    }, 0);
    if (gstFromItems > 0) return gstFromItems;
  }

  // Fallback: use stored values if items yield 0 (e.g. all items have gstRate=0)
  // For sales: saleGstInfo; for purchase: totalGst — only trust if they look sane
  const total = Number(bill.total || 0);
  const stored = isPurchase ? Number(bill.totalGst || 0) : Number(bill.saleGstInfo || 0);
  // Sanity check: stored GST shouldn't exceed 40% of total
  if (stored > 0 && stored < total * 0.40) return stored;

  return 0;
};
