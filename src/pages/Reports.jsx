import React, { useState, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Calendar, Download, TrendingUp, RotateCcw, Activity, DollarSign, ShoppingCart, Box, Truck, Tag } from "lucide-react";
import { useT } from "../theme";
import { PC } from "../theme";
import { KCard, CTip, GBtn, GS, StChip } from "../components/UI";
import { fmtCur, today, inRange, getLast12Months, monthOf, toCSV, dlCSV } from "../utils";

const TABS = ["Sales", "Purchase", "Products", "Inventory"];

export default function Reports({ ctx }) {
  const T = useT();
  const { transactions, products, categories, vendors, getStock, bills } = ctx;
  const [tab, setTab] = useState("Sales");

  // ── Global date filter ──────────────────────────────────────────────────
  const [df, setDf] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().split("T")[0]; });
  const [dt, setDt] = useState(today());
  const [catF, setCatF] = useState("");
  const [vendorF, setVendorF] = useState("");

  const months = getLast12Months();
  const pp = pid => Number(products.find(pr => pr.id === pid)?.purchasePrice || 0);

  // ── Period bills (ground truth) ────────────────────────────────────────
  const periodSaleBills = useMemo(() => bills.filter(b =>
    b.type === "sale" && inRange(b.date, df, dt) &&
    (catF ? (b.items || []).some(i => products.find(p => p.id === i.productId)?.categoryId === catF) : true)
  ), [bills, df, dt, catF, products]);

  const periodPurBills = useMemo(() => bills.filter(b =>
    b.type === "purchase" && inRange(b.date, df, dt) &&
    (vendorF ? b.vendorId === vendorF : true)
  ), [bills, df, dt, vendorF]);

  // Return transactions
  const rets = useMemo(() => transactions.filter(t => t.type === "return" && inRange(t.date, df, dt)), [transactions, df, dt]);
  // For channel/category breakdown we still use sale transactions
  const sales = useMemo(() => transactions.filter(t =>
    t.type === "sale" && inRange(t.date, df, dt) &&
    (catF ? products.find(p => p.id === t.productId)?.categoryId === catF : true)
  ), [transactions, df, dt, catF, products]);
  const purch = useMemo(() => transactions.filter(t =>
    t.type === "purchase" && inRange(t.date, df, dt) &&
    (vendorF ? t.vendorId === vendorF : true)
  ), [transactions, df, dt, vendorF]);

  // ── SALES metrics from BILLS ─────────────────────────────────────────────
  // Revenue = bill.total (incl GST, after discount)
  // Net revenue = bill.total - bill.saleGstInfo (excl GST)
  const revenue = periodSaleBills.reduce((s, b) => s + Number(b.total || 0), 0);
  const saleGstTotal = periodSaleBills.reduce((s, b) => s + Number(b.saleGstInfo || 0), 0);
  const retAmt = rets.reduce((s, t) => s + Number(t.qty) * Number(t.price || 0), 0);
  const retGst = rets.reduce((s, t) => {
    const rate = Number(t.gstRate || products.find(p => p.id === t.productId)?.gstRate || 0);
    return s + Number(t.qty) * Number(t.price || 0) * rate / (100 + rate);
  }, 0);
  const finalRevenue = revenue - retAmt;                            // incl GST after returns
  const netRev = (revenue - saleGstTotal) - (retAmt - retGst);     // excl GST after returns

  // COGS = units sold * ex-GST purchasePrice (from product record)
  const cogsSales = periodSaleBills.reduce((s, b) => s + (b.items || []).reduce((si, i) => si + Number(i.qty) * pp(i.productId), 0), 0);
  const cogsRet = rets.reduce((s, t) => s + Number(t.qty) * pp(t.productId), 0);
  const netCogs = cogsSales - cogsRet;
  const gp = netRev - netCogs;

  // ── PURCHASE metrics from BILLS ──────────────────────────────────────────
  // pc = total paid (incl GST), pu = units
  const pc = periodPurBills.reduce((s, b) => s + Number(b.total || 0), 0);
  const pcExclGst = periodPurBills.reduce((s, b) => s + Number(b.subtotal || 0), 0);
  const pu = periodPurBills.reduce((s, b) => s + (b.items || []).reduce((si, i) => si + Number(i.qty || 0), 0), 0);

  // ── Monthly 12m from bills ───────────────────────────────────────────────
  const monthly12 = useMemo(() => months.map(m => {
    const mb = bills.filter(b => b.type === "sale" && monthOf(b.date) === m.key);
    const mp = bills.filter(b => b.type === "purchase" && monthOf(b.date) === m.key);
    const mr = transactions.filter(t => t.type === "return" && monthOf(t.date) === m.key);
    const rev = mb.reduce((s, b) => s + Number(b.total || 0), 0);
    const gstOnSales = mb.reduce((s, b) => s + Number(b.saleGstInfo || 0), 0);
    const rAmt = mr.reduce((s, t) => s + Number(t.qty) * Number(t.price || 0), 0);
    const rGst = mr.reduce((s, t) => { const rate = Number(t.gstRate || products.find(p => p.id === t.productId)?.gstRate || 0); return s + Number(t.qty) * Number(t.price || 0) * rate / (100 + rate); }, 0);
    const net = (rev - gstOnSales) - (rAmt - rGst);  // excl GST
    const cogs = mb.reduce((s, b) => s + (b.items || []).reduce((si, i) => si + Number(i.qty) * pp(i.productId), 0), 0);
    const cogsR = mr.reduce((s, t) => s + Number(t.qty) * pp(t.productId), 0);
    const purCost = mp.reduce((s, b) => s + Number(b.total || 0), 0);
    return { ...m, revenue: net, purchase: purCost, profit: net - (cogs - cogsR) };
  }), [bills, transactions, products]);


  // ── Vendor performance in sales (replaces channel perf) ─────────────────
  const chPerf = useMemo(() => {
    const m = {};
    periodSaleBills.forEach(b => {
      const v = vendors?.find(x => x.id === b.vendorId);
      const n = v?.name || "Direct / Walk-in";
      if (!m[n]) m[n] = { name: n, revenue: 0, units: 0, orders: 0 };
      m[n].revenue += Number(b.total || 0);
      m[n].orders += 1;
      m[n].units += (b.items || []).reduce((s, i) => s + Number(i.qty || 0), 0);
    });
    return Object.values(m).map(x => ({ ...x, avgOrder: x.orders > 0 ? x.revenue / x.orders : 0 })).sort((a, b) => b.revenue - a.revenue);
  }, [periodSaleBills, vendors]);

  // ── Category performance ─────────────────────────────────────────────────
  const catPerf = useMemo(() => {
    const m = {};
    sales.forEach(t => {
      const p = products.find(pr => pr.id === t.productId);
      const cat = categories.find(c => c.id === p?.categoryId);
      const n = cat?.name || "Other"; const col = cat?.color || T.textMuted;
      if (!m[n]) m[n] = { name: n, revenue: 0, units: 0, cost: 0, color: col };
      m[n].revenue += Number(t.qty) * Number(t.price); m[n].units += Number(t.qty); m[n].cost += Number(t.qty) * pp(t.productId);
    });
    rets.forEach(t => {
      const p = products.find(pr => pr.id === t.productId);
      const cat = categories.find(c => c.id === p?.categoryId);
      const n = cat?.name || "Other";
      if (m[n]) { m[n].revenue -= Number(t.qty) * Number(t.price); m[n].units -= Number(t.qty); m[n].cost -= Number(t.qty) * pp(t.productId); }
    });
    return Object.values(m).map(x => ({ ...x, profit: x.revenue - x.cost, margin: x.revenue > 0 ? ((x.revenue - x.cost) / x.revenue * 100).toFixed(1) : "0" })).sort((a, b) => b.revenue - a.revenue);
  }, [sales, rets, products, categories]);

  // ── Vendor performance ───────────────────────────────────────────────────
  const vendorPerf = useMemo(() => {
    const m = {};
    purch.forEach(t => {
      const v = vendors.find(x => x.id === t.vendorId);
      const n = v?.name || "Unknown";
      if (!m[n]) m[n] = { name: n, cost: 0, units: 0, orders: new Set() };
      m[n].cost += Number(t.qty) * Number(t.price); m[n].units += Number(t.qty);
      if (t.billId) m[n].orders.add(t.billId);
    });
    return Object.values(m).map(x => ({ ...x, orders: x.orders.size })).sort((a, b) => b.cost - a.cost);
  }, [purch, vendors]);

  // ── Product performance ──────────────────────────────────────────────────
  const prodPerf = useMemo(() => {
    const m = {};
    sales.forEach(t => {
      if (!m[t.productId]) m[t.productId] = { p: products.find(pr => pr.id === t.productId), units: 0, revenue: 0, cost: 0 };
      m[t.productId].units += Number(t.qty); m[t.productId].revenue += Number(t.qty) * Number(t.price); m[t.productId].cost += Number(t.qty) * pp(t.productId);
    });
    rets.forEach(t => {
      if (!m[t.productId]) m[t.productId] = { p: products.find(pr => pr.id === t.productId), units: 0, revenue: 0, cost: 0 };
      m[t.productId].units -= Number(t.qty); m[t.productId].revenue -= Number(t.qty) * Number(t.price); m[t.productId].cost -= Number(t.qty) * pp(t.productId);
    });
    return Object.values(m).filter(x => x.p).map(x => ({ ...x, profit: x.revenue - x.cost, margin: x.revenue > 0 ? ((x.revenue - x.cost) / x.revenue * 100).toFixed(1) : "0", currentStock: getStock(x.p.id) })).sort((a, b) => b.revenue - a.revenue);
  }, [sales, rets, products, getStock]);

  // ── Dead stock ───────────────────────────────────────────────────────────
  const deadStock = useMemo(() => {
    const soldIds = new Set(sales.map(t => t.productId));
    return products.filter(p => !soldIds.has(p.id) && getStock(p.id) > 0).map(p => ({ ...p, stock: getStock(p.id), value: getStock(p.id) * Number(p.purchasePrice) })).sort((a, b) => b.value - a.value);
  }, [sales, products, getStock]);

  // ── Purchase product breakdown ────────────────────────────────────────────
  const purProd = useMemo(() => {
    const m = {};
    purch.forEach(t => {
      const p = products.find(pr => pr.id === t.productId);
      if (!m[t.productId]) m[t.productId] = { p, units: 0, cost: 0 };
      m[t.productId].units += Number(t.qty); m[t.productId].cost += Number(t.qty) * Number(t.price);
    });
    return Object.values(m).filter(x => x.p).sort((a, b) => b.cost - a.cost);
  }, [purch, products]);

  // ── Inventory stats ───────────────────────────────────────────────────────
  const invStats = useMemo(() => {
    const byCategory = {};
    products.forEach(p => {
      const cat = categories.find(c => c.id === p.categoryId);
      const n = cat?.name || "Other"; const col = cat?.color || T.textMuted;
      const stock = getStock(p.id);
      if (!byCategory[n]) byCategory[n] = { name: n, value: 0, units: 0, color: col };
      byCategory[n].value += stock * Number(p.purchasePrice);
      byCategory[n].units += stock;
    });
    return Object.values(byCategory).sort((a, b) => b.value - a.value);
  }, [products, categories, getStock]);

  const filterBar = (
    <div className="glass" style={{ padding: "12px 16px", borderRadius: 12, marginBottom: 16 }}>
      <div className="filter-wrap">
        <Calendar size={14} color={T.textMuted} />
        <input type="date" className="inp" value={df} onChange={e => setDf(e.target.value)} style={{ flex: "0 1 120px" }} />
        <span style={{ fontSize: 12, color: T.textMuted }}>→</span>
        <input type="date" className="inp" value={dt} onChange={e => setDt(e.target.value)} style={{ flex: "0 1 120px" }} />
        {tab === "Sales" && <>
          <GS value={catF} onChange={e => setCatF(e.target.value)} placeholder="All Categories">{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</GS>
        </>}
        {tab === "Purchase" && <GS value={vendorF} onChange={e => setVendorF(e.target.value)} placeholder="All Vendors">{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</GS>}
        {tab === "Products" && <>
          <GS value={catF} onChange={e => setCatF(e.target.value)} placeholder="All Categories">{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</GS>
        </>}
        <GBtn v="ghost" sz="sm" onClick={() => dlCSV(toCSV(prodPerf.map(x => ({ product: x.p?.name, sku: x.p?.sku, units: x.units, revenue: x.revenue, cost: x.cost, profit: x.profit, margin: x.margin + "%" })), ["product", "sku", "units", "revenue", "cost", "profit", "margin"]), "report")} icon={<Download size={13} />}>Export</GBtn>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map(t => <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 18px", borderRadius: 10, border: `1px solid ${tab === t ? T.accent : T.borderSubtle}`, cursor: "pointer", fontWeight: 600, fontSize: 13, background: tab === t ? T.accent : "transparent", color: tab === t ? "#fff" : T.textSub, transition: "all .15s" }}>{t}</button>)}
      </div>

      {filterBar}

      {/* ── SALES TAB ── */}
      {tab === "Sales" && <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="kgrid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          <KCard label="Total Sales" value={fmtCur(finalRevenue)} sub="incl. GST · after returns" icon={TrendingUp} color={T.green} />
          <KCard label="Returns" value={fmtCur(retAmt)} sub="at return price" icon={RotateCcw} color={T.red} />
          <KCard label="Net Revenue" value={fmtCur(netRev)} sub="excl. GST · after returns" icon={Activity} color={T.accent} />
          <KCard label="Gross Profit" value={fmtCur(gp)} sub={netRev > 0 ? `${((gp / netRev) * 100).toFixed(1)}% margin (excl GST)` : ""} icon={DollarSign} color={T.purple} />
        </div>

        {/* 12-month trend */}
        <div className="glass" style={{ padding: "18px 18px 10px", borderRadius: T.radius }}>
          <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>12-Month Revenue Trend</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthly12}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: T.textMuted }} tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v} axisLine={false} tickLine={false} />
              <Tooltip content={<CTip fmt />} />
              <Line type="monotone" dataKey="revenue" name="Net Revenue" stroke={T.green} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" name="Gross Profit" stroke={T.accent} strokeWidth={2} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Channel + Category */}
        <div className="chart-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
            <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>By Vendor</div>
            {chPerf.length > 0 && <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chPerf} margin={{ left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: T.textMuted }} tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v} axisLine={false} tickLine={false} />
                <Tooltip content={<CTip fmt />} />
                <Bar dataKey="revenue" name="Revenue" fill={T.green} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>}
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr>{["Vendor", "Net Rev", "Units", "Avg Order"].map(h => <th key={h} className="th" style={{ textAlign: h === "Vendor" ? "left" : "right", padding: "6px 8px" }}>{h.toUpperCase()}</th>)}</tr></thead>
                <tbody>{chPerf.map((c, i) => <tr key={i} className="trow">
                  <td className="td" style={{ padding: "6px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent }} />
                      <span style={{ fontWeight: 600, color: T.text }}>{c.name}</span>
                    </div>
                  </td>
                  <td className="td r" style={{ padding: "6px 8px", color: T.green, fontWeight: 600 }}>{fmtCur(c.revenue)}</td>
                  <td className="td r" style={{ padding: "6px 8px" }}>{c.units}</td>
                  <td className="td r m" style={{ padding: "6px 8px" }}>{fmtCur(c.avgOrder)}</td>
                </tr>)}
                {chPerf.length === 0 && <tr><td colSpan={4} className="td" style={{ textAlign: "center", color: T.textMuted }}>No data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
            <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>By Category</div>
            {catPerf.length > 0 && <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={catPerf} cx="50%" cy="50%" outerRadius={65} dataKey="revenue" paddingAngle={3} nameKey="name">
                  {catPerf.map((_, i) => <Cell key={i} fill={catPerf[i].color || PC[i % PC.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmtCur(v)} contentStyle={{ background: T.surfaceStrong, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>}
            <div style={{ overflowX: "auto", marginTop: 4 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr>{["Category", "Revenue", "Profit", "Margin"].map(h => <th key={h} className="th" style={{ textAlign: h === "Category" ? "left" : "right", padding: "6px 8px" }}>{h.toUpperCase()}</th>)}</tr></thead>
                <tbody>{catPerf.map((c, i) => <tr key={i} className="trow">
                  <td className="td" style={{ padding: "6px 8px" }}><span className="tag" style={{ background: (c.color || PC[i % PC.length]) + "18", color: c.color || PC[i % PC.length] }}>{c.name}</span></td>
                  <td className="td r" style={{ padding: "6px 8px", color: T.green, fontWeight: 600 }}>{fmtCur(c.revenue)}</td>
                  <td className="td r" style={{ padding: "6px 8px", color: T.accent, fontWeight: 600 }}>{fmtCur(c.profit)}</td>
                  <td className="td r" style={{ padding: "6px 8px", color: T.purple }}>{c.margin}%</td>
                </tr>)}
                {catPerf.length === 0 && <tr><td colSpan={4} className="td" style={{ textAlign: "center", color: T.textMuted }}>No data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>}

      {/* ── PURCHASE TAB ── */}
      {tab === "Purchase" && <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="kgrid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          <KCard label="Total Purchase Cost" value={fmtCur(pc)} sub={`${pu} units`} icon={ShoppingCart} color={T.blue} />
          <KCard label="Vendors Used" value={vendorPerf.length.toString()} sub="In selected period" icon={Truck} color={T.accent} />
          <KCard label="Orders Placed" value={new Set(purch.map(t => t.billId).filter(Boolean)).size.toString()} sub="Purchase orders" icon={Box} color={T.purple} />
        </div>

        {/* Monthly purchase trend */}
        <div className="glass" style={{ padding: "18px 18px 10px", borderRadius: T.radius }}>
          <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>12-Month Purchase Trend</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly12}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: T.textMuted }} tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v} axisLine={false} tickLine={false} />
              <Tooltip content={<CTip fmt />} />
              <Bar dataKey="purchase" name="Purchase Cost" fill={T.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Vendor spend + product breakdown */}
        <div className="chart-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
            <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Vendor Spend</div>
            {vendorPerf.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {vendorPerf.slice(0, 5).map((v, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</div>
                  <div style={{ height: 4, borderRadius: 99, background: T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", marginTop: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${(v.cost / vendorPerf[0].cost) * 100}%`, background: T.blue }} />
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.blue, flexShrink: 0 }}>{fmtCur(v.cost)}</div>
              </div>)}
            </div>}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead><tr>{["Vendor", "Cost", "Units", "Orders"].map(h => <th key={h} className="th" style={{ textAlign: h === "Vendor" ? "left" : "right", padding: "6px 8px" }}>{h.toUpperCase()}</th>)}</tr></thead>
              <tbody>{vendorPerf.map((v, i) => <tr key={i} className="trow">
                <td className="td" style={{ padding: "6px 8px", fontWeight: 600 }}>{v.name}</td>
                <td className="td r" style={{ padding: "6px 8px", color: T.blue, fontWeight: 600 }}>{fmtCur(v.cost)}</td>
                <td className="td r" style={{ padding: "6px 8px" }}>{v.units}</td>
                <td className="td r" style={{ padding: "6px 8px" }}>{v.orders}</td>
              </tr>)}
              {vendorPerf.length === 0 && <tr><td colSpan={4} className="td" style={{ textAlign: "center", color: T.textMuted }}>No data</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
            <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>By Product</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead><tr>{["Product", "Units", "Cost"].map(h => <th key={h} className="th" style={{ textAlign: h === "Product" ? "left" : "right", padding: "6px 8px" }}>{h.toUpperCase()}</th>)}</tr></thead>
              <tbody>{purProd.slice(0, 10).map((x, i) => <tr key={i} className="trow">
                <td className="td" style={{ padding: "6px 8px" }}><div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{x.p?.name}</div><div style={{ fontSize: 9, color: T.textMuted }}>{x.p?.sku}</div></td>
                <td className="td r" style={{ padding: "6px 8px" }}>{x.units}</td>
                <td className="td r" style={{ padding: "6px 8px", color: T.blue, fontWeight: 600 }}>{fmtCur(x.cost)}</td>
              </tr>)}
              {purProd.length === 0 && <tr><td colSpan={3} className="td" style={{ textAlign: "center", color: T.textMuted }}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>}

      {/* ── PRODUCTS TAB ── */}
      {tab === "Products" && <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
          <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Product Performance — Full Breakdown</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr>{["Rank", "Product", "SKU", "Net Units", "Net Revenue", "Net COGS", "Gross Profit", "Margin", "Avg Price", "Stock"].map(h => <th key={h} className="th" style={{ textAlign: ["Net Units", "Net Revenue", "Net COGS", "Gross Profit", "Margin", "Avg Price"].includes(h) ? "right" : "left" }}>{h.toUpperCase()}</th>)}</tr></thead>
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
                  <td className="td r m">{x.units > 0 ? fmtCur(x.revenue / x.units) : "—"}</td>
                  <td className="td"><StChip stock={x.currentStock} min={Number(x.p?.minStock || 0)} /></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>

        {deadStock.length > 0 && <div className="glass" style={{ padding: 18, borderRadius: T.radius, borderLeft: `4px solid ${T.red}` }}>
          <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.red, marginBottom: 14 }}>⚠️ Dead Stock — No Sales in Period ({deadStock.length} products)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr>{["Product", "SKU", "Category", "Stock", "Value"].map(h => <th key={h} className="th" style={{ textAlign: ["Stock", "Value"].includes(h) ? "right" : "left" }}>{h.toUpperCase()}</th>)}</tr></thead>
              <tbody>{deadStock.map(p => {
                const cat = categories.find(c => c.id === p.categoryId);
                return <tr key={p.id} className="trow">
                  <td className="td" style={{ fontWeight: 600 }}>{p.name}</td>
                  <td className="td m" style={{ fontFamily: "monospace", fontSize: 10 }}>{p.sku}</td>
                  <td className="td">{cat && <span className="tag" style={{ background: cat.color + "18", color: cat.color }}>{cat.name}</span>}</td>
                  <td className="td r" style={{ fontWeight: 700, color: T.amber }}>{p.stock}</td>
                  <td className="td r" style={{ fontWeight: 600, color: T.red }}>{fmtCur(p.value)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </div>}
      </div>}

      {/* ── INVENTORY TAB ── */}
      {tab === "Inventory" && <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="kgrid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          <KCard label="Total Inventory Value" value={fmtCur(products.reduce((s, p) => s + getStock(p.id) * Number(p.purchasePrice), 0))} sub={`${products.length} SKUs`} icon={Box} color={T.accent} />
          <KCard label="Low Stock Items" value={products.filter(p => getStock(p.id) > 0 && getStock(p.id) <= Number(p.minStock)).length.toString()} sub="Below min level" icon={Tag} color={T.amber} />
          <KCard label="Out of Stock" value={products.filter(p => getStock(p.id) <= 0).length.toString()} sub="Zero units" icon={Box} color={T.red} />
        </div>

        <div className="chart-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
          <div className="glass" style={{ padding: "18px 18px 10px", borderRadius: T.radius }}>
            <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Stock Levels by Product</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={products.map(p => ({ name: p.alias || p.name?.slice(0, 12), stock: getStock(p.id) })).sort((a, b) => b.stock - a.stock).slice(0, 12)} layout="vertical" margin={{ left: 90 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: T.textMuted }} width={90} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: T.surfaceStrong, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 11 }} />
                <Bar dataKey="stock" name="Stock" fill={T.accent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
            <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Value by Category</div>
            {invStats.length > 0 && <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={invStats} cx="50%" cy="50%" outerRadius={60} dataKey="value" paddingAngle={3}>
                  {invStats.map((_, i) => <Cell key={i} fill={invStats[i].color || PC[i % PC.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmtCur(v)} contentStyle={{ background: T.surfaceStrong, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>}
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
              {invStats.map((c, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color || PC[i % PC.length] }} /><span style={{ color: T.textSub }}>{c.name}</span></div>
                <span style={{ fontWeight: 600, color: T.text }}>{fmtCur(c.value)}</span>
              </div>)}
            </div>
          </div>
        </div>

        {/* Full inventory table */}
        <div className="glass" style={{ borderRadius: T.radius, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.borderSubtle}`, fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text }}>Full Stock Register</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ background: T.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)" }}>
                {["Product", "SKU", "Category", "Stock", "Value", "MRP", "Cost", "Margin", "Status"].map(h => <th key={h} className="th" style={{ textAlign: ["Stock", "Value", "MRP", "Cost", "Margin"].includes(h) ? "right" : "left" }}>{h.toUpperCase()}</th>)}
              </tr></thead>
              <tbody>{products.map(p => {
                const stock = getStock(p.id);
                const cat = categories.find(c => c.id === p.categoryId);
                return <tr key={p.id} className="trow">
                  <td className="td"><div style={{ fontWeight: 600, color: T.text, fontSize: 12 }}>{p.name}</div><div style={{ color: T.textMuted, fontSize: 10 }}>{p.alias}</div></td>
                  <td className="td m" style={{ fontFamily: "monospace", fontSize: 10 }}>{p.sku}</td>
                  <td className="td">{cat && <span className="tag" style={{ background: cat.color + "18", color: cat.color }}>{cat.name}</span>}</td>
                  <td className="td r" style={{ fontWeight: 700, color: stock <= 0 ? T.red : stock <= Number(p.minStock || 0) ? T.amber : T.text }}>{stock}</td>
                  <td className="td r" style={{ fontWeight: 600, color: T.accent }}>{fmtCur(stock * Number(p.purchasePrice))}</td>
                  <td className="td r">₹{Number(p.mrp || 0).toLocaleString("en-IN")}</td>
                  <td className="td r m">₹{Number(p.purchasePrice || 0).toLocaleString("en-IN")}</td>
                  <td className="td r" style={{ color: T.green }}>{p.margin || 0}%</td>
                  <td className="td"><StChip stock={stock} min={Number(p.minStock || 0)} /></td>
                </tr>;
              })}</tbody>
              <tfoot><tr style={{ borderTop: `2px solid ${T.accent}30` }}>
                <td className="td" colSpan={4} style={{ fontWeight: 700 }}>TOTAL</td>
                <td className="td r" style={{ fontWeight: 700, color: T.accent }}>{fmtCur(products.reduce((s, p) => s + getStock(p.id) * Number(p.purchasePrice), 0))}</td>
                <td colSpan={4} className="td" />
              </tr></tfoot>
            </table>
          </div>
        </div>
      </div>}
    </div>
  );
}
