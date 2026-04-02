import React, { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar, Download, TrendingUp, RotateCcw, Activity, DollarSign, ShoppingCart } from "lucide-react";
import { useT } from "../theme";
import { KCard, CTip, GBtn, GS, StChip } from "../components/UI";
import { fmtCur, today, inRange, getLast12Months, monthOf, toCSV, dlCSV } from "../utils";

export default function Reports({ ctx }) {
  const T = useT();
  const { transactions, products, categories, channels, vendors, getStock, bills } = ctx;
  const [df, setDf] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().split("T")[0]; });
  const [dt, setDt] = useState(today());
  const [catF, setCatF] = useState("");
  const [chF, setChF] = useState("");

  const fil = useMemo(() => transactions.filter(t =>
    inRange(t.date, df, dt) &&
    (catF ? products.find(p => p.id === t.productId)?.categoryId === catF : true) &&
    (chF ? t.channelId === chF : true)
  ), [transactions, df, dt, catF, chF, products]);

  const pp = pid => Number(products.find(pr => pr.id === pid)?.purchasePrice || 0);
  const sales = fil.filter(t => t.type === "sale");
  const purch = fil.filter(t => t.type === "purchase");
  const ret = fil.filter(t => t.type === "return");

  const revenue = sales.reduce((s, t) => s + Number(t.qty) * Number(t.price), 0);
  const retAmt = ret.reduce((s, t) => s + Number(t.qty) * Number(t.price), 0);
  const netRev = revenue - retAmt;
  const cogsSales = sales.reduce((s, t) => s + Number(t.qty) * pp(t.productId), 0);
  const cogsRet = ret.reduce((s, t) => s + Number(t.qty) * pp(t.productId), 0);
  const netCogs = cogsSales - cogsRet;
  const gp = netRev - netCogs;
  const pc = purch.reduce((s, t) => s + Number(t.qty) * Number(t.price), 0);

  const prodPerf = useMemo(() => {
    const m = {};
    sales.forEach(t => {
      if (!m[t.productId]) m[t.productId] = { p: products.find(pr => pr.id === t.productId), units: 0, revenue: 0, cost: 0 };
      m[t.productId].units += Number(t.qty);
      m[t.productId].revenue += Number(t.qty) * Number(t.price);
      m[t.productId].cost += Number(t.qty) * pp(t.productId);
    });
    ret.forEach(t => {
      if (!m[t.productId]) m[t.productId] = { p: products.find(pr => pr.id === t.productId), units: 0, revenue: 0, cost: 0 };
      m[t.productId].units -= Number(t.qty);
      m[t.productId].revenue -= Number(t.qty) * Number(t.price);
      m[t.productId].cost -= Number(t.qty) * pp(t.productId);
    });
    return Object.values(m).filter(x => x.p).map(x => ({ ...x, profit: x.revenue - x.cost, margin: x.revenue > 0 ? ((x.revenue - x.cost) / x.revenue * 100).toFixed(1) : "0", avgPrice: x.units > 0 ? (x.revenue / x.units).toFixed(0) : "0", currentStock: getStock(x.p.id) })).sort((a, b) => b.revenue - a.revenue);
  }, [sales, ret, products, getStock]);

  const deadStock = useMemo(() => {
    const soldIds = new Set(sales.map(t => t.productId));
    return products.filter(p => !soldIds.has(p.id) && getStock(p.id) > 0).map(p => ({ ...p, stock: getStock(p.id), value: getStock(p.id) * Number(p.purchasePrice) })).sort((a, b) => b.value - a.value);
  }, [sales, products, getStock]);

  const chPerf = useMemo(() => {
    const m = {};
    sales.forEach(t => {
      const ch = channels.find(c => c.id === t.channelId);
      const n = ch?.name || "Unknown"; const col = ch?.color || T.textMuted;
      if (!m[n]) m[n] = { name: n, revenue: 0, units: 0, orders: new Set(), color: col };
      m[n].revenue += Number(t.qty) * Number(t.price);
      m[n].units += Number(t.qty);
      if (t.billId) m[n].orders.add(t.billId);
    });
    ret.forEach(t => {
      const ch = channels.find(c => c.id === t.channelId);
      const n = ch?.name || "Unknown";
      if (m[n]) { m[n].revenue -= Number(t.qty) * Number(t.price); m[n].units -= Number(t.qty); }
    });
    return Object.values(m).map(x => ({ ...x, orders: x.orders.size || x.units, avgOrder: x.revenue / (x.orders.size || 1) })).sort((a, b) => b.revenue - a.revenue);
  }, [sales, ret, channels]);

  const catPerf = useMemo(() => {
    const m = {};
    sales.forEach(t => {
      const p = products.find(pr => pr.id === t.productId);
      const cat = categories.find(c => c.id === p?.categoryId);
      const n = cat?.name || "Other"; const col = cat?.color || T.textMuted;
      if (!m[n]) m[n] = { name: n, revenue: 0, units: 0, cost: 0, color: col };
      m[n].revenue += Number(t.qty) * Number(t.price);
      m[n].units += Number(t.qty);
      m[n].cost += Number(t.qty) * pp(t.productId);
    });
    ret.forEach(t => {
      const p = products.find(pr => pr.id === t.productId);
      const cat = categories.find(c => c.id === p?.categoryId);
      const n = cat?.name || "Other";
      if (m[n]) { m[n].revenue -= Number(t.qty) * Number(t.price); m[n].units -= Number(t.qty); m[n].cost -= Number(t.qty) * pp(t.productId); }
    });
    return Object.values(m).map(x => ({ ...x, profit: x.revenue - x.cost, margin: x.revenue > 0 ? ((x.revenue - x.cost) / x.revenue * 100).toFixed(1) : "0" })).sort((a, b) => b.revenue - a.revenue);
  }, [sales, ret, products, categories]);

  const months = getLast12Months();
  const monthly12 = useMemo(() => months.map(m => {
    const ms = transactions.filter(t => t.type === "sale" && monthOf(t.date) === m.key);
    const mr = transactions.filter(t => t.type === "return" && monthOf(t.date) === m.key);
    const mp = transactions.filter(t => t.type === "purchase" && monthOf(t.date) === m.key);
    const rev = ms.reduce((s, t) => s + Number(t.qty) * Number(t.price), 0);
    const rAmt = mr.reduce((s, t) => s + Number(t.qty) * Number(t.price), 0);
    const net = rev - rAmt;
    const cgS = ms.reduce((s, t) => s + Number(t.qty) * pp(t.productId), 0);
    const cgR = mr.reduce((s, t) => s + Number(t.qty) * pp(t.productId), 0);
    return { ...m, revenue: net, purchase: mp.reduce((s, t) => s + Number(t.qty) * Number(t.price), 0), profit: net - (cgS - cgR) };
  }), [transactions, products]);

  const exportReport = () => dlCSV(toCSV(prodPerf.map(x => ({ product: x.p?.name, sku: x.p?.sku, units: x.units, revenue: x.revenue, cost: x.cost, profit: x.profit, margin: x.margin + "%", avgPrice: x.avgPrice, currentStock: x.currentStock })), ["product", "sku", "units", "revenue", "cost", "profit", "margin", "avgPrice", "currentStock"]), "deep_report");

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div className="glass" style={{ padding: "14px 16px", borderRadius: 14 }}>
      <div className="filter-wrap">
        <Calendar size={14} color={T.textMuted} />
        <input type="date" className="inp" value={df} onChange={e => setDf(e.target.value)} style={{ flex: "0 1 120px" }} />
        <span style={{ fontSize: 12, color: T.textMuted }}>→</span>
        <input type="date" className="inp" value={dt} onChange={e => setDt(e.target.value)} style={{ flex: "0 1 120px" }} />
        <GS value={catF} onChange={e => setCatF(e.target.value)} placeholder="All Categories">{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</GS>
        <GS value={chF} onChange={e => setChF(e.target.value)} placeholder="All Channels">{channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</GS>
        <GBtn v="ghost" sz="sm" onClick={exportReport} icon={<Download size={13} />}>Export</GBtn>
      </div>
    </div>
    <div className="kgrid" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
      <KCard label="Revenue" value={fmtCur(revenue)} icon={TrendingUp} color={T.green} />
      <KCard label="Returns" value={fmtCur(retAmt)} icon={RotateCcw} color={T.red} />
      <KCard label="Net Revenue" value={fmtCur(netRev)} icon={Activity} color={T.accent} />
      <KCard label="Gross Profit" value={fmtCur(gp)} sub={netRev > 0 ? `${((gp / netRev) * 100).toFixed(1)}% margin` : ""} icon={DollarSign} color={T.purple} />
      <KCard label="Purchase Cost" value={fmtCur(pc)} icon={ShoppingCart} color={T.blue} />
    </div>
    <div className="glass" style={{ padding: "18px 18px 10px", borderRadius: T.radius }}>
      <div style={{ fontFamily: "Syne,sans-serif", fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>12-Month Trend: Net Revenue vs Purchase vs Profit</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={monthly12}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: T.textMuted }} tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v} axisLine={false} tickLine={false} />
          <Tooltip content={<CTip fmt />} />
          <Line type="monotone" dataKey="revenue" name="Net Revenue" stroke={T.green} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="purchase" name="Purchase" stroke={T.blue} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="profit" name="Gross Profit" stroke={T.accent} strokeWidth={2} dot={false} strokeDasharray="4 4" />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <div className="chart-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
        <div style={{ fontFamily: "Syne,sans-serif", fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Net Channel Performance</div>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>{["Channel", "Net Orders", "Net Revenue", "Avg Order"].map(h => <th key={h} className="th" style={{ textAlign: h === "Channel" ? "left" : "right" }}>{h.toUpperCase()}</th>)}</tr></thead>
          <tbody>{chPerf.map((c, i) => <tr key={i} className="trow"><td className="td"><span className="tag" style={{ background: c.color + "18", color: c.color }}>{c.name}</span></td><td className="td r">{c.orders}</td><td className="td r" style={{ fontWeight: 600, color: T.green }}>{fmtCur(c.revenue)}</td><td className="td r m">{fmtCur(c.avgOrder)}</td></tr>)}
            {chPerf.length === 0 && <tr><td className="td" colSpan={4} style={{ textAlign: "center", color: T.textMuted }}>No data</td></tr>}
          </tbody>
        </table></div>
      </div>
      <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
        <div style={{ fontFamily: "Syne,sans-serif", fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Net Category Performance</div>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>{["Category", "Net Units", "Net Revenue", "Profit", "Margin"].map(h => <th key={h} className="th" style={{ textAlign: h === "Category" ? "left" : "right" }}>{h.toUpperCase()}</th>)}</tr></thead>
          <tbody>{catPerf.map((c, i) => <tr key={i} className="trow"><td className="td"><span className="tag" style={{ background: c.color + "18", color: c.color }}>{c.name}</span></td><td className="td r">{c.units}</td><td className="td r" style={{ color: T.green, fontWeight: 600 }}>{fmtCur(c.revenue)}</td><td className="td r" style={{ color: T.accent, fontWeight: 600 }}>{fmtCur(c.profit)}</td><td className="td r" style={{ color: T.purple }}>{c.margin}%</td></tr>)}
            {catPerf.length === 0 && <tr><td className="td" colSpan={5} style={{ textAlign: "center", color: T.textMuted }}>No data</td></tr>}
          </tbody>
        </table></div>
      </div>
    </div>
    <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
      <div style={{ fontFamily: "Syne,sans-serif", fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Product Performance — Full Breakdown</div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr>{["Rank", "Product", "SKU", "Net Units", "Net Revenue", "Net COGS", "Gross Profit", "Margin", "Avg Price", "Current Stock"].map(h => <th key={h} className="th" style={{ textAlign: ["Net Units", "Net Revenue", "Net COGS", "Gross Profit", "Margin", "Avg Price", "Current Stock"].includes(h) ? "right" : "left" }}>{h.toUpperCase()}</th>)}</tr></thead>
        <tbody>
          {prodPerf.length === 0 && <tr><td className="td" colSpan={10} style={{ textAlign: "center", color: T.textMuted }}>No sales in selected period</td></tr>}
          {prodPerf.map((x, i) => <tr key={i} className="trow">
            <td className="td"><div style={{ width: 22, height: 22, borderRadius: 5, background: i === 0 ? `linear-gradient(135deg,${T.accent},${T.accentDark})` : `${T.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: i === 0 ? "#fff" : T.textSub }}>{i + 1}</div></td>
            <td className="td" style={{ fontWeight: 600, color: T.text }}>{x.p?.name}</td>
            <td className="td m" style={{ fontFamily: "monospace", fontSize: 10 }}>{x.p?.sku}</td>
            <td className="td r" style={{ fontWeight: 600 }}>{x.units}</td>
            <td className="td r" style={{ color: T.green, fontWeight: 600 }}>{fmtCur(x.revenue)}</td>
            <td className="td r m">{fmtCur(x.cost)}</td>
            <td className="td r" style={{ color: x.profit >= 0 ? T.accent : T.red, fontWeight: 600 }}>{fmtCur(x.profit)}</td>
            <td className="td r" style={{ color: T.purple }}>{x.margin}%</td>
            <td className="td r m">{fmtCur(x.avgPrice)}</td>
            <td className="td r"><StChip stock={x.currentStock} min={Number(x.p?.minStock || 0)} /></td>
          </tr>)}
        </tbody>
      </table></div>
    </div>
    {deadStock.length > 0 && <div className="glass" style={{ padding: 18, borderRadius: T.radius, borderLeft: `4px solid ${T.red}` }}>
      <div style={{ fontFamily: "Syne,sans-serif", fontWeight: 700, fontSize: 15, color: T.red, marginBottom: 14 }}>⚠️ Dead Stock — No Sales in Period ({deadStock.length} products)</div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr>{["Product", "SKU", "Category", "Stock", "Value", "MRP", "Purchase Price"].map(h => <th key={h} className="th" style={{ textAlign: ["Stock", "Value", "MRP", "Purchase Price"].includes(h) ? "right" : "left" }}>{h.toUpperCase()}</th>)}</tr></thead>
        <tbody>{deadStock.map(p => {
          const cat = categories.find(c => c.id === p.categoryId);
          return <tr key={p.id} className="trow">
            <td className="td" style={{ fontWeight: 600, color: T.text }}>{p.name}</td>
            <td className="td m" style={{ fontFamily: "monospace", fontSize: 10 }}>{p.sku}</td>
            <td className="td">{cat && <span className="tag" style={{ background: cat.color + "18", color: cat.color }}>{cat.name}</span>}</td>
            <td className="td r" style={{ fontWeight: 700, color: T.amber }}>{p.stock}</td>
            <td className="td r" style={{ fontWeight: 600, color: T.red }}>{fmtCur(p.value)}</td>
            <td className="td r">{fmtCur(p.mrp)}</td>
            <td className="td r">{fmtCur(p.purchasePrice)}</td>
          </tr>;
        })}</tbody>
      </table></div>
    </div>}
  </div>;
}
