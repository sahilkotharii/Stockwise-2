import React, { useState, useMemo, useEffect } from "react";
import { Plus, X, Eye, Trash2, Send, Edit2, TrendingUp, DollarSign, FileText, Package, Printer, Download } from "lucide-react";
import { useT } from "../theme";
import { KCard, GBtn, DeleteConfirmModal, GIn, GS, Field, Modal, Pager, PeriodBar, SearchInput } from "../components/UI";
import BillForm from "../components/BillForm";
import InvoiceModal, { buildHTML } from "../components/InvoiceModal";
import { uid, today, fmtCur, fmtDate, inRange, calcBillGst, safeDate } from "../utils";

const PRESETS = [
  { k: "1d", l: "Today" }, { k: "7d", l: "7d" }, { k: "30d", l: "30d" },
  { k: "90d", l: "90d" }, { k: "6m", l: "6M" }, { k: "1y", l: "1Y" }
];
function getPresetDate(k) {
  const n = new Date();
  if (k === "1d") return today();
  if (k === "7d") return new Date(n - 7*864e5).toISOString().split("T")[0];
  if (k === "30d") return new Date(n - 30*864e5).toISOString().split("T")[0];
  if (k === "90d") return new Date(n - 90*864e5).toISOString().split("T")[0];
  if (k === "6m") { const d = new Date(n); d.setMonth(d.getMonth()-6); return d.toISOString().split("T")[0]; }
  if (k === "1y") { const d = new Date(n); d.setFullYear(d.getFullYear()-1); return d.toISOString().split("T")[0]; }
  return null;
}

export default function Sales({ ctx }) {
  const T = useT();
  const { bills, saveBills, transactions, saveTransactions, products, vendors, getStock, user, addLog, addChangeReq, invoiceSettings } = ctx;
  const isManager = user.role === "manager";
  const isAdmin = user.role === "admin";

  const [modal, setModal] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [invoiceBill, setInvoiceBill] = useState(null);
  const [selBills, setSelBills] = useState(new Set());
  const tgBill = id => setSelBills(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [preset, setPreset] = useState("30d");
  const [df, setDf] = useState(getPresetDate("30d"));
  const [dt, setDt] = useState(today());
  const [vendorF, setVendorF] = useState("");
  const [pg, setPg] = useState(1); const [ps, setPs] = useState(20);
  const [search, setSearch] = useState("");
  const [exp, setExp] = useState({});
  const [delConfirm, setDelConfirm] = useState(null);
  const [delBulkConfirm, setDelBulkConfirm] = useState(false);
  useEffect(() => setPg(1), [df, dt, vendorF, search, ps]);

  const handlePreset = k => { setPreset(k); setDf(getPresetDate(k)); setDt(today()); };

  const periodSaleBills = useMemo(() => bills.filter(b =>
    b.type === "sale" && inRange(b.date, df, dt) && (vendorF ? b.vendorId === vendorF : true)
  ), [bills, df, dt, vendorF]);

  const totalRevenueInclGst = periodSaleBills.reduce((s, b) => s + Number(b.total || 0), 0);
  const totalGstCollected = periodSaleBills.reduce((s, b) => s + calcBillGst(b), 0);
  const netRevenueExclGst = totalRevenueInclGst - totalGstCollected;
  const unitsSold = periodSaleBills.reduce((s, b) => s + (b.items || []).reduce((si, i) => si + Number(i.qty || 0), 0), 0);

  const retTxns = useMemo(() => transactions.filter(t => t.type === "return" && inRange(t.date, df, dt)), [transactions, df, dt]);
  const returnRevenue = retTxns.reduce((s, t) => s + Number(t.qty) * Number(t.price || 0), 0);
  const returnGst = retTxns.reduce((s, t) => {
    const rate = Number(t.gstRate || products.find(p => p.id === t.productId)?.gstRate || 0);
    return s + Number(t.qty) * Number(t.price || 0) * rate / (100 + rate);
  }, 0);
  const finalRevenue = totalRevenueInclGst - returnRevenue;
  const finalNetExclGst = netRevenueExclGst - (returnRevenue - returnGst);

  const saleBills = useMemo(() => periodSaleBills.filter(b => {
    if (search) {
      const q = search.toLowerCase();
      return (b.items || []).some(i => i.productName?.toLowerCase().includes(q)) || b.billNo?.toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b2) => (b2.date || "").localeCompare(a.date || "")), [periodSaleBills, search]);

  const pp = pid => Number(products.find(pr => pr.id === pid)?.purchasePrice || 0);

  // ── Bulk invoice download — same layout as single invoice PDF ────────────
  const downloadBulkInvoices = () => {
    const selected = saleBills.filter(b => selBills.has(b.id));
    if (selected.length === 0) return;

    // buildHTML returns full HTML doc — extract just the .page div content
    const pages = selected.map((b, idx) => {
      const vendor = (vendors||[]).find(v => v.id === b.vendorId) || null;
      const html = buildHTML(b, invoiceSettings || {}, vendor);
      // Extract the content inside <div class="page">
      const pageMatch = html.match(/<div class="page">([\s\S]*?)<\/div>\s*<\/body>/i);
      const content = pageMatch ? pageMatch[1] : html.replace(/<html>[\s\S]*?<body>/, "").replace(/<\/body>[\s\S]*/, "");
      const isLast = idx === selected.length - 1;
      return `<div class="page">${content}</div>${isLast ? "" : '<div style="page-break-after:always"></div>'}`;
    });

    // Get the stylesheet from a single buildHTML call (shared across all pages)
    const sampleHtml = buildHTML(selected[0], invoiceSettings || {}, (vendors||[]).find(v => v.id === selected[0].vendorId) || null);
    const styleMatch = sampleHtml.match(/<style>([\s\S]*?)<\/style>/i);
    const sharedStyle = styleMatch ? styleMatch[1] : "";

    const combined = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Invoices (${selected.length})</title>
<style>
${sharedStyle}
/* Multi-invoice overrides */
@page { size: A4; margin: 12mm; }
.page { width: 794px; min-height: 1050px; margin: 0 auto; padding: 24px; display: flex; flex-direction: column; page-break-inside: avoid; }
@media print {
  .no-print { display: none !important; }
  .page { page-break-inside: auto; break-inside: auto; }
}
</style>
</head><body>${pages.join("\n")}</body></html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (win) {
      win.document.write(combined);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 800);
    }
    setSelBills(new Set());
  };

  const handleSaveBill = bill => {
    if (isManager) { addChangeReq({ entity: "sale", action: "create", entityId: null, entityName: bill.billNo, currentData: null, proposedData: bill }); setModal(false); return; }
    const newTxns = bill.items.map(item => ({
      id: uid(), productId: item.productId, type: item.isDamaged ? "damaged" : "sale",
      qty: item.qty, price: item.effectivePrice || item.price,
      effectivePrice: item.effectivePrice || item.price,
      gstRate: item.gstRate || 0, gstAmount: item.gstAmount || 0,
      vendorId: bill.vendorId, date: bill.date,
      notes: `Bill: ${bill.billNo}${bill.notes ? ` · ${bill.notes}` : ""}`,
      userId: user.id, userName: user.name, billId: bill.id, isDamaged: item.isDamaged,
      paymentMode: bill.paymentMode || ""
    }));
    const billWithUser = { ...bill, userId: user.id, userName: user.name };
    saveBills([billWithUser, ...bills]);
    saveTransactions([...newTxns, ...transactions]);
    addLog("created", "sale bill", bill.billNo, `${bill.items.length} items · ${fmtCur(bill.total)}`);
    setModal(false);
  };

  const handleEditBill = updatedBill => {
    const filteredTxns = transactions.filter(t => t.billId !== updatedBill.id);
    const newTxns = updatedBill.items.map(item => ({
      id: uid(), productId: item.productId, type: item.isDamaged ? "damaged" : "sale",
      qty: item.qty, price: item.effectivePrice || item.price,
      effectivePrice: item.effectivePrice || item.price,
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
    addLog("edited", "sale bill", updatedBill.billNo);
    setEditBill(null);
  };

  const deleteBill = b => {
    if (isManager) {
      if (!window.confirm(`Request admin to delete bill ${b.billNo}?`)) return;
      addChangeReq({ entity: "sale", action: "delete", entityId: b.id, entityName: b.billNo, currentData: b, proposedData: null });
      return;
    }
    setDelConfirm(b);
  };
  const doDeleteBill = b => {
    saveBills(bills.filter(x => x.id !== b.id));
    saveTransactions(transactions.filter(t => t.billId !== b.id));
    addLog("deleted", "sale bill", b.billNo);
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {isManager && <div style={{ padding: "10px 14px", borderRadius: T.radius, background: T.amberBg, border: `1px solid ${T.amber}30`, fontSize: 12, color: T.amber, fontWeight: 600 }}> Manager mode — new sales require admin approval</div>}

    {/* Filter + Actions */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <PeriodBar df={df} setDf={setDf} dt={dt} setDt={setDt} preset={preset} setPreset={setPreset} />
      <GBtn sz="md" onClick={() => setModal(true)} icon={<Plus size={14} />}>New Sale Bill</GBtn>
    </div>

    {/* KPI Cards — 3 cards */}
    <div className="kgrid" style={{ gap: 12 }}>
      {[
        { label: "Total Sales", value: totalRevenueInclGst, sub: "incl. GST · all bills", icon: TrendingUp, color: T.green },
        { label: "Net Sales", value: netRevenueExclGst, sub: "excl. GST · all bills", icon: DollarSign, color: T.accent },
        { label: "Units Sold", value: unitsSold, sub: "total qty across bills", icon: Package, color: T.purple, noFmt: true },
      ].map((k, i) => (
        <KCard key={i} label={k.label} value={k.noFmt ? String(k.value) : fmtCur(k.value)} sub={k.sub} icon={k.icon} color={k.color} />
      ))}
    </div>

    {/* Bills table */}
    <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
      <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Sales Bills</div>
      <div className="filter-wrap" style={{ marginBottom: 12 }}>
        <div style={{ position: "relative", flex: "1 1 160px" }}>
          
          <input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bill no, product…" style={{ paddingLeft: 28 }} />
        </div>
        <GS value={vendorF} onChange={e => setVendorF(e.target.value)} placeholder="All Vendors">{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</GS>
        {(vendorF || search) && <GBtn v="ghost" sz="sm" onClick={() => { setVendorF(""); setSearch(""); }} icon={<X size={12} />}>Clear</GBtn>}
      </div>
      {selBills.size > 0 && (
        <div style={{ marginBottom: 10, padding: "8px 14px", borderRadius: T.radius, background: T.accentBg, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.accent }}>{selBills.size} selected</span>
          <GBtn sz="sm" onClick={downloadBulkInvoices} icon={<Download size={13} />}>Download {selBills.size} Invoice{selBills.size!==1?"s":""}</GBtn>
          <GBtn v="danger" sz="sm" onClick={() => { if(isManager){if(window.confirm(`Request admin to delete ${selBills.size} bills?`)){saleBills.filter(b=>selBills.has(b.id)).forEach(b=>addChangeReq({entity:'sale',action:'delete',entityId:b.id,entityName:b.billNo,currentData:b,proposedData:null}));setSelBills(new Set());}}else if(window.confirm(`Delete ${selBills.size} bills?`)){const toDelIds=new Set(selBills);saveBills(bills.filter(x=>!toDelIds.has(x.id)));saveTransactions(transactions.filter(t=>!toDelIds.has(t.billId)));setSelBills(new Set());}}} icon={<Trash2 size={13} />}>{isManager?"Request Delete":"Delete Selected"}</GBtn>
          <button onClick={() => setSelBills(new Set())} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: T.textMuted }}>Clear</button>
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>
            <th className="th" style={{ width: 36 }}>
              <input type="checkbox" className="cb" checked={saleBills.length>0&&saleBills.every(b=>selBills.has(b.id))} onChange={e=>{if(e.target.checked){setSelBills(new Set(saleBills.map(b=>b.id)));}else{setSelBills(new Set());}}} />
            </th>
            {["Bill No", "Date", "Vendor", "Items", "Subtotal", "Disc", "GST", "Total", ""].map((h, i) => (
              <th key={i} className="th" style={{ textAlign: ["Subtotal", "Disc", "GST", "Total"].includes(h) ? "right" : "left" }}>{h.toUpperCase()}</th>
            ))}
          </tr></thead>
          <tbody>
            {saleBills.slice((pg-1)*ps, pg*ps).map(b => {
              const v = vendors.find(x => x.id === b.vendorId);
              return <React.Fragment key={b.id}>
                <tr className={`trow${selBills.has(b.id)?" row-sel":""}`}>
                  <td className="td" onClick={e=>e.stopPropagation()}><input type="checkbox" className="cb" checked={selBills.has(b.id)} onChange={()=>tgBill(b.id)}/></td>
                  <td className="td" style={{ fontWeight: 600, color: T.accent }}>{b.billNo}</td>
                  <td className="td m">{fmtDate(b.date)}</td>
                  <td className="td">{v?.name || "—"}</td>
                  <td className="td m">{(b.items||[]).length}×</td>
                  <td className="td r m">{fmtCur(b.subtotal)}</td>
                  <td className="td r" style={{ color: (b.discAmount||0)>0 ? T.red : T.textMuted }}>{(b.discAmount||0)>0 ? `–${fmtCur(b.discAmount)}` : "—"}</td>
                  <td className="td r" style={{ color: T.textMuted, fontSize: 11 }}>{calcBillGst(b)>0 ? fmtCur(calcBillGst(b)) : "—"}</td>
                  <td className="td r" style={{ fontWeight: 700, color: T.green }}>{fmtCur(b.total)}</td>
                  <td className="td">
                    <div style={{ display: "flex", gap: 3 }}>
                      <button className="btn-ghost" onClick={() => setExp(p => ({...p,[b.id]:!p[b.id]}))} style={{ padding: "3px 6px" }}><Eye size={13} /></button>
                      <button className="btn-ghost" onClick={() => setInvoiceBill(b)} style={{ padding: "3px 6px" }} title="View Invoice"><Printer size={13} /></button>
                      {isAdmin && <button className="btn-ghost" onClick={() => setEditBill(b)} style={{ padding: "3px 6px" }}><Edit2 size={13} /></button>}
                      {isAdmin && <button className="btn-danger" onClick={() => deleteBill(b)} style={{ padding: "3px 6px" }}><Trash2 size={11} /></button>}
                    </div>
                  </td>
                </tr>
                {exp[b.id] && <tr style={{ background: T.isDark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.012)" }}>
                  <td colSpan={10} style={{ padding: "0", borderBottom: `1px solid ${T.borderSubtle}` }}>
                    <div style={{ padding: "12px 20px 14px" }}>
                      <div style={{ overflowX: "auto", marginBottom: 10 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                          <thead><tr style={{ background: T.isDark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)" }}>
                            {["#","Description","HSN","Qty","Unit","MRP","Rate (ex-GST)","GST%","Line Total"].map((h,i) => (
                              <th key={i} style={{ padding:"5px 8px", textAlign:["Qty","MRP","Rate (ex-GST)","GST%","Line Total"].includes(h)?"right":"left", fontWeight:700, fontSize:11, color:T.textSub, background: T.isDark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)", letterSpacing:"0.04em", borderBottom:`1px solid ${T.borderSubtle}`, whiteSpace:"nowrap" }}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {(b.items||[]).map((it, idx) => {
                              const rate = Number(it.gstRate||0);
                              const effPrice = Number(it.effectivePrice||it.price||0);
                              const qty = Number(it.qty||0);
                              const taxable = rate > 0 ? effPrice * 100 / (100 + rate) : effPrice;
                              const gst = qty * effPrice - qty * taxable;
                              return (
                                <tr key={idx} style={{ borderBottom:`1px solid ${T.borderSubtle}40` }}>
                                  <td style={{ padding:"5px 8px", color:T.textMuted }}>{idx+1}</td>
                                  <td style={{ padding:"5px 8px", fontWeight:600, color:T.text }}>{it.productName||"—"}{it.isDamaged&&<span style={{color:T.red,fontSize:11,marginLeft:6}}> DMG</span>}</td>
                                  <td style={{ padding:"5px 8px", color:T.textSub, fontFamily:"monospace" }}>{it.hsn||"—"}</td>
                                  <td style={{ padding:"5px 8px", textAlign:"right", fontWeight:600, color:T.text }}>{qty}</td>
                                  <td style={{ padding:"5px 8px", color:T.textMuted }}>{it.unit||"pcs"}</td>
                                  <td style={{ padding:"5px 8px", textAlign:"right", color:T.textSub }}>{fmtCur(it.mrp||it.effectivePrice||it.price||0)}</td>
                                  <td style={{ padding:"5px 8px", textAlign:"right", color:T.textSub }}>{fmtCur(taxable)}</td>
                                  <td style={{ padding:"5px 8px", textAlign:"right", color:T.amber }}>{rate > 0 ? rate+"%" : "—"}</td>
                                  <td style={{ padding:"5px 8px", textAlign:"right", fontWeight:700, color:T.text }}>{fmtCur(qty*effPrice)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ display:"flex", justifyContent:"flex-end" }}>
                        <table style={{ fontSize:12, borderCollapse:"collapse", minWidth:220 }}>
                          <tbody>
                            <tr><td style={{ padding:"3px 8px", color:T.textSub }}>Subtotal (MRP)</td><td style={{ padding:"3px 8px", textAlign:"right", fontWeight:600, color:T.text }}>{fmtCur(b.subtotal)}</td></tr>
                            {(b.discAmount||0)>0 && <tr><td style={{ padding:"3px 8px", color:T.red }}>Discount</td><td style={{ padding:"3px 8px", textAlign:"right", color:T.red }}>–{fmtCur(b.discAmount)}</td></tr>}
                            {calcBillGst(b)>0 && <tr><td style={{ padding:"3px 8px", color:T.amber }}>GST (incl.)</td><td style={{ padding:"3px 8px", textAlign:"right", color:T.amber }}>{fmtCur(calcBillGst(b))}</td></tr>}
                            {b.paymentMode && <tr><td style={{ padding:"3px 8px", color:T.textMuted, fontSize:11 }}>Payment</td><td style={{ padding:"3px 8px", textAlign:"right", fontSize:11, color:T.textSub }}>{b.paymentMode}</td></tr>}
                            <tr style={{ borderTop:`2px solid ${T.borderSubtle}` }}><td style={{ padding:"5px 8px", fontWeight:700, color:T.text }}>Total</td><td style={{ padding:"5px 8px", textAlign:"right", fontWeight:800, fontSize:14, color:T.accent }}>{fmtCur(b.total)}</td></tr>
                          </tbody>
                        </table>
                      </div>
                      {b.ewayBill && <div style={{ marginTop:8, fontSize:11, color:T.blue, padding:"6px 10px", borderRadius: T.radius, background:T.blueBg }}> E-Way: {b.ewayBillNo} · {b.transportName} · {b.vehicleNo}</div>}
                      {b.notes && <div style={{ fontSize:11, color:T.textSub, marginTop:6, fontStyle:"italic" }}>Note: {b.notes}</div>}
                    </div>
                  </td>
                </tr>}
              </React.Fragment>;
            })}
          </tbody>
        </table>
        {saleBills.length === 0 && <div style={{ padding: "40px 0", textAlign: "center", color: T.textMuted }}>No sales bills in selected period</div>}
      </div>
      <Pager total={saleBills.length} page={pg} ps={ps} setPage={setPg} setPs={setPs} />
    </div>

    <Modal open={modal} onClose={() => setModal(false)} title={`New Sale Bill${isManager?" (Requires Approval)":""}`} width={720}
      footer={isManager
        ? <><GBtn v="ghost" onClick={() => setModal(false)}>Cancel</GBtn><GBtn v="green" type="submit" form="sale-form" icon={<Send size={13}/>}>Submit for Approval</GBtn></>
        : <><GBtn v="ghost" onClick={() => setModal(false)}>Cancel</GBtn><GBtn type="submit" form="sale-form">Save Sale Bill</GBtn></>}>
      <BillForm type="sale" bills={bills} onSave={handleSaveBill} products={products} vendors={vendors} getStock={getStock} invoiceSettings={invoiceSettings} />
    </Modal>

    <Modal open={Boolean(editBill)} onClose={() => setEditBill(null)} title={`Edit: ${editBill?.billNo}`} width={720}
      footer={<><GBtn v="ghost" onClick={() => setEditBill(null)}>Cancel</GBtn><GBtn type="submit" form="sale-form" icon={<Edit2 size={13}/>}>Save Changes</GBtn></>}>
      {editBill && <BillForm type="sale" bills={bills} onSave={handleEditBill} products={products} vendors={vendors} getStock={getStock} existingBill={editBill} invoiceSettings={invoiceSettings} />}
    </Modal>

    {invoiceBill && <InvoiceModal bill={invoiceBill} invSettings={invoiceSettings||{}} vendors={vendors} products={products} onClose={() => setInvoiceBill(null)} />}




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
