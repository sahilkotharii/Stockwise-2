import React, { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, DollarSign, BarChart2, Box, Download } from "lucide-react";
import { useT } from "../theme";
import { GBtn, GIn } from "../components/UI";
import { fmtCur, toCSV, dlCSV, calcBillGst } from "../utils";

/* ── Safe date string: always returns YYYY-MM-DD or empty string ──────── */
function safeDate(val) {
  if (!val) return "";
  if (typeof val === "string") {
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
    // Try parsing
    const d = new Date(val);
    if (!isNaN(d)) return d.toISOString().split("T")[0];
    return "";
  }
  if (val instanceof Date && !isNaN(val)) return val.toISOString().split("T")[0];
  return "";
}

function inPeriod(dateVal, df, dt) {
  const d = safeDate(dateVal);
  if (!d) return false;
  return d >= df && d <= dt;
}

function Row({ label, value, indent = 0, bold = false, color, separator }) {
  const T = useT();
  return (
    <>
      {separator && <tr><td colSpan={2} style={{ padding: "3px 0", borderTop: `1px solid ${T.borderSubtle}` }} /></tr>}
      <tr>
        <td style={{ padding: "5px 8px", paddingLeft: 8 + indent * 18, color: bold ? T.text : T.textSub, fontWeight: bold ? 700 : 400, fontSize: bold ? 13 : 12 }}>{label}</td>
        <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: bold ? 700 : 500, fontSize: bold ? 13 : 12, color: color || (bold ? T.text : T.textSub) }}>
          {typeof value === "number" ? fmtCur(value) : value}
        </td>
      </tr>
    </>
  );
}

export default function PnL({ ctx }) {
  const T = useT();
  const { bills = [], transactions = [], products = [] } = ctx;

  // ── Default to current Indian financial year (Apr–Mar) ──────────────────
  const now = new Date();
  const fyStart = now.getMonth() >= 3
    ? `${now.getFullYear()}-04-01`
    : `${now.getFullYear() - 1}-04-01`;
  const fyEnd = now.getMonth() >= 3
    ? `${now.getFullYear() + 1}-03-31`
    : `${now.getFullYear()}-03-31`;

  const [df, setDf] = useState(fyStart);
  const [dt, setDt] = useState(fyEnd);
  const [activeSection, setActiveSection] = useState("all");

  const pp = pid => Number(products.find(pr => pr.id === pid)?.purchasePrice || 0);

  // ── All memos — use safeDate for robust comparison ──────────────────────
  const saleBills = useMemo(() =>
    bills.filter(b => b.type === "sale" && inPeriod(b.date, df, dt)),
    [bills, df, dt]);

  const purBills = useMemo(() =>
    bills.filter(b => b.type === "purchase" && inPeriod(b.date, df, dt)),
    [bills, df, dt]);

  const retTxns = useMemo(() =>
    transactions.filter(t => t.type === "return" && inPeriod(t.date, df, dt)),
    [transactions, df, dt]);

  const purRetTxns = useMemo(() =>
    transactions.filter(t => t.type === "purchase_return" && inPeriod(t.date, df, dt)),
    [transactions, df, dt]);

  // ── REVENUE (from bills — ground truth) ─────────────────────────────────
  const grossSalesInclGst = useMemo(() =>
    saleBills.reduce((s, b) => s + Number(b.total || 0), 0), [saleBills]);

  const gstOnSales = useMemo(() =>
    saleBills.reduce((s, b) => s + calcBillGst(b), 0), [saleBills]);

  const grossSalesExclGst = grossSalesInclGst - gstOnSales;

  const salesReturnInclGst = useMemo(() =>
    retTxns.reduce((s, t) => s + Number(t.qty) * Number(t.price || 0), 0), [retTxns]);

  const salesReturnGst = useMemo(() =>
    retTxns.reduce((s, t) => {
      const rate = Number(t.gstRate || products.find(p => p.id === t.productId)?.gstRate || 0);
      return s + Number(t.qty) * Number(t.price || 0) * rate / (100 + rate);
    }, 0), [retTxns, products]);

  const salesReturnExclGst = salesReturnInclGst - salesReturnGst;
  const netRevenueInclGst = grossSalesInclGst - salesReturnInclGst;
  const netRevenueExclGst = grossSalesExclGst - salesReturnExclGst;

  // ── COGS ─────────────────────────────────────────────────────────────────
  // Opening stock = stock value at start of period (all txns BEFORE df)
  const openingStockValue = useMemo(() => {
    return products.reduce((s, pr) => {
      const qty = transactions
        .filter(t => t.productId === pr.id && safeDate(t.date) < df)
        .reduce((ss, t) => {
          const type = t.type || "";
          if (["opening", "purchase", "return"].includes(type)) return ss + Number(t.qty);
          if (["sale", "damaged", "purchase_return"].includes(type)) return ss - Number(t.qty);
          return ss;
        }, 0);
      return s + Math.max(0, qty) * Number(pr.purchasePrice || 0);
    }, 0);
  }, [products, transactions, df]);

  // Purchases ex-GST = sum of bill subtotals (ex-GST by definition)
  const purchasesExclGst = useMemo(() =>
    purBills.reduce((s, b) => s + Number(b.subtotal || 0), 0), [purBills]);

  const purchaseReturnValue = useMemo(() =>
    purRetTxns.reduce((s, t) => s + Number(t.qty) * Number(t.price || 0), 0), [purRetTxns]);

  const netPurchases = purchasesExclGst - purchaseReturnValue;

  // Closing stock = stock value at end of period (all txns UP TO dt)
  const closingStockValue = useMemo(() => {
    return products.reduce((s, pr) => {
      const qty = transactions
        .filter(t => t.productId === pr.id && safeDate(t.date) <= dt)
        .reduce((ss, t) => {
          const type = t.type || "";
          if (["opening", "purchase", "return"].includes(type)) return ss + Number(t.qty);
          if (["sale", "damaged", "purchase_return"].includes(type)) return ss - Number(t.qty);
          return ss;
        }, 0);
      return s + Math.max(0, qty) * Number(pr.purchasePrice || 0);
    }, 0);
  }, [products, transactions, dt]);

  const cogs = openingStockValue + netPurchases - closingStockValue;
  const grossProfit = netRevenueExclGst - cogs;
  const grossMargin = netRevenueExclGst > 0 ? (grossProfit / netRevenueExclGst * 100) : 0;

  // ── GST SUMMARY ──────────────────────────────────────────────────────────
  const gstOnPurchases = useMemo(() =>
    purBills.reduce((s, b) => s + Number(b.totalGst || 0), 0), [purBills]);

  const gstOnPurReturns = useMemo(() =>
    purRetTxns.reduce((s, t) => {
      const rate = Number(t.gstRate || products.find(p => p.id === t.productId)?.gstRate || 0);
      return s + Number(t.qty) * Number(t.price || 0) * rate / 100;
    }, 0), [purRetTxns, products]);

  const netInputCredit = gstOnPurchases - gstOnPurReturns;
  const netOutputGst = gstOnSales - salesReturnGst;
  const netGstPayable = netOutputGst - netInputCredit;

  // ── Indicative Balance Sheet ──────────────────────────────────────────────
  const totalAssets = closingStockValue + netRevenueInclGst;
  const netWorth = grossProfit - netGstPayable;

  // ── CSV Export ──────────────────────────────────────────────────────────
  const exportPnL = () => dlCSV(toCSV([
    { section: "REVENUE", item: "Gross Sales (incl GST)", value: grossSalesInclGst },
    { section: "REVENUE", item: "GST on Sales", value: gstOnSales },
    { section: "REVENUE", item: "Gross Sales (excl GST)", value: grossSalesExclGst },
    { section: "REVENUE", item: "Sales Returns (excl GST)", value: salesReturnExclGst },
    { section: "REVENUE", item: "Net Revenue (excl GST)", value: netRevenueExclGst },
    { section: "COGS", item: "Opening Stock (ex-GST)", value: openingStockValue },
    { section: "COGS", item: "Purchases (excl GST)", value: purchasesExclGst },
    { section: "COGS", item: "Purchase Returns", value: purchaseReturnValue },
    { section: "COGS", item: "Closing Stock (ex-GST)", value: closingStockValue },
    { section: "COGS", item: "Total COGS", value: cogs },
    { section: "PROFIT", item: "Gross Profit", value: grossProfit },
    { section: "PROFIT", item: "Gross Margin %", value: grossMargin.toFixed(2) + "%" },
    { section: "GST", item: "Output GST (on sales)", value: netOutputGst },
    { section: "GST", item: "Input GST Credit (purchases)", value: netInputCredit },
    { section: "GST", item: "Net GST Payable", value: netGstPayable },
  ], ["section", "item", "value"]), `pnl_${df}_to_${dt}`);

  const tabBtn = s => ({
    padding: "7px 16px", borderRadius: 99, fontSize: 12, fontWeight: 600, border: "none",
    cursor: "pointer", background: activeSection === s ? T.accent : "transparent",
    color: activeSection === s ? "#fff" : T.textSub, transition: "all .15s"
  });

  // Debug helper — shows if data is being found
  const dataStatus = `${saleBills.length} sale bills · ${purBills.length} purchase bills · ${retTxns.length} returns`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 18, color: T.text }}>P&L Statement & Balance Sheet</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Indicative · Based on recorded transactions</div>
        </div>
        <GBtn v="ghost" sz="sm" onClick={exportPnL} icon={<Download size={13} />}>Export P&L CSV</GBtn>
      </div>

      {/* Date range */}
      <div className="glass" style={{ padding: "12px 16px", borderRadius: 12 }}>
        <div className="filter-wrap">
          <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>PERIOD</span>
          <input type="date" className="inp" value={df} onChange={e => setDf(e.target.value)} style={{ flex: "0 1 130px" }} />
          <span style={{ fontSize: 12, color: T.textMuted }}>→</span>
          <input type="date" className="inp" value={dt} onChange={e => setDt(e.target.value)} style={{ flex: "0 1 130px" }} />
          <button onClick={() => { setDf(fyStart); setDt(fyEnd); }} style={{ padding: "6px 14px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: `1px solid ${T.borderSubtle}`, cursor: "pointer", background: "transparent", color: T.textSub }}>Current FY</button>
          <button onClick={() => { const y = now.getFullYear(); setDf(`${y}-01-01`); setDt(`${y}-12-31`); }} style={{ padding: "6px 14px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: `1px solid ${T.borderSubtle}`, cursor: "pointer", background: "transparent", color: T.textSub }}>Calendar Year</button>
          <span style={{ fontSize: 10, color: T.textMuted, marginLeft: "auto" }}>{dataStatus}</span>
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: 6 }}>
        {[["all","All"], ["pnl","P&L"], ["gst","GST Summary"], ["balance","Balance Sheet"]].map(([s, l]) => (
          <button key={s} style={tabBtn(s)} onClick={() => setActiveSection(s)}>{l}</button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="kgrid" style={{ gap: 12 }}>
        {[
          { label: "Net Revenue", value: netRevenueExclGst, sub: "excl. GST · after returns", icon: TrendingUp, color: T.green },
          { label: "COGS", value: cogs, sub: "opening + purchases − closing", icon: TrendingDown, color: T.blue },
          { label: "Gross Profit", value: grossProfit, sub: grossMargin.toFixed(1) + "% margin", icon: DollarSign, color: grossProfit >= 0 ? T.accent : T.red },
          { label: netGstPayable >= 0 ? "GST Payable" : "GST Credit", value: Math.abs(netGstPayable), sub: "output − input credit", icon: BarChart2, color: netGstPayable >= 0 ? T.amber : T.green },
        ].map((k, i) => (
          <div key={i} className="kcard glass">
            <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: `${k.color}12` }} />
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${k.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><k.icon size={15} color={k.color} /></div>
            <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 18, color: k.value < 0 ? T.red : T.text }}>{fmtCur(k.value)}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textSub, marginTop: 1 }}>{k.label}</div>
            <div style={{ fontSize: 10, color: T.textMuted }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        {/* P&L Statement */}
        {(activeSection === "all" || activeSection === "pnl") && (
          <div className="glass" style={{ padding: 20, borderRadius: T.radius }}>
            <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 4 }}>📊 Profit & Loss</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>{df} → {dt}</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <Row label="INCOME" bold />
                <Row label="Gross Sales (incl. GST)" value={grossSalesInclGst} indent={1} color={T.green} />
                <Row label="Less: GST on Sales" value={-gstOnSales} indent={1} color={T.textMuted} />
                <Row label="Gross Sales (excl. GST)" value={grossSalesExclGst} indent={1} bold />
                <Row label="Less: Sales Returns (excl. GST)" value={-salesReturnExclGst} indent={1} color={T.red} />
                <Row label="Net Revenue (excl. GST)" value={netRevenueExclGst} bold color={T.green} separator />

                <Row label="COST OF GOODS SOLD" bold />
                <Row label="Opening Stock" value={openingStockValue} indent={1} />
                <Row label="Add: Purchases (excl. GST)" value={purchasesExclGst} indent={1} color={T.blue} />
                <Row label="Less: Purchase Returns" value={-purchaseReturnValue} indent={1} color={T.textMuted} />
                <Row label="Less: Closing Stock" value={-closingStockValue} indent={1} color={T.textMuted} />
                <Row label="Total COGS" value={cogs} bold color={T.red} separator />

                <Row label="GROSS PROFIT" value={grossProfit} bold color={grossProfit >= 0 ? T.green : T.red} separator />
                <Row label="Gross Margin" value={grossMargin.toFixed(1) + "%"} indent={1} color={T.textMuted} />
              </tbody>
            </table>
          </div>
        )}

        {/* GST Summary */}
        {(activeSection === "all" || activeSection === "gst") && (
          <div className="glass" style={{ padding: 20, borderRadius: T.radius }}>
            <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 4 }}>🧾 GST Summary</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>Indicative GST position for this period</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <Row label="OUTPUT TAX (Sales)" bold />
                <Row label="GST collected on sales" value={gstOnSales} indent={1} color={T.amber} />
                <Row label="Less: GST on sales returns" value={-salesReturnGst} indent={1} color={T.textMuted} />
                <Row label="Net Output GST" value={netOutputGst} bold color={T.amber} separator />

                <Row label="INPUT TAX CREDIT (Purchases)" bold />
                <Row label="GST paid on purchases" value={gstOnPurchases} indent={1} color={T.green} />
                <Row label="Less: GST on purchase returns" value={-gstOnPurReturns} indent={1} color={T.textMuted} />
                <Row label="Net Input Credit" value={netInputCredit} bold color={T.green} separator />

                <Row label={netGstPayable >= 0 ? "NET GST PAYABLE" : "NET GST CREDIT"} value={Math.abs(netGstPayable)} bold color={netGstPayable >= 0 ? T.red : T.green} separator />
              </tbody>
            </table>
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: netGstPayable >= 0 ? T.amberBg : T.greenBg, fontSize: 12, color: netGstPayable >= 0 ? T.amber : T.green }}>
              {netGstPayable >= 0 ? `⚠️ You owe ${fmtCur(netGstPayable)} in GST.` : `✅ Excess input credit: ${fmtCur(Math.abs(netGstPayable))}`}
            </div>
          </div>
        )}

        {/* Balance Sheet */}
        {(activeSection === "all" || activeSection === "balance") && (
          <div className="glass" style={{ padding: 20, borderRadius: T.radius, gridColumn: activeSection === "balance" ? "1 / -1" : "auto" }}>
            <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 4 }}>🏦 Indicative Balance Sheet</div>
            <div style={{ fontSize: 11, color: T.amber, marginBottom: 14 }}>⚠️ Simplified view only. Consult your CA for a certified balance sheet.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 8, borderBottom: `2px solid ${T.green}`, paddingBottom: 5 }}>ASSETS</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    <Row label="Current Assets" bold />
                    <Row label="Inventory (ex-GST)" value={closingStockValue} indent={1} color={T.accent} />
                    <Row label="Sales Proceeds (net, indicative)" value={netRevenueInclGst} indent={1} color={T.green} />
                    <Row label="Total Assets" value={totalAssets} bold color={T.green} separator />
                  </tbody>
                </table>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 8, borderBottom: `2px solid ${T.red}`, paddingBottom: 5 }}>LIABILITIES & EQUITY</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    <Row label="Liabilities" bold />
                    <Row label="GST Payable" value={Math.max(0, netGstPayable)} indent={1} color={T.amber} />
                    <Row label="Total Liabilities" value={Math.max(0, netGstPayable)} bold color={T.red} separator />
                    <Row label="Equity" bold />
                    <Row label="Gross Profit (period)" value={grossProfit} indent={1} color={grossProfit >= 0 ? T.green : T.red} />
                    <Row label="Less: Net GST Payable" value={-netGstPayable} indent={1} color={T.textMuted} />
                    <Row label="Net Equity" value={netWorth} bold color={netWorth >= 0 ? T.green : T.red} separator />
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
