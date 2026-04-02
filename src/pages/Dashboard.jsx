import React, { useState, useMemo } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, DollarSign, ShoppingCart, Box, AlertTriangle } from "lucide-react";
import { useT } from "../theme";
import { KCard, CTip } from "../components/UI";
import { fmtCur, fmtDate } from "../utils";

export default function Dashboard({ ctx }) {
  const T = useT();
  const { products, transactions, getStock, bills, channels, vendors } = ctx;
  const [range, setRange] = useState("30");
  const now = new Date();
  const fStr = new Date(now.getTime() - parseInt(range) * 86400000).toISOString().split("T")[0];
  const fil = useMemo(() => transactions.filter(t => t.date >= fStr), [transactions, range]);

  const sales = fil.filter(t => t.type === "sale");
  const ret = fil.filter(t => t.type === "return");
  const purch = fil.filter(t => t.type === "purchase");

  const revenue = sales.reduce((s, t) => s + Number(t.qty) * Number(t.price), 0);
  const retAmt = ret.reduce((s, t) => s + Number(t.qty) * Number(t.price), 0);
  const netRev = revenue - retAmt;
  const purchCost = purch.reduce((s, t) => s + Number(t.qty) * Number(t.price), 0);

  const pp = pid => Number(products.find(pr => pr.id === pid)?.purchasePrice || 0);
  const cogsSales = sales.reduce((s, t) => s + Number(t.qty) * pp(t.productId), 0);
  const cogsRet = ret.reduce((s, t) => s + Number(t.qty) * pp(t.productId), 0);
  const netCogs = cogsSales - cogsRet;
  const grossProfit = netRev - netCogs;

  const invVal = products.reduce((s, p) => s + getStock(p.id) * Number(p.purchasePrice), 0);
  const lowStock = products.filter(p => { const s = getStock(p.id); return s > 0 && s <= Number(p.minStock); });
  const oos = products.filter(p => getStock(p.id) <= 0);

  const dailyRev = useMemo(() => {
    const map = {};
    for (let i = parseInt(range) - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const k = d.toISOString().split("T")[0];
      map[k] = { date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), revenue: 0, purchase: 0 };
    }
    transactions.forEach(t => {
      if (map[t.date]) {
        if (t.type === "sale") map[t.date].revenue += Number(t.qty) * Number(t.price);
        if (t.type === "purchase") map[t.date].purchase += Number(t.qty) * Number(t.price);
      }
    });
    return Object.values(map);
  }, [transactions, range]);

  const topProds = useMemo(() => {
    const m = {};
    sales.forEach(t => {
      if (!m[t.productId]) m[t.productId] = { product: products.find(p => p.id === t.productId), units: 0, revenue: 0 };
      m[t.productId].units += Number(t.qty);
      m[t.productId].revenue += Number(t.qty) * Number(t.price);
    });
    return Object.values(m).filter(x => x.product).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [sales, products]);

  const recentBills = bills.slice(0, 5);

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {(oos.length > 0 || lowStock.length > 0) && <div className="glass fade-up" style={{ padding: "12px 18px", borderRadius: 14, background: T.amberBg, borderColor: `${T.amber}30` }}><div style={{ display: "flex", gap: 10 }}><AlertTriangle size={16} color={T.amber} style={{ flexShrink: 0, marginTop: 1 }} /><div><div style={{ fontWeight: 700, fontSize: 13, color: T.amber }}>Stock Alerts</div><div style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>{oos.length > 0 && <span style={{ color: T.red, fontWeight: 600 }}>{oos.length} out of stock · </span>}{lowStock.length > 0 && <span>{lowStock.length} low: {lowStock.map(p => p.alias || p.name).join(", ")}</span>}</div></div></div></div>}
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.05em" }}>PERIOD</span>{["7", "14", "30", "90"].map(d => <button key={d} onClick={() => setRange(d)} style={{ padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: range === d ? T.accent : "transparent", color: range === d ? "#fff" : T.textSub, transition: "all .15s" }}>{d}d</button>)}</div>
    <div className="kgrid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
      <KCard label="Net Revenue" value={fmtCur(netRev)} sub={`Gross: ${fmtCur(revenue)} · Returns: ${fmtCur(retAmt)}`} icon={TrendingUp} color={T.green} />
      <KCard label="Gross Profit" value={fmtCur(grossProfit)} sub={netRev > 0 ? `${((grossProfit / netRev) * 100).toFixed(1)}% margin` : ""} icon={DollarSign} color={T.accent} />
      <KCard label="Purchase Cost" value={fmtCur(purchCost)} icon={ShoppingCart} color={T.blue} />
      <KCard label="Inventory Value" value={fmtCur(invVal)} sub={`${products.length} SKUs · ${oos.length} OOS`} icon={Box} color={T.purple} />
    </div>
    <div className="chart-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
      <div className="glass" style={{ padding: "18px 18px 10px", borderRadius: T.radius }}>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Revenue vs Purchase</div>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={dailyRev}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: T.textMuted }} tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v} axisLine={false} tickLine={false} />
            <Tooltip content={<CTip fmt />} />
            <Bar dataKey="revenue" name="Sales" fill={T.green} radius={[4, 4, 0, 0]} />
            <Bar dataKey="purchase" name="Purchase" fill={T.blue} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>🏆 Top Products</div>
        {topProds.length === 0 ? <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 13 }}>No sales yet</div> :
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{topProds.map((item, i) => {
            const pct = (item.units / topProds[0].units) * 100;
            return <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: i === 0 ? `linear-gradient(135deg,${T.accent},${T.accentDark})` : `${T.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: i === 0 ? "#fff" : T.textSub, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.product?.alias || item.product?.name}</div>
                <div style={{ height: 4, borderRadius: 99, background: T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,.06)", marginTop: 4, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 99, width: `${pct}%`, background: `linear-gradient(90deg,${T.accent},${T.accentLight})` }} /></div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text, flexShrink: 0 }}>{item.units}<span style={{ fontSize: 10, color: T.textMuted }}> u</span></div>
            </div>;
          })}</div>}
      </div>
    </div>
    <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
      <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Recent Bills</div>
      {recentBills.length === 0 ? <div style={{ padding: "20px 0", textAlign: "center", color: T.textMuted, fontSize: 13 }}>No bills yet</div> :
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>{["Bill No", "Date", "Type", "Items", "Total", "Channel/Vendor"].map(h => <th key={h} className="th" style={{ textAlign: h === "Total" ? "right" : "left" }}>{h.toUpperCase()}</th>)}</tr></thead>
          <tbody>{recentBills.map(b => {
            const ch = channels.find(c => c.id === b.channelId);
            return <tr key={b.id} className="trow">
              <td className="td">{b.billNo}</td>
              <td className="td m">{fmtDate(b.date)}</td>
              <td className="td"><span className="badge" style={{ background: b.type === "sale" ? T.greenBg : T.blueBg, color: b.type === "sale" ? T.green : T.blue }}>{b.type}</span></td>
              <td className="td m">{(b.items || []).length} item{(b.items || []).length !== 1 ? "s" : ""}</td>
              <td className="td r" style={{ fontWeight: 700, color: T.accent }}>{fmtCur(b.total)}</td>
              <td className="td m">{ch?.name || vendors?.find(v => v.id === b.vendorId)?.name || "—"}</td>
            </tr>;
          })}</tbody>
        </table></div>}
    </div>
  </div>;
}
