import React, { useState, useMemo, useEffect } from "react";
import { X, Download, Trash2 } from "lucide-react";
import { useT } from "../theme";
import { GBtn, Pager, PeriodBar, SearchInput } from "../components/UI";
import { fmtCur, fmtDate, inRange, toCSV, dlCSV } from "../utils";

export default function Transactions({ ctx }) {
  const T = useT();
  const { transactions, products, vendors, saveTransactions, saveBills, bills, user } = ctx;
  const canDelete = user.role === 'admin' || !ctx.changeReqs; // admin always, or if no approval system
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [df, setDf] = useState("");
  const [dt, setDt] = useState("");
  const [preset, setPreset] = useState("");
  const [pg, setPg] = useState(1);
  const [ps, setPs] = useState(20);
  const [sel, setSel] = useState(new Set());
  const [delConfirm, setDelConfirm] = useState(null); // {mode:'single'|'bulk', target}
  const [delPass, setDelPass] = useState("");
  const [delErr, setDelErr] = useState("");
  useEffect(() => { setPg(1); setSel(new Set()); }, [tab, search, df, dt, ps]);

  const TT = [
    { id: "all",             label: "All" },
    { id: "opening",         label: "Opening",          color: "#7C3AED" },
    { id: "purchase",        label: "Purchase",         color: T.blue },
    { id: "sale",            label: "Sale",             color: T.green },
    { id: "return",          label: "Sales Return",     color: T.amber },
    { id: "purchase_return", label: "Purchase Return",  color: T.cyan },
    { id: "damaged",         label: "Damaged",          color: T.red },
  ];

  const fil = useMemo(() => transactions.filter(t => {
    if (tab !== "all" && t.type !== tab) return false;
    if (!inRange(t.date, df, dt)) return false;
    const p = products.find(pr => pr.id === t.productId);
    if (search && !p?.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [transactions, tab, search, df, dt, products]);

  const paged = useMemo(() => fil.slice((pg - 1) * ps, pg * ps), [fil, pg, ps]);
  const allSel = paged.length > 0 && paged.every(t => sel.has(t.id));
  const tgSel = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const tgAll = () => setSel(allSel ? new Set() : new Set(paged.map(t => t.id)));
  const tiMap = { opening: "#7C3AED", purchase: T.blue, sale: T.green, return: T.amber, purchase_return: T.cyan, damaged: T.red };

  const confirmDelete = (target) => { setDelConfirm({ mode: 'single', target }); setDelPass(""); setDelErr(""); };
  const confirmDeleteBulk = () => { setDelConfirm({ mode: 'bulk', target: [...sel] }); setDelPass(""); setDelErr(""); };
  const executeDelete = () => {
    if (!delPass) { setDelErr("Enter your password"); return; }
    const me = user;
    if (delPass !== me.password) { setDelErr("Incorrect password"); return; }
    if (delConfirm.mode === 'single') {
      const t = delConfirm.target;
      const updated = transactions.filter(x => x.id !== t.id);
      saveTransactions(updated);
      // If this txn belongs to a bill, remove the bill too (and all its txns)
      if (t.billId) {
        saveBills(bills.filter(b => b.id !== t.billId));
        saveTransactions(updated.filter(x => x.billId !== t.billId));
      }
    } else {
      const toDelIds = new Set(delConfirm.target);
      const billIds = new Set(transactions.filter(t => toDelIds.has(t.id) && t.billId).map(t => t.billId));
      const remaining = transactions.filter(t => !toDelIds.has(t.id) && !billIds.has(t.billId));
      saveTransactions(remaining);
      if (billIds.size) saveBills(bills.filter(b => !billIds.has(b.id)));
      setSel(new Set());
    }
    setDelConfirm(null); setDelPass(""); setDelErr("");
  };
  const exportCSV = () => dlCSV(toCSV(fil.map(t => ({
    date: t.date,
    type: t.type,
    product: products.find(p => p.id === t.productId)?.name || t.productId,
    sku: products.find(p => p.id === t.productId)?.sku || "",
    qty: t.qty,
    price: t.price,
    effectivePrice: t.effectivePrice || t.price,
    gstRate: t.gstRate || "",
    gstAmount: t.gstAmount || "",
    value: Number(t.qty) * Number(t.effectivePrice || t.price),
    vendor: vendors?.find(v => v.id === t.vendorId)?.name || "",
    notes: t.notes || "",
    by: t.userName || "",
    billRef: t.billId || "",
  })), ["date","type","product","sku","qty","price","effectivePrice","gstRate","gstAmount","value","vendor","notes","by","billRef"]), "transactions");

  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <div className="glass" style={{ padding: "10px 14px", borderRadius: T.radius, fontSize: 12, color: T.textSub }}> Raw transaction log — add Sales and Purchases from their dedicated pages</div>
      {sel.size > 0 && (
        <GBtn v="danger" sz="sm" icon={<Trash2 size={12} />} onClick={confirmDeleteBulk}>Delete Selected ({sel.size})</GBtn>
      )}
    </div>

    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {TT.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "6px 14px", borderRadius: T.radiusFull, fontSize: 12, fontWeight: 600, cursor: "pointer", background: tab === t.id ? (t.color || T.accent) : "transparent", color: tab === t.id ? "#fff" : T.textMuted, border: `1px solid ${tab === t.id ? (t.color || T.accent) : T.borderSubtle}`, transition: "all .15s" }}>{t.label}</button>
      ))}
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <PeriodBar df={df} setDf={setDf} dt={dt} setDt={setDt} preset={preset} setPreset={setPreset} />
      <div className="filter-wrap">
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product…" style={{ flex: "1 1 160px" }} />
        {(df || dt || search || preset) && <GBtn v="ghost" sz="sm" onClick={() => { setDf(""); setDt(""); setSearch(""); setPreset(""); }} icon={<X size={12} />}>Clear</GBtn>}
        <GBtn v="ghost" sz="sm" onClick={exportCSV} icon={<Download size={12} />}>Export</GBtn>
      </div>
    </div>

    <div className="glass" style={{ overflow: "hidden", borderRadius: T.radius }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: T.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)" }}>
              <th className="th" style={{ width: 36 }}><input type="checkbox" className="cb" checked={allSel} onChange={tgAll} /></th>
              {["Date", "Product", "Type", "Qty", "Price", "Value", "Vendor", "By", "Bill Ref"].map((h, i) => (
                <th key={i} className="th" style={{ textAlign: ["Qty", "Price", "Value"].includes(h) ? "right" : "left" }}>{h.toUpperCase()}</th>
              ))}
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {paged.map(t => {
              const p = products.find(pr => pr.id === t.productId);
              const v = vendors?.find(vn => vn.id === t.vendorId);
              const tc = tiMap[t.type] || T.textMuted;
              const isSel = sel.has(t.id);
              const typeLabel = t.type === "purchase_return" ? "Pur. Return" : t.type === "return" ? "Sale Return" : t.type;
              return (
                <tr key={t.id} className={`trow${isSel ? " row-sel" : ""}`}>
                  <td className="td"><input type="checkbox" className="cb" checked={isSel} onChange={() => tgSel(t.id)} /></td>
                  <td className="td m" style={{ whiteSpace: "nowrap", fontSize: 11 }}>{fmtDate(t.date)}</td>
                  <td className="td">
                    <div style={{ fontWeight: 600, color: T.text, fontSize: 12 }}>{p?.name || "—"}</div>
                    <div style={{ fontSize:11, color: T.textMuted, fontFamily: "monospace" }}>{p?.sku}</div>
                  </td>
                  <td className="td">
                    <span className="badge" style={{ background: `${tc}18`, color: tc, textTransform: "capitalize" }}>
                      {typeLabel} {t.isDamaged ? "" : ""}
                    </span>
                  </td>
                  <td className="td r" style={{ fontWeight: 700 }}>{t.qty}</td>
                  <td className="td r m">{fmtCur(t.price)}</td>
                  <td className="td r" style={{ fontWeight: 600, color: t.type === "sale" ? T.green : t.type === "purchase" ? T.blue : T.textSub }}>
                    {fmtCur(Number(t.qty) * Number(t.effectivePrice || t.price))}
                  </td>
                  <td className="td m" style={{ fontSize: 11 }}>{v?.name || "—"}</td>
                  <td className="td m" style={{ fontSize:11 }}>{t.userName || "—"}</td>
                  <td className="td m" style={{ fontSize:11, fontFamily: "monospace" }}>{t.billId ? "📄" : "—"}</td>
                  {user.role === "admin" && (
                    <td className="td">
                      <button className="btn-danger" onClick={() => { if (window.confirm("Delete?")) saveTransactions(transactions.filter(x => x.id !== t.id)); }} style={{ padding: "3px 7px" }}>
                        <Trash2 size={11} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {fil.length === 0 && <div style={{ padding: "40px 0", textAlign: "center", color: T.textMuted }}>No transactions found</div>}
      </div>
      <Pager total={fil.length} page={pg} ps={ps} setPage={setPg} setPs={setPs} />
    </div>
    {delConfirm && (
      <div onClick={() => setDelConfirm(null)} style={{ position:"fixed", inset:0, zIndex:400, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
        <div className="glass-strong spring-in" onClick={e=>e.stopPropagation()} style={{ width:"100%", maxWidth:380, borderRadius:T.radiusXl, padding:24, boxShadow:T.shadowXl }}>
          <div style={{ fontFamily:T.displayFont, fontWeight:700, fontSize:16, color:T.text, marginBottom:6 }}>Confirm Delete</div>
          <div style={{ fontSize:13, color:T.textSub, marginBottom:16 }}>
            {delConfirm.mode === 'single' ? "This will delete the transaction" : `Delete ${delConfirm.target.length} transaction(s)`}
            {delConfirm.mode === 'single' && delConfirm.target.billId ? " and its parent bill." : "."}
            {" "}This cannot be undone.
          </div>
          <div style={{ fontSize:12, fontWeight:700, color:T.textMuted, marginBottom:6, letterSpacing:"0.05em" }}>ENTER YOUR PASSWORD TO CONFIRM</div>
          <input className="inp" type="password" value={delPass} onChange={e=>{setDelPass(e.target.value);setDelErr("");}}
            placeholder="Your login password" autoFocus
            onKeyDown={e => e.key==="Enter" && executeDelete()}
            style={{ marginBottom: delErr?6:12 }} />
          {delErr && <div style={{ fontSize:12, color:T.red, marginBottom:10 }}>{delErr}</div>}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button className="btn-ghost" onClick={()=>setDelConfirm(null)} style={{ padding:"8px 16px", fontSize:13 }}>Cancel</button>
            <button className="btn-copper" onClick={executeDelete} style={{ padding:"8px 16px", fontSize:13 }}>Delete</button>
          </div>
        </div>
      </div>
    )}
  </div>;
}
