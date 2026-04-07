import React, { useState, useMemo, useEffect } from "react";
import { Plus, X, Eye, Trash2, Send, Edit2, TrendingUp, DollarSign, FileText, Package, Printer, Download } from "lucide-react";
import { useT } from "../theme";
import { KCard, GBtn, GIn, GS, Field, Modal, Pager } from "../components/UI";
import BillForm from "../components/BillForm";
import InvoiceModal from "../components/InvoiceModal";
import { uid, today, fmtCur, fmtDate, inRange } from "../utils";

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
  useEffect(() => setPg(1), [df, dt, vendorF, search, ps]);

  const handlePreset = k => { setPreset(k); setDf(getPresetDate(k)); setDt(today()); };

  const periodSaleBills = useMemo(() => bills.filter(b =>
    b.type === "sale" && inRange(b.date, df, dt) && (vendorF ? b.vendorId === vendorF : true)
  ), [bills, df, dt, vendorF]);

  // Always recalc GST from items — stored saleGstInfo can be stale/corrupted in old bills
  const calcBillGst = b => (b.items || []).reduce((s, i) => {
    const rate = Number(i.gstRate || 0);
    if (!rate) return s;
    const effPrice = Number(i.effectivePrice || i.price || 0);
    const effLine = Number(i.qty || 0) * effPrice;
    // If discount applied, effectivePrice already reflects it
    return s + effLine * rate / (100 + rate);
  }, 0);

  const totalRevenueInclGst = periodSaleBills.reduce((s, b) => s + Number(b.total || 0), 0);
  const totalGstCollected = periodSaleBills.reduce((s, b) => s + calcBillGst(b), 0);
  const netRevenueExclGst = totalRevenueInclGst - totalGstCollected;
  const totalOrders = periodSaleBills.length;
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

  // ── Bulk invoice download ─────────────────────────────────────────────────
  const downloadBulkInvoices = () => {
    const selected = saleBills.filter(b => selBills.has(b.id));
    if (selected.length === 0) return;
    // Dynamically import buildHTML from InvoiceModal
    const pages = selected.map((b, idx) => {
      const vendor = (vendors||[]).find(v => v.id === b.vendorId) || null;
      const inv = invoiceSettings || {};
      const isIGST = (b.gstType || "cgst_sgst") === "igst";
      const dateStr = b.date ? new Date(b.date).toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"}) : "";
      const itemsData = (b.items||[]).map(it => {
        const rate = Number(it.gstRate||0), effPrice = Number(it.effectivePrice||it.price||0), qty = Number(it.qty||0);
        const taxablePerUnit = rate>0 ? effPrice*100/(100+rate) : effPrice;
        return { ...it, taxablePerUnit, taxableTotal: qty*taxablePerUnit, gstTotal: qty*effPrice-qty*taxablePerUnit, rate, effPrice, qty };
      });
      const grandTaxable = itemsData.reduce((s,i)=>s+i.taxableTotal,0);
      const grandGst = itemsData.reduce((s,i)=>s+i.gstTotal,0);
      const grandTotal = Number(b.total||0);
      const gstByRate = {};
      itemsData.forEach(it => { if(!it.rate)return; if(!gstByRate[it.rate])gstByRate[it.rate]={taxable:0,gst:0}; gstByRate[it.rate].taxable+=it.taxableTotal; gstByRate[it.rate].gst+=it.gstTotal; });
      const billToLines = vendor ? [
        `<strong>${vendor.name}</strong>`,
        [vendor.address1,vendor.address2].filter(Boolean).join(", "),
        [vendor.city,vendor.state,vendor.pincode].filter(Boolean).join(", "),
        vendor.gstin?`GSTIN: <strong>${vendor.gstin}</strong>`:"",
        vendor.phone?`Ph: ${vendor.phone}`:"",
      ].filter(Boolean) : [];
      const gstRows = Object.entries(gstByRate).map(([r,v])=>isIGST?`<tr><td>IGST @${r}%</td><td style="text-align:right">₹${v.gst.toFixed(2)}</td></tr>`:`<tr><td>CGST @${(r/2).toFixed(1)}%</td><td style="text-align:right">₹${(v.gst/2).toFixed(2)}</td></tr><tr><td>SGST @${(r/2).toFixed(1)}%</td><td style="text-align:right">₹${(v.gst/2).toFixed(2)}</td></tr>`).join("");
      const itemRows = itemsData.map((it,i)=>`<tr><td>${i+1}</td><td><b>${it.productName||""}</b>${it.hsn?`<br/><small>HSN: ${it.hsn}</small>`:""}</td><td>${it.unit||"Pcs"}</td><td style="text-align:right">${it.qty}</td><td style="text-align:right">₹${it.taxablePerUnit.toFixed(2)}</td><td style="text-align:right">₹${it.taxableTotal.toFixed(2)}</td><td style="text-align:right"><b>₹${(it.qty*it.effPrice).toFixed(2)}</b></td></tr>`).join("");
      return `<div style="page-break-after:${idx<selected.length-1?"always":"auto"};font-family:Arial,sans-serif;font-size:12px;padding:24px;max-width:794px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:12px">
          <div>${inv.logoUrl?`<img src="${inv.logoUrl}" style="height:48px" alt="logo"/><br/>`:""}<b style="font-size:18px;color:#B5541A">${inv.businessName||"Your Business"}</b><br/><span style="font-size:11px;color:#555">${[inv.address1,inv.city,inv.state].filter(Boolean).join(", ")}${inv.gstin?`<br/>GSTIN: ${inv.gstin}`:""}</span></div>
          <div style="text-align:right"><b style="font-size:20px;letter-spacing:2px;color:#B5541A">TAX INVOICE</b><br/><b>No:</b> ${b.billNo||"—"}<br/><b>Date:</b> ${dateStr}<br/><span style="background:#e8f0fe;padding:2px 8px;border-radius:99px;font-size:10px">${isIGST?"IGST":"CGST+SGST"}</span></div>
        </div>
        <div style="display:flex;gap:0;border:1px solid #ddd;margin-bottom:12px">
          <div style="flex:1;padding:10px;border-right:1px solid #ddd"><b style="font-size:10px;color:#888;text-transform:uppercase">Bill To</b><br/>${billToLines.join("<br/>")}</div>
          <div style="flex:1;padding:10px"><b style="font-size:10px;color:#888;text-transform:uppercase">Ship To</b><br/>${billToLines.join("<br/>")}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:0"><thead><tr style="background:#f0f0f0"><th style="padding:6px;text-align:left;border:1px solid #ddd">#</th><th style="padding:6px;text-align:left;border:1px solid #ddd">Description</th><th style="padding:6px;border:1px solid #ddd">Unit</th><th style="padding:6px;text-align:right;border:1px solid #ddd">Qty</th><th style="padding:6px;text-align:right;border:1px solid #ddd">Rate (ex-GST)</th><th style="padding:6px;text-align:right;border:1px solid #ddd">Taxable</th><th style="padding:6px;text-align:right;border:1px solid #ddd">Total</th></tr></thead><tbody>${itemRows}</tbody><tfoot><tr style="background:#f9f9f9;font-weight:700"><td colspan="5" style="text-align:right;padding:6px">Totals</td><td style="text-align:right;padding:6px">₹${grandTaxable.toFixed(2)}</td><td style="text-align:right;padding:6px">₹${grandTotal.toFixed(2)}</td></tr></tfoot></table>
        <div style="display:flex;border:1px solid #ddd;border-top:none">
          <div style="flex:1;padding:10px;border-right:1px solid #ddd;font-size:11px"><b>GST Summary</b><table style="width:100%;margin-top:4px">${gstRows}<tr style="font-weight:700"><td>Total GST</td><td style="text-align:right">₹${grandGst.toFixed(2)}</td></tr></table></div>
          <div style="min-width:220px;padding:10px"><table style="width:100%;font-size:12px"><tr><td>Subtotal (ex-GST)</td><td style="text-align:right">₹${grandTaxable.toFixed(2)}</td></tr>${Number(b.discAmount||0)>0?`<tr><td style="color:#c00">Discount</td><td style="text-align:right;color:#c00">-₹${Number(b.discAmount).toFixed(2)}</td></tr>`:""}<tr><td>Total GST</td><td style="text-align:right">₹${grandGst.toFixed(2)}</td></tr><tr style="font-weight:900;font-size:15px;color:#B5541A;border-top:2px solid #B5541A"><td>Grand Total</td><td style="text-align:right">₹${grandTotal.toFixed(2)}</td></tr></table></div>
        </div>
        ${inv.bankName||inv.upiId?`<div style="margin-top:12px;padding:8px;background:#fafafa;border:1px solid #ddd;font-size:11px"><b>Bank:</b> ${inv.bankName||""} | <b>A/C:</b> ${inv.bankAccount||""} | <b>IFSC:</b> ${inv.ifsc||""} | <b>UPI:</b> ${inv.upiId||""}</div>`:""}
      </div>`;
    });
    const win = window.open("","_blank","width=900,height=700");
    if(win){ win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Invoices</title><style>@page{size:A4;margin:0}body{margin:0}@media print{.no-print{display:none}}</style></head><body>${pages.join("")}</body></html>`); win.document.close(); win.focus(); setTimeout(()=>win.print(),600); }
    setSelBills(new Set());
  };

  const handleSaveBill = bill => {
    if (isManager) { addChangeReq({ entity: "sale", action: "create", entityId: null, entityName: bill.billNo, currentData: null, proposedData: bill }); setModal(false); return; }
    const newTxns = bill.items.map(item => ({
      id: uid(), productId: item.productId, type: item.isDamaged ? "damaged" : "sale",
      qty: item.qty, price: item.effectivePrice || item.price,
      effectivePrice: item.effectivePrice || item.price,
      gstRate: item.gstRate || 0, gstAmount: item.gstAmount || 0,
      vendorId: bill.vendorId, channelId: null, date: bill.date,
      notes: `Bill: ${bill.billNo}${bill.notes ? ` · ${bill.notes}` : ""}`,
      userId: user.id, userName: user.name, billId: bill.id, isDamaged: item.isDamaged
    }));
    saveBills([bill, ...bills]);
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
      vendorId: updatedBill.vendorId, channelId: null, date: updatedBill.date,
      notes: `Bill: ${updatedBill.billNo} (edited)`,
      userId: user.id, userName: user.name, billId: updatedBill.id, isDamaged: item.isDamaged
    }));
    saveBills(bills.map(b => b.id === updatedBill.id ? updatedBill : b));
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
    if (!window.confirm(`Delete bill ${b.billNo}?`)) return;
    saveBills(bills.filter(x => x.id !== b.id));
    saveTransactions(transactions.filter(t => t.billId !== b.id));
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {isManager && <div style={{ padding: "10px 14px", borderRadius: 12, background: T.amberBg, border: `1px solid ${T.amber}30`, fontSize: 12, color: T.amber, fontWeight: 600 }}>⚠️ Manager mode — new sales require admin approval</div>}

    {/* Filter + Actions */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.05em" }}>PERIOD</span>
        {PRESETS.map(p => (
          <button key={p.k} onClick={() => handlePreset(p.k)} style={{ padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: preset === p.k ? T.accent : "transparent", color: preset === p.k ? "#fff" : T.textSub, transition: "all .15s" }}>{p.l}</button>
        ))}
        <input type="date" className="inp" value={df} onChange={e => { setDf(e.target.value); setPreset(""); }} style={{ width: 120, fontSize: 12 }} />
        <span style={{ fontSize: 12, color: T.textMuted }}>→</span>
        <input type="date" className="inp" value={dt} onChange={e => { setDt(e.target.value); setPreset(""); }} style={{ width: 120, fontSize: 12 }} />
      </div>
      <GBtn sz="md" onClick={() => setModal(true)} icon={<Plus size={14} />}>New Sale Bill</GBtn>
    </div>

    {/* KPI Cards — 4 cards */}
    <div className="kgrid" style={{ gap: 12 }}>
      {[
        { label: "Total Sales", value: finalRevenue, sub: "incl. GST · after returns", icon: TrendingUp, color: T.green },
        { label: "Net Sales", value: finalNetExclGst, sub: "excl. GST · after returns", icon: DollarSign, color: T.accent },
        { label: "Orders", value: totalOrders, sub: "sale bills in period", icon: FileText, color: T.blue, noFmt: true },
        { label: "Units Sold", value: unitsSold, sub: "total qty in bills", icon: Package, color: T.purple, noFmt: true },
      ].map((k, i) => (
        <div key={i} className="kcard glass">
          <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: `${k.color}12` }} />
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${k.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><k.icon size={17} color={k.color} /></div>
          <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 20, color: T.text }}>{k.noFmt ? k.value : fmtCur(k.value)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginTop: 2 }}>{k.label}</div>
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>{k.sub}</div>
        </div>
      ))}
    </div>

    {/* Bills table */}
    <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
      <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Sales Bills</div>
      <div className="filter-wrap" style={{ marginBottom: 12 }}>
        <div style={{ position: "relative", flex: "1 1 160px" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: T.textMuted }}>🔍</span>
          <input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bill no, product…" style={{ paddingLeft: 28 }} />
        </div>
        <GS value={vendorF} onChange={e => setVendorF(e.target.value)} placeholder="All Vendors">{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</GS>
        {(vendorF || search) && <GBtn v="ghost" sz="sm" onClick={() => { setVendorF(""); setSearch(""); }} icon={<X size={12} />}>Clear</GBtn>}
      </div>
      {selBills.size > 0 && (
        <div style={{ marginBottom: 10, padding: "8px 14px", borderRadius: 10, background: T.accentBg, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.accent }}>{selBills.size} selected</span>
          <GBtn sz="sm" onClick={downloadBulkInvoices} icon={<Download size={13} />}>Download {selBills.size} Invoice{selBills.size!==1?"s":""}</GBtn>
          <GBtn v="danger" sz="sm" onClick={() => { if(isManager){if(window.confirm(`Request admin to delete ${selBills.size} bills?`)){saleBills.filter(b=>selBills.has(b.id)).forEach(b=>addChangeReq({entity:'sale',action:'delete',entityId:b.id,entityName:b.billNo,currentData:b,proposedData:null}));setSelBills(new Set());}}else if(window.confirm(`Delete ${selBills.size} bills?`)){saleBills.filter(b=>selBills.has(b.id)).forEach(b=>{saveBills(bills.filter(x=>x.id!==b.id));saveTransactions(transactions.filter(t=>t.billId!==b.id));});setSelBills(new Set());}}} icon={<Trash2 size={13} />}>{isManager?"Request Delete":"Delete Selected"}</GBtn>
          <button onClick={() => setSelBills(new Set())} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: T.textMuted }}>Clear</button>
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>
            <th className="th" style={{ width: 36 }}>
              <input type="checkbox" className="cb" checked={saleBills.slice((pg-1)*ps,pg*ps).length>0&&saleBills.slice((pg-1)*ps,pg*ps).every(b=>selBills.has(b.id))} onChange={e=>{ const paged=saleBills.slice((pg-1)*ps,pg*ps); if(e.target.checked){setSelBills(s=>{const n=new Set(s);paged.forEach(b=>n.add(b.id));return n;});}else{setSelBills(s=>{const n=new Set(s);paged.forEach(b=>n.delete(b.id));return n;});}}} />
            </th>
            {["Bill No", "Date", "Vendor", "Items", "Subtotal", "Disc", "GST", "Total", ""].map((h, i) => (
              <th key={i} className="th" style={{ textAlign: ["Subtotal", "Disc", "GST", "Total"].includes(h) ? "right" : "left" }}>{h.toUpperCase()}</th>
            ))}
          </tr></thead>
          <tbody>
            {saleBills.slice((pg-1)*ps, pg*ps).map(b => {
              const v = vendors.find(x => x.id === b.vendorId);
              return <React.Fragment key={b.id}>
                <tr className={`trow${selBills.has(b.id)?" sel":""}`} onClick={()=>tgBill(b.id)} style={{cursor:"pointer"}}>
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
                {exp[b.id] && <tr style={{ background: T.isDark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.015)" }}>
                  <td colSpan={10} style={{ padding: "12px 20px", borderBottom: `1px solid ${T.borderSubtle}` }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                      {(b.items||[]).map((it, idx) => {
                        const effPrice = it.effectivePrice || it.price;
                        return <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.text }}>
                          <span>{it.productName} × {it.qty}{it.gstRate>0&&<span style={{color:T.textMuted,fontSize:10,marginLeft:8}}>GST@{it.gstRate}%</span>}{it.isDamaged&&<span style={{color:T.red,fontSize:10,marginLeft:8}}>DAMAGED</span>}</span>
                          <span style={{ fontWeight: 600 }}>{fmtCur(Number(it.qty)*Number(effPrice))}</span>
                        </div>;
                      })}
                    </div>
                    <div style={{ maxWidth: 260, marginLeft: "auto", borderTop: `1px solid ${T.borderSubtle}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:T.textSub }}><span>Subtotal</span><span>{fmtCur(b.subtotal)}</span></div>
                      {(b.discAmount||0)>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.red}}><span>Discount</span><span>–{fmtCur(b.discAmount)}</span></div>}
                      {calcBillGst(b)>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.textMuted}}><span>GST incl.</span><span>{fmtCur(calcBillGst(b))}</span></div>}
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,color:T.green}}><span>Total</span><span>{fmtCur(b.total)}</span></div>
                    </div>
                    {b.ewayBill && <div style={{ marginTop: 8, fontSize: 11, color: T.blue }}>E-Way: {b.ewayBillNo} · {b.transportName} · {b.vehicleNo}</div>}
                    {b.notes && <div style={{ fontSize: 11, color: T.textSub, marginTop: 6, fontStyle: "italic" }}>{b.notes}</div>}
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
  </div>;
}
