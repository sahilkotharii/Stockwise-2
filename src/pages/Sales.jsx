import React, { useState, useMemo, useEffect } from "react";
import { Plus, X, RotateCcw, Eye, Trash2, Send, Edit2, TrendingUp, DollarSign, FileText, Package, RefreshCw } from "lucide-react";
import { useT } from "../theme";
import { KCard, GBtn, GIn, GS, GTa, Field, Modal, Pager } from "../components/UI";
import BillForm from "../components/BillForm";
import { uid, today, fmtCur, fmtDate, inRange } from "../utils";

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
  const [preset, setPreset] = useState("30d");
  const [df, setDf] = useState(getPresetDate("30d"));
  const [dt, setDt] = useState(today());
  const [chF, setChF] = useState("");
  const [pg, setPg] = useState(1); const [ps, setPs] = useState(20);
  const [search, setSearch] = useState("");
  const [retForm, setRetForm] = useState({ productId: "", qty: 1, price: "", channelId: "", date: today(), notes: "", isDamaged: false });
  const [exp, setExp] = useState({});
  useEffect(() => setPg(1), [df, dt, chF, search, ps]);

  const handlePreset = (k) => {
    setPreset(k);
    setDf(getPresetDate(k));
    setDt(today());
  };

  // ── Period bills ────────────────────────────────────────────────────────
  const periodSaleBills = useMemo(() => bills.filter(b =>
    b.type === "sale" && inRange(b.date, df, dt) &&
    (chF ? b.channelId === chF : true)
  ), [bills, df, dt, chF]);

  // ── KPI calculations from BILLS (ground truth for revenue) ─────────────
  // Revenue incl GST = bill.total (already after discount)
  // GST on sale = bill.saleGstInfo (GST extracted from discounted total)
  // Net revenue excl GST = bill.total - bill.saleGstInfo
  const totalRevenueInclGst = periodSaleBills.reduce((s, b) => s + Number(b.total || 0), 0);
  const totalGstCollected = periodSaleBills.reduce((s, b) => s + Number(b.saleGstInfo || 0), 0);
  const netRevenueExclGst = totalRevenueInclGst - totalGstCollected;
  const totalOrders = periodSaleBills.length;
  const unitsSold = periodSaleBills.reduce((s, b) => s + (b.items || []).reduce((si, i) => si + Number(i.qty || 0), 0), 0);

  // Returns: reduce revenue at return price (incl GST)
  const retTxns = useMemo(() => transactions.filter(t =>
    t.type === "return" && inRange(t.date, df, dt)
  ), [transactions, df, dt]);
  const unitsReturned = retTxns.reduce((s, t) => s + Number(t.qty || 0), 0);
  const returnRevenueInclGst = retTxns.reduce((s, t) => s + Number(t.qty) * Number(t.price || 0), 0);
  const returnGst = retTxns.reduce((s, t) => {
    const rate = Number(t.gstRate || products.find(p => p.id === t.productId)?.gstRate || 0);
    return s + Number(t.qty) * Number(t.price || 0) * rate / (100 + rate);
  }, 0);
  const returnNetExclGst = returnRevenueInclGst - returnGst;

  // Final net figures (after returns)
  const finalRevenueInclGst = totalRevenueInclGst - returnRevenueInclGst;
  const finalNetExclGst = netRevenueExclGst - returnNetExclGst;

  // ── Filtered bills for table ────────────────────────────────────────────
  const saleBills = useMemo(() => periodSaleBills.filter(b => {
    if (search) {
      const q = search.toLowerCase();
      return (b.items || []).some(i => i.productName?.toLowerCase().includes(q)) || b.billNo.toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b2) => new Date(b2.date) - new Date(a.date)), [periodSaleBills, search]);

  // ── Save handlers ──────────────────────────────────────────────────────
  const handleSaveBill = bill => {
    if (isManager) {
      addChangeReq({ entity: "sale", action: "create", entityId: null, entityName: bill.billNo, currentData: null, proposedData: bill });
      setModal(false); return;
    }
    // Transactions record effectivePrice (discounted MRP per unit, incl GST)
    const newTxns = bill.items.map(item => ({
      id: uid(), productId: item.productId, type: item.isDamaged ? "damaged" : "sale",
      qty: item.qty,
      price: item.effectivePrice || item.price, // discounted price (incl GST)
      effectivePrice: item.effectivePrice || item.price,
      gstRate: item.gstRate || 0,
      gstAmount: item.gstAmount || 0,
      vendorId: null, channelId: bill.channelId, date: bill.date,
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
      vendorId: null, channelId: updatedBill.channelId, date: updatedBill.date,
      notes: `Bill: ${updatedBill.billNo} (edited)`,
      userId: user.id, userName: user.name, billId: updatedBill.id, isDamaged: item.isDamaged
    }));
    saveBills(bills.map(b => b.id === updatedBill.id ? updatedBill : b));
    saveTransactions([...newTxns, ...filteredTxns]);
    addLog("edited", "sale bill", updatedBill.billNo);
    setEditBill(null);
  };

  const handleReturn = () => {
    if (!retForm.productId || !retForm.qty) return;
    const pr = products.find(p => p.id === retForm.productId);
    const returnPrice = retForm.price ? Number(retForm.price) : Number(pr?.mrp || 0);
    const rate = Number(pr?.gstRate || 0);
    const t = {
      id: uid(), productId: retForm.productId,
      type: retForm.isDamaged ? "damaged" : "return",
      qty: Number(retForm.qty),
      price: returnPrice,   // return price per unit (incl GST)
      effectivePrice: returnPrice,
      gstRate: rate,
      gstAmount: returnPrice * rate / (100 + rate) * Number(retForm.qty),
      vendorId: null, channelId: retForm.channelId || null, date: retForm.date,
      notes: retForm.notes || "Customer return",
      userId: user.id, userName: user.name, billId: null, isDamaged: retForm.isDamaged
    };
    saveTransactions([t, ...transactions]);
    addLog("recorded", retForm.isDamaged ? "damaged return" : "sale return", pr?.name || "");
    setRetModal(false);
    setRetForm({ productId: "", qty: 1, price: "", channelId: "", date: today(), notes: "", isDamaged: false });
  };

  const deleteBill = b => {
    if (!window.confirm(`Delete bill ${b.billNo}? This removes all associated transactions.`)) return;
    saveBills(bills.filter(x => x.id !== b.id));
    saveTransactions(transactions.filter(t => t.billId !== b.id));
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {isManager && <div style={{ padding: "10px 14px", borderRadius: 12, background: T.amberBg, border: `1px solid ${T.amber}30`, fontSize: 12, color: T.amber, fontWeight: 600 }}>⚠️ Manager mode — new sales require admin approval</div>}

    {/* Actions + Time filter */}
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
      <div style={{ display: "flex", gap: 8 }}>
        <GBtn v="ghost" sz="sm" onClick={() => setRetModal(true)} icon={<RotateCcw size={13} />}>Record Return</GBtn>
        <GBtn sz="md" onClick={() => setModal(true)} icon={<Plus size={14} />}>New Sale Bill</GBtn>
      </div>
    </div>

    {/* KPI Cards — 5 cards */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
      <div className="kcard glass">
        <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: `${T.green}12` }} />
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${T.green}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><TrendingUp size={17} color={T.green} /></div>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 20, color: T.text }}>{fmtCur(finalRevenueInclGst)}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginTop: 2 }}>Total Sales</div>
        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>incl. GST · after returns</div>
      </div>
      <div className="kcard glass">
        <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: `${T.accent}12` }} />
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${T.accent}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><DollarSign size={17} color={T.accent} /></div>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 20, color: T.text }}>{fmtCur(finalNetExclGst)}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginTop: 2 }}>Net Sales</div>
        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>excl. GST · after returns</div>
      </div>
      <div className="kcard glass">
        <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: `${T.blue}12` }} />
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${T.blue}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><FileText size={17} color={T.blue} /></div>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 20, color: T.text }}>{totalOrders}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginTop: 2 }}>Orders</div>
        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>sale bills in period</div>
      </div>
      <div className="kcard glass">
        <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: `${T.purple}12` }} />
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${T.purple}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Package size={17} color={T.purple} /></div>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 20, color: T.text }}>{unitsSold}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginTop: 2 }}>Units Sold</div>
        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>total qty in bills</div>
      </div>
      <div className="kcard glass">
        <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: `${T.red}12` }} />
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${T.red}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><RotateCcw size={17} color={T.red} /></div>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 20, color: T.text }}>{unitsReturned}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginTop: 2 }}>Units Returned</div>
        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>
          {returnRevenueInclGst > 0 ? `${fmtCur(returnRevenueInclGst)} refunded` : "no returns"}
        </div>
      </div>
    </div>

    {/* Bills table */}
    <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
      <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Sales Bills</div>
      <div className="filter-wrap" style={{ marginBottom: 12 }}>
        <div style={{ position: "relative", flex: "1 1 160px" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textMuted, fontSize: 12 }}>🔍</span>
          <input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bill no, product…" style={{ paddingLeft: 28 }} />
        </div>
        <GS value={chF} onChange={e => setChF(e.target.value)} placeholder="All Channels">{channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</GS>
        {(chF || search) && <GBtn v="ghost" sz="sm" onClick={() => { setChF(""); setSearch(""); }} icon={<X size={12} />}>Clear</GBtn>}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>{["Bill No", "Date", "Channel", "Items", "Subtotal", "Discount", "GST", "Total", "", ""].map((h, i) => (
            <th key={i} className="th" style={{ textAlign: ["Subtotal", "Discount", "GST", "Total"].includes(h) ? "right" : "left", width: h === "" ? 36 : "auto" }}>{h.toUpperCase()}</th>
          ))}</tr></thead>
          <tbody>
            {saleBills.slice((pg - 1) * ps, pg * ps).map(b => {
              const ch = channels.find(c => c.id === b.channelId);
              return <React.Fragment key={b.id}>
                <tr className="trow">
                  <td className="td" style={{ fontWeight: 600, color: T.accent }}>{b.billNo}</td>
                  <td className="td m">{fmtDate(b.date)}</td>
                  <td className="td"><ChannelTag ch={ch} /></td>
                  <td className="td m">{(b.items || []).length}×</td>
                  <td className="td r m">{fmtCur(b.subtotal)}</td>
                  <td className="td r" style={{ color: (b.discAmount || 0) > 0 ? T.red : T.textMuted }}>{(b.discAmount || 0) > 0 ? `–${fmtCur(b.discAmount)}` : "—"}</td>
                  <td className="td r" style={{ color: T.textMuted, fontSize: 11 }}>{(b.saleGstInfo || 0) > 0 ? fmtCur(b.saleGstInfo) : "—"}</td>
                  <td className="td r" style={{ fontWeight: 700, color: T.green }}>{fmtCur(b.total)}</td>
                  <td className="td">
                    <div style={{ display: "flex", gap: 3 }}>
                      <button className="btn-ghost" onClick={() => setExp(p => ({ ...p, [b.id]: !p[b.id] }))} style={{ padding: "3px 6px" }}><Eye size={13} /></button>
                      {isAdmin && <button className="btn-ghost" onClick={() => setEditBill(b)} style={{ padding: "3px 6px" }}><Edit2 size={13} /></button>}
                    </div>
                  </td>
                  <td className="td">{isAdmin && <button className="btn-danger" onClick={() => deleteBill(b)} style={{ padding: "3px 6px" }}><Trash2 size={11} /></button>}</td>
                </tr>
                {exp[b.id] && <tr style={{ background: T.isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)" }}>
                  <td colSpan={10} style={{ padding: "12px 20px", borderBottom: `1px solid ${T.borderSubtle}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>BILL ITEMS</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                      {(b.items || []).map((it, idx) => {
                        const effPrice = it.effectivePrice || it.price;
                        const lineTotal = Number(it.qty) * Number(effPrice);
                        const gstAmt = it.gstAmount || (it.gstRate ? lineTotal * Number(it.gstRate) / (100 + Number(it.gstRate)) : 0);
                        return <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.text }}>
                          <span>
                            {it.productName} × {it.qty}
                            {it.gstRate > 0 && <span style={{ color: T.textMuted, fontSize: 10, marginLeft: 8 }}>GST @{it.gstRate}%: {fmtCur(gstAmt)}</span>}
                            {it.isDamaged && <span style={{ color: T.red, fontWeight: 600, fontSize: 10, marginLeft: 8 }}>DAMAGED</span>}
                          </span>
                          <span style={{ fontWeight: 600 }}>{fmtCur(lineTotal)}</span>
                        </div>;
                      })}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 260, marginLeft: "auto", borderTop: `1px solid ${T.borderSubtle}`, paddingTop: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textSub }}><span>Subtotal (MRP)</span><span>{fmtCur(b.subtotal)}</span></div>
                      {(b.discAmount || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.red }}><span>Discount ({b.discType === "percent" ? `${b.discValue}%` : `₹${b.discValue}`})</span><span>–{fmtCur(b.discAmount)}</span></div>}
                      {(b.saleGstInfo || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textMuted }}><span>GST (incl. in total)</span><span>{fmtCur(b.saleGstInfo)}</span></div>}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: T.green }}><span>Total (incl. GST)</span><span>{fmtCur(b.total)}</span></div>
                      {(b.saleGstInfo || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textMuted }}><span>Net (excl. GST)</span><span style={{ fontWeight: 600 }}>{fmtCur(b.total - (b.saleGstInfo || 0))}</span></div>}
                    </div>
                    {b.notes && <div style={{ fontSize: 11, color: T.textSub, marginTop: 8, fontStyle: "italic" }}>Note: {b.notes}</div>}
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

    {/* New Sale Modal */}
    <Modal open={modal} onClose={() => setModal(false)} title={`New Sale Bill${isManager ? " (Requires Approval)" : ""}`} width={720}
      footer={isManager
        ? <><GBtn v="ghost" onClick={() => setModal(false)}>Cancel</GBtn><GBtn v="green" type="submit" form="sale-form" icon={<Send size={13} />}>Submit for Approval</GBtn></>
        : <><GBtn v="ghost" onClick={() => setModal(false)}>Cancel</GBtn><GBtn type="submit" form="sale-form">Save Sale Bill</GBtn></>}>
      <BillForm type="sale" bills={bills} onSave={handleSaveBill} products={products} vendors={vendors} channels={channels} getStock={getStock} />
    </Modal>

    {/* Edit Sale Modal */}
    <Modal open={Boolean(editBill)} onClose={() => setEditBill(null)} title={`Edit: ${editBill?.billNo}`} width={720}
      footer={<><GBtn v="ghost" onClick={() => setEditBill(null)}>Cancel</GBtn><GBtn type="submit" form="sale-form" icon={<Edit2 size={13} />}>Save Changes</GBtn></>}>
      {editBill && <BillForm type="sale" bills={bills} onSave={handleEditBill} products={products} vendors={vendors} channels={channels} getStock={getStock} existingBill={editBill} />}
    </Modal>

    {/* Return Modal */}
    <Modal open={retModal} onClose={() => setRetModal(false)} title="Record Sale Return" width={440}
      footer={<><GBtn v="ghost" onClick={() => setRetModal(false)}>Cancel</GBtn><GBtn v="danger" onClick={handleReturn} icon={<RotateCcw size={13} />}>Record Return</GBtn></>}>
      <div className="fgrid">
        <Field label="Product" req cl="s2"><GS value={retForm.productId} onChange={e => {
          const pr = products.find(p => p.id === e.target.value);
          setRetForm(p => ({ ...p, productId: e.target.value, price: pr?.mrp?.toString() || "" }));
        }} placeholder="Select product">{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</GS></Field>
        <Field label="Return Qty" req><GIn type="number" min="1" value={retForm.qty} onChange={e => setRetForm(p => ({ ...p, qty: e.target.value }))} /></Field>
        <Field label="Return Price / unit (incl GST)" req>
          <GIn type="number" min="0" step="0.01" value={retForm.price} onChange={e => setRetForm(p => ({ ...p, price: e.target.value }))} placeholder="MRP or agreed refund price" />
          {retForm.price && retForm.productId && (() => {
            const pr = products.find(p => p.id === retForm.productId);
            const rate = Number(pr?.gstRate || 0);
            const price = Number(retForm.price);
            if (rate > 0 && price > 0) {
              const gst = price * rate / (100 + rate);
              return <div style={{ fontSize: 10, marginTop: 3, color: T.textMuted }}>GST @{rate}%: {fmtCur(gst)} · Net: {fmtCur(price - gst)}</div>;
            }
          })()}
        </Field>
        <Field label="Channel"><GS value={retForm.channelId} onChange={e => setRetForm(p => ({ ...p, channelId: e.target.value }))} placeholder="Select channel">{channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</GS></Field>
        <Field label="Date" cl="s2"><GIn type="date" value={retForm.date} onChange={e => setRetForm(p => ({ ...p, date: e.target.value }))} /></Field>
        <Field label="Reason" cl="s2"><GTa value={retForm.notes} onChange={e => setRetForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Reason for return…" /></Field>
        <div className="s2" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: T.redBg, borderRadius: 10 }}>
          <input type="checkbox" id="damret" checked={retForm.isDamaged} onChange={e => setRetForm(p => ({ ...p, isDamaged: e.target.checked }))} style={{ width: 16, height: 16, accentColor: T.red }} />
          <label htmlFor="damret" style={{ fontSize: 13, fontWeight: 600, color: T.red, cursor: "pointer" }}>Mark as Damaged (excluded from stock)</label>
        </div>
      </div>
    </Modal>
  </div>;
}
