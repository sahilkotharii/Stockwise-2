import React, { useState, useMemo, useEffect } from "react";
import { Plus, X, Eye, Trash2, Edit2, ShoppingCart, FileText, Box, Package, Download } from "lucide-react";
import { useT } from "../theme";
import { KCard, GBtn, GS, Modal, Pager } from "../components/UI";
import BillForm from "../components/BillForm";
import { uid, fmtCur, fmtDate, inRange, today } from "../utils";

const PRESETS = [
  { k: "1d", l: "Today" }, { k: "7d", l: "7d" }, { k: "30d", l: "30d" },
  { k: "90d", l: "90d" }, { k: "6m", l: "6M" }, { k: "1y", l: "1Y" }
];

function getPresetDate(preset) {
  const now = new Date();
  switch (preset) {
    case "1d": return today();
    case "7d": return new Date(now - 7 * 864e5).toISOString().split("T")[0];
    case "30d": return new Date(now - 30 * 864e5).toISOString().split("T")[0];
    case "90d": return new Date(now - 90 * 864e5).toISOString().split("T")[0];
    case "6m": { const d = new Date(now); d.setMonth(d.getMonth() - 6); return d.toISOString().split("T")[0]; }
    case "1y": { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split("T")[0]; }
    default: return null;
  }
}

export default function Purchase({ ctx }) {
  const T = useT();
  const { bills, saveBills, transactions, saveTransactions, products, vendors, getStock, user, addLog, addChangeReq, invoiceSettings } = ctx;
  const isAdmin = user.role === "admin";
  const isManager = user.role === "manager";

  const [modal, setModal] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [preset, setPreset] = useState("30d");
  const [df, setDf] = useState(getPresetDate("30d"));
  const [dt, setDt] = useState(today());
  const [vF, setVF] = useState("");
  const [pg, setPg] = useState(1); const [ps, setPs] = useState(20);
  const [search, setSearch] = useState("");
  const [exp, setExp] = useState({});
  const [selBills, setSelBills] = useState(new Set());
  const tgBill = id => setSelBills(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  useEffect(() => setPg(1), [df, dt, vF, search, ps]);

  const handlePreset = (k) => { setPreset(k); setDf(getPresetDate(k)); setDt(today()); };

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
      vendorId: bill.vendorId, channelId: null, date: bill.date,
      notes: `Bill: ${bill.billNo}${bill.notes ? ` · ${bill.notes}` : ""}`,
      userId: user.id, userName: user.name, billId: bill.id, isDamaged: item.isDamaged
    }));
    saveBills([bill, ...bills]);
    saveTransactions([...newTxns, ...transactions]);
    addLog("created", "purchase bill", bill.billNo, `${bill.items.length} items · ${fmtCur(bill.total)}`);
    setModal(false);
  };

  const handleEditBill = updatedBill => {
    const filteredTxns = transactions.filter(t => t.billId !== updatedBill.id);
    const newTxns = updatedBill.items.map(item => ({
      id: uid(), productId: item.productId, type: item.isDamaged ? "damaged" : "purchase",
      qty: item.qty, price: item.price, effectivePrice: item.price,
      gstRate: item.gstRate || 0, gstAmount: item.gstAmount || 0,
      vendorId: updatedBill.vendorId, channelId: null, date: updatedBill.date,
      notes: `Bill: ${updatedBill.billNo} (edited)`,
      userId: user.id, userName: user.name, billId: updatedBill.id, isDamaged: item.isDamaged
    }));
    saveBills(bills.map(b => b.id === updatedBill.id ? updatedBill : b));
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
    if (!window.confirm(`Delete bill ${b.billNo}?`)) return;
    saveBills(bills.filter(x => x.id !== b.id));
    saveTransactions(transactions.filter(t => t.billId !== b.id));
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {/* Actions + Time filter */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.05em" }}>PERIOD</span>
        {PRESETS.map(p => (
          <button key={p.k} onClick={() => handlePreset(p.k)} style={{ padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: preset === p.k ? T.blue : "transparent", color: preset === p.k ? "#fff" : T.textSub, transition: "all .15s" }}>{p.l}</button>
        ))}
        <input type="date" className="inp" value={df} onChange={e => { setDf(e.target.value); setPreset(""); }} style={{ width: 120, fontSize: 12 }} />
        <span style={{ fontSize: 12, color: T.textMuted }}>→</span>
        <input type="date" className="inp" value={dt} onChange={e => { setDt(e.target.value); setPreset(""); }} style={{ width: 120, fontSize: 12 }} />
      </div>
      <GBtn sz="md" onClick={() => setModal(true)} icon={<Plus size={14} />}>New Purchase Bill</GBtn>
    </div>

    {/* KPI Cards — 4 cards */}
    <div className="kgrid" style={{ gap: 12 }}>
      <div className="kcard glass">
        <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: `${T.blue}12` }} />
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${T.blue}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><ShoppingCart size={17} color={T.blue} /></div>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 20, color: T.text }}>{fmtCur(totalPurchaseInclGst)}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginTop: 2 }}>Total Purchase</div>
        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>incl. GST · amount paid</div>
      </div>
      <div className="kcard glass">
        <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: `${T.accent}12` }} />
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${T.accent}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Box size={17} color={T.accent} /></div>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 20, color: T.text }}>{fmtCur(totalPurchaseExclGst)}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginTop: 2 }}>Purchase Cost</div>
        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>excl. GST · inventory cost basis</div>
      </div>
      <div className="kcard glass">
        <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: `${T.purple}12` }} />
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${T.purple}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><FileText size={17} color={T.purple} /></div>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 20, color: T.text }}>{totalOrders}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginTop: 2 }}>Orders</div>
        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>purchase bills in period</div>
      </div>
      <div className="kcard glass">
        <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: `${T.cyan}12` }} />
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${T.cyan}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Package size={17} color={T.cyan} /></div>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 20, color: T.text }}>{totalUnits}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginTop: 2 }}>Units Purchased</div>
        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>total qty in period</div>
      </div>
    </div>

    {/* Bills table */}
    <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
      <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Purchase Bills</div>
      <div className="filter-wrap" style={{ marginBottom: 12 }}>
        <div style={{ position: "relative", flex: "1 1 160px" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textMuted, fontSize: 12 }}>🔍</span>
          <input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bill, product…" style={{ paddingLeft: 28 }} />
        </div>
        <GS value={vF} onChange={e => setVF(e.target.value)} placeholder="All Vendors">{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</GS>
        {(vF || search) && <GBtn v="ghost" sz="sm" onClick={() => { setVF(""); setSearch(""); }} icon={<X size={12} />}>Clear</GBtn>}
      </div>
      {selBills.size > 0 && (
        <div style={{ marginBottom: 10, padding: "8px 14px", borderRadius: 10, background: T.blueBg, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.blue }}>{selBills.size} selected</span>
          <GBtn v="danger" sz="sm" onClick={() => { if(isManager){if(window.confirm(`Request admin to delete ${selBills.size} bills?`)){purBills.filter(b=>selBills.has(b.id)).forEach(b=>addChangeReq({entity:'purchase',action:'delete',entityId:b.id,entityName:b.billNo,currentData:b,proposedData:null}));setSelBills(new Set());}}else if(window.confirm(`Delete ${selBills.size} bills?`)){const toDelIds=new Set(selBills);saveBills(bills.filter(x=>!toDelIds.has(x.id)));saveTransactions(transactions.filter(t=>!toDelIds.has(t.billId)));setSelBills(new Set());}}} icon={<Trash2 size={13} />}>{isManager?"Request Delete":"Delete Selected"}</GBtn>
          <button onClick={()=>setSelBills(new Set())} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",fontSize:11,color:T.textMuted}}>Clear</button>
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>
            <th className="th" style={{ width: 36 }}>
              <input type="checkbox" className="cb" checked={purBills.slice((pg-1)*ps,pg*ps).length>0&&purBills.slice((pg-1)*ps,pg*ps).every(b=>selBills.has(b.id))} onChange={e=>{ const paged=purBills.slice((pg-1)*ps,pg*ps); if(e.target.checked){setSelBills(s=>{const n=new Set(s);paged.forEach(b=>n.add(b.id));return n;});}else{setSelBills(s=>{const n=new Set(s);paged.forEach(b=>n.delete(b.id));return n;});}}} />
            </th>
            {["Bill No", "Date", "Vendor", "Items", "Ex-GST", "GST", "Total Paid", "", ""].map((h, i) => (
            <th key={i} className="th" style={{ textAlign: ["Ex-GST", "GST", "Total Paid"].includes(h) ? "right" : "left", width: h === "" ? 36 : "auto" }}>{h.toUpperCase()}</th>
          ))}</tr></thead>
          <tbody>
            {purBills.slice((pg - 1) * ps, pg * ps).map(b => {
              const v = vendors.find(x => x.id === b.vendorId);
              return <React.Fragment key={b.id}>
                <tr className={`trow${selBills.has(b.id)?" sel":""}`} onClick={()=>tgBill(b.id)} style={{cursor:"pointer"}}>
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
                {exp[b.id] && <tr style={{ background: T.isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)" }}>
                  <td colSpan={10} style={{ padding: "12px 20px", borderBottom: `1px solid ${T.borderSubtle}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>BILL ITEMS</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                      {(b.items || []).map((it, idx) => {
                        const lineBase = Number(it.qty) * Number(it.price);
                        const gstAmt = it.gstAmount || (it.gstRate ? lineBase * Number(it.gstRate) / 100 : 0);
                        return <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.text }}>
                          <span>
                            {it.productName} × {it.qty} @ ₹{Number(it.price).toLocaleString("en-IN")} ex-GST
                            {it.gstRate > 0 && <span style={{ color: T.amber, fontSize: 10, marginLeft: 8 }}>+GST @{it.gstRate}%: {fmtCur(gstAmt)}</span>}
                            {it.isDamaged && <span style={{ color: T.red, fontWeight: 600, fontSize: 10, marginLeft: 8 }}>REJECTED</span>}
                          </span>
                          <span style={{ fontWeight: 600 }}>{fmtCur(lineBase + gstAmt)}</span>
                        </div>;
                      })}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 260, marginLeft: "auto", borderTop: `1px solid ${T.borderSubtle}`, paddingTop: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textSub }}><span>Subtotal (ex-GST)</span><span>{fmtCur(b.subtotal)}</span></div>
                      {(b.totalGst || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.amber }}><span>GST</span><span>+{fmtCur(b.totalGst)}</span></div>}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: T.blue }}><span>Total Paid</span><span>{fmtCur(b.total)}</span></div>
                    </div>
                    {b.notes && <div style={{ fontSize: 11, color: T.textSub, marginTop: 8, fontStyle: "italic" }}>Note: {b.notes}</div>}
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
  </div>;
}
