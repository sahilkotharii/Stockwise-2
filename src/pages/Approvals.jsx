import React, { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, ThumbsUp, ThumbsDown, CheckCircle, XCircle, Filter } from "lucide-react";
import { useT } from "../theme";
import { GBtn, GIn, Field } from "../components/UI";
import { uid, fmtCur, fmtTs } from "../utils";

export default function Approvals({ ctx }) {
  const T = useT();
  const { changeReqs, saveChangeReqs, saveBills, saveTransactions, saveProducts, saveCategories, saveVendors, products, categories, vendors, bills, transactions, addLog, user } = ctx;
  const [tab, setTab] = useState("pending");
  const [note, setNote] = useState("");
  const [declining, setDeclining] = useState(null);
  // ── New: Filters + bulk select ────────────────────────────────────────────
  const [entityFilter, setEntityFilter] = useState("all");
  const [selected, setSelected] = useState(new Set());

  const pending = changeReqs.filter(r => r.status === "pending");
  const hist = changeReqs.filter(r => r.status !== "pending").slice(0, 50);
  const sc = { pending: T.amber, approved: T.green, declined: T.red };

  // ── Entity filter options ─────────────────────────────────────────────────
  const ENTITY_FILTERS = [
    { id: "all", label: "All" },
    { id: "sale", label: "Sales" },
    { id: "purchase", label: "Purchase" },
    { id: "return", label: "Returns" },
    { id: "product", label: "Products" },
    { id: "vendor", label: "Vendors" },
    { id: "category", label: "Categories" },
  ];

  // ── Apply filters ─────────────────────────────────────────────────────────
  const shown = useMemo(() => {
    const base = tab === "pending" ? pending : hist;
    if (entityFilter === "all") return base;
    return base.filter(r => r.entity === entityFilter);
  }, [tab, pending, hist, entityFilter]);

  // ── Bulk select ───────────────────────────────────────────────────────────
  const allSelected = shown.length > 0 && shown.every(r => selected.has(r.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(shown.map(r => r.id)));
  };
  const toggleSel = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const approve = req => {
    try {
      if (req.entity === "product") {
        if (req.action === "create") saveProducts([...products, { ...req.proposedData, id: req.proposedData.id || uid() }]);
        else if (req.action === "update") saveProducts(products.map(p => p.id === req.entityId ? req.proposedData : p));
        else if (req.action === "delete") saveProducts(products.filter(p => p.id !== req.entityId));
      } else if (req.entity === "category") {
        if (req.action === "create") saveCategories([...categories, { ...req.proposedData, id: req.proposedData.id || uid() }]);
        else if (req.action === "update") saveCategories(categories.map(c => c.id === req.entityId ? req.proposedData : c));
        else if (req.action === "delete") saveCategories(categories.filter(c => c.id !== req.entityId));
      } else if (req.entity === "vendor") {
        if (req.action === "create") saveVendors([...vendors, { ...req.proposedData, id: req.proposedData.id || uid() }]);
        else if (req.action === "update") saveVendors(vendors.map(v => v.id === req.entityId ? req.proposedData : v));
        else if (req.action === "delete") saveVendors(vendors.filter(v => v.id !== req.entityId));
      } else if ((req.entity === "sale" || req.entity === "purchase") && req.action === "create") {
        const bill = req.proposedData;
        const newT = bill.items.map(item => ({
          id: uid(), productId: item.productId,
          type: item.isDamaged ? "damaged" : req.entity,
          qty: item.qty,
          price: item.effectivePrice || item.price,
          effectivePrice: item.effectivePrice || item.price,
          gstRate: item.gstRate || 0, gstAmount: item.gstAmount || 0,
          vendorId: bill.vendorId || null,
          gstType: bill.gstType || "",
          date: bill.date, notes: `Bill: ${bill.billNo}`,
          userId: req.requestedBy, userName: req.requestedByName,
          billId: bill.id, isDamaged: item.isDamaged
        }));
        saveBills([bill, ...bills]);
        saveTransactions([...newT, ...transactions]);
      } else if ((req.entity === "sale" || req.entity === "purchase") && req.action === "update") {
        const bill = req.proposedData;
        const newT = bill.items.map(item => ({
          id: uid(), productId: item.productId,
          type: item.isDamaged ? "damaged" : req.entity,
          qty: item.qty,
          price: item.effectivePrice || item.price,
          effectivePrice: item.effectivePrice || item.price,
          gstRate: item.gstRate || 0, gstAmount: item.gstAmount || 0,
          vendorId: bill.vendorId || null,
          gstType: bill.gstType || "",
          date: bill.date, notes: `Bill: ${bill.billNo} (edited)`,
          userId: req.requestedBy, userName: req.requestedByName,
          billId: bill.id, isDamaged: item.isDamaged
        }));
        saveBills(bills.map(b => b.id === bill.id ? bill : b));
        saveTransactions([...newT, ...transactions.filter(t => t.billId !== bill.id)]);
      } else if ((req.entity === "sale" || req.entity === "purchase") && req.action === "delete") {
        saveBills(bills.filter(b => b.id !== req.entityId));
        saveTransactions(transactions.filter(t => t.billId !== req.entityId));
      } else if (req.entity === "return" && req.action === "create") {
        const newTxns = Array.isArray(req.proposedData)
          ? req.proposedData.map(t => ({ ...t, id: t.id || uid() }))
          : [{ ...req.proposedData, id: req.proposedData.id || uid() }];
        saveTransactions([...newTxns, ...transactions]);
      } else if (req.entity === "return" && req.action === "update") {
        saveTransactions(transactions.map(t => t.id === req.entityId ? req.proposedData : t));
      } else if (req.entity === "return" && req.action === "delete") {
        saveTransactions(transactions.filter(t => t.id !== req.entityId));
      }
      saveChangeReqs(changeReqs.map(r => r.id === req.id ? { ...r, status: "approved", reviewedBy: user.id, reviewedByName: user.name, reviewedAt: new Date().toISOString() } : r));
      addLog("approved", req.entity, req.entityName);
    } catch (e) { alert("Error: " + e.message); }
  };

  const decline = req => {
    saveChangeReqs(changeReqs.map(r => r.id === req.id ? { ...r, status: "declined", reviewedBy: user.id, reviewedByName: user.name, reviewedAt: new Date().toISOString(), reviewNote: note } : r));
    addLog("declined", req.entity, req.entityName);
    setDeclining(null);
    setNote("");
  };

  // ── Bulk approve ──────────────────────────────────────────────────────────
  const bulkApprove = () => {
    if (!window.confirm(`Approve ${selected.size} requests?`)) return;
    const toApprove = shown.filter(r => selected.has(r.id) && r.status === "pending");
    toApprove.forEach(req => approve(req));
    setSelected(new Set());
  };
  const bulkDecline = () => {
    if (!window.confirm(`Decline ${selected.size} requests?`)) return;
    const toDecline = shown.filter(r => selected.has(r.id) && r.status === "pending");
    toDecline.forEach(req => {
      saveChangeReqs(changeReqs.map(r => r.id === req.id ? { ...r, status: "declined", reviewedBy: user.id, reviewedByName: user.name, reviewedAt: new Date().toISOString(), reviewNote: "Bulk declined" } : r));
      addLog("declined", req.entity, req.entityName);
    });
    setSelected(new Set());
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {/* Tabs + entity filters */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {["pending", "history"].map(t => <button key={t} onClick={() => { setTab(t); setSelected(new Set()); setEntityFilter("all"); }} style={{ padding: "7px 16px", borderRadius: T.radiusFull, fontSize: 12, fontWeight: 600, border: `1px solid ${tab === t ? T.accent : T.borderSubtle}`, cursor: "pointer", background: tab === t ? T.accent : "transparent", color: tab === t ? "#fff" : T.textSub, transition: "all .15s" }}>{t === "pending" ? `Pending (${pending.length})` : `History (${hist.length})`}</button>)}
      </div>
      {tab === "history" && hist.length > 0 && (
        <button className="btn-danger" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => {
          if (window.confirm("Clear all approved/declined history? Pending requests are not affected.")) {
            saveChangeReqs(changeReqs.filter(r => r.status === "pending"));
          }
        }}> Clear History</button>
      )}
    </div>

    {/* Entity type filter pills */}
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <Filter size={13} color={T.textMuted} />
      {ENTITY_FILTERS.map(f => {
        const count = (tab === "pending" ? pending : hist).filter(r => f.id === "all" || r.entity === f.id).length;
        if (count === 0 && f.id !== "all") return null;
        return (
          <button key={f.id} onClick={() => { setEntityFilter(f.id); setSelected(new Set()); }}
            style={{ padding: "5px 12px", borderRadius: T.radiusFull, fontSize: 11, fontWeight: 600, border: `1px solid ${entityFilter === f.id ? T.accent : T.borderSubtle}`, cursor: "pointer", background: entityFilter === f.id ? T.accent + "18" : "transparent", color: entityFilter === f.id ? T.accent : T.textSub, transition: "all .15s" }}>
            {f.label} {count > 0 ? `(${count})` : ""}
          </button>
        );
      })}
    </div>

    {/* Bulk action bar */}
    {tab === "pending" && shown.length > 0 && (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: T.radius, background: T.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, color: T.textSub }}>
          <input type="checkbox" className="cb" checked={allSelected} onChange={toggleAll} />
          Select All ({shown.length})
        </label>
        {selected.size > 0 && <>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.accent }}>{selected.size} selected</span>
          <GBtn sz="sm" onClick={bulkApprove} icon={<ThumbsUp size={12} />}>Approve All</GBtn>
          <GBtn v="danger" sz="sm" onClick={bulkDecline} icon={<ThumbsDown size={12} />}>Decline All</GBtn>
          <button onClick={() => setSelected(new Set())} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: T.textMuted }}>Clear</button>
        </>}
      </div>
    )}

    {shown.length === 0 && <div className="glass" style={{ padding: "60px 20px", textAlign: "center", borderRadius: T.radius }}>
      <CheckCircle size={40} color={T.green} style={{ margin: "0 auto 12px" }} />
      <div style={{ fontWeight: 600, color: T.textSub, fontSize: 15 }}>No {tab === "pending" ? "pending approvals" : "history yet"}{entityFilter !== "all" ? ` for ${entityFilter}` : ""}</div>
    </div>}

    {shown.map(req => <div key={req.id} className="glass fade-up" style={{ padding: 20, borderRadius: T.radius, borderLeft: `4px solid ${sc[req.status]}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Checkbox for bulk select (pending only) */}
          {req.status === "pending" && (
            <input type="checkbox" className="cb" checked={selected.has(req.id)} onChange={() => toggleSel(req.id)} onClick={e => e.stopPropagation()} />
          )}
          <div style={{ width: 36, height: 36, borderRadius: T.radius, background: `${sc[req.status]}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {req.action === "delete" ? <Trash2 size={16} color={sc[req.status]} /> : req.action === "update" ? <Edit2 size={16} color={sc[req.status]} /> : <Plus size={16} color={sc[req.status]} />}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: T.text, fontSize: 14 }}>
              <span style={{ textTransform: "capitalize" }}>{req.action}</span> {req.entity}: <span style={{ color: sc[req.status] }}>{req.entityName}</span>
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>By <strong style={{ color: T.textSub }}>{req.requestedByName}</strong> · {fmtTs(req.ts)}</div>
          </div>
        </div>
        <span className="badge" style={{ background: `${sc[req.status]}18`, color: sc[req.status], textTransform: "capitalize" }}>{req.status}</span>
      </div>

      {req.action === "delete" && (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: T.radius, background: T.redBg, border: `1px solid ${T.red}30`, fontSize: 12, color: T.red, display: "flex", alignItems: "center", gap: 8 }}>
          <Trash2 size={14} />
          <span><strong>Delete Request</strong> — approving will permanently remove this {req.entity} record{req.entity === "sale" || req.entity === "purchase" ? " and all its transactions" : ""}.</span>
        </div>
      )}
      {req.action !== "delete" && req.proposedData?.items && (
        <div style={{ marginTop: 10, marginBottom: 12, padding: 14, background: T.isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)", borderRadius: T.radius, border: `1px solid ${T.borderSubtle}` }}>
          <div style={{ fontSize:11, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>BILL ITEMS REVIEW</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {req.proposedData.items.map((it, idx) => (
              <div key={idx} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", color: T.text }}>
                <span>{it.productName} × {it.qty} {it.isDamaged ? <span style={{ color: T.red, fontWeight: 600, fontSize:11, marginLeft: 6 }}>DAMAGED / EXCLUDED</span> : ""}</span>
                <span style={{ fontWeight: 600 }}>{fmtCur(it.price * it.qty)}</span>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${T.borderSubtle}`, paddingTop: 6, marginTop: 4, display: "flex", justifyContent: "space-between", fontWeight: 700, color: T.accent }}>
              <span>Total</span><span>{fmtCur(req.proposedData.total)}</span>
            </div>
          </div>
        </div>
      )}

      {req.action === "update" && req.currentData && req.proposedData && (
        <div className="fgrid" style={{ marginBottom: 12, gap: 10 }}>
          <div style={{ padding: "10px 12px", borderRadius: T.radius, background: T.isDark ? "rgba(248,113,113,0.07)" : "rgba(254,226,226,0.6)", border: `1px solid ${T.red}20` }}>
            <div style={{ fontSize:11, fontWeight: 700, color: T.red, marginBottom: 6, letterSpacing: "0.05em" }}>CURRENT</div>
            {Object.keys(req.proposedData).filter(k => req.currentData[k] !== req.proposedData[k] && !["id", "margin"].includes(k)).slice(0, 5).map(k => <div key={k} style={{ fontSize: 11, color: T.textSub, marginBottom: 2 }}><span style={{ color: T.textMuted, textTransform: "capitalize" }}>{k}:</span> {String(req.currentData[k] || "—")}</div>)}
          </div>
          <div style={{ padding: "10px 12px", borderRadius: T.radius, background: T.isDark ? "rgba(74,222,128,0.07)" : "rgba(220,252,231,0.6)", border: `1px solid ${T.green}20` }}>
            <div style={{ fontSize:11, fontWeight: 700, color: T.green, marginBottom: 6, letterSpacing: "0.05em" }}>PROPOSED</div>
            {Object.keys(req.proposedData).filter(k => req.currentData[k] !== req.proposedData[k] && !["id", "margin"].includes(k)).slice(0, 5).map(k => <div key={k} style={{ fontSize: 11, color: T.textSub, marginBottom: 2 }}><span style={{ color: T.textMuted, textTransform: "capitalize" }}>{k}:</span> <strong style={{ color: T.text }}>{String(req.proposedData[k] || "—")}</strong></div>)}
          </div>
        </div>
      )}

      {req.status === "pending" && declining !== req.id && (
        <div style={{ display: "flex", gap: 10, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.borderSubtle}` }}>
          <GBtn onClick={() => approve(req)} icon={<ThumbsUp size={13} />}>Approve</GBtn>
          <GBtn v="danger" onClick={() => setDeclining(req.id)} icon={<ThumbsDown size={13} />}>Decline</GBtn>
        </div>
      )}

      {declining === req.id && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.borderSubtle}`, display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Decline Reason (Optional)"><GIn value={note} onChange={e => setNote(e.target.value)} placeholder="Reason…" /></Field>
          <div style={{ display: "flex", gap: 8 }}>
            <GBtn v="danger" onClick={() => decline(req)} icon={<XCircle size={13} />}>Confirm Decline</GBtn>
            <GBtn v="ghost" onClick={() => { setDeclining(null); setNote(""); }}>Cancel</GBtn>
          </div>
        </div>
      )}

      {req.status !== "pending" && (
        <div style={{ fontSize: 11, color: T.textMuted }}>
          Reviewed by <strong>{req.reviewedByName}</strong> · {fmtTs(req.reviewedAt)}{req.reviewNote && <span> · "{req.reviewNote}"</span>}
        </div>
      )}
    </div>)}
  </div>;
}
