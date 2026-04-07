import React, { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, DollarSign, BarChart2, Box, FileText, Download } from "lucide-react";
import { useT } from "../theme";
import { GBtn, GIn, Field } from "../components/UI";
import { fmtCur, toCSV, dlCSV } from "../utils";

function Row({ label, value, indent = 0, bold = false, color, sub, separator }) {
  const T = useT();
  return (
    <>
      {separator && <tr><td colSpan={2} style={{ padding: "4px 0", borderTop: `1px solid ${T.borderSubtle}` }} /></tr>}
      <tr>
        <td style={{ padding: "5px 8px", paddingLeft: 8 + indent * 20, color: bold ? T.text : T.textSub, fontWeight: bold ? 700 : 400, fontSize: bold ? 13 : 12 }}>
          {label}
          {sub && <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 400, marginTop: 1 }}>{sub}</div>}
        </td>
        <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: bold ? 700 : 500, fontSize: bold ? 13 : 12, color: color || (bold ? T.text : T.textSub) }}>
          {typeof value === "number" ? fmtCur(value) : value}
        </td>
      </tr>
    </>
  );
}

export default function PnL({ ctx }) {
  const T = useT();
  const { bills, transactions, products, vendors, channels } = ctx;

  // Default: current financial year (April to March)
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

  // ── Period calculations ────────────────────────────────────────────────
  const saleBills = useMemo(() => bills.filter(b => b.type === "sale" && b.date >= df && b.date <= dt), [bills, df, dt]);
  const purBills = useMemo(() => bills.filter(b => b.type === "purchase" && b.date >= df && b.date <= dt), [bills, df, dt]);
  const retTxns = useMemo(() => transactions.filter(t => t.type === "return" && t.date >= df && t.date <= dt), [transactions, df, dt]);
  const purRetTxns = useMemo(() => transactions.filter(t => t.type === "purchase_return" && t.date >= df && t.date <= dt), [transactions, df, dt]);

  // ── REVENUE ──────────────────────────────────────────────────────────────
  const grossSalesInclGst = saleBills.reduce((s, b) => s + Number(b.total || 0), 0);
  const gstOnSales = saleBills.reduce((s, b) => s + Number(b.saleGstInfo || 0), 0);
  const grossSalesExclGst = grossSalesInclGst - gstOnSales;

  const salesReturnInclGst = retTxns.reduce((s, t) => s + Number(t.qty) * Number(t.price || 0), 0);
  const salesReturnGst = retTxns.reduce((s, t) => {
    const rate = Number(t.gstRate || products.find(p => p.id === t.productId)?.gstRate || 0);
    return s + Number(t.qty) * Number(t.price || 0) * rate / (100 + rate);
  }, 0);
  const salesReturnExclGst = salesReturnInclGst - salesReturnGst;

  const netRevenueInclGst = grossSalesInclGst - salesReturnInclGst;
  const netRevenueExclGst = grossSalesExclGst - salesReturnExclGst;

  // ── COGS ─────────────────────────────────────────────────────────────────
  // Opening inventory = stock as of df (all transactions BEFORE df)
  const openingStockValue = useMemo(() => {
    return products.reduce((s, pr) => {
      const openStock = transactions.filter(t => t.productId === pr.id && t.date < df).reduce((ss, t) => {
        if (["opening", "purchase", "return"].includes(t.type)) return ss + Number(t.qty);
        if (["sale", "damaged", "purchase_return"].includes(t.type)) return ss - Number(t.qty);
        return ss;
      }, 0);
      return s + Math.max(0, openStock) * Number(pr.purchasePrice || 0);
    }, 0);
  }, [products, transactions, df]);

  const purchasesExclGst = purBills.reduce((s, b) => s + Number(b.subtotal || 0), 0);
  const purchaseReturnValue = purRetTxns.reduce((s, t) => s + Number(t.qty) * Number(t.price || 0), 0);
  const netPurchases = purchasesExclGst - purchaseReturnValue;

  // Closing inventory = current stock * purchasePrice
  const closingStockValue = useMemo(() => {
    const endTxns = transactions.filter(t => t.date <= dt);
    return products.reduce((s, pr) => {
      const stock = endTxns.filter(t => t.productId === pr.id).reduce((ss, t) => {
        if (["opening", "purchase", "return"].includes(t.type)) return ss + Number(t.qty);
        if (["sale", "damaged", "purchase_return"].includes(t.type)) return ss - Number(t.qty);
        return ss;
      }, 0);
      return s + Math.max(0, stock) * Number(pr.purchasePrice || 0);
    }, 0);
  }, [products, transactions, dt]);

  const cogs = openingStockValue + netPurchases - closingStockValue;
  const grossProfit = netRevenueExclGst - cogs;
  const grossMargin = netRevenueExclGst > 0 ? (grossProfit / netRevenueExclGst * 100) : 0;

  // ── GST SUMMARY ──────────────────────────────────────────────────────────
  const gstOnPurchases = purBills.reduce((s, b) => s + Number(b.totalGst || 0), 0);
  const gstOnPurReturns = purRetTxns.reduce((s, t) => {
    const rate = Number(t.gstRate || products.find(p => p.id === t.productId)?.gstRate || 0);
    return s + Number(t.qty) * Number(t.price || 0) * rate / 100;
  }, 0);
  const netInputCredit = gstOnPurchases - gstOnPurReturns;
  const netOutputGst = gstOnSales - salesReturnGst;
  const netGstPayable = netOutputGst - netInputCredit;

  // ── BALANCE SHEET (indicative) ──────────────────────────────────────────
  // Assets
  const currentAssets_Inventory = closingStockValue;
  const currentAssets_Cash = netRevenueInclGst; // simplified: cash collected from sales
  const totalAssets = currentAssets_Inventory + currentAssets_Cash;

  // Liabilities
  const liability_GstPayable = Math.max(0, netGstPayable);
  const liability_PurchasePayables = purBills.reduce((s, b) => s + Number(b.total || 0), 0) - 
    (netPurchases + gstOnPurchases); // simplified
  const totalLiabilities = liability_GstPayable;
  const netWorth = grossProfit - netGstPayable;

  // ── CSV export ──────────────────────────────────────────────────────────
  const exportPnL = () => {
    const rows = [
      { section: "REVENUE", item: "Gross Sales (incl GST)", value: grossSalesInclGst },
      { section: "REVENUE", item: "GST Collected on Sales", value: gstOnSales },
      { section: "REVENUE", item: "Gross Sales (excl GST)", value: grossSalesExclGst },
      { section: "REVENUE", item: "Sales Returns (excl GST)", value: salesReturnExclGst },
      { section: "REVENUE", item: "Net Revenue (excl GST)", value: netRevenueExclGst },
      { section: "COGS", item: "Opening Stock", value: openingStockValue },
      { section: "COGS", item: "Purchases (excl GST)", value: purchasesExclGst },
      { section: "COGS", item: "Purchase Returns", value: purchaseReturnValue },
      { section: "COGS", item: "Closing Stock", value: closingStockValue },
      { section: "COGS", item: "Total COGS", value: cogs },
      { section: "PROFIT", item: "Gross Profit", value: grossProfit },
      { section: "PROFIT", item: "Gross Margin %", value: grossMargin.toFixed(2) + "%" },
      { section: "GST", item: "Output GST (Sales)", value: netOutputGst },
      { section: "GST", item: "Input GST Credit (Purchases)", value: netInputCredit },
      { section: "GST", item: "Net GST Payable", value: netGstPayable },
    ];
    dlCSV(toCSV(rows, ["section", "item", "value"]), `pnl_${df}_to_${dt}`);
  };

  const sectionStyle = (active) => ({
    flex: 1, padding: "8px 16px", borderRadius: 99, fontSize: 12, fontWeight: 600, border: "none",
    cursor: "pointer", background: activeSection === active ? T.accent : "transparent",
    color: activeSection === active ? "#fff" : T.textSub, transition: "all .15s"
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 18, color: T.text }}>P&L Statement & Balance Sheet</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Indicative — based on your recorded transactions</div>
        </div>
        <GBtn v="ghost" sz="sm" onClick={exportPnL} icon={<Download size={13} />}>Export P&L CSV</GBtn>
      </div>

      {/* Date range */}
      <div className="glass" style={{ padding: "12px 16px", borderRadius: 12 }}>
        <div className="filter-wrap">
          <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>PERIOD</span>
          <GIn type="date" value={df} onChange={e => setDf(e.target.value)} style={{ flex: "0 1 130px" }} />
          <span style={{ fontSize: 12, color: T.textMuted }}>→</span>
          <GIn type="date" value={dt} onChange={e => setDt(e.target.value)} style={{ flex: "0 1 130px" }} />
          <button onClick={() => { setDf(fyStart); setDt(fyEnd); }} style={{ padding: "6px 14px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: `1px solid ${T.borderSubtle}`, cursor: "pointer", background: "transparent", color: T.textSub }}>Current FY</button>
          <button onClick={() => { const y = now.getFullYear(); setDf(`${y}-01-01`); setDt(`${y}-12-31`); }} style={{ padding: "6px 14px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: `1px solid ${T.borderSubtle}`, cursor: "pointer", background: "transparent", color: T.textSub }}>Calendar Year</button>
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: 6 }}>
        {["all", "pnl", "gst", "balance"].map(s => (
          <button key={s} style={sectionStyle(s)} onClick={() => setActiveSection(s)}>
            {s === "all" ? "All" : s === "pnl" ? "P&L Statement" : s === "gst" ? "GST Summary" : "Balance Sheet"}
          </button>
        ))}
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <div className="kcard glass">
          <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: `${T.green}12` }} />
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `${T.green}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><TrendingUp size={15} color={T.green} /></div>
          <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 18, color: T.text }}>{fmtCur(netRevenueExclGst)}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.textSub, marginTop: 1 }}>Net Revenue</div>
          <div style={{ fontSize: 10, color: T.textMuted }}>excl. GST · after returns</div>
        </div>
        <div className="kcard glass">
          <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: `${cogs < 0 ? T.red : T.blue}12` }} />
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `${T.blue}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><TrendingDown size={15} color={T.blue} /></div>
          <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 18, color: T.text }}>{fmtCur(cogs)}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.textSub, marginTop: 1 }}>COGS</div>
          <div style={{ fontSize: 10, color: T.textMuted }}>cost of goods sold</div>
        </div>
        <div className="kcard glass">
          <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: `${grossProfit >= 0 ? T.accent : T.red}12` }} />
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `${T.accent}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><DollarSign size={15} color={T.accent} /></div>
          <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 18, color: grossProfit >= 0 ? T.green : T.red }}>{fmtCur(grossProfit)}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.textSub, marginTop: 1 }}>Gross Profit</div>
          <div style={{ fontSize: 10, color: T.textMuted }}>{grossMargin.toFixed(1)}% margin</div>
        </div>
        <div className="kcard glass">
          <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: `${netGstPayable >= 0 ? T.amber : T.green}12` }} />
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `${T.amber}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><BarChart2 size={15} color={T.amber} /></div>
          <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 18, color: netGstPayable >= 0 ? T.amber : T.green }}>{fmtCur(Math.abs(netGstPayable))}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.textSub, marginTop: 1 }}>Net GST {netGstPayable >= 0 ? "Payable" : "Credit"}</div>
          <div style={{ fontSize: 10, color: T.textMuted }}>output - input credit</div>
        </div>
      </div>

      <div className="chart-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* P&L Statement */}
        {(activeSection === "all" || activeSection === "pnl") && (
          <div className="glass" style={{ padding: 20, borderRadius: T.radius }}>
            <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>
              📊 Profit & Loss Statement
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 10 }}>Period: {df} to {dt}</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <Row label="INCOME" bold />
                <Row label="Gross Sales (incl GST)" value={grossSalesInclGst} indent={1} color={T.green} />
                <Row label="Less: GST on Sales (liability)" value={-gstOnSales} indent={1} color={T.textMuted} />
                <Row label="Gross Sales (excl GST)" value={grossSalesExclGst} indent={1} bold />
                <Row label="Less: Sales Returns (excl GST)" value={-salesReturnExclGst} indent={1} color={T.red} />
                <Row label="Net Revenue (excl GST)" value={netRevenueExclGst} bold color={T.green} separator />

                <Row label="COST OF GOODS SOLD" bold />
                <Row label="Opening Stock" value={openingStockValue} indent={1} />
                <Row label="Add: Purchases (excl GST)" value={purchasesExclGst} indent={1} color={T.blue} />
                <Row label="Less: Purchase Returns" value={-purchaseReturnValue} indent={1} color={T.textMuted} />
                <Row label="Less: Closing Stock" value={-closingStockValue} indent={1} color={T.textMuted} />
                <Row label="Total COGS" value={cogs} bold color={T.red} separator />

                <Row label="GROSS PROFIT" value={grossProfit} bold color={grossProfit >= 0 ? T.green : T.red} separator />
                <Row label={`Gross Margin`} value={grossMargin.toFixed(1) + "%"} indent={1} color={T.textMuted} />
              </tbody>
            </table>
          </div>
        )}

        {/* GST Summary */}
        {(activeSection === "all" || activeSection === "gst") && (
          <div className="glass" style={{ padding: 20, borderRadius: T.radius }}>
            <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>
              🧾 GST Summary
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 10 }}>Indicative GST liability for this period</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <Row label="OUTPUT TAX (on Sales)" bold />
                <Row label="GST Collected on Sales" value={gstOnSales} indent={1} color={T.amber} />
                <Row label="Less: GST on Returns" value={-salesReturnGst} indent={1} color={T.textMuted} />
                <Row label="Net Output GST" value={netOutputGst} bold color={T.amber} separator />

                <Row label="INPUT TAX CREDIT (on Purchases)" bold />
                <Row label="GST Paid on Purchases" value={gstOnPurchases} indent={1} color={T.green} />
                <Row label="Less: GST on Purchase Returns" value={-gstOnPurReturns} indent={1} color={T.textMuted} />
                <Row label="Net Input Credit" value={netInputCredit} bold color={T.green} separator />

                <Row label={`NET GST ${netGstPayable >= 0 ? "PAYABLE" : "CREDIT"}`} value={Math.abs(netGstPayable)} bold color={netGstPayable >= 0 ? T.red : T.green} separator />
              </tbody>
            </table>
            <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 10, background: netGstPayable >= 0 ? T.amberBg : T.greenBg, fontSize: 12, color: netGstPayable >= 0 ? T.amber : T.green }}>
              {netGstPayable >= 0
                ? `⚠️ You owe ${fmtCur(netGstPayable)} in GST for this period.`
                : `✅ You have ${fmtCur(Math.abs(netGstPayable))} in excess input credit.`}
            </div>
          </div>
        )}
      </div>

      {/* Balance Sheet */}
      {(activeSection === "all" || activeSection === "balance") && (
        <div className="glass" style={{ padding: 20, borderRadius: T.radius }}>
          <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 4 }}>🏦 Indicative Balance Sheet</div>
          <div style={{ fontSize: 11, color: T.amber, marginBottom: 14 }}>
            ⚠️ Simplified indicative view only. Consult your CA for certified balance sheet. Cash position is estimated from sales only.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Assets */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 10, borderBottom: `2px solid ${T.green}`, paddingBottom: 6 }}>ASSETS</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <Row label="Current Assets" bold />
                  <Row label="Inventory (ex-GST)" value={currentAssets_Inventory} indent={1} color={T.accent} />
                  <Row label="Sales Proceeds (net)" value={currentAssets_Cash} indent={1} color={T.green} />
                  <Row label="Total Assets (Indicative)" value={totalAssets} bold color={T.green} separator />
                </tbody>
              </table>
            </div>
            {/* Liabilities + Net Worth */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 10, borderBottom: `2px solid ${T.red}`, paddingBottom: 6 }}>LIABILITIES & EQUITY</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <Row label="Current Liabilities" bold />
                  <Row label="GST Payable" value={liability_GstPayable} indent={1} color={T.amber} />
                  <Row label="Total Liabilities" value={totalLiabilities} bold color={T.red} separator />
                  <Row label="EQUITY" bold />
                  <Row label="Gross Profit (this period)" value={grossProfit} indent={1} color={grossProfit >= 0 ? T.green : T.red} />
                  <Row label="Less: Net GST Payable" value={-netGstPayable} indent={1} color={T.textMuted} />
                  <Row label="Net Equity (Indicative)" value={netWorth} bold color={netWorth >= 0 ? T.green : T.red} separator />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
