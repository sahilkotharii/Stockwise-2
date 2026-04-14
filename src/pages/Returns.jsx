import React, { useState, useMemo, useEffect } from "react";
import { Plus, Search, X, Eye, Trash2, RotateCcw, Package, Truck, AlertTriangle, Edit2 } from "lucide-react";
import { useT } from "../theme";
import { KCard, GBtn, GIn, GS, GTa, Field, Modal, Pager, PeriodBar, SearchInput, DeleteConfirmModal } from "../components/UI";
import { ProductSearch } from "../components/BillForm";
import VendorSearch from "../components/VendorSearch";
import { uid, today, fmtCur, fmtDate, inRange } from "../utils";

const PRESETS = [
  { k: "30d", l: "30d" }, { k: "90d", l: "90d" }, { k: "6m", l: "6M" }, { k: "1y", l: "1Y" }
];

function getPresetDate(preset) {
  const now = new Date();
  switch (preset) {
    case "7d": return new Date(now - 7 * 864e5).toISOString().split("T")[0];
    case "30d": return new Date(now - 30 * 864e5).toISOString().split("T")[0];
    case "90d": return new Date(now - 90 * 864e5).toISOString().split("T")[0];
    case "6m": { const d = new Date(now); d.setMonth(d.getMonth() - 6); return d.toISOString().split("T")[0]; }
    case "1y": { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split("T")[0]; }
    default: return null;
  }
}

export default function Returns({ ctx }) {
  const T = useT();
  const { transactions, saveTransactions, products, vendors, getStock, user, addLog, addChangeReq } = ctx;
  const isAdmin = user.role === "admin";
  const isManager = user.role === "manager";

  const [modal, setModal] = useState(false);
  const [returnType, setReturnType] = useState("sales_return"); // "sales_return" | "purchase_return"
  const [preset, setPreset] = useState("30d");
  const [df, setDf] = useState(getPresetDate("30d"));
  const [dt, setDt] = useState(today());
  const [typeFilter, setTypeFilter] = useState("all"); // all | sales_return | purchase_return | damaged
  const [pg, setPg] = useState(1); const [ps, setPs] = useState(20);
  const [search, setSearch] = useState("");
  const [selRets, setSelRets] = useState(new Set());
  const tgRet = id => setSelRets(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [exp, setExp] = useState({});
  const [delConfirmRet, setDelConfirmRet] = useState(null);
  const [viewTxn, setViewTxn] = useState(null);
  const [editTxn, setEditTxn] = useState(null);
  useEffect(() => setPg(1), [df, dt, typeFilter, search, ps]);

  const handlePreset = k => { setPreset(k); setDf(getPresetDate(k)); setDt(today()); };

  // ── Form state ──────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    date: today(),
    vendorId: "",
    gstType: "cgst_sgst",
    notes: "",
    items: [{ id: uid(), productId: "", qty: 1, price: "", isDamaged: false }]
  });

  const resetForm = () => setForm({ date: today(), vendorId: "", gstType: "cgst_sgst", notes: "", items: [{ id: uid(), productId: "", qty: 1, price: "", isDamaged: false }] });
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { id: uid(), productId: "", qty: 1, price: "", isDamaged: false }] }));
  const remItem = id => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }));
  const upItem = (id, k, v) => setForm(f => ({
    ...f, items: f.items.map(i => {
      if (i.id !== id) return i;
      const u = { ...i, [k]: v };
      if (k === "productId") {
        const pr = products.find(p => p.id === v);
        if (pr) u.price = returnType === "sales_return" ? (pr.mrp || "") : (pr.purchasePrice || "");
      }
      return u;
    })
  }));

  const valid = form.items.filter(i => i.productId && Number(i.qty) > 0);
  const totalValue = valid.reduce((s, i) => s + Number(i.qty) * Number(i.price || 0), 0);

  const handleSave = () => {
    if (valid.length === 0) { alert("Add at least one product"); return; }
    if (!form.vendorId) { alert("Select a vendor"); return; }

    const batchId = uid(); // groups all items from this return submission
    const newTxns = valid.map(item => {
      const pr = products.find(p => p.id === item.productId);
      const rate = Number(pr?.gstRate || 0);
      const price = Number(item.price || 0);
      return {
        id: uid(),
        returnId: batchId,
        productId: item.productId,
        type: returnType === "purchase_return" ? "purchase_return" : "return",
        qty: Number(item.qty),
        price,
        effectivePrice: price,
        gstRate: rate,
        gstAmount: returnType === "sales_return"
          ? price * rate / (100 + rate) * Number(item.qty)
          : price * rate / 100 * Number(item.qty),
        vendorId: form.vendorId || null,
        date: form.date,
        notes: form.notes || (returnType === "purchase_return" ? "Purchase return to vendor" : "Sales return from customer"),
        userId: user.id, userName: user.name,
        billId: null,
        isDamaged: item.isDamaged,
        returnType,
        gstType: form.gstType || "cgst_sgst"
      };
    });
    if (editTxn) {
      // Update mode: replace the single existing transaction
      if (isManager) {
        addChangeReq({ entity: "return", action: "update", entityId: editTxn.id, entityName: editTxn.type, currentData: editTxn, proposedData: { ...editTxn, ...newTxns[0], id: editTxn.id } });
      } else {
        const updated = { ...editTxn, ...newTxns[0], id: editTxn.id };
        saveTransactions(transactions.map(x => x.id === editTxn.id ? updated : x));
        addLog("edited", "return", updated.type);
      }
    } else if (isManager) {
      // Manager: batch all items into ONE approval request
      addChangeReq({ entity: "return", action: "create", entityId: null, entityName: returnType === "purchase_return" ? "Purchase Return" : "Sales Return", currentData: null, proposedData: newTxns });
    } else {
      saveTransactions([...newTxns, ...transactions]);
      addLog("recorded", returnType === "purchase_return" ? "purchase return" : "sales return", `${valid.length} product(s)`);
    }
    setEditTxn(null);
    setModal(false);
    resetForm();
  };

  const deleteTxn = t => {
    if (isManager) {
      if (!window.confirm("Request admin to delete this return?")) return;
      addChangeReq({ entity: "return", action: "delete", entityId: t.id, entityName: `${t.type} - ${products.find(p=>p.id===t.productId)?.name||t.productId}`, currentData: t, proposedData: null });
      return;
    }
    if (!window.confirm("Delete this return entry?")) return;
    saveTransactions(transactions.filter(x => x.id !== t.id));
  };

  // ── All return transactions ──────────────────────────────────────────────
  const allReturns = useMemo(() => transactions.filter(t =>
    ["return", "purchase_return", "damaged"].includes(t.type) &&
    inRange(t.date, df, dt) &&
    (typeFilter === "all" ? true :
      typeFilter === "damaged" ? t.isDamaged :
      typeFilter === "sales_return" ? t.type === "return" :
      typeFilter === "purchase_return" ? t.type === "purchase_return" : true)
  ).filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    const pn = products.find(p => p.id === t.productId)?.name || "";
    return pn.toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q);
  }).sort((a, b) => new Date(b.date) - new Date(a.date)), [transactions, df, dt, typeFilter, search, products]);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const salesRets = allReturns.filter(t => t.type === "return");
  const purRets = allReturns.filter(t => t.type === "purchase_return");
  const damaged = allReturns.filter(t => t.isDamaged);

  const salesRetValue = salesRets.reduce((s, t) => s + Number(t.qty) * Number(t.price || 0), 0);
  const purRetValue = purRets.reduce((s, t) => s + Number(t.qty) * Number(t.price || 0), 0);

  // Damaged stock: items that came back as damaged (sales returns with isDamaged)
  // Still in inventory but marked damaged
  const damagedStockByProduct = useMemo(() => {
    const m = {};
    transactions.filter(t => t.isDamaged && t.type === "return").forEach(t => {
      if (!m[t.productId]) m[t.productId] = 0;
      m[t.productId] += Number(t.qty);
    });
    // Subtract purchase_return of damaged items (sent back to vendor)
    transactions.filter(t => t.isDamaged && t.type === "purchase_return").forEach(t => {
      if (!m[t.productId]) m[t.productId] = 0;
      m[t.productId] -= Number(t.qty);
    });
    return m;
  }, [transactions]);

  const damagedInvValue = Object.entries(damagedStockByProduct).reduce((s, [pid, qty]) => {
    const pp = Number(products.find(p => p.id === pid)?.purchasePrice || 0);
    return s + Math.max(0, qty) * pp;
  }, 0);
  const totalDamagedUnits = Object.values(damagedStockByProduct).reduce((s, q) => s + Math.max(0, q), 0);

  // ── Group returns by returnId; old entries (no returnId) = own group ────────
  const groupedReturns = useMemo(() => {
    const m = {};
    allReturns.forEach(t => {
      // New entries have returnId (groups items from one submission)
      // Old entries get their own unique key (each appears as its own row)
      const key = t.returnId || t.id;
      if (!m[key]) m[key] = [];
      m[key].push(t);
    });
    return Object.values(m).sort((a, b) =>
      new Date(b[0].date) - new Date(a[0].date) || b[0].id.localeCompare(a[0].id)
    );
  }, [allReturns]);

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {/* Time filter + actions */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <PeriodBar df={df} setDf={setDf} dt={dt} setDt={setDt} preset={preset} setPreset={setPreset} />
      <GBtn sz="md" onClick={() => { resetForm(); setModal(true); }} icon={<Plus size={14} />}>Record Return</GBtn>
    </div>

    {/* KPI Cards */}
    <div className="kgrid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
      <div onClick={() => setTypeFilter(typeFilter === "sales_return" ? "all" : "sales_return")} style={{ cursor: "pointer" }}>
        <KCard label="Sales Returns" value={fmtCur(salesRetValue)} sub={`${salesRets.length} entries · ${salesRets.reduce((s,t)=>s+Number(t.qty),0)} units`} icon={RotateCcw} color={T.red} />
      </div>
      <div onClick={() => setTypeFilter(typeFilter === "purchase_return" ? "all" : "purchase_return")} style={{ cursor: "pointer" }}>
        <KCard label="Purchase Returns" value={fmtCur(purRetValue)} sub={`${purRets.length} entries · ${purRets.reduce((s,t)=>s+Number(t.qty),0)} units`} icon={Truck} color={T.blue} />
      </div>
      <div onClick={() => setTypeFilter(typeFilter === "damaged" ? "all" : "damaged")} style={{ cursor: "pointer" }}>
        <KCard label="Damaged in Inventory" value={String(totalDamagedUnits)} sub={`Value: ${fmtCur(damagedInvValue)} (ex-GST)`} icon={AlertTriangle} color={T.amber} />
      </div>
    </div>

    {/* Damaged stock breakdown */}
    {totalDamagedUnits > 0 && (
      <div className="glass" style={{ padding: 16, borderRadius: T.radius, borderLeft: `4px solid ${T.amber}` }}>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 14, color: T.amber, marginBottom: 10 }}> Damaged Stock in Inventory</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(damagedStockByProduct).filter(([, q]) => q > 0).map(([pid, qty]) => {
            const pr = products.find(p => p.id === pid);
            return pr ? (
              <div key={pid} style={{ padding: "6px 12px", borderRadius: T.radiusFull, background: `${T.amber}15`, border: `1px solid ${T.amber}30`, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: T.text }}>{pr.alias || pr.name}</span>
                <span style={{ color: T.amber, marginLeft: 6 }}>{qty} units</span>
              </div>
            ) : null;
          })}
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 8 }}>These items are physically in your inventory but marked as damaged. They are counted in total stock and inventory value at purchase price.</div>
      </div>
    )}

    {/* Returns table */}
    <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
      <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Returns Log</div>
      <div className="filter-wrap" style={{ marginBottom: 12 }}>
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product, notes…" style={{ flex: "1 1 160px" }} />
        <div style={{ display: "flex", gap: 5 }}>
          {["all", "sales_return", "purchase_return", "damaged"].map(f => (
            <button key={f} onClick={() => setTypeFilter(f)} style={{ padding: "5px 12px", borderRadius: T.radiusFull, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", background: typeFilter === f ? T.accent : T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)", color: typeFilter === f ? "#fff" : T.textSub }}>
              {f === "all" ? "All" : f === "sales_return" ? "Sales Returns" : f === "purchase_return" ? "Purchase Returns" : "Damaged"}
            </button>
          ))}
        </div>
        {(search || typeFilter !== "all") && <GBtn v="ghost" sz="sm" onClick={() => { setSearch(""); setTypeFilter("all"); }} icon={<X size={12} />}>Clear</GBtn>}
      </div>
      {selRets.size > 0 && (
        <div style={{ marginBottom: 10, padding: "8px 14px", borderRadius: T.radius, background: T.amberBg, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.amber }}>{selRets.size} selected</span>
          <GBtn v="danger" sz="sm" onClick={() => {
            if (isManager) {
              if (!window.confirm(`Request admin to delete ${selRets.size} entries?`)) return;
              allReturns.filter(t => selRets.has(t.id)).forEach(t =>
                addChangeReq({ entity: 'return', action: 'delete', entityId: t.id, entityName: t.type, currentData: t, proposedData: null })
              );
              setSelRets(new Set());
            } else {
              if (!window.confirm(`Delete ${selRets.size} return entries? This cannot be undone.`)) return;
              const toDelete = new Set(selRets);
              saveTransactions(transactions.filter(t => !toDelete.has(t.id)));
              setSelRets(new Set());
            }
          }} icon={<Trash2 size={13} />}>{isManager ? "Request Delete" : "Delete Selected"}</GBtn>
          <button onClick={()=>setSelRets(new Set())} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",fontSize:11,color:T.textMuted}}>Clear</button>
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>
            <th className="th" style={{ width: 36 }}>
              <input type="checkbox" className="cb"
                checked={groupedReturns.length > 0 && groupedReturns.every(g => g.every(t => selRets.has(t.id)))}
                onChange={e => {
                  if (e.target.checked) setSelRets(new Set(allReturns.map(t => t.id)));
                  else setSelRets(new Set());
                }}
              />
            </th>
            {["Date", "Type", "Items", "Total Qty", "Total Value", "Vendor", "Damaged", ""].map((h, i) => (
              <th key={i} className="th" style={{ textAlign: ["Total Qty","Total Value"].includes(h) ? "right" : "left", width: h === "" ? 100 : "auto" }}>{h.toUpperCase()}</th>
            ))}
          </tr></thead>
          <tbody>
            {groupedReturns.slice((pg-1)*ps, pg*ps).map(group => {
              const gKey = group[0].returnId || `${group[0].date}__${group[0].vendorId||""}__${group[0].type}`;
              const first = group[0];
              const v = vendors.find(x => x.id === first.vendorId);
              const typeColor = first.type === "return" ? T.red : first.type === "purchase_return" ? T.blue : T.amber;
              const typeLabel = first.type === "return" ? "Sales Return" : first.type === "purchase_return" ? "Purchase Return" : "Damaged";
              const totalQty = group.reduce((s,t) => s + Number(t.qty), 0);
              const totalVal = group.reduce((s,t) => s + Number(t.qty)*Number(t.price||0), 0);
              const hasDamaged = group.some(t => t.isDamaged);
              const allSelected = group.every(t => selRets.has(t.id));
              const groupExp = exp[gKey];
              return (<React.Fragment key={gKey}>
                <tr className={`trow${allSelected?" row-sel":""}`}>
                  <td className="td" onClick={e=>e.stopPropagation()}>
                    <input type="checkbox" className="cb" checked={allSelected}
                      onChange={() => {
                        const ns = new Set(selRets);
                        if (allSelected) group.forEach(t => ns.delete(t.id));
                        else group.forEach(t => ns.add(t.id));
                        setSelRets(ns);
                      }}/>
                  </td>
                  <td className="td m">{fmtDate(first.date)}</td>
                  <td className="td"><span className="badge" style={{ background:typeColor+"18", color:typeColor }}>{typeLabel}</span></td>
                  <td className="td">
                    {group.length === 1
                      ? <><div style={{ fontWeight:600, color:T.text }}>{products.find(p=>p.id===first.productId)?.name||"—"}</div><div style={{ fontSize:11, color:T.textMuted }}>{products.find(p=>p.id===first.productId)?.sku}</div></>
                      : <><div style={{ fontWeight:600, color:T.text }}>{group.length} products</div><div style={{ fontSize:11, color:T.textMuted }}>{group.map(t=>products.find(p=>p.id===t.productId)?.alias||products.find(p=>p.id===t.productId)?.name||"?").join(", ")}</div></>
                    }
                  </td>
                  <td className="td r" style={{ fontWeight:600, color:T.text }}>{totalQty}</td>
                  <td className="td r" style={{ fontWeight:700, color:typeColor }}>{fmtCur(totalVal)}</td>
                  <td className="td m">{v?.name||"—"}</td>
                  <td className="td">{hasDamaged ? <span style={{ fontSize:11, fontWeight:700, color:T.amber }}>YES</span> : <span style={{ color:T.textMuted, fontSize:11 }}>—</span>}</td>
                  <td className="td">
                    <div style={{ display:"flex", gap:3 }}>
                      <button className="btn-ghost" onClick={() => setExp(p=>({...p,[gKey]:!p[gKey]}))} style={{ padding:"3px 6px" }} title="View"><Eye size={13}/></button>
                      {isAdmin && group.length === 1 && <button className="btn-ghost" onClick={() => { setEditTxn(first); setReturnType(first.type==="purchase_return"?"purchase_return":"sales_return"); setForm({ date:first.date, vendorId:first.vendorId||"", gstType:first.gstType||"cgst_sgst", notes:first.notes||"", items:[{ id:uid(), productId:first.productId, qty:first.qty, price:first.price||"", isDamaged:first.isDamaged||false }] }); setModal(true); }} style={{ padding:"3px 6px" }} title="Edit"><Edit2 size={13}/></button>}
                      <button className="btn-danger" onClick={e=>{e.stopPropagation(); setDelConfirmRet(group);}} style={{ padding:"3px 6px" }}><Trash2 size={11}/></button>
                    </div>
                  </td>
                </tr>
                {groupExp && (
                  <tr style={{ background: T.isDark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.012)" }}>
                    <td colSpan={9} style={{ padding:0, borderBottom:`1px solid ${T.borderSubtle}`, overflow:"hidden" }}>
                      <div className="expand-down" style={{ padding:"12px 20px 14px" }}>
                        <div style={{ overflowX:"auto", marginBottom:10 }}>
                          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                            <thead><tr style={{ background: T.isDark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)" }}>
                              {["#","Description","HSN","Qty","Unit","MRP","Price/Unit","GST%","Value","Damaged"].map((h,i)=>(
                                <th key={i} style={{ padding:"5px 8px", textAlign:["Qty","MRP","Price/Unit","GST%","Value"].includes(h)?"right":"left", fontWeight:700, fontSize:11, color:T.textSub, background:T.isDark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)", letterSpacing:"0.04em", borderBottom:`1px solid ${T.borderSubtle}`, whiteSpace:"nowrap" }}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {group.map((t,idx)=>{
                                const pr2 = products.find(p=>p.id===t.productId);
                                const mrp = pr2?.mrp || t.price || 0;
                                const val = Number(t.qty)*Number(t.price||0);
                                return (
                                  <tr key={t.id} style={{ borderBottom:`1px solid ${T.borderSubtle}40` }}>
                                    <td style={{ padding:"5px 8px", color:T.textMuted }}>{idx+1}</td>
                                    <td style={{ padding:"5px 8px", fontWeight:600, color:T.text }}>{pr2?.name||"—"}{t.isDamaged&&<span style={{color:T.amber,fontSize:11,marginLeft:6}}>DMG</span>}<div style={{fontSize:11,color:T.textMuted}}>{pr2?.sku}</div></td>
                                    <td style={{ padding:"5px 8px", color:T.textSub, fontFamily:"monospace" }}>{pr2?.hsn||"—"}</td>
                                    <td style={{ padding:"5px 8px", textAlign:"right", fontWeight:600, color:T.text }}>{t.qty}</td>
                                    <td style={{ padding:"5px 8px", color:T.textMuted }}>{pr2?.unit||"pcs"}</td>
                                    <td style={{ padding:"5px 8px", textAlign:"right", color:T.textSub }}>{fmtCur(mrp)}</td>
                                    <td style={{ padding:"5px 8px", textAlign:"right", color:T.textSub }}>{fmtCur(t.price||0)}</td>
                                    <td style={{ padding:"5px 8px", textAlign:"right", color:T.amber }}>{t.gstRate?t.gstRate+"%":"—"}</td>
                                    <td style={{ padding:"5px 8px", textAlign:"right", fontWeight:700, color:typeColor }}>{fmtCur(val)}</td>
                                    <td style={{ padding:"5px 8px" }}>{t.isDamaged?<span style={{color:T.amber,fontWeight:700,fontSize:11}}>YES</span>:<span style={{color:T.textMuted,fontSize:11}}>—</span>}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ display:"flex", justifyContent:"flex-end" }}>
                          <table style={{ fontSize:12, borderCollapse:"collapse", minWidth:220 }}>
                            <tbody>
                              {first.notes && <tr><td style={{ padding:"3px 8px", color:T.textMuted, fontSize:11 }}>Notes</td><td style={{ padding:"3px 8px", color:T.textSub, fontStyle:"italic" }}>{first.notes}</td></tr>}
                              <tr><td style={{ padding:"3px 8px", color:T.textSub }}>Vendor</td><td style={{ padding:"3px 8px", fontWeight:600, color:T.text }}>{vendors.find(x=>x.id===first.vendorId)?.name||"—"}</td></tr>
                              <tr><td style={{ padding:"3px 8px", color:T.textMuted, fontSize:11 }}>Recorded by</td><td style={{ padding:"3px 8px", fontSize:11, color:T.textSub }}>{first.userName||"—"}</td></tr>
                              <tr style={{ borderTop:`2px solid ${T.borderSubtle}` }}><td style={{ padding:"5px 8px", fontWeight:700, color:T.text }}>Total Value</td><td style={{ padding:"5px 8px", textAlign:"right", fontWeight:800, fontSize:14, color:typeColor }}>{fmtCur(totalVal)}</td></tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>);
            })}
          </tbody>
        </table>
        {groupedReturns.length === 0 && <div style={{ padding: "40px 0", textAlign: "center", color: T.textMuted }}>No returns in selected period</div>}
      </div>
      <Pager total={groupedReturns.length} page={pg} ps={ps} setPage={setPg} setPs={setPs} />
    </div>

    {/* New Return Modal */}
    <Modal open={modal} onClose={() => { setModal(false); resetForm(); setEditTxn(null); }} title={`${editTxn ? "Edit" : "Record"} Return${isManager ? " (Requires Approval)" : ""}`} width={620}
      footer={<><GBtn v="ghost" onClick={() => { setModal(false); resetForm(); setEditTxn(null); }}>Cancel</GBtn><GBtn onClick={handleSave} icon={<RotateCcw size={13} />}>Save Return</GBtn></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Type selector */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>RETURN TYPE</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ k: "sales_return", l: " Sales Return", sub: "Customer returns product to you" },
              { k: "purchase_return", l: "🚚 Purchase Return", sub: "You return product to vendor" }].map(rt => (
              <button key={rt.k} onClick={() => setReturnType(rt.k)} style={{
                flex: 1, padding: "12px 16px", borderRadius: T.radius, border: `2px solid ${returnType === rt.k ? T.accent : T.borderSubtle}`,
                cursor: "pointer", background: returnType === rt.k ? T.accentBg : "transparent",
                textAlign: "left", transition: "all .15s"
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: returnType === rt.k ? T.accent : T.text }}>{rt.l}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{rt.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Info banner */}
        <div style={{ padding: "10px 14px", borderRadius: T.radius, background: returnType === "sales_return" ? T.redBg : T.blueBg, border: `1px solid ${returnType === "sales_return" ? T.red + "30" : T.blue + "30"}`, fontSize: 12, color: returnType === "sales_return" ? T.red : T.blue }}>
          {returnType === "sales_return"
            ? " Sales Return: Product added back to your inventory. If damaged, it stays in stock but is flagged as damaged."
            : "🚚 Purchase Return: Product removed from your inventory. Applicable for defective/wrong items sent back to vendor."}
        </div>

        {/* Date + Channel/Vendor */}
        <div className="fgrid">
          <Field label="Date" req><GIn type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></Field>
          <Field label="Vendor" req><VendorSearch value={form.vendorId} onChange={id => setForm(f => ({ ...f, vendorId: id }))} vendors={vendors||[]} /></Field>
        </div>

        {/* GST Type */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>GST TYPE</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { k: "cgst_sgst", l: "CGST + SGST", sub: "Intra-state (within same state)" },
              { k: "igst",      l: "IGST",         sub: "Inter-state / Import / Export" }
            ].map(g => (
              <button key={g.k} onClick={() => setForm(f => ({ ...f, gstType: g.k }))} style={{
                flex: 1, padding: "10px 14px", borderRadius: T.radius,
                border: `2px solid ${form.gstType === g.k ? T.accent : T.borderSubtle}`,
                cursor: "pointer", background: form.gstType === g.k ? T.accentBg : "transparent",
                textAlign: "left", transition: "all .15s"
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: form.gstType === g.k ? T.accent : T.text }}>{g.l}</div>
                <div style={{ fontSize:11, color: T.textMuted, marginTop: 2 }}>{g.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Products */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>PRODUCTS</div>
          <div style={{ border: `1px solid ${T.borderSubtle}`, borderRadius: T.radius, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 100px 70px 32px", gap: 8, padding: "8px 12px", background: T.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}>
              {["Product", "Qty", `${returnType === "sales_return" ? "Sale" : "Purchase"} Price`, "Damaged?", ""].map(h => (
                <div key={h} style={{ fontSize:11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.04em" }}>{h.toUpperCase()}</div>
              ))}
            </div>
            {form.items.map((item, i) => {
              const pr = products.find(p => p.id === item.productId);
              const stk = item.productId ? getStock(item.productId) : null;
              return (
                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 70px 100px 70px 32px", gap: 8, padding: "8px 12px", alignItems: "center", borderTop: `1px solid ${T.borderSubtle}` }}>
                  <div>
                    <ProductSearch value={item.productId} onChange={v => upItem(item.id, "productId", v)} products={products} placeholder={`Product ${i + 1}…`} />
                    {stk !== null && <div style={{ fontSize:11, marginTop:2, color:T.textMuted }}>Stock: {stk}</div>}
                  </div>
                  <GIn type="number" min="1" value={item.qty} onChange={e => upItem(item.id, "qty", e.target.value)} />
                  <div>
                    <GIn type="number" min="0" step="0.01" value={item.price} onChange={e => upItem(item.id, "price", e.target.value)} placeholder="0.00" />
                    {item.price && pr?.gstRate > 0 && (() => {
                      const rate = Number(pr.gstRate);
                      const price = Number(item.price);
                      if (price <= 0) return null;
                      if (returnType === "sales_return") {
                        const totalGst = price * rate / (100 + rate);
                        const net = price - totalGst;
                        return (
                          <div style={{ fontSize:11, color: T.textMuted, marginTop: 2 }}>
                            {form.gstType === "igst"
                              ? `Net: ${fmtCur(net)} · IGST @${rate}%: ${fmtCur(totalGst)}`
                              : `Net: ${fmtCur(net)} · CGST: ${fmtCur(totalGst/2)} · SGST: ${fmtCur(totalGst/2)}`}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <input type="checkbox" checked={item.isDamaged} onChange={e => upItem(item.id, "isDamaged", e.target.checked)} style={{ width: 16, height: 16, accentColor: T.amber, cursor: "pointer" }} />
                  </div>
                  <button onClick={() => remItem(item.id)} className="btn-danger" style={{ padding: "4px", opacity: form.items.length <= 1 ? .3 : 1 }} disabled={form.items.length <= 1}>
                    <X size={12} />
                  </button>
                </div>
              );
            })}
            <div style={{ padding: "8px 12px", borderTop: `1px solid ${T.borderSubtle}` }}>
              <GBtn v="ghost" sz="sm" onClick={addItem} icon={<Plus size={12} />}>Add Another Product</GBtn>
            </div>
          </div>
        </div>

        {/* Summary + Notes */}
        <div className="fgrid">
          <Field label="Notes"><GTa value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Reason for return, condition, reference no…" /></Field>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.textSub }}>
              <span>{valid.length} product{valid.length !== 1 ? "s" : ""}</span>
              <span>{valid.reduce((s, i) => s + Number(i.qty), 0)} units</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: T.text, borderTop: `1px solid ${T.borderSubtle}`, paddingTop: 8 }}>
              <span>Total {returnType === "purchase_return" ? "Refund" : "Value"}</span>
              <span style={{ color: T.accent }}>{fmtCur(totalValue)}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
    {/* View Return Detail Modal */}


    <DeleteConfirmModal
      open={!!delConfirmRet}
      onClose={()=>setDelConfirmRet(null)}
      onConfirm={()=>{ saveTransactions(transactions.filter(t=>!(delConfirmRet||[]).some(g=>g.id===t.id))); }}
      user={user}
      label={delConfirmRet?.length > 1 ? `${delConfirmRet.length} return entries` : "this return entry"}
    />
  </div>;
}
