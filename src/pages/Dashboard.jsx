import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, DollarSign, ShoppingCart, Box, AlertTriangle } from "lucide-react";
import { useT } from "../theme";
import { KCard, CTip, PeriodBar } from "../components/UI";
import { fmtCur, fmtDate, calcBillGst } from "../utils";
const safeDate = v => { if (!v) return ""; if (typeof v === "string") return v.slice(0,10); if (v instanceof Date && !isNaN(v)) return v.toISOString().split("T")[0]; return ""; };

export default function Dashboard({ ctx }) {
  const T = useT();
  const { products, transactions, getStock, bills, vendors } = ctx;
  const [preset, setPreset] = useState("30d");
  const [df, setDf] = useState(new Date(Date.now()-30*864e5).toISOString().split("T")[0]);
  const [dt, setDt] = useState(new Date().toISOString().split("T")[0]);

  const now = new Date();
  const fStr = df;

  // ── Revenue from BILLS (ground truth) ──────────────────────────────────
  const periodSaleBills = useMemo(() => bills.filter(b => b.type === "sale" && safeDate(b.date) >= df && safeDate(b.date) <= dt), [bills, df, dt]);
  const periodPurBills = useMemo(() => bills.filter(b => b.type === "purchase" && safeDate(b.date) >= df && safeDate(b.date) <= dt), [bills, df, dt]);

  // Revenue incl GST (bill.total = after discount, incl GST)
  const totalRevenue = periodSaleBills.reduce((s, b) => s + Number(b.total || 0), 0);
  const totalGstCollected = periodSaleBills.reduce((s, b) => s + calcBillGst(b), 0);
  const netRevenue = totalRevenue - totalGstCollected; // excl GST

  // Returns reduce revenue
  const retTxns = useMemo(() => transactions.filter(t => t.type === "return" && safeDate(t.date) >= df && safeDate(t.date) <= dt), [transactions, df, dt]);
  const retRevenue = retTxns.reduce((s, t) => s + Number(t.qty) * Number(t.price || 0), 0);
  const retGst = retTxns.reduce((s, t) => {
    const rate = Number(t.gstRate || products.find(p => p.id === t.productId)?.gstRate || 0);
    return s + Number(t.qty) * Number(t.price || 0) * rate / (100 + rate);
  }, 0);

  const finalRevenue = totalRevenue - retRevenue;          // incl GST
  const finalNetRevenue = netRevenue - (retRevenue - retGst); // excl GST

  // COGS = units sold * ex-GST purchase price (from product record)
  const pp = pid => Number(products.find(pr => pr.id === pid)?.purchasePrice || 0);
  const cogsSales = periodSaleBills.reduce((s, b) => s + (b.items || []).reduce((si, i) => si + Number(i.qty) * pp(i.productId), 0), 0);
  const cogsRet = retTxns.reduce((s, t) => s + Number(t.qty) * pp(t.productId), 0);
  const netCogs = cogsSales - cogsRet;

  const grossProfit = finalNetRevenue - netCogs;

  // Purchase cost (total paid incl GST)
  const purchCost = periodPurBills.reduce((s, b) => s + Number(b.total || 0), 0);

  // Inventory value = ex-GST purchase price * stock
  const invVal = products.reduce((s, p) => s + getStock(p.id) * Number(p.purchasePrice), 0);

  const lowStock = products.filter(p => { const s = getStock(p.id); return s > 0 && s <= Number(p.minStock); });
  const oos = products.filter(p => getStock(p.id) <= 0);

  // ── Daily chart ──────────────────────────────────────────────────────────
  const dailyData = useMemo(() => {
    const map = {};
    const start = new Date(df), end = new Date(dt);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = d.toISOString().split("T")[0];
      map[k] = { date: new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), revenue: 0, purchase: 0 };
    }
    bills.forEach(b => {
      if (map[b.date]) {
        if (b.type === "sale") map[b.date].revenue += Number(b.total || 0);
        if (b.type === "purchase") map[b.date].purchase += Number(b.total || 0);
      }
    });
    return Object.values(map);
  }, [bills, df, dt]);

  const topProds = useMemo(() => {
    const m = {};
    periodSaleBills.forEach(b => {
      (b.items || []).forEach(i => {
        if (!m[i.productId]) m[i.productId] = { product: products.find(p => p.id === i.productId), units: 0, revenue: 0 };
        m[i.productId].units += Number(i.qty);
        // Revenue per item = effectivePrice * qty
        const effPrice = i.effectivePrice || i.price;
        m[i.productId].revenue += Number(i.qty) * Number(effPrice);
      });
    });
    return Object.values(m).filter(x => x.product).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [periodSaleBills, products]);

  const recentBills = bills.slice(0, 5);

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {(oos.length > 0 || lowStock.length > 0) && (
      <div className="glass fade-up" style={{ padding: "12px 18px", borderRadius: 14, background: T.amberBg, borderColor: `${T.amber}30` }}>
        <div style={{ display: "flex", gap: 10 }}>
          <AlertTriangle size={16} color={T.amber} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: T.amber }}>Stock Alerts</div>
            <div style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>
              {oos.length > 0 && <span style={{ color: T.red, fontWeight: 600 }}>{oos.length} out of stock · </span>}
              {lowStock.length > 0 && <span>{lowStock.length} low: {lowStock.map(p => p.alias || p.name).join(", ")}</span>}
            </div>
          </div>
        </div>
      </div>
    )}

    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize:11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.05em" }}>PERIOD</span>
      {["7", "14", "30", "90"].map(d => (
        <button key={d} onClick={() => setRange(d)} style={{ padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: range === d ? T.accent : "transparent", color: range === d ? "#fff" : T.textSub, transition: "all .15s" }}>{d}d</button>
      ))}
    </div>

    <div className="kgrid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
      <KCard label="Total Sales" value={fmtCur(totalRevenue)} sub={`GST: ${fmtCur(totalGstCollected)}`} icon={TrendingUp} color={T.green} />
      <KCard label="Total Purchase" value={fmtCur(purchCost)} sub="incl. GST · all time in period" icon={ShoppingCart} color={T.blue} />
      <KCard label="Inventory Value" value={fmtCur(invVal)} sub={`${products.length} SKUs · ex-GST`} icon={Box} color={T.accent} />
      <KCard label="Units Returned" value={String(retTxns.reduce((s,t) => s + Number(t.qty||0), 0))} sub={`${retTxns.length} return entries`} icon={DollarSign} color={T.red} />
    </div>

    <div className="chart-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
      <div className="glass" style={{ padding: "18px 18px 10px", borderRadius: T.radius }}>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Revenue vs Purchase</div>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
            <XAxis dataKey="date" tick={{ fontSize:11, fill: T.textMuted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:11, fill: T.textMuted }} tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v} axisLine={false} tickLine={false} />
            <Tooltip content={<CTip fmt />} />
            <Bar dataKey="revenue" name="Sales (incl GST)" fill={T.green} radius={[4, 4, 0, 0]} />
            <Bar dataKey="purchase" name="Purchase (incl GST)" fill={T.blue} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}> Top Products</div>
        {topProds.length === 0
          ? <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 13 }}>No sales yet</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topProds.map((item, i) => {
              const pct = (item.units / topProds[0].units) * 100;
              return <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: i === 0 ? `linear-gradient(135deg,${T.accent},${T.accentDark})` : `${T.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: i === 0 ? "#fff" : T.textSub, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.product?.name}</div>
                  <div style={{ fontSize:11, color: T.textMuted }}>{item.product?.sku}</div>
                  <div style={{ height: 4, borderRadius: 99, background: T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,.06)", marginTop: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${pct}%`, background: `linear-gradient(90deg,${T.accent},${T.accentLight})` }} />
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, flexShrink: 0 }}>{item.units}<span style={{ fontSize:11, color: T.textMuted }}> u</span></div>
              </div>;
            })}
          </div>}
      </div>
    </div>

    <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
      <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Recent Bills</div>
      {recentBills.length === 0
        ? <div style={{ padding: "20px 0", textAlign: "center", color: T.textMuted, fontSize: 13 }}>No bills yet</div>
        : <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr>{["Bill No", "Date", "Type", "Items", "Total", "Vendor"].map(h => (
              <th key={h} className="th" style={{ textAlign: h === "Total" ? "right" : "left" }}>{h.toUpperCase()}</th>
            ))}</tr></thead>
            <tbody>{recentBills.map(b => {
              const vn = vendors?.find(v => v.id === b.vendorId);
              return <tr key={b.id} className="trow">
                <td className="td">{b.billNo}</td>
                <td className="td m">{fmtDate(b.date)}</td>
                <td className="td"><span className="badge" style={{ background: b.type === "sale" ? T.greenBg : T.blueBg, color: b.type === "sale" ? T.green : T.blue }}>{b.type}</span></td>
                <td className="td m">{(b.items || []).length}×</td>
                <td className="td r" style={{ fontWeight: 700, color: b.type === "sale" ? T.green : T.blue }}>{fmtCur(b.total)}</td>
                <td className="td m">
{vn?.name || "—"}
                </td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
    </div>
  </div>;
}
