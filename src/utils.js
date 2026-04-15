export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export const today = () => new Date().toISOString().split("T")[0];
export const fmtCur = n => "₹" + Number(n || 0).toLocaleString("en-IN");
export const fmtDate = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtTs = ts => new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const calcMgn = (m, p) => m > 0 ? (((m - p) / m) * 100).toFixed(1) : "0";

// ── Shared date helpers ──────────────────────────────────────────────────────
export const getPresetDate = k => {
  const n = new Date();
  if (k === "1d") return today();
  if (k === "7d") return new Date(n - 7*864e5).toISOString().split("T")[0];
  if (k === "30d") return new Date(n - 30*864e5).toISOString().split("T")[0];
  if (k === "90d") return new Date(n - 90*864e5).toISOString().split("T")[0];
  if (k === "6m") { const d = new Date(n); d.setMonth(d.getMonth()-6); return d.toISOString().split("T")[0]; }
  if (k === "1y") { const d = new Date(n); d.setFullYear(d.getFullYear()-1); return d.toISOString().split("T")[0]; }
  return null;
};

// ── Indian Pincode → City + State lookup ─────────────────────────────────────
export async function fetchPincodeData(pin) {
  if (!pin || String(pin).length !== 6) return null;
  try {
    const r = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const d = await r.json();
    if (d?.[0]?.Status === "Success" && d[0].PostOffice?.length) {
      const po = d[0].PostOffice[0];
      return { city: po.District || po.Name, state: po.State };
    }
  } catch {}
  return null;
}

// ── Normalise Indian state names for GST comparison ──────────────────────────
export function normaliseState(s) {
  if (!s) return "";
  return s.trim().toLowerCase().replace(/[\s&]+/g, "").replace(/andaman.*nicobar/i,"andamannicobar");
}

// ── Safe number extractor — Google Sheets sometimes returns numbers as dates ──
export function safeNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }
  if (v instanceof Date) return 0;
  return 0;
}

// ── Convenience wrappers that apply safeNum to common transaction fields ──────
export const sGst = t => safeNum(t?.gstRate);
export const sGstAmt = t => safeNum(t?.gstAmount);
export const sPrice = t => safeNum(t?.price);
export const sEffPrice = t => safeNum(t?.effectivePrice) || safeNum(t?.price);
export const sQty = t => safeNum(t?.qty);

// ── Date range filter ────────────────────────────────────────────────────────
export const inRange = (d, f, t) => {
  if (!f && !t) return true;
  if (!d) return false;
  const ds = safeDate(d);
  if (!ds) return false;
  if (f && ds < f) return false;
  if (t && ds > t) return false;
  return true;
};

// ── CSV helpers ──────────────────────────────────────────────────────────────
export const toCSV = (rows, hs) => [hs.join(","), ...rows.map(r => hs.map(k => {
  const v = r[k];
  if (v === null || v === undefined || v === "") return '""';
  if (typeof v === "number") return isNaN(v) ? '""' : String(v);
  const s = String(v);
  if (/^-?\d+(\.\d+)?$/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}).join(","))].join("\n");

export const dlCSV = (csv, name) => { const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv); a.download = name + ".csv"; a.click(); };

// ── Standardised transaction CSV builder ─────────────────────────────────────
export function buildTransactionCSVRows(transactions, products, vendors) {
  return transactions.map(t => {
    const p = products.find(pr => pr.id === t.productId);
    const rate = sGst(t);
    const ep = sEffPrice(t);
    const qty = sQty(t);
    return {
      date: t.date || "",
      type: t.type || "",
      product: p?.name || t.productName || "",
      sku: p?.sku || "",
      qty,
      pricePerUnit: sPrice(t),
      effectivePrice: ep,
      gstRate: rate,
      gstAmount: sGstAmt(t),
      value: qty * ep,
      vendor: vendors?.find(v => v.id === t.vendorId)?.name || t.vendorName || "",
      isDamaged: t.isDamaged ? "Yes" : "No",
      billRef: t.billId || "",
      billNo: t.billNo || "",
      by: t.userName || "",
      notes: t.notes || ""
    };
  });
}
export const TXN_CSV_HEADERS = ["date","type","product","sku","qty","pricePerUnit","effectivePrice","gstRate","gstAmount","value","vendor","isDamaged","billRef","billNo","by","notes"];

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

// Safe date → always YYYY-MM-DD string
export const safeDate = v => {
  if (!v) return "";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    const d = new Date(v);
    if (!isNaN(d)) return d.toISOString().split("T")[0];
    return "";
  }
  if (v instanceof Date && !isNaN(v)) return v.toISOString().split("T")[0];
  if (typeof v === "number") return new Date(v).toISOString().split("T")[0];
  return "";
};

// ── Reliable GST recalculation from bill items ─────────────────────────────
export const calcBillGst = (bill) => {
  if (!bill) return 0;
  const isPurchase = bill.type === "purchase";
  if (Array.isArray(bill.items) && bill.items.length > 0) {
    const gstFromItems = bill.items.reduce((s, i) => {
      const rate = safeNum(i.gstRate);
      if (!rate) return s;
      const price = safeNum(i.effectivePrice) || safeNum(i.price) || safeNum(i.mrp);
      const qty = safeNum(i.qty);
      if (!price || !qty) return s;
      return s + (isPurchase
        ? qty * price * rate / 100
        : qty * price * rate / (100 + rate));
    }, 0);
    if (gstFromItems > 0) return gstFromItems;
  }
  const total = safeNum(bill.total);
  const stored = isPurchase ? safeNum(bill.totalGst) : safeNum(bill.saleGstInfo);
  if (stored > 0 && stored < total * 0.30) return stored;
  return 0;
};

// ── Password hashing ─────────────────────────────────────────────────────────
export const hashPassword = async (pass) => {
  const msgBuffer = new TextEncoder().encode("sw2026:" + pass);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
};
export const checkPassword = async (pass, stored) => {
  if (!stored) return false;
  if (!stored.startsWith("sha256:")) return pass === stored;
  const hashed = await hashPassword(pass);
  return "sha256:" + hashed === stored;
};
