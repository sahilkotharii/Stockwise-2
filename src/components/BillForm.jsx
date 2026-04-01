import React, { useState, useMemo } from "react";
import { Plus, X, FileText } from "lucide-react";
import { useT } from "../theme";
import { uid, today, fmtCur } from "../utils";
import { GIn, GS, GTa, GBtn, Lbl, Field } from "./UI";

export default function BillForm({ type, bills, onSave, products, vendors, channels, getStock }) {
  const T = useT();
  const [date, setDate] = useState(today());
  const [channelId, setChannelId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [discount, setDiscount] = useState("");
  const [discType, setDiscType] = useState("percent");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ id: uid(), productId: "", qty: 1, price: "", isDamaged: false }]);

  const billNo = useMemo(() => {
    const prefix = type === "sale" ? "SALE" : "PUR";
    const n = bills.filter(b => b.type === type).length + 1;
    return `${prefix}-${String(n).padStart(4, "0")}`;
  }, [bills, type]);

  const addItem = () => setItems(p => [...p, { id: uid(), productId: "", qty: 1, price: "", isDamaged: false }]);
  const remItem = id => setItems(p => p.filter(i => i.id !== id));
  const upItem = (id, k, v) => setItems(p => p.map(i => {
    if (i.id !== id) return i;
    const u = { ...i, [k]: v };
    if (k === "productId") {
      const pr = products.find(x => x.id === v);
      if (pr) u.price = type === "sale" ? pr.mrp : pr.purchasePrice;
    }
    return u;
  }));

  const valid = items.filter(i => i.productId && Number(i.qty) > 0 && Number(i.price) >= 0);
  const subtotal = valid.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0);
  const discAmt = type === "sale" ? (discType === "percent" ? subtotal * Number(discount || 0) / 100 : Math.min(Number(discount || 0), subtotal)) : 0;
  const total = subtotal - discAmt;

  const handleSave = () => {
    if (valid.length === 0) { alert("Add at least one product with qty > 0"); return; }
    if (type === "sale" && !channelId) { alert("Select a sales channel"); return; }
    if (type === "purchase" && !vendorId) { alert("Select a vendor"); return; }
    onSave({
      id: uid(), billNo, type, date,
      channelId: type === "sale" ? channelId : null,
      vendorId: type === "purchase" ? vendorId : null,
      items: valid.map(i => ({
        productId: i.productId,
        productName: products.find(p => p.id === i.productId)?.name || "",
        qty: Number(i.qty), price: Number(i.price),
        isDamaged: Boolean(i.isDamaged),
        mrp: products.find(p => p.id === i.productId)?.mrp || Number(i.price)
      })),
      subtotal, discType, discValue: Number(discount || 0), discAmount: discAmt, total, notes,
      ts: new Date().toISOString()
    });
  };

  return <form id={type + "-form"} onSubmit={e => { e.preventDefault(); handleSave(); }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div style={{ padding: "8px 14px", borderRadius: 10, background: T.accentBg, display: "flex", alignItems: "center", gap: 8 }}>
      <FileText size={14} color={T.accent} />
      <span style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>{billNo}</span>
      <span style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto" }}>{type === "sale" ? "Sales Bill" : "Purchase Order"}</span>
    </div>
    <div className="fgrid">
      <Field label="Date" req><GIn type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      {type === "sale"
        ? <Field label="Sales Channel" req><GS value={channelId} onChange={e => setChannelId(e.target.value)} placeholder="Select channel">{channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</GS></Field>
        : <Field label="Vendor" req><GS value={vendorId} onChange={e => setVendorId(e.target.value)} placeholder="Select vendor">{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</GS></Field>
      }
    </div>
    <div>
      <Lbl c="Products" req />
      <div style={{ border: `1px solid ${T.borderSubtle}`, borderRadius: 12, overflow: "hidden" }}>
        <div className="bill-item-hdr">
          {["Product", "Qty", type === "sale" ? "Sell Price" : "Cost Price", "Line Total", "Damaged", ""].map((h, i) => <div key={i} style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.05em", textAlign: h === "Damaged" ? "center" : "left" }}>{h.toUpperCase()}</div>)}
        </div>
        {items.map((item, i) => {
          const pr = products.find(p => p.id === item.productId);
          const stk = item.productId ? getStock(item.productId) : null;
          const lineTotal = Number(item.qty || 0) * Number(item.price || 0);
          return <div key={item.id} className="bill-item-row">
            <div>
              <GS value={item.productId} onChange={e => upItem(item.id, "productId", e.target.value)} placeholder={`Product ${i + 1}`}>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </GS>
              {stk !== null && <div style={{ fontSize: 10, marginTop: 2, color: stk <= 0 ? T.red : stk <= (pr?.minStock || 5) ? T.amber : T.textMuted }}>Stock: {stk}{type === "sale" && stk < Number(item.qty || 0) ? " ⚠️ Insufficient" : ""}</div>}
            </div>
            <GIn type="number" min="1" value={item.qty} onChange={e => upItem(item.id, "qty", e.target.value)} />
            <GIn type="number" min="0" step="0.01" value={item.price} onChange={e => upItem(item.id, "price", e.target.value)} placeholder={type === "sale" ? "MRP" : "Cost"} />
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{fmtCur(lineTotal)}</div>
            <div style={{ display: "flex", justifyContent: "center" }}><input type="checkbox" className="cb" checked={item.isDamaged} onChange={e => upItem(item.id, "isDamaged", e.target.checked)} /></div>
            <button type="button" onClick={() => remItem(item.id)} className="btn-danger" style={{ padding: "4px", opacity: items.length <= 1 ? .3 : 1 }} disabled={items.length <= 1}><X size={12} /></button>
          </div>;
        })}
        <div style={{ padding: "8px 12px", borderTop: `1px solid ${T.borderSubtle}` }}>
          <GBtn v="ghost" sz="sm" onClick={addItem} icon={<Plus size={12} />}>Add Product</GBtn>
        </div>
      </div>
    </div>
    <div className="fgrid">
      {type === "sale"
        ? <Field label="Discount">
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ display: "flex", gap: 2, background: T.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", borderRadius: 8, padding: 3, flexShrink: 0 }}>
              {[{ k: "percent", l: "%" }, { k: "amount", l: "₹" }].map(d => <button type="button" key={d.k} onClick={() => setDiscType(d.k)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: discType === d.k ? T.accent : "transparent", color: discType === d.k ? "#fff" : T.textMuted, fontSize: 12, fontWeight: 600 }}>{d.l}</button>)}
            </div>
            <GIn type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" />
          </div>
        </Field>
        : <div />
      }
      <div style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "flex-end" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.textSub }}><span>Subtotal</span><span style={{ fontWeight: 600 }}>{fmtCur(subtotal)}</span></div>
        {discAmt > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.red }}><span>Discount ({discType === "percent" ? `${discount}%` : `₹${discount}`})</span><span>–{fmtCur(discAmt)}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: T.text, borderTop: `1px solid ${T.borderSubtle}`, paddingTop: 8 }}><span>Total</span><span style={{ color: T.accent }}>{fmtCur(total)}</span></div>
      </div>
    </div>
    <Field label="Notes / Invoice No."><GTa value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Invoice number, remarks, reference..." /></Field>
  </form>;
}
