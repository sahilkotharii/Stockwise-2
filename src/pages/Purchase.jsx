import React, { useState, useMemo, useEffect } from "react";
import { Plus, Search, X, Eye, Trash2, ShoppingCart, FileText, Box, Truck, Edit2, Send } from "lucide-react";
import { useT } from "../theme";
import { KCard, GBtn, GS, Modal, Pager } from "../components/UI";
import BillForm from "../components/BillForm";
import { uid, fmtCur, fmtDate, inRange, getLast12Months, monthOf } from "../utils";

export default function Purchase({ ctx }) {
  const T = useT();
  const { bills, saveBills, transactions, saveTransactions, products, vendors, channels, getStock, user, addLog, addChangeReq } = ctx;
  const isAdmin = user.role === "admin";
  const isManager = user.role === "manager";
  const [modal, setModal] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [df, setDf] = useState(""); const [dt, setDt] = useState(""); const [vF, setVF] = useState("");
  const [pg, setPg] = useState(1); const [ps, setPs] = useState(20);
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
    return { ...m, cost, units: mp.reduce((s, t) => s + Number(t.qty), 0), orders: new Set(mp.map(t => t.billId).filter(Boolean)).size };
  }), [purTxns]);

  const thisMonth = monthly[monthly.length - 1];
  const lastMonth = monthly[monthly.length - 2];
  const costDelta = lastMonth?.cost > 0 ? ((thisMonth.cost - lastMonth.cost) / lastMonth.cost * 100) : 0;
  const totalCost = monthly.reduce((s, m) => s + m.cost, 0);
  const totalUnits = monthly.reduce((s, m) => s + m.units, 0);
  const vendorCount = new Set(purTxns.map(t => t.vendorId).filter(Boolean)).size;

  const handleSaveBill = bill => {
    if (isManager) { addChangeReq({ entity: "purchase", action: "create", entityId: null, entityName: bill.billNo, currentData: null, proposedData: bill }); setModal(false); return; }
    const newTxns = bill.items.map(item => ({ id: uid(), productId: item.productId, type: item.isDamaged ? "damaged" : "purchase", qty: item.qty, price: item.price, vendorId: bill.vendorId, channelId: null, date: bill.date, notes: `Bill: ${bill.billNo}${bill.notes ? ` · ${bill.notes}` : ""}`, userId: user.id, userName: user.name, billId: bill.id, isDamaged: item.isDamaged }));
    saveBills([bill, ...bills]);
    saveTransactions([...newTxns, ...transactions]);
    addLog("created", "purchase bill", bill.billNo, `${bill.items.length} items · ${fmtCur(bill.total)}`);
    setModal(false);
  };

  const handleEditBill = updatedBill => {
    const filteredTxns = transactions.filter(t => t.billId !== updatedBill.id);
    const newTxns = updatedBill.items.map(item => ({ id: uid(), productId: item.productId, type: item.isDamaged ? "damaged" : "purchase", qty: item.qty, price: item.price, vendorId: updatedBill.vendorId, channelId: null, date: updatedBill.date, notes: `Bill: ${updatedBill.billNo}`, userId: user.id, userName: user.name, billId: updatedBill.id, isDamaged: item.isDamaged }));
    saveBills(bills.map(b => b.id === updatedBill.id ? updatedBill : b));
    saveTransactions([...newTxns, ...filteredTxns]);
    addLog("edited", "purchase bill", updatedBill.billNo);
    setEditBill(null);
  };

  const deleteBill = b => {
    if (!window.confirm(`Delete bill ${b.billNo}?`)) return;
    saveBills(bills.filter(x => x.id !== b.id));
    saveTransactions(transactions.filter(t => t.billId !== b.id));
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {/* Top action bar */}
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <GBtn sz="md" onClick={() => setModal(true)} icon={<Plus size={14} />}>New Purchase Bill</GBtn>
    </div>

    {/* KPIs */}
    <div className="kgrid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
      <KCard label="This Month Cost" value={fmtCur(thisMonth.cost)} sub={`${thisMonth.units} units`} icon={ShoppingCart} color={T.blue} delta={costDelta} />
      <KCard label="This Month Orders" value={thisMonth.orders.toString()} sub="Purchase orders" icon={FileText} color={T.accent} />
      <KCard label="Total (12 Months)" value={fmtCur(totalCost)} sub={`${totalUnits} units`} icon={Box} color={T.purple} />
      <KCard label="Vendors Used" value={vendorCount.toString()} sub="Across all purchases" icon={Truck} color={T.cyan} />
    </div>

    {/* Bills table */}
    <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
      <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Purchase Bills</div>
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
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>{["Bill No", "Date", "Vendor", "Items", "Subtotal", "GST", "Total", "", ""].map((h, i) => <th key={i} className="th" style={{ textAlign: ["Subtotal", "GST", "Total"].includes(h) ? "right" : "left", width: h === "" ? 36 : "auto" }}>{h.toUpperCase()}</th>)}</tr></thead>
          <tbody>
            {purBills.slice((pg - 1) * ps, pg * ps).map(b => {
              const v = vendors.find(x => x.id === b.vendorId);
              return <React.Fragment key={b.id}>
                <tr className="trow">
                  <td className="td" style={{ fontWeight: 600, color: T.blue }}>{b.billNo}</td>
                  <td className="td m">{fmtDate(b.date)}</td>
                  <td className="td">{v?.name || "—"}</td>
                  <td className="td m">{(b.items || []).length} item{(b.items || []).length !== 1 ? "s" : ""}</td>
                  <td className="td r">{fmtCur(b.subtotal)}</td>
                  <td className="td r" style={{ color: (b.totalGst || 0) > 0 ? T.amber : T.textMuted }}>{(b.totalGst || 0) > 0 ? `+${fmtCur(b.totalGst)}` : "—"}</td>
                  <td className="td r" style={{ fontWeight: 700, color: T.blue }}>{fmtCur(b.total)}</td>
                  <td className="td">
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn-ghost" onClick={() => setExp(p => ({ ...p, [b.id]: !p[b.id] }))} style={{ padding: "3px 7px" }}><Eye size={13} /></button>
                      {isAdmin && <button className="btn-ghost" onClick={() => setEditBill(b)} style={{ padding: "3px 7px" }}><Edit2 size={13} /></button>}
                    </div>
                  </td>
                  <td className="td">{isAdmin && <button className="btn-danger" onClick={() => deleteBill(b)} style={{ padding: "3px 7px" }}><Trash2 size={11} /></button>}</td>
                </tr>
                {exp[b.id] && <tr style={{ background: T.isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)" }}>
                  <td colSpan={9} style={{ padding: "12px 20px", borderBottom: `1px solid ${T.borderSubtle}` }}>
                    <div style={{ fontWeight: 700, color: T.textMuted, fontSize: 10, marginBottom: 8 }}>BILL ITEMS</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                      {(b.items || []).map((it, idx) => {
                        const gstAmt = it.gstAmount || (it.gstRate ? Number(it.qty) * Number(it.price) * Number(it.gstRate) / 100 : 0);
                        return <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.text }}>
                          <span>{it.productName} × {it.qty}{it.gstRate > 0 ? <span style={{ color: T.amber, fontSize: 10, marginLeft: 6 }}>+GST@{it.gstRate}%: {fmtCur(gstAmt)}</span> : ""}{it.isDamaged ? <span style={{ color: T.red, fontWeight: 600, fontSize: 10, marginLeft: 6 }}>REJECTED</span> : ""}</span>
                          <span style={{ fontWeight: 600 }}>{fmtCur(Number(it.qty) * Number(it.price) + gstAmt)}</span>
                        </div>;
                      })}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 240, marginLeft: "auto", borderTop: `1px solid ${T.borderSubtle}`, paddingTop: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textSub }}><span>Subtotal (ex-GST)</span><span>{fmtCur(b.subtotal)}</span></div>
                      {(b.totalGst || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.amber }}><span>GST</span><span>+{fmtCur(b.totalGst)}</span></div>}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: T.blue }}><span>Total (incl. GST)</span><span>{fmtCur(b.total)}</span></div>
                    </div>
                    {b.notes && <div style={{ fontSize: 11, color: T.textSub, marginTop: 8, fontStyle: "italic" }}>Note: {b.notes}</div>}
                  </td>
                </tr>}
              </React.Fragment>;
            })}
          </tbody>
        </table>
        {purBills.length === 0 && <div style={{ padding: "40px 0", textAlign: "center", color: T.textMuted }}>No purchase bills found</div>}
      </div>
      <Pager total={purBills.length} page={pg} ps={ps} setPage={setPg} setPs={setPs} />
    </div>

    <Modal open={modal} onClose={() => setModal(false)} title="New Purchase Bill" width={680}
      footer={<><GBtn v="ghost" onClick={() => setModal(false)}>Cancel</GBtn><GBtn type="submit" form="purchase-form">Save Purchase Bill</GBtn></>}>
      <BillForm type="purchase" bills={bills} onSave={handleSaveBill} products={products} vendors={vendors} channels={channels} getStock={getStock} />
    </Modal>

    <Modal open={Boolean(editBill)} onClose={() => setEditBill(null)} title={`Edit Bill: ${editBill?.billNo}`} width={680}
      footer={<><GBtn v="ghost" onClick={() => setEditBill(null)}>Cancel</GBtn><GBtn type="submit" form="purchase-form" icon={<Edit2 size={13} />}>Save Changes</GBtn></>}>
      {editBill && <BillForm type="purchase" bills={bills} onSave={handleEditBill} products={products} vendors={vendors} channels={channels} getStock={getStock} existingBill={editBill} />}
    </Modal>
  </div>;
}
