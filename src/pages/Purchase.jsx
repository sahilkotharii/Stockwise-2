import React, { useState, useMemo, useEffect } from "react";
import { Plus, X, Eye, Trash2, Edit2, ShoppingCart, Box, Package } from "lucide-react";
import { useT } from "../theme";
import { KCard, GBtn, DeleteConfirmModal, GS, Modal, Pager, PeriodBar, SearchInput } from "../components/UI";
import BillForm from "../components/BillForm";
import { uid, fmtCur, fmtDate, inRange, today } from "../utils";

export default function Purchase({ ctx }) {
  const T = useT();
  const { bills, saveBills, transactions, saveTransactions, products, vendors, getStock, user, addLog, addChangeReq, invoiceSettings } = ctx;
  const isAdmin = user.role === "admin";
  const isManager = user.role === "manager";

  const [modal, setModal] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [preset, setPreset] = useState("30d");
  const [df, setDf] = useState(new Date(Date.now()-30*864e5).toISOString().split("T")[0]);
  const [dt, setDt] = useState(today());
  const [vF, setVF] = useState("");
  const [pg, setPg] = useState(1); const [ps, setPs] = useState(20);
  const [search, setSearch] = useState("");
  const [exp, setExp] = useState({});
  const [delConfirm, setDelConfirm] = useState(null);
  const [delBulkConfirm, setDelBulkConfirm] = useState(false);
  const [selBills, setSelBills] = useState(new Set());
  const tgBill = id => setSelBills(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  useEffect(() => setPg(1), [df, dt, vF, search, ps]);

  // ── Period bills ────────────────────────────────────────────────────────
  const periodPurBills = useMemo(() => bills.filter(b =>
    b.type === "purchase" && inRange(b.date, df, dt) &&
    (vF ? b.vendorId === vF : true)
  ), [bills, df, dt, vF]);

  // ── KPI from bills ──────────────────────────────────────────────────────
  // Purchase bill total = subtotal (ex-GST) + totalGst = amount actually paid
  // bill.subtotal = ex-GST total
  // bill.totalGst = GST paid
  // bill.total = bill.subtotal + bill.totalGst = total paid
  const totalPurchaseInclGst = periodPurBills.reduce((s, b) => s + Number(b.total || 0), 0);
  const totalPurchaseExclGst = periodPurBills.reduce((s, b) => s + Number(b.subtotal || 0), 0);
  const totalOrders = periodPurBills.length;
  const totalUnits = periodPurBills.reduce((s, b) => s + (b.items || []).reduce((si, i) => si + Number(i.qty || 0), 0), 0);

  // ── Filtered bills for table ────────────────────────────────────────────
  const purBills = useMemo(() => periodPurBills.filter(b => {
    if (search) {
      const q = search.toLowerCase();
      return b.billNo.toLowerCase().includes(q) || (b.items || []).some(i => i.productName?.toLowerCase().includes(q));
    }
    return true;
  }).sort((a, b2) => new Date(b2.date) - new Date(a.date)), [periodPurBills, search]);

  const handleSaveBill = bill => {
    if (isManager) {
      addChangeReq({ entity: "purchase", action: "create", entityId: null, entityName: bill.billNo, currentData: null, proposedData: bill });
      setModal(false); return;
    }
    // Purchase transactions store ex-GST price (for COGS calculation)
    const newTxns = bill.items.map(item => ({
      id: uid(), productId: item.productId, type: item.isDamaged ? "damaged" : "purchase",
      qty: item.qty,
      price: item.price,        // ex-GST purchase price (for COGS)
      effectivePrice: item.price,
      gstRate: item.gstRate || 0,
      gstAmount: item.gstAmount || 0,
      vendorId: bill.vendorId, date: bill.date,
      notes: `Bill: ${bill.billNo}${bill.notes ? ` · ${bill.notes}` : ""}`,
      userId: user.id, userName: user.name, billId: bill.id, isDamaged: item.isDamaged,
      paymentMode: bill.paymentMode || ""
    }));
    const billWithUser = { ...bill, userId: user.id, userName: user.name };
    saveBills([billWithUser, ...bills]);
    saveTransactions([...newTxns, ...transactions]);
    addLog("created", "purchase bill", bill.billNo, `${bill.items.length} items · ${fmtCur(bill.total)}`);
    setModal(false);
  };

  const handleEditBill = updatedBill => {
    if (isManager) {
      addChangeReq({ entity: "purchase", action: "update", entityId: updatedBill.id, entityName: updatedBill.billNo, currentData: bills.find(b => b.id === updatedBill.id), proposedData: updatedBill });
      setEditBill(null); return;
    }
    const filteredTxns = transactions.filter(t => t.billId !== updatedBill.id);
    const newTxns = updatedBill.items.map(item => ({
      id: uid(), productId: item.productId, type: item.isDamaged ? "damaged" : "purchase",
      qty: item.qty, price: item.effectivePrice || item.price, effectivePrice: item.effectivePrice || item.price,
      gstRate: item.gstRate || 0, gstAmount: item.gstAmount || 0,
      vendorId: updatedBill.vendorId, date: updatedBill.date,
      notes: `Bill: ${updatedBill.billNo} (edited)`,
      gstType: updatedBill.gstType || "",
      userId: user.id, userName: user.name, billId: updatedBill.id, isDamaged: item.isDamaged,
      paymentMode: updatedBill.paymentMode || ""
    }));
    const updatedWithUser = { ...updatedBill, userId: user.id, userName: user.name };
    saveBills(bills.map(b => b.id === updatedBill.id ? updatedWithUser : b));
    saveTransactions([...newTxns, ...filteredTxns]);
    addLog("edited", "purchase bill", updatedBill.billNo);
    setEditBill(null);
  };

  const deleteBill = b => {
    if (isManager) {
      if (!window.confirm(`Request admin to delete bill ${b.billNo}?`)) return;
      addChangeReq({ entity: "purchase", action: "delete", entityId: b.id, entityName: b.billNo, currentData: b, proposedData: null });
      return;
    }
    setDelConfirm(b);
  };
  const doDeleteBill = b => {
    saveBills(bills.filter(x => x.id !== b.id));
    saveTransactions(transactions.filter(t => t.billId !== b.id));
    addLog("deleted", "purchase bill", b.billNo);
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {/* Actions + Time filter */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <PeriodBar df={df} setDf={setDf} dt={dt} setDt={setDt} preset={preset} setPreset={setPreset} />
      <GBtn sz="md" onClick={() => setModal(true)} icon={<Plus size={14} />}>New Purchase Bill</GBtn>
    </div>

    {/* KPI Cards — 3 cards */}
    <div className="kgrid" style={{ gap: 12 }}>
      <KCard label="Total Purchase" value={fmtCur(totalPurchaseInclGst)} sub="incl. GST · amount paid" icon={ShoppingCart} color={T.blue} />
      <KCard label="Purchase Cost" value={fmtCur(totalPurchaseExclGst)} sub="excl. GST · inventory cost basis" icon={Box} color={T.accent} />
      <KCard label="Units Purchased" value={String(totalUnits)} sub="total qty in period" icon={Package} color={T.cyan} />
    </div>

    {/* Bills table */}
    <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
      <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Purchase Bills</div>
      <div className="filter-wrap" style={{ marginBottom: 12 }}>
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bill, product…" style={{ flex: "1 1 160px" }} />
        <GS value={vF} onChange={e => setVF(e.target.value)} placeholder="All Vendors">{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</GS>
        {(vF || search) && <GBtn v="ghost" sz="sm" onClick={() => { setVF(""); setSearch(""); }} icon={<X size={12} />}>Clear</GBtn>}
      </div>
      {selBills.size > 0 && (
        <div style={{ marginBottom: 10, padding: "8px 14px", borderRadius: T.radius, background: T.blueBg, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.blue }}>{selBills.size} selected</span>
          <GBtn v="danger" sz="sm" onClick={() => { if(isManager){if(window.confirm(`Request admin to delete ${selBills.size} bills?`)){purBills.filter(b=>selBills.has(b.id)).forEach(b=>addChangeReq({entity:'purchase',action:'delete',entityId:b.id,entityName:b.billNo,currentData:b,proposedData:null}));setSelBills(new Set());}}else if(window.confirm(`Delete ${selBills.size} bills?`)){const toDelIds=new Set(selBills);saveBills(bills.filter(x=>!toDelIds.has(x.id)));saveTransactions(transactions.filter(t=>!toDelIds.has(t.billId)));setSelBills(new Set());}}} icon={<Trash2 size={13} />}>{isManager?"Request Delete":"Delete Selected"}</GBtn>
          <button onClick={()=>setSelBills(new Set())} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",fontSize:11,color:T.textMuted}}>Clear</button>
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>
            <th className="th" style={{ width: 36 }}>
              <input type="checkbox" className="cb" checked={purBills.length>0&&purBills.every(b=>selBills.has(b.id))} onChange={e=>{if(e.target.checked){setSelBills(new Set(purBills.map(b=>b.id)));}else{setSelBills(new Set());}}} />
            </th>
            {["Bill No", "Date", "Vendor", "Items", "Ex-GST", "GST", "Total Paid", "", ""].map((h, i) => (
            <th key={i} className="th" style={{ textAlign: ["Ex-GST", "GST", "Total Paid"].includes(h) ? "right" : "left", width: h === "" ? 36 : "auto" }}>{h.toUpperCase()}</th>
          ))}</tr></thead>
          <tbody>
            {purBills.slice((pg - 1) * ps, pg * ps).map(b => {
              const v = vendors.find(x => x.id === b.vendorId);
              return <React.Fragment key={b.id}>
                <tr className={`trow${selBills.has(b.id)?" row-sel":""}`}>
                  <td className="td" onClick={e=>e.stopPropagation()}><input type="checkbox" className="cb" checked={selBills.has(b.id)} onChange={()=>tgBill(b.id)}/></td>
                  <td className="td" style={{ fontWeight: 600, color: T.blue }}>{b.billNo}</td>
                  <td className="td m">{fmtDate(b.date)}</td>
                  <td className="td">{v?.name || "—"}</td>
                  <td className="td m">{(b.items || []).length}×</td>
                  <td className="td r m">{fmtCur(b.subtotal)}</td>
                  <td className="td r" style={{ color: (b.totalGst || 0) > 0 ? T.amber : T.textMuted }}>{(b.totalGst || 0) > 0 ? `+${fmtCur(b.totalGst)}` : "—"}</td>
                  <td className="td r" style={{ fontWeight: 700, color: T.blue }}>{fmtCur(b.total)}</td>
                  <td className="td">
                    <div style={{ display: "flex", gap: 3 }}>
                      <button className="btn-ghost" onClick={() => setExp(p => ({ ...p, [b.id]: !p[b.id] }))} style={{ padding: "3px 6px" }}><Eye size={13} /></button>
                      {isAdmin && <button className="btn-ghost" onClick={() => setEditBill(b)} style={{ padding: "3px 6px" }}><Edit2 size={13} /></button>}
                    </div>
                  </td>
                  <td className="td"><button className="btn-danger" onClick={() => deleteBill(b)} style={{ padding: "3px 6px" }}><Trash2 size={11} /></button></td>
                </tr>
                {exp[b.id] && <tr style={{ background: T.isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.012)" }}>
                  <td colSpan={10} style={{ padding: "0", borderBottom: `1px solid ${T.borderSubtle}` }}>
                    <div style={{ padding: "12px 20px 14px" }}>
                      <div style={{ overflowX: "auto", marginBottom: 10 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                          <thead><tr style={{ background: T.isDark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)" }}>
                            {["#","Description","HSN","Qty","Unit","MRP","Cost (ex-GST)","GST%","GST Amt","Line Total"].map((h,i) => (
                              <th key={i} style={{ padding:"5px 8px", textAlign:["Qty","MRP","Cost (ex-GST)","GST%","GST Amt","Line Total"].includes(h)?"right":"left", fontWeight:700, fontSize:11, color:T.textSub, background: T.isDark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)", letterSpacing:"0.04em", borderBottom:`1px solid ${T.borderSubtle}`, whiteSpace:"nowrap" }}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {(b.items||[]).map((it, idx) => {
                              const rate = Number(it.gstRate||0);
                              const price = Number(it.price||0);
                              const qty = Number(it.qty||0);
                              const gstAmt = it.gstAmount || (rate ? qty * price * rate / 100 : 0);
                              const lineTotal = qty * price + gstAmt;
                              return (
                                <tr key={idx} style={{ borderBottom:`1px solid ${T.borderSubtle}40` }}>
                                  <td style={{ padding:"5px 8px", color:T.textMuted }}>{idx+1}</td>
                                  <td style={{ padding:"5px 8px", fontWeight:600, color:T.text }}>{it.productName||"—"}</td>
                                  <td style={{ padding:"5px 8px", color:T.textSub, fontFamily:"monospace" }}>{it.hsn||"—"}</td>
                                  <td style={{ padding:"5px 8px", textAlign:"right", fontWeight:600, color:T.text }}>{qty}</td>
                                  <td style={{ padding:"5px 8px", color:T.textMuted }}>{it.unit||"pcs"}</td>
                                  <td style={{ padding:"5px 8px", textAlign:"right", color:T.textSub }}>{fmtCur(it.mrp||0)}</td>
                                  <td style={{ padding:"5px 8px", textAlign:"right", color:T.textSub }}>{fmtCur(price)}</td>
                                  <td style={{ padding:"5px 8px", textAlign:"right", color:T.amber }}>{rate > 0 ? rate+"%" : "—"}</td>
                                  <td style={{ padding:"5px 8px", textAlign:"right", color:T.amber }}>{gstAmt > 0 ? fmtCur(gstAmt) : "—"}</td>
                                  <td style={{ padding:"5px 8px", textAlign:"right", fontWeight:700, color:T.text }}>{fmtCur(lineTotal)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ display:"flex", justifyContent:"flex-end" }}>
                        <table style={{ fontSize:12, borderCollapse:"collapse", minWidth:220 }}>
                          <tbody>
                            <tr><td style={{ padding:"3px 8px", color:T.textSub }}>Subtotal (ex-GST)</td><td style={{ padding:"3px 8px", textAlign:"right", fontWeight:600 }}>{fmtCur(b.subtotal)}</td></tr>
                            {(b.totalGst||0) > 0 && <tr><td style={{ padding:"3px 8px", color:T.amber }}>GST</td><td style={{ padding:"3px 8px", textAlign:"right", color:T.amber }}>+{fmtCur(b.totalGst)}</td></tr>}
                            {b.paymentMode && <tr><td style={{ padding:"3px 8px", color:T.textMuted, fontSize:11 }}>Payment</td><td style={{ padding:"3px 8px", textAlign:"right", fontSize:11, color:T.textSub }}>{b.paymentMode}</td></tr>}
                            <tr style={{ borderTop:`2px solid ${T.borderSubtle}` }}><td style={{ padding:"5px 8px", fontWeight:700, color:T.text }}>Total Paid</td><td style={{ padding:"5px 8px", textAlign:"right", fontWeight:800, fontSize:14, color:T.blue }}>{fmtCur(b.total)}</td></tr>
                          </tbody>
                        </table>
                      </div>
                      {b.notes && <div style={{ fontSize:11, color:T.textSub, marginTop:6, fontStyle:"italic" }}>Note: {b.notes}</div>}
                    </div>
                  </td>
                </tr>}
              </React.Fragment>;
            })}
          </tbody>
        </table>
        {purBills.length === 0 && <div style={{ padding: "40px 0", textAlign: "center", color: T.textMuted }}>No purchase bills in selected period</div>}
      </div>
      <Pager total={purBills.length} page={pg} ps={ps} setPage={setPg} setPs={setPs} />
    </div>

    <Modal open={modal} onClose={() => setModal(false)} title="New Purchase Bill" width={720}
      footer={<><GBtn v="ghost" onClick={() => setModal(false)}>Cancel</GBtn><GBtn type="submit" form="purchase-form">Save Purchase Bill</GBtn></>}>
      <BillForm type="purchase" bills={bills} onSave={handleSaveBill} products={products} vendors={vendors} getStock={getStock} invoiceSettings={invoiceSettings} />
    </Modal>

    <Modal open={Boolean(editBill)} onClose={() => setEditBill(null)} title={`Edit: ${editBill?.billNo}`} width={720}
      footer={<><GBtn v="ghost" onClick={() => setEditBill(null)}>Cancel</GBtn><GBtn type="submit" form="purchase-form" icon={<Edit2 size={13} />}>Save Changes</GBtn></>}>
      {editBill && <BillForm type="purchase" bills={bills} onSave={handleEditBill} products={products} vendors={vendors} getStock={getStock} existingBill={editBill} invoiceSettings={invoiceSettings} />}
    </Modal>




    <DeleteConfirmModal
      open={!!delBulkConfirm}
      onClose={()=>setDelBulkConfirm(false)}
      onConfirm={()=>{const ids=new Set(selBills);saveBills(bills.filter(x=>!ids.has(x.id)));saveTransactions(transactions.filter(t=>!ids.has(t.billId)));setSelBills(new Set());}}
      user={user}
      label={selBills.size + " bills"}
      extra="All transactions will also be deleted."
    />
    <DeleteConfirmModal
      open={!!delConfirm}
      onClose={()=>setDelConfirm(null)}
      onConfirm={()=>doDeleteBill(delConfirm)}
      user={user}
      label={`bill ${delConfirm?.billNo}`}
      extra="All transactions for this bill will also be deleted."
    />
  </div>;
}
