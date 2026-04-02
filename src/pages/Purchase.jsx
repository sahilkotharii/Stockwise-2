import React, { useState, useMemo, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Plus, Search, X, Eye, Trash2, ShoppingCart, FileText, Box, Truck } from "lucide-react";
import { useT } from "../theme";
import { KCard, CTip, GBtn, GS, Modal, Pager } from "../components/UI";
import BillForm from "../components/BillForm";
import { uid, fmtCur, fmtDate, inRange, getLast12Months, monthOf } from "../utils";

export default function Purchase({ ctx }) {
  const T = useT();
  const { bills, saveBills, transactions, saveTransactions, products, vendors, channels, getStock, user, addLog, addChangeReq } = ctx;
  const isManager = user.role === "manager";
  const [modal, setModal] = useState(false);
  const [df, setDf] = useState("");
  const [dt, setDt] = useState("");
  const [vF, setVF] = useState("");
  const [pg, setPg] = useState(1);
  const [ps, setPs] = useState(20);
  const [search, setSearch] = useState("");
  const [exp, setExp] = useState({});
  useEffect(() => setPg(1), [df, dt, vF, search, ps]);

  const purBills = useMemo(() => bills.filter(b => b.type === "purchase").filter(b => {
    if (!inRange(b.date, df, dt)) return false;
    if (vF && b.vendorId !== vF) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!b.billNo.toLowerCase().includes(q) && !(b.items || []).some(i => i.productName?.toLowerCase().includes(q))) return false;
    }
    return true;
  }).sort((a, b2) => new Date(b2.date) - new Date(a.date)), [bills, df, dt, vF, search]);

  const purTxns = useMemo(() => transactions.filter(t => t.type === "purchase"), [transactions]);
  const months = getLast12Months();
  const monthly = useMemo(() => months.map(m => {
    const mp = purTxns.filter(t => monthOf(t.date) === m.key);
    const cost = mp.reduce((s, t) => s + Number(t.qty) * Number(t.price), 0);
    return { ...m, cost, units: mp.reduce((s, t) => s + Number(t.qty), 0), orders: new Set(mp.map(t => t.billId).filter(Boolean)).size + mp.filter(t => !t.billId).length };
  }), [purTxns]);

  const thisMonth = monthly[monthly.length - 1];
  const lastMonth = monthly[monthly.length - 2];
  const costDelta = lastMonth?.cost > 0 ? ((thisMonth.cost - lastMonth.cost) / lastMonth.cost * 100) : 0;

  const vendorSpend = useMemo(() => {
    const m = {};
    purTxns.forEach(t => {
      const v = vendors.find(x => x.id === t.vendorId);
      const n = v?.name || "Unknown";
      if (!m[n]) m[n] = { name: n, cost: 0, orders: 0 };
      m[n].cost += Number(t.qty) * Number(t.price);
      m[n].orders += 1;
    });
    return Object.values(m).sort((a, b) => b.cost - a.cost);
  }, [purTxns, vendors]);

  const handleSaveBill = bill => {
    if (isManager) { addChangeReq({ entity: "purchase", action: "create", entityId: null, entityName: bill.billNo, currentData: null, proposedData: bill }); setModal(false); return; }
    const newTxns = bill.items.map(item => ({ id: uid(), productId: item.productId, type: item.isDamaged ? "damaged" : "purchase", qty: item.qty, price: item.price, vendorId: bill.vendorId, channelId: null, date: bill.date, notes: `Bill: ${bill.billNo}${bill.notes ? ` · ${bill.notes}` : ""}`, userId: user.id, userName: user.name, billId: bill.id, isDamaged: item.isDamaged }));
    saveBills([bill, ...bills]);
    saveTransactions([...newTxns, ...transactions]);
    addLog("created", "purchase bill", bill.billNo, `${bill.items.length} items · ${fmtCur(bill.total)}`);
    setModal(false);
  };

  const deleteBill = b => {
    if (!window.confirm(`Delete bill ${b.billNo}? This removes all associated transactions.`)) return;
    saveBills(bills.filter(x => x.id !== b.id));
    saveTransactions(transactions.filter(t => t.billId !== b.id));
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {/* ── Top action bar ── */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
      <GBtn sz="md" onClick={() => setModal(true)} icon={<Plus size={14} />}>New Purchase Bill</GBtn>
    </div>
    <div className="kgrid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
      <KCard label="This Month Cost" value={fmtCur(thisMonth.cost)} sub={`${thisMonth.units} units purchased`} icon={ShoppingCart} color={T.blue} delta={costDelta} />
      <KCard label="This Month Orders" value={thisMonth.orders.toString()} sub="Purchase orders" icon={FileText} color={T.accent} />
      <KCard label="Total (12 Months)" value={fmtCur(monthly.reduce((s, m) => s + m.cost, 0))} sub={`${monthly.reduce((s, m) => s + m.units, 0)} units`} icon={Box} color={T.purple} />
      <KCard label="Vendors Used" value={vendorSpend.length.toString()} sub={`Top: ${vendorSpend[0]?.name || "—"}`} icon={Truck} color={T.cyan} />
    </div>
    <div className="chart-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
      <div className="glass" style={{ padding: "18px 18px 10px", borderRadius: T.radius }}>
        <div style={{ fontFamily: "Syne,sans-serif", fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Monthly Purchase Trend</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: T.textMuted }} tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v} axisLine={false} tickLine={false} />
            <Tooltip content={<CTip fmt />} />
            <Bar dataKey="cost" name="Cost" fill={T.blue} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
        <div style={{ fontFamily: "Syne,sans-serif", fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Vendor Spend</div>
        {vendorSpend.length === 0 ? <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 13 }}>No data</div> :
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{vendorSpend.slice(0, 5).map((v, i) => <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</div>
              <div style={{ height: 4, borderRadius: 99, background: T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", marginTop: 4, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 99, width: `${(v.cost / vendorSpend[0].cost) * 100}%`, background: T.blue }} /></div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.blue, flexShrink: 0 }}>{fmtCur(v.cost)}</div>
          </div>)}</div>}
      </div>
    </div>
    <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontFamily: "Syne,sans-serif", fontWeight: 700, fontSize: 15, color: T.text }}>Purchase Bills</div>
      </div>
      <div className="filter-wrap" style={{ marginBottom: 12 }}>
        <div style={{ position: "relative", flex: "1 1 160px" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
          <input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bill, product…" style={{ paddingLeft: 30 }} />
        </div>
        <input type="date" className="inp" value={df} onChange={e => setDf(e.target.value)} style={{ flex: "0 1 120px" }} />
        <span style={{ fontSize: 12, color: T.textMuted }}>→</span>
        <input type="date" className="inp" value={dt} onChange={e => setDt(e.target.value)} style={{ flex: "0 1 120px" }} />
        <GS value={vF} onChange={e => setVF(e.target.value)} placeholder="All Vendors">{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</GS>
        {(df || dt || vF || search) && <GBtn v="ghost" sz="sm" onClick={() => { setDf(""); setDt(""); setVF(""); setSearch(""); }} icon={<X size={12} />}>Clear</GBtn>}
      </div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr>{["Bill No", "Date", "Vendor", "Items", "Total", "", ""].map((h, i) => <th key={i} className="th" style={{ textAlign: h === "Total" ? "right" : "left", width: h === "" ? 40 : "auto" }}>{h.toUpperCase()}</th>)}</tr></thead>
        <tbody>{purBills.slice((pg - 1) * ps, pg * ps).map(b => {
          const v = vendors.find(x => x.id === b.vendorId);
          return <React.Fragment key={b.id}>
            <tr className="trow">
              <td className="td" style={{ fontWeight: 600, color: T.blue }}>{b.billNo}</td>
              <td className="td m">{fmtDate(b.date)}</td>
              <td className="td">{v?.name || "—"}</td>
              <td className="td m">{(b.items || []).length} item{(b.items || []).length !== 1 ? "s" : ""}</td>
              <td className="td r" style={{ fontWeight: 700, color: T.blue }}>{fmtCur(b.total)}</td>
              <td className="td"><button className="btn-ghost" onClick={() => setExp(p => ({ ...p, [b.id]: !p[b.id] }))} style={{ padding: "3px 7px" }}><Eye size={13} /></button></td>
              <td className="td">{user.role === "admin" && <button className="btn-danger" onClick={() => deleteBill(b)} style={{ padding: "3px 7px" }}><Trash2 size={11} /></button>}</td>
            </tr>
            {exp[b.id] && <tr style={{ background: T.isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)" }}><td colSpan={7} style={{ padding: "14px 20px", borderBottom: `1px solid ${T.borderSubtle}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.05em", marginBottom: 8 }}>BILL ITEMS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 12 }}>
                {(b.items || []).map((it, idx) => {
                  const lineBase = Number(it.qty) * Number(it.price);
                  const gstAmt = it.gstAmount || (it.gstRate ? lineBase * Number(it.gstRate) / 100 : 0);
                  const lineTotal = lineBase + gstAmt;
                  return (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 40px 80px 80px 80px 80px", gap: 8, alignItems: "start", padding: "7px 0", borderBottom: `1px solid ${T.borderSubtle}` }}>
                      <div>
                        <span style={{ fontWeight: 600, color: T.text, fontSize: 12 }}>{it.productName}</span>
                        {it.isDamaged && <span style={{ color: T.red, fontWeight: 600, fontSize: 10, marginLeft: 8 }}>REJECTED</span>}
                        {it.gstRate > 0 && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>HSN: {it.hsn || "—"} · GST @{it.gstRate}%</div>}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted, textAlign: "center", paddingTop: 1 }}>×{it.qty}</div>
                      <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: T.textSub }}>{fmtCur(it.price)}</div><div style={{ fontSize: 9, color: T.textMuted }}>ex-GST/unit</div></div>
                      <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: T.amber }}>{it.gstRate > 0 ? `+${fmtCur(gstAmt)}` : "—"}</div><div style={{ fontSize: 9, color: T.textMuted }}>GST @{it.gstRate || 0}%</div></div>
                      <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: T.textSub }}>{fmtCur(lineBase)}</div><div style={{ fontSize: 9, color: T.textMuted }}>base total</div></div>
                      <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, fontWeight: 700, color: T.blue }}>{fmtCur(lineTotal)}</div><div style={{ fontSize: 9, color: T.textMuted }}>incl. GST</div></div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 260, marginLeft: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textSub }}><span>Subtotal (ex-GST)</span><span style={{ fontWeight: 600 }}>{fmtCur(b.subtotal)}</span></div>
                {(b.totalGst || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.amber }}><span>GST Amount</span><span style={{ fontWeight: 600 }}>+{fmtCur(b.totalGst)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: T.blue, borderTop: `1px solid ${T.borderSubtle}`, paddingTop: 6, marginTop: 2 }}><span>Total (incl. GST)</span><span>{fmtCur(b.total)}</span></div>
              </div>
              {b.notes && <div style={{ fontSize: 11, color: T.textSub, marginTop: 10, fontStyle: "italic" }}>Note: {b.notes}</div>}
            </td></tr>}
          </React.Fragment>;
        })}</tbody>
      </table>
        {purBills.length === 0 && <div style={{ padding: "40px 0", textAlign: "center", color: T.textMuted }}>No purchase bills found</div>}
      </div>
      <Pager total={purBills.length} page={pg} ps={ps} setPage={setPg} setPs={setPs} />
    </div>
    <Modal open={modal} onClose={() => setModal(false)} title="New Purchase Bill" width={680}
      footer={<><GBtn v="ghost" onClick={() => setModal(false)}>Cancel</GBtn><GBtn type="submit" form="purchase-form">Save Purchase Bill</GBtn></>}>
      <BillForm type="purchase" bills={bills} onSave={handleSaveBill} products={products} vendors={vendors} channels={channels} getStock={getStock} />
    </Modal>
  </div>;
}
