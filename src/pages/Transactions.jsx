import React, { useState, useMemo, useEffect } from "react";
import { Search, X, Download, Trash2 } from "lucide-react";
import { useT } from "../theme";
import { GBtn, Pager } from "../components/UI";
import { fmtCur, fmtDate, inRange, toCSV, dlCSV } from "../utils";

export default function Transactions({ ctx }) {
  const T = useT();
  const { transactions, products, vendors, channels, saveTransactions, user } = ctx;
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [df, setDf] = useState("");
  const [dt, setDt] = useState("");
  const [pg, setPg] = useState(1);
  const [ps, setPs] = useState(20);
  const [sel, setSel] = useState(new Set());
  useEffect(() => { setPg(1); setSel(new Set()); }, [tab, search, df, dt, ps]);

  const TT = [
    { id: "all", label: "All" },
    { id: "opening", label: "Opening", color: "#7C3AED" },
    { id: "purchase", label: "Purchase", color: T.blue },
    { id: "sale", label: "Sale", color: T.green },
    { id: "return", label: "Return", color: T.amber },
    { id: "damaged", label: "Damaged", color: T.red }
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
  const tiMap = { opening: "#7C3AED", purchase: T.blue, sale: T.green, return: T.amber, damaged: T.red };

  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <div className="glass" style={{ padding: "10px 14px", borderRadius: 12, fontSize: 12, color: T.textSub }}>📋 Raw transaction log — add Sales and Purchases from the dedicated pages for multi-product bills</div>
      <div style={{ display: "flex", gap: 10 }}>
        {sel.size > 0 && user.role === "admin" && (
          <GBtn v="danger" sz="sm" icon={<Trash2 size={12} />} onClick={() => {
            if (window.confirm(`Delete these ${sel.size} transactions?`)) {
              saveTransactions(transactions.filter(t => !sel.has(t.id)));
              setSel(new Set());
            }
          }}>Delete Selected ({sel.size})</GBtn>
        )}
      </div>
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {TT.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "6px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer", background: tab === t.id ? (t.color || T.accent) + "1C" : "transparent", color: tab === t.id ? (t.color || T.accent) : T.textMuted, border: `1px solid ${tab === t.id ? (t.color || T.accent) + "44" : T.borderSubtle}`, transition: "all .15s" }}>{t.label}</button>)}
    </div>
    <div className="filter-wrap">
      <div style={{ position: "relative", flex: "1 1 160px" }}>
        <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
        <input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product…" style={{ paddingLeft: 30 }} />
      </div>
      <input type="date" className="inp" value={df} onChange={e => setDf(e.target.value)} style={{ flex: "0 1 120px" }} />
      <span style={{ fontSize: 12, color: T.textMuted }}>→</span>
      <input type="date" className="inp" value={dt} onChange={e => setDt(e.target.value)} style={{ flex: "0 1 120px" }} />
      {(df || dt || search) && <GBtn v="ghost" sz="sm" onClick={() => { setDf(""); setDt(""); setSearch(""); }} icon={<X size={12} />}>Clear</GBtn>}
      <GBtn v="ghost" sz="sm" onClick={() => dlCSV(toCSV(fil, ["date", "type", "productId", "qty", "price", "vendorId", "channelId", "notes", "userName", "billId"]), "transactions")} icon={<Download size={12} />}>Export</GBtn>
    </div>
    <div className="glass" style={{ overflow: "hidden", borderRadius: T.radius }}>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: T.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)" }}>
          <th className="th" style={{ width: 36 }}><input type="checkbox" className="cb" checked={allSel} onChange={tgAll} /></th>
          {["Date", "Product", "Type", "Qty", "Price", "Value", "Source", "By", "Ref"].map((h, i) => <th key={i} className="th" style={{ textAlign: ["Qty", "Price", "Value"].includes(h) ? "right" : "left" }}>{h.toUpperCase()}</th>)}
          {user.role === "admin" && <th className="th" />}
        </tr></thead>
        <tbody>{paged.map(t => {
          const p = products.find(pr => pr.id === t.productId);
          const vc = vendors.find(v => v.id === t.vendorId) || channels.find(c => c.id === t.channelId);
          const tc = tiMap[t.type] || T.textMuted;
          const isSel = sel.has(t.id);
          return <tr key={t.id} className={`trow${isSel ? " sel" : ""}`}>
            <td className="td"><input type="checkbox" className="cb" checked={isSel} onChange={() => tgSel(t.id)} /></td>
            <td className="td m" style={{ whiteSpace: "nowrap", fontSize: 11 }}>{fmtDate(t.date)}</td>
            <td className="td"><div style={{ fontWeight: 600, color: T.text, fontSize: 12 }}>{p?.name || "—"}</div><div style={{ fontSize: 10, color: T.textMuted, fontFamily: "monospace" }}>{p?.sku}</div></td>
            <td className="td"><span className="badge" style={{ background: `${tc}18`, color: tc, textTransform: "capitalize" }}>{t.type} {t.isDamaged ? <span style={{ color: T.red }}>⚠</span> : ""}</span></td>
            <td className="td r" style={{ fontWeight: 700 }}>{t.qty}</td>
            <td className="td r m">{fmtCur(t.price)}</td>
            <td className="td r" style={{ fontWeight: 600, color: t.type === "sale" ? T.green : t.type === "purchase" ? T.blue : T.textSub }}>{fmtCur(Number(t.qty) * Number(t.effectivePrice || t.price))}</td>
            <td className="td m" style={{ fontSize: 11 }}>{vc?.name || "—"}</td>
            <td className="td m" style={{ fontSize: 10 }}>{t.userName || "—"}</td>
            <td className="td m" style={{ fontSize: 10, fontFamily: "monospace" }}>{t.billId ? "📄" : "—"}</td>
            {user.role === "admin" && <td className="td"><button className="btn-danger" onClick={() => { if (window.confirm("Delete?")) saveTransactions(transactions.filter(x => x.id !== t.id)); }} style={{ padding: "3px 7px" }}><Trash2 size={11} /></button></td>}
          </tr>;
        })}</tbody>
      </table>
        {fil.length === 0 && <div style={{ padding: "40px 0", textAlign: "center", color: T.textMuted }}>No transactions found</div>}
      </div>
      <Pager total={fil.length} page={pg} ps={ps} setPage={setPg} setPs={setPs} />
    </div>
  </div>;
}
