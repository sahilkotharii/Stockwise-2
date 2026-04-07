import React, { useState, useMemo, useRef, useEffect } from "react";
import { Plus, X, FileText, Search } from "lucide-react";
import { useT } from "../theme";
import { uid, today, fmtCur } from "../utils";
import { GIn, GS, GTa, GBtn, Lbl, Field } from "./UI";

/* ─── Searchable product autocomplete ──────────────────────────────────── */
function ProductSearch({ value, onChange, products, placeholder }) {
  const T = useT();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = products.find(p => p.id === value);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return products.slice(0, 30);
    return products.filter(p =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q) ||
      (p.alias || "").toLowerCase().includes(q)
    ).slice(0, 25);
  }, [query, products]);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search size={11} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none" }} />
        <input
          className="inp" style={{ paddingLeft: 26 }}
          value={open ? query : (selected ? selected.name : "")}
          placeholder={placeholder || "Search product…"}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setQuery(""); setOpen(true); }}
        />
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 300, marginTop: 3, background: T.surfaceStrong, border: `1px solid ${T.borderSubtle}`, borderRadius: 10, boxShadow: T.shadowLg, maxHeight: 220, overflowY: "auto" }}>
          {filtered.length === 0
            ? <div style={{ padding: "10px 12px", fontSize: 12, color: T.textMuted }}>No products found</div>
            : filtered.map(p => (
              <div key={p.id} onMouseDown={() => { onChange(p.id); setOpen(false); setQuery(""); }}
                style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${T.borderSubtle}`, background: p.id === value ? T.accentBg : "transparent" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{p.name}</div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
                  {p.sku}{p.gstRate > 0 ? ` · GST ${p.gstRate}%` : ""} · MRP ₹{Number(p.mrp || 0).toLocaleString("en-IN")} · Cost ₹{Number(p.purchasePrice || 0).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/* ─── BillForm ──────────────────────────────────────────────────────────── */
export default function BillForm({ type, bills, onSave, products, vendors, channels, getStock, existingBill }) {
  const T = useT();
  const isEdit = Boolean(existingBill);

  const [date, setDate] = useState(existingBill?.date || today());
  const [channelId, setChannelId] = useState(existingBill?.channelId || "");
  const [vendorId, setVendorId] = useState(existingBill?.vendorId || "");
  const [discount, setDiscount] = useState(existingBill?.discValue?.toString() || "");
  const [discType, setDiscType] = useState(existingBill?.discType || "percent");
  const [notes, setNotes] = useState(existingBill?.notes || "");
  const [items, setItems] = useState(
    existingBill?.items?.map(i => ({
      id: uid(), productId: i.productId, qty: i.qty,
      price: i.price, gstRate: Number(i.gstRate || 0), isDamaged: i.isDamaged || false
    })) || [{ id: uid(), productId: "", qty: 1, price: "", gstRate: 0, isDamaged: false }]
  );

  const billNo = useMemo(() => {
    if (isEdit) return existingBill.billNo;
    const prefix = type === "sale" ? "SALE" : "PUR";
    const n = bills.filter(b => b.type === type).length + 1;
    return `${prefix}-${String(n).padStart(4, "0")}`;
  }, [bills, type, isEdit, existingBill]);

  const addItem = () => setItems(p => [...p, { id: uid(), productId: "", qty: 1, price: "", gstRate: 0, isDamaged: false }]);
  const remItem = id => setItems(p => p.filter(i => i.id !== id));
  const upItem = (id, k, v) => setItems(p => p.map(i => {
    if (i.id !== id) return i;
    const u = { ...i, [k]: v };
    if (k === "productId") {
      const pr = products.find(x => x.id === v);
      if (pr) {
        // Sale: enter MRP (incl GST). Purchase: enter cost (ex-GST)
        u.price = type === "sale" ? pr.mrp : pr.purchasePrice;
        u.gstRate = Number(pr.gstRate || 0);
      }
    }
    return u;
  }));

  const valid = items.filter(i => i.productId && Number(i.qty) > 0 && Number(i.price) >= 0);

  // subtotal = sum of line totals at face price
  // For sale: MRP * qty (incl GST)
  // For purchase: ex-GST cost * qty
  const subtotal = valid.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0);

  // Discount only on sales (applied to incl-GST subtotal)
  const discAmt = type === "sale"
    ? (discType === "percent" ? subtotal * Number(discount || 0) / 100 : Math.min(Number(discount || 0), subtotal))
    : 0;

  // After discount total for sales (still incl GST)
  const saleTotal = subtotal - discAmt;

  // GST calculations
  // SALE: MRP is incl GST → extract GST from discounted total
  //   GST per item = effectiveLineTotal × rate / (100 + rate)
  //   effectiveLineTotal = item line total × (saleTotal / subtotal)
  // PURCHASE: cost is ex-GST → add GST on top
  //   GST per item = lineBase × rate / 100
  const effectiveFactor = subtotal > 0 ? saleTotal / subtotal : 1;
  const totalGst = valid.reduce((s, i) => {
    const rate = Number(i.gstRate || 0);
    const lineBase = Number(i.qty) * Number(i.price);
    if (type === "sale") {
      const effectiveLine = lineBase * effectiveFactor;
      return s + effectiveLine * rate / (100 + rate);
    } else {
      return s + lineBase * rate / 100;
    }
  }, 0);

  // Final totals
  // Sale: total = discounted MRP (incl GST)
  // Purchase: total = ex-GST subtotal + GST
  const total = type === "sale" ? saleTotal : subtotal + totalGst;

  const handleSave = () => {
    if (valid.length === 0) { alert("Add at least one product with qty > 0"); return; }
    if (type === "sale" && !channelId) { alert("Select a sales channel"); return; }
    if (type === "purchase" && !vendorId) { alert("Select a vendor"); return; }

    onSave({
      id: existingBill?.id || uid(),
      billNo, type, date,
      channelId: type === "sale" ? channelId : null,
      vendorId: type === "purchase" ? vendorId : null,
      items: valid.map(i => {
        const rate = Number(i.gstRate || 0);
        const lineBase = Number(i.qty) * Number(i.price);
        let gstPerUnit = 0;
        let effectivePrice = Number(i.price);
        if (type === "sale") {
          // effectivePrice = discounted MRP per unit (incl GST)
          effectivePrice = Number(i.price) * effectiveFactor;
          gstPerUnit = effectivePrice * rate / (100 + rate);
        } else {
          // effectivePrice = ex-GST cost per unit
          effectivePrice = Number(i.price);
          gstPerUnit = effectivePrice * rate / 100;
        }
        return {
          productId: i.productId,
          productName: products.find(p => p.id === i.productId)?.name || "",
          qty: Number(i.qty),
          price: Number(i.price),          // original face price
          effectivePrice,                   // after discount (sale) / ex-GST (purchase)
          gstRate: rate,
          gstAmount: gstPerUnit * Number(i.qty),
          isDamaged: Boolean(i.isDamaged),
          mrp: products.find(p => p.id === i.productId)?.mrp || Number(i.price)
        };
      }),
      subtotal,
      discType, discValue: Number(discount || 0), discAmount: discAmt,
      totalGst: type === "purchase" ? totalGst : 0,
      saleGstInfo: type === "sale" ? totalGst : 0,
      total,
      notes,
      ts: existingBill?.ts || new Date().toISOString(),
      updatedTs: isEdit ? new Date().toISOString() : undefined
    });
  };

  return (
    <form id={type + "-form"} onSubmit={e => { e.preventDefault(); handleSave(); }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ padding: "8px 14px", borderRadius: 10, background: T.accentBg, display: "flex", alignItems: "center", gap: 8 }}>
        <FileText size={14} color={T.accent} />
        <span style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>{billNo}</span>
        {isEdit && <span style={{ fontSize: 10, background: T.amber + "20", color: T.amber, padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>EDITING</span>}
        <span style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto" }}>
          {type === "sale" ? "Sales Bill — prices are MRP (incl. GST)" : "Purchase Order — prices are ex-GST"}
        </span>
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
        <div style={{ border: `1px solid ${T.borderSubtle}`, borderRadius: 12, overflow: "visible" }}>
          <div className="bill-item-hdr">
            {["Product", "Qty", type === "sale" ? "MRP (incl GST)" : "Cost (ex-GST)", "GST", "Line Total", "Dmg", ""].map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.04em" }}>{h.toUpperCase()}</div>
            ))}
          </div>
          {items.map((item, i) => {
            const pr = products.find(p => p.id === item.productId);
            const stk = item.productId ? getStock(item.productId) : null;
            const rate = Number(item.gstRate || 0);
            const lineBase = Number(item.qty || 0) * Number(item.price || 0);
            const effectiveLine = lineBase * effectiveFactor;
            const lineGst = type === "sale"
              ? effectiveLine * rate / (100 + rate)
              : lineBase * rate / 100;
            const lineTotal = type === "sale" ? effectiveLine : lineBase + lineGst;

            return (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 60px 100px 80px 80px 32px 28px", gap: 8, padding: "8px 12px", alignItems: "start", borderTop: `1px solid ${T.borderSubtle}`, overflow: "visible" }}>
                <div style={{ overflow: "visible" }}>
                  <ProductSearch value={item.productId} onChange={v => upItem(item.id, "productId", v)} products={products} placeholder={`Product ${i + 1}`} />
                  {stk !== null && (
                    <div style={{ fontSize: 10, marginTop: 2, color: stk <= 0 ? T.red : stk <= (pr?.minStock || 5) ? T.amber : T.textMuted }}>
                      Stock: {stk}{type === "sale" && stk < Number(item.qty || 0) ? " ⚠️ Low" : ""}
                    </div>
                  )}
                </div>
                <GIn type="number" min="1" value={item.qty} onChange={e => upItem(item.id, "qty", e.target.value)} />
                <GIn type="number" min="0" step="0.01" value={item.price} onChange={e => upItem(item.id, "price", e.target.value)} placeholder="0.00" />
                <div style={{ paddingTop: 2 }}>
                  {rate > 0 && lineBase > 0
                    ? <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: type === "purchase" ? T.amber : T.textMuted }}>
                          {type === "purchase" ? `+${fmtCur(lineGst)}` : fmtCur(lineGst)}
                        </div>
                        <div style={{ fontSize: 9, color: T.textMuted }}>{rate}% {type === "purchase" ? "added" : "incl."}</div>
                      </div>
                    : <span style={{ fontSize: 11, color: T.textMuted }}>—</span>}
                </div>
                <div style={{ paddingTop: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{fmtCur(lineTotal)}</div>
                  {type === "purchase" && rate > 0 && lineBase > 0 && (
                    <div style={{ fontSize: 9, color: T.textMuted }}>base {fmtCur(lineBase)}</div>
                  )}
                  {type === "sale" && discAmt > 0 && lineBase > 0 && (
                    <div style={{ fontSize: 9, color: T.textMuted }}>was {fmtCur(lineBase)}</div>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 6 }}>
                  <input type="checkbox" className="cb" checked={item.isDamaged} onChange={e => upItem(item.id, "isDamaged", e.target.checked)} />
                </div>
                <button type="button" onClick={() => remItem(item.id)} className="btn-danger" style={{ padding: "4px", opacity: items.length <= 1 ? .3 : 1, marginTop: 2 }} disabled={items.length <= 1}>
                  <X size={12} />
                </button>
              </div>
            );
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
                {[{ k: "percent", l: "%" }, { k: "amount", l: "₹" }].map(d => (
                  <button type="button" key={d.k} onClick={() => setDiscType(d.k)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: discType === d.k ? T.accent : "transparent", color: discType === d.k ? "#fff" : T.textMuted, fontSize: 12, fontWeight: 600 }}>{d.l}</button>
                ))}
              </div>
              <GIn type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" />
            </div>
          </Field>
          : <div />
        }
        <div style={{ display: "flex", flexDirection: "column", gap: 5, justifyContent: "flex-end" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.textSub }}>
            <span>{type === "sale" ? "Subtotal (MRP)" : "Subtotal (ex-GST)"}</span>
            <span style={{ fontWeight: 600 }}>{fmtCur(subtotal)}</span>
          </div>
          {type === "sale" && discAmt > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.red }}>
              <span>Discount ({discType === "percent" ? `${discount}%` : `₹${discount}`})</span>
              <span>–{fmtCur(discAmt)}</span>
            </div>
          )}
          {type === "purchase" && totalGst > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.amber }}>
              <span>GST (added)</span>
              <span style={{ fontWeight: 600 }}>+{fmtCur(totalGst)}</span>
            </div>
          )}
          {type === "sale" && totalGst > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textMuted }}>
              <span>GST included in above</span>
              <span>{fmtCur(totalGst)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: T.text, borderTop: `1px solid ${T.borderSubtle}`, paddingTop: 8 }}>
            <span>{type === "sale" ? "Total (incl. GST)" : "Total Payable (incl. GST)"}</span>
            <span style={{ color: T.accent }}>{fmtCur(total)}</span>
          </div>
          {type === "sale" && totalGst > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textMuted }}>
              <span>Net amount (excl. GST)</span>
              <span style={{ fontWeight: 600 }}>{fmtCur(total - totalGst)}</span>
            </div>
          )}
          {type === "purchase" && totalGst > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textMuted }}>
              <span>Your cost (excl. GST)</span>
              <span style={{ fontWeight: 600 }}>{fmtCur(subtotal)}</span>
            </div>
          )}
        </div>
      </div>

      <Field label="Notes / Invoice No.">
        <GTa value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Invoice number, remarks, reference..." />
      </Field>
    </form>
  );
}
