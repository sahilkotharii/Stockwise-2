import React, { useState, useMemo, useEffect } from "react";
import { Plus, Search, X, RotateCcw, Eye, Trash2, Send, DollarSign, Star, TrendingUp, Edit2, ChevronDown, ChevronRight } from "lucide-react";
import { useT } from "../theme";
import { KCard, CTip, GBtn, GIn, GS, GTa, Field, Modal, Pager } from "../components/UI";
import BillForm from "../components/BillForm";
import { uid, today, fmtCur, fmtDate, inRange, getLast12Months, monthOf } from "../utils";

function ChannelTag({ ch }) {
  const T = useT();
  if (!ch) return <span style={{ color: T.textMuted }}>—</span>;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 99, background: ch.color + "18", border: `1px solid ${ch.color}30` }}>
      {ch.logoUrl
        ? <img src={ch.logoUrl} alt="" style={{ width: 14, height: 14, borderRadius: 2, objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} />
        : <div style={{ width: 7, height: 7, borderRadius: "50%", background: ch.color }} />}
      <span style={{ fontSize: 11, fontWeight: 600, color: ch.color }}>{ch.name}</span>
    </div>
  );
}

export default function Sales({ ctx }) {
  const T = useT();
  const { bills, saveBills, transactions, saveTransactions, products, vendors, channels, getStock, user, addLog, addChangeReq } = ctx;
  const isManager = user.role === "manager";
  const isAdmin = user.role === "admin";

  const [modal, setModal] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [retModal, setRetModal] = useState(false);
  const [df, setDf] = useState(""); const [dt, setDt] = useState("");
  const [chF, setChF] = useState(""); const [pg, setPg] = useState(1); const [ps, setPs] = useState(20);
  const [search, setSearch] = useState("");
  const [retForm, setRetForm] = useState({ productId: "", qty: 1, channelId: "", date: today(), notes: "", isDamaged: false });
  const [exp, setExp] = useState({});
  const [showMonthly, setShowMonthly] = useState(false);
  useEffect(() => setPg(1), [df, dt, chF, search, ps]);

  const saleBills = useMemo(() => bills.filter(b => b.type === "sale").filter(b => {
    if (!inRange(b.date, df, dt)) return false;
    if (chF && b.channelId !== chF) return false;
    if (search) {
      const q = search.toLowerCase();
      const match = (b.items || []).some(i => i.productName?.toLowerCase().includes(q));
      if (!match && !b.billNo.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b2) => new Date(b2.date) - new Date(a.date)), [bills, df, dt, chF, search]);

  const saleTxns = useMemo(() => transactions.filter(t => t.type === "sale"), [transactions]);
  const retTxns = useMemo(() => transactions.filter(t => t.type === "return"), [transactions]);
  const pp = pid => Number(products.find(pr => pr.id === pid)?.purchasePrice || 0);
  const months = getLast12Months();

  const monthly = useMemo(() => months.map(m => {
    const ms = saleTxns.filter(t => monthOf(t.date) === m.key);
    const mr = retTxns.filter(t => monthOf(t.date) === m.key);
    const revenue = ms.reduce((s, t) => s + Number(t.qty) * Number(t.price), 0);
    const retAmt = mr.reduce((s, t) => s + Number(t.qty) * Number(t.price), 0);
    const cogsSales = ms.reduce((s, t) => s + Number(t.qty) * pp(t.productId), 0);
    const cogsRet = mr.reduce((s, t) => s + Number(t.qty) * pp(t.productId), 0);
    const netRev = revenue - retAmt;
    return { ...m, revenue, retAmt, net: netRev, orders: ms.length, cogs: cogsSales - cogsRet, profit: netRev - (cogsSales - cogsRet) };
  }), [saleTxns, retTxns, products]);

  const thisMonth = monthly[monthly.length - 1];
  const lastMonth = monthly[monthly.length - 2];
  const revDelta = lastMonth?.revenue > 0 ? ((thisMonth.revenue - lastMonth.revenue) / lastMonth.revenue * 100) : 0;
  const totalRev = monthly.reduce((s, m) => s + m.revenue, 0);
  const totalRet = monthly.reduce((s, m) => s + m.retAmt, 0);
  const totalNet = totalRev - totalRet;

  const handleSaveBill = bill => {
    if (isManager) { addChangeReq({ entity: "sale", action: "create", entityId: null, entityName: bill.billNo, currentData: null, proposedData: bill }); setModal(false); return; }
    const newTxns = bill.items.map(item => ({ id: uid(), productId: item.productId, type: item.isDamaged ? "damaged" : "sale", qty: item.qty, price: item.price, vendorId: null, channelId: bill.channelId, date: bill.date, notes: `Bill: ${bill.billNo}${bill.notes ? ` · ${bill.notes}` : ""}`, userId: user.id, userName: user.name, billId: bill.id, isDamaged: item.isDamaged, discountApplied: bill.discAmount > 0 ? `${bill.discType === "percent" ? bill.discValue + "%" : "₹" + bill.discValue} off` : null }));
    saveBills([bill, ...bills]);
    saveTransactions([...newTxns, ...transactions]);
    addLog("created", "sale bill", bill.billNo, `${bill.items.length} items · ${fmtCur(bill.total)}`);
    setModal(false);
  };

  const handleEditBill = updatedBill => {
    const filteredTxns = transactions.filter(t => t.billId !== updatedBill.id);
    const newTxns = updatedBill.items.map(item => ({ id: uid(), productId: item.productId, type: item.isDamaged ? "damaged" : "sale", qty: item.qty, price: item.price, vendorId: null, channelId: updatedBill.channelId, date: updatedBill.date, notes: `Bill: ${updatedBill.billNo}`, userId: user.id, userName: user.name, billId: updatedBill.id, isDamaged: item.isDamaged }));
    saveBills(bills.map(b => b.id === updatedBill.id ? updatedBill : b));
    saveTransactions([...newTxns, ...filteredTxns]);
    addLog("edited", "sale bill", updatedBill.billNo);
    setEditBill(null);
  };

  const handleReturn = () => {
    if (!retForm.productId || !retForm.qty) return;
    const t = { id: uid(), productId: retForm.productId, type: retForm.isDamaged ? "damaged" : "return", qty: Number(retForm.qty), price: products.find(p => p.id === retForm.productId)?.mrp || 0, vendorId: null, channelId: retForm.channelId || null, date: retForm.date, notes: retForm.notes || "Customer return", userId: user.id, userName: user.name, billId: null, isDamaged: retForm.isDamaged };
    saveTransactions([t, ...transactions]);
    addLog("recorded", retForm.isDamaged ? "damaged return" : "sale return", products.find(p => p.id === retForm.productId)?.name || "");
    setRetModal(false);
    setRetForm({ productId: "", qty: 1, channelId: "", date: today(), notes: "", isDamaged: false });
  };

  const deleteBill = b => {
    if (!window.confirm(`Delete bill ${b.billNo}? This removes all associated transactions.`)) return;
    saveBills(bills.filter(x => x.id !== b.id));
    saveTransactions(transactions.filter(t => t.billId !== b.id));
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {isManager && <div style={{ padding: "10px 14px", borderRadius: 12, background: T.amberBg, border: `1px solid ${T.amber}30`, fontSize: 12, color: T.amber, fontWeight: 600 }}>⚠️ Manager mode — new sales require admin approval</div>}

    {/* Top bar */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <GBtn v="ghost" sz="sm" onClick={() => setRetModal(true)} icon={<RotateCcw size={13} />}>Record Return</GBtn>
        <GBtn sz="md" onClick={() => setModal(true)} icon={<Plus size={14} />}>New Sale Bill</GBtn>
      </div>
    </div>

    {/* KPIs */}
    <div className="kgrid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
      <KCard label="This Month Revenue" value={fmtCur(thisMonth.revenue)} sub={`${thisMonth.orders} orders`} icon={TrendingUp} color={T.green} delta={revDelta} />
      <KCard label="This Month Returns" value={fmtCur(thisMonth.retAmt)} sub="Refunds & returns" icon={RotateCcw} color={T.red} />
      <KCard label="Net Revenue (Month)" value={fmtCur(thisMonth.net)} sub="Gross – Returns" icon={DollarSign} color={T.accent} />
      <KCard label="Gross Profit (Month)" value={fmtCur(thisMonth.profit)} sub={thisMonth.net > 0 ? `${((thisMonth.profit / thisMonth.net) * 100).toFixed(1)}% margin` : ""} icon={Star} color={T.purple} />
    </div>

    {/* Monthly totals — accordion */}
    <div className="glass" style={{ borderRadius: T.radius, overflow: "hidden" }}>
      <button onClick={() => setShowMonthly(p => !p)} style={{ width: "100%", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", cursor: "pointer", color: T.text }}>
        <span style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15 }}>Monthly Totals (12 months)</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: T.textMuted }}>{totalRev > 0 ? fmtCur(totalRev) + " total" : "No sales yet"}</span>
          {showMonthly ? <ChevronDown size={16} color={T.textMuted} /> : <ChevronRight size={16} color={T.textMuted} />}
        </div>
      </button>
      {showMonthly && (
        <div style={{ borderTop: `1px solid ${T.borderSubtle}` }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr>{["Month", "Orders", "Revenue", "Returns", "Net Revenue", "Net COGS", "Gross Profit", "Margin"].map(h => <th key={h} className="th" style={{ textAlign: h === "Month" || h === "Orders" ? "left" : "right" }}>{h.toUpperCase()}</th>)}</tr></thead>
              <tbody>
                {[...monthly].reverse().map((m, i) => (
                  <tr key={m.key} className="trow" style={{ fontWeight: i === 0 ? 700 : 400 }}>
                    <td className="td" style={{ color: i === 0 ? T.accent : T.text, fontWeight: 600 }}>{m.label}</td>
                    <td className="td">{m.orders}</td>
                    <td className="td r" style={{ color: T.green }}>{fmtCur(m.revenue)}</td>
                    <td className="td r" style={{ color: m.retAmt > 0 ? T.red : T.textMuted }}>{fmtCur(m.retAmt)}</td>
                    <td className="td r" style={{ fontWeight: 600 }}>{fmtCur(m.net)}</td>
                    <td className="td r m">{fmtCur(m.cogs)}</td>
                    <td className="td r" style={{ color: m.profit >= 0 ? T.accent : T.red, fontWeight: 600 }}>{fmtCur(m.profit)}</td>
                    <td className="td r" style={{ color: T.purple }}>{m.net > 0 ? ((m.profit / m.net) * 100).toFixed(1) + "%" : "—"}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: `2px solid ${T.accent}30` }}>
                  <td className="td" style={{ fontWeight: 700 }}>TOTAL (12M)</td>
                  <td className="td" style={{ fontWeight: 700 }}>{monthly.reduce((s, m) => s + m.orders, 0)}</td>
                  <td className="td r" style={{ fontWeight: 700, color: T.green }}>{fmtCur(totalRev)}</td>
                  <td className="td r" style={{ fontWeight: 700, color: T.red }}>{fmtCur(totalRet)}</td>
                  <td className="td r" style={{ fontWeight: 700 }}>{fmtCur(totalNet)}</td>
                  <td className="td r" style={{ fontWeight: 700 }}>{fmtCur(monthly.reduce((s, m) => s + m.cogs, 0))}</td>
                  <td className="td r" style={{ fontWeight: 700, color: T.accent }}>{fmtCur(monthly.reduce((s, m) => s + m.profit, 0))}</td>
                  <td className="td r" style={{ fontWeight: 700, color: T.purple }}>{totalNet > 0 ? ((monthly.reduce((s, m) => s + m.profit, 0) / totalNet) * 100).toFixed(1) + "%" : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>

    {/* Bills table */}
    <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
      <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Sales Bills</div>
      <div className="filter-wrap" style={{ marginBottom: 12 }}>
        <div style={{ position: "relative", flex: "1 1 160px" }}><Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} /><input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bill no, product…" style={{ paddingLeft: 30 }} /></div>
        <input type="date" className="inp" value={df} onChange={e => setDf(e.target.value)} style={{ flex: "0 1 120px" }} />
        <span style={{ fontSize: 12, color: T.textMuted }}>→</span>
        <input type="date" className="inp" value={dt} onChange={e => setDt(e.target.value)} style={{ flex: "0 1 120px" }} />
        <GS value={chF} onChange={e => setChF(e.target.value)} placeholder="All Channels">{channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</GS>
        {(df || dt || chF || search) && <GBtn v="ghost" sz="sm" onClick={() => { setDf(""); setDt(""); setChF(""); setSearch(""); }} icon={<X size={12} />}>Clear</GBtn>}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>{["Bill No", "Date", "Channel", "Items", "Subtotal", "Discount", "Total", "", ""].map((h, i) => <th key={i} className="th" style={{ textAlign: ["Subtotal", "Discount", "Total"].includes(h) ? "right" : "left", width: h === "" ? 36 : "auto" }}>{h.toUpperCase()}</th>)}</tr></thead>
          <tbody>
            {saleBills.slice((pg - 1) * ps, pg * ps).map(b => {
              const ch = channels.find(c => c.id === b.channelId);
              return <React.Fragment key={b.id}>
                <tr className="trow">
                  <td className="td" style={{ fontWeight: 600, color: T.accent }}>{b.billNo}</td>
                  <td className="td m">{fmtDate(b.date)}</td>
                  <td className="td"><ChannelTag ch={ch} /></td>
                  <td className="td m">{(b.items || []).length} item{(b.items || []).length !== 1 ? "s" : ""}</td>
                  <td className="td r">{fmtCur(b.subtotal)}</td>
                  <td className="td r" style={{ color: (b.discAmount || 0) > 0 ? T.red : T.textMuted }}>{(b.discAmount || 0) > 0 ? `–${fmtCur(b.discAmount)}` : "—"}</td>
                  <td className="td r" style={{ fontWeight: 700 }}>{fmtCur(b.total)}</td>
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
                        const gstAmt = it.gstAmount || (it.gstRate ? Number(it.qty) * Number(it.price) * Number(it.gstRate) / (100 + Number(it.gstRate)) : 0);
                        return <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.text }}>
                          <span>{it.productName} × {it.qty}{it.gstRate > 0 ? <span style={{ color: T.textMuted, fontSize: 10, marginLeft: 6 }}>GST@{it.gstRate}%: {fmtCur(gstAmt)}</span> : ""}{it.isDamaged ? <span style={{ color: T.red, fontWeight: 600, fontSize: 10, marginLeft: 6 }}>DAMAGED</span> : ""}</span>
                          <span style={{ fontWeight: 600 }}>{fmtCur(Number(it.qty) * Number(it.price))}</span>
                        </div>;
                      })}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 240, marginLeft: "auto", borderTop: `1px solid ${T.borderSubtle}`, paddingTop: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textSub }}><span>Subtotal</span><span>{fmtCur(b.subtotal)}</span></div>
                      {(b.saleGstInfo || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textMuted }}><span>GST incl.</span><span>{fmtCur(b.saleGstInfo)}</span></div>}
                      {(b.discAmount || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.red }}><span>Discount</span><span>–{fmtCur(b.discAmount)}</span></div>}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: T.accent }}><span>Total</span><span>{fmtCur(b.total)}</span></div>
                    </div>
                    {b.notes && <div style={{ fontSize: 11, color: T.textSub, marginTop: 8, fontStyle: "italic" }}>Note: {b.notes}</div>}
                  </td>
                </tr>}
              </React.Fragment>;
            })}
          </tbody>
        </table>
        {saleBills.length === 0 && <div style={{ padding: "40px 0", textAlign: "center", color: T.textMuted }}>No sales bills found</div>}
      </div>
      <Pager total={saleBills.length} page={pg} ps={ps} setPage={setPg} setPs={setPs} />
    </div>

    {/* New sale modal */}
    <Modal open={modal} onClose={() => setModal(false)} title={`New Sale Bill${isManager ? " (Requires Approval)" : ""}`} width={680}
      footer={isManager
        ? <><GBtn v="ghost" onClick={() => setModal(false)}>Cancel</GBtn><GBtn v="green" type="submit" form="sale-form" icon={<Send size={13} />}>Submit for Approval</GBtn></>
        : <><GBtn v="ghost" onClick={() => setModal(false)}>Cancel</GBtn><GBtn type="submit" form="sale-form">Save Sale Bill</GBtn></>}>
      <BillForm type="sale" bills={bills} onSave={handleSaveBill} products={products} vendors={vendors} channels={channels} getStock={getStock} />
    </Modal>

    {/* Edit sale modal */}
    <Modal open={Boolean(editBill)} onClose={() => setEditBill(null)} title={`Edit Bill: ${editBill?.billNo}`} width={680}
      footer={<><GBtn v="ghost" onClick={() => setEditBill(null)}>Cancel</GBtn><GBtn type="submit" form="sale-form" icon={<Edit2 size={13} />}>Save Changes</GBtn></>}>
      {editBill && <BillForm type="sale" bills={bills} onSave={handleEditBill} products={products} vendors={vendors} channels={channels} getStock={getStock} existingBill={editBill} />}
    </Modal>

    {/* Return modal */}
    <Modal open={retModal} onClose={() => setRetModal(false)} title="Record Sale Return" width={420}
      footer={<><GBtn v="ghost" onClick={() => setRetModal(false)}>Cancel</GBtn><GBtn v="danger" onClick={handleReturn} icon={<RotateCcw size={13} />}>Record Return</GBtn></>}>
      <div className="fgrid">
        <Field label="Product" req cl="s2"><GS value={retForm.productId} onChange={e => setRetForm(p => ({ ...p, productId: e.target.value }))} placeholder="Select product">{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</GS></Field>
        <Field label="Return Qty" req><GIn type="number" min="1" value={retForm.qty} onChange={e => setRetForm(p => ({ ...p, qty: e.target.value }))} /></Field>
        <Field label="Channel"><GS value={retForm.channelId} onChange={e => setRetForm(p => ({ ...p, channelId: e.target.value }))} placeholder="Select channel">{channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</GS></Field>
        <Field label="Date" cl="s2"><GIn type="date" value={retForm.date} onChange={e => setRetForm(p => ({ ...p, date: e.target.value }))} /></Field>
        <Field label="Notes" cl="s2"><GTa value={retForm.notes} onChange={e => setRetForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Reason for return..." /></Field>
        <div className="s2" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: T.redBg, borderRadius: 10 }}>
          <input type="checkbox" id="damret" checked={retForm.isDamaged} onChange={e => setRetForm(p => ({ ...p, isDamaged: e.target.checked }))} style={{ width: 16, height: 16, accentColor: T.red }} />
          <label htmlFor="damret" style={{ fontSize: 13, fontWeight: 600, color: T.red, cursor: "pointer" }}>Mark as Damaged (Excluded from Stock)</label>
        </div>
      </div>
    </Modal>
  </div>;
}
