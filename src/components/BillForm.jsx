import React, { useState, useMemo, useRef, useEffect } from "react";
import { Plus, X, FileText, Search, ChevronDown, ChevronUp, Truck } from "lucide-react";
import { useT } from "../theme";
import { uid, today, fmtCur } from "../utils";
import { GIn, GS, GTa, GBtn, Lbl, Field } from "./UI";
import VendorSearch from "./VendorSearch";

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
        <input className="inp" style={{ paddingLeft: 26 }}
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
                <div style={{ fontSize:11, color: T.textMuted, marginTop: 1 }}>
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
export default function BillForm({ type, bills, onSave, products, vendors, getStock, existingBill, invoiceSettings }) {
  const T = useT();
  const isEdit = Boolean(existingBill);

  const [date, setDate] = useState(existingBill?.date || today());
  const [vendorId, setVendorId] = useState(existingBill?.vendorId || "");
  const [discount, setDiscount] = useState(existingBill?.discValue?.toString() || "");
  const [discType, setDiscType] = useState(existingBill?.discType || "percent");
  const [notes, setNotes] = useState(existingBill?.notes || "");
  const [gstType, setGstType] = useState(existingBill?.gstType || "cgst_sgst");
  const [paymentMode, setPaymentMode] = useState(existingBill?.paymentMode || "");
  const [purchaseInvoiceNo, setPurchaseInvoiceNo] = useState(existingBill?.purchaseInvoiceNo || "");
  // Ship-to (for sales)
  const [shipTo, setShipTo] = useState(existingBill?.shipTo || "");
  const [shipToSameAsBill, setShipToSameAsBill] = useState(!existingBill?.shipTo || existingBill?.shipToSameAsBill !== false);
  // Eway bill
  const [ewayBill, setEwayBill] = useState(existingBill?.ewayBill || false);
  const [ewayBillNo, setEwayBillNo] = useState(existingBill?.ewayBillNo || "");
  const [transportName, setTransportName] = useState(existingBill?.transportName || "");
  const [vehicleNo, setVehicleNo] = useState(existingBill?.vehicleNo || "");

  const [items, setItems] = useState(
    existingBill?.items?.map(i => ({
      id: uid(), productId: i.productId, qty: i.qty,
      price: i.price, gstRate: Number(i.gstRate || 0), isDamaged: i.isDamaged || false
    })) || [{ id: uid(), productId: "", qty: 1, price: "", gstRate: 0, isDamaged: false }]
  );

  // Auto-populate shipTo from bill address when vendor changes (for sales)
  useEffect(() => {
    if (type !== "sale") return;
    const v = (vendors||[]).find(x => x.id === vendorId);
    if (v && shipToSameAsBill) {
      const addr = [v.name, v.address1, v.address2, v.city, v.state, v.pincode].filter(Boolean).join(", ");
      setShipTo(addr);
    }
  }, [vendorId, shipToSameAsBill]);

  // Bill number generation — uses series from invoiceSettings
  const billNo = useMemo(() => {
    if (isEdit) return existingBill.billNo;
    if (type === "sale") {
      const prefix = invoiceSettings?.saleSeries || "SALE-";
      const startNum = Number(invoiceSettings?.saleSeriesStart || 1);
      const existing = (bills||[]).filter(b => b.type === "sale").length;
      return `${prefix}${String(startNum + existing).padStart(4, "0")}`;
    } else {
      // Purchase: no auto number — user enters vendor's invoice number
      return purchaseInvoiceNo || "";
    }
  }, [bills, type, isEdit, existingBill, invoiceSettings, purchaseInvoiceNo]);

  const addItem = () => setItems(p => [...p, { id: uid(), productId: "", qty: 1, price: "", gstRate: 0, isDamaged: false }]);
  const remItem = id => setItems(p => p.filter(i => i.id !== id));
  const upItem = (id, k, v2) => setItems(p => p.map(i => {
    if (i.id !== id) return i;
    const u = { ...i, [k]: v2 };
    if (k === "productId") {
      const pr = products.find(x => x.id === v2);
      if (pr) { u.price = type === "sale" ? pr.mrp : pr.purchasePrice; u.gstRate = Number(pr.gstRate || 0); }
    }
    return u;
  }));

  const valid = items.filter(i => i.productId && Number(i.qty) > 0 && Number(i.price) >= 0);
  const vendorList = vendors || [];
  const subtotal = valid.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0);
  const discAmt = type === "sale"
    ? (discType === "percent" ? subtotal * Number(discount || 0) / 100 : Math.min(Number(discount || 0), subtotal))
    : 0;
  const saleTotal = subtotal - discAmt;
  const effectiveFactor = subtotal > 0 ? saleTotal / subtotal : 1;

  const totalGst = valid.reduce((s, i) => {
    const rate = Number(i.gstRate || 0);
    const lineBase = Number(i.qty) * Number(i.price);
    return s + (type === "sale"
      ? lineBase * effectiveFactor * rate / (100 + rate)
      : lineBase * rate / 100);
  }, 0);

  const total = type === "sale" ? saleTotal : subtotal + totalGst;

  const handleSave = () => {
    if (type === "purchase" && !purchaseInvoiceNo && !isEdit) {
      alert("Please enter the vendor's invoice number"); return;
    }
    if (valid.length === 0) { alert("Add at least one product with qty > 0"); return; }
    if (!vendorId) { alert("Select a vendor"); return; }

    const selectedVendor = (vendors||[]).find(v => v.id === vendorId);
    const billToAddress = selectedVendor
      ? [selectedVendor.name, selectedVendor.address1, selectedVendor.address2, selectedVendor.city, selectedVendor.state, selectedVendor.pincode].filter(Boolean).join(", ")
      : "";

    onSave({
      id: existingBill?.id || uid(),
      billNo: type === "purchase" ? purchaseInvoiceNo : billNo,
      type, date, vendorId,
      gstType,
      billToAddress,
      shipTo: type === "sale" ? (shipToSameAsBill ? billToAddress : shipTo) : "",
      shipToSameAsBill: type === "sale" ? shipToSameAsBill : true,
      ewayBill: type === "sale" ? ewayBill : false,
      ewayBillNo: type === "sale" && ewayBill ? ewayBillNo : "",
      transportName: type === "sale" && ewayBill ? transportName : "",
      vehicleNo: type === "sale" && ewayBill ? vehicleNo : "",
      items: valid.map(i => {
        const rate = Number(i.gstRate || 0);
        const lineBase = Number(i.qty) * Number(i.price);
        let gstPerUnit = 0, effectivePrice = Number(i.price);
        if (type === "sale") {
          effectivePrice = Number(i.price) * effectiveFactor;
          gstPerUnit = effectivePrice * rate / (100 + rate);
        } else {
          gstPerUnit = effectivePrice * rate / 100;
        }
        return {
          productId: i.productId,
          productName: products.find(p => p.id === i.productId)?.name || "",
          hsn: products.find(p => p.id === i.productId)?.hsn || "",
          unit: products.find(p => p.id === i.productId)?.unit || "Pcs",
          qty: Number(i.qty),
          price: Number(i.price),
          effectivePrice,
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
      purchaseInvoiceNo: type === "purchase" ? purchaseInvoiceNo : "",
      ts: existingBill?.ts || new Date().toISOString(),
      updatedTs: isEdit ? new Date().toISOString() : undefined
    });
  };

  const selectedVendor = (vendors||[]).find(v => v.id === vendorId);

  return (
    <form id={type + "-form"} onSubmit={e => { e.preventDefault(); handleSave(); }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Header bar */}
      <div style={{ padding: "8px 14px", borderRadius: 10, background: T.accentBg, display: "flex", alignItems: "center", gap: 8 }}>
        <FileText size={14} color={T.accent} />
        {type === "sale"
          ? <span style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>{billNo || "Series not set"}</span>
          : <span style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>{purchaseInvoiceNo || "Enter vendor invoice no."}</span>}
        {isEdit && <span style={{ fontSize:11, background: T.amber + "20", color: T.amber, padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>EDITING</span>}
        <span style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto" }}>
          {type === "sale" ? "Sales Bill — MRP incl. GST" : "Purchase Order — cost ex-GST"}
        </span>
      </div>

      {/* Purchase invoice number */}
      {type === "purchase" && (
        <Field label="Vendor Invoice Number" req>
          <GIn value={purchaseInvoiceNo} onChange={e => setPurchaseInvoiceNo(e.target.value)} placeholder="Enter the invoice no. from vendor's bill (e.g. INV-2425-001)" />
        </Field>
      )}

      {/* Date + Vendor */}
      <div className="fgrid">
        <Field label="Date" req><GIn type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Vendor" req>
          <VendorSearch value={vendorId} onChange={v => setVendorId(v)} vendors={vendors||[]} placeholder="Search vendor by name, city, GSTIN…" />
        </Field>
      </div>

      {/* Vendor details preview */}
      {selectedVendor && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: T.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${T.borderSubtle}`, fontSize: 11, color: T.textSub }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {[selectedVendor.address1, selectedVendor.city, selectedVendor.state].filter(Boolean).length > 0 && (
              <div><span style={{ color: T.textMuted }}>Address: </span>{[selectedVendor.address1, selectedVendor.address2, selectedVendor.city, selectedVendor.state, selectedVendor.pincode].filter(Boolean).join(", ")}</div>
            )}
            {selectedVendor.gstin && <div><span style={{ color: T.textMuted }}>GSTIN: </span><span style={{ fontFamily: "monospace", fontWeight: 600 }}>{selectedVendor.gstin}</span></div>}
            {selectedVendor.contact && <div><span style={{ color: T.textMuted }}>Contact: </span>{selectedVendor.contact}</div>}
          </div>
        </div>
      )}

      {/* GST Type toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.05em" }}>GST TYPE</span>
        <div style={{ display: "flex", gap: 2, background: T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)", borderRadius: 10, padding: 3 }}>
          {[{ k: "cgst_sgst", l: "CGST + SGST", sub: "Intra-state" }, { k: "igst", l: "IGST", sub: "Inter-state" }].map(g => (
            <button type="button" key={g.k} onClick={() => setGstType(g.k)} style={{ padding: "5px 14px", borderRadius: 8, border: "none", cursor: "pointer", background: gstType === g.k ? T.accent : "transparent", color: gstType === g.k ? "#fff" : T.textMuted, fontSize: 12, fontWeight: 600, transition: "all .15s" }}>
              {g.l} <span style={{ fontSize:11, opacity: .8 }}>({g.sub})</span>
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: gstType === "igst" ? T.blue : T.green }}>
          {gstType === "igst" ? "Full GST as IGST on invoice" : "GST split CGST 50% + SGST 50%"}
        </span>
      </div>

      {/* Ship-to address (sales only) */}
      {type === "sale" && (
        <div style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${T.borderSubtle}`, background: T.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: shipToSameAsBill ? 0 : 10 }}>
            <Truck size={13} color={T.textMuted} />
            <span style={{ fontSize: 12, fontWeight: 600, color: T.textSub }}>Ship To</span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" id="sameAsBill" checked={shipToSameAsBill} onChange={e => setShipToSameAsBill(e.target.checked)} style={{ accentColor: T.accent, cursor: "pointer" }} />
              <label htmlFor="sameAsBill" style={{ fontSize: 11, color: T.textMuted, cursor: "pointer" }}>Same as Bill To</label>
            </div>
          </div>
          {!shipToSameAsBill && (
            <GTa value={shipTo} onChange={e => setShipTo(e.target.value)} rows={2} placeholder="Shipping address (if different)" style={{ marginTop: 8 }} />
          )}
        </div>
      )}

      {/* Products */}
      <div>
        <Lbl c="Products" req />
        <div style={{ border: `1px solid ${T.borderSubtle}`, borderRadius: 12, overflow: "visible" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 100px 90px 28px", gap: 8, padding: "8px 12px", background: T.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}>
            {["Product", "Qty", type === "sale" ? "MRP (incl GST)" : "Cost (ex-GST)", "Line Total", ""].map((h, i) => (
              <div key={i} style={{ fontSize:11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.04em" }}>{h.toUpperCase()}</div>
            ))}
          </div>
          {items.map((item, i) => {
            const pr = products.find(p => p.id === item.productId);
            const stk = item.productId ? getStock(item.productId) : null;
            const rate = Number(item.gstRate || 0);
            const lineBase = Number(item.qty || 0) * Number(item.price || 0);
            const effectiveLine = lineBase * effectiveFactor;
            const lineGst = type === "sale" ? effectiveLine * rate / (100 + rate) : lineBase * rate / 100;
            const lineTotal = type === "sale" ? effectiveLine : lineBase + lineGst;

            return (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 60px 100px 90px 28px", gap: 8, padding: "8px 12px", alignItems: "start", borderTop: `1px solid ${T.borderSubtle}`, overflow: "visible" }}>
                <div style={{ overflow: "visible" }}>
                  <ProductSearch value={item.productId} onChange={v => upItem(item.id, "productId", v)} products={products} placeholder={`Product ${i + 1}`} />
                  {stk !== null && (
                    <div style={{ fontSize:11, marginTop: 2, color: stk <= 0 ? T.red : stk <= (pr?.minStock || 5) ? T.amber : T.textMuted }}>
                      Stock: {stk}{type === "sale" && stk < Number(item.qty || 0) ? " ⚠️" : ""}
                      {rate > 0 && <span style={{ marginLeft: 6, color: T.textMuted }}>GST {rate}%</span>}
                    </div>
                  )}
                </div>
                <GIn type="number" min="1" value={item.qty} onChange={e => upItem(item.id, "qty", e.target.value)} />
                <div>
                  <GIn type="number" min="0" step="0.01" value={item.price} onChange={e => upItem(item.id, "price", e.target.value)} placeholder="0.00" />
                  {rate > 0 && lineBase > 0 && (
                    <div style={{ fontSize:11, marginTop: 2, color: T.textMuted }}>
                      {type === "purchase" ? `+GST: ${fmtCur(lineGst)}` : `GST: ${fmtCur(lineGst)}`}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{fmtCur(lineTotal)}</div>
                  {discAmt > 0 && lineBase > 0 && type === "sale" && (
                    <div style={{ fontSize:11, color: T.textMuted }}>was {fmtCur(lineBase)}</div>
                  )}
                </div>
                <button type="button" onClick={() => remItem(item.id)} className="btn-danger" style={{ padding: "4px", marginTop: 2, opacity: items.length <= 1 ? .3 : 1 }} disabled={items.length <= 1}>
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

      {/* Discount + Summary */}
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
              <span>GST</span><span style={{ fontWeight: 600 }}>+{fmtCur(totalGst)}</span>
            </div>
          )}
          {type === "sale" && totalGst > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textMuted }}>
              <span>GST incl. in total</span><span>{fmtCur(totalGst)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: T.text, borderTop: `1px solid ${T.borderSubtle}`, paddingTop: 8 }}>
            <span>Total</span>
            <span style={{ color: T.accent }}>{fmtCur(total)}</span>
          </div>
          {type === "sale" && totalGst > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textMuted }}>
              <span>Net excl. GST</span><span style={{ fontWeight: 600 }}>{fmtCur(total - totalGst)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Eway Bill (sales only) */}
      {type === "sale" && (
        <div style={{ border: `1px solid ${T.borderSubtle}`, borderRadius: 12, overflow: "hidden" }}>
          <button type="button" onClick={() => setEwayBill(p => !p)} style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", color: T.text }}>
            <input type="checkbox" checked={ewayBill} readOnly style={{ accentColor: T.accent, pointerEvents: "none" }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>E-Way Bill Required</span>
            {ewayBill ? <ChevronUp size={14} color={T.textMuted} style={{ marginLeft: "auto" }} /> : <ChevronDown size={14} color={T.textMuted} style={{ marginLeft: "auto" }} />}
          </button>
          {ewayBill && (
            <div className="fgrid" style={{ padding: "0 14px 14px" }}>
              <Field label="E-Way Bill No."><GIn value={ewayBillNo} onChange={e => setEwayBillNo(e.target.value)} placeholder="EWB-XXXX-XXXX" /></Field>
              <Field label="Transporter Name"><GIn value={transportName} onChange={e => setTransportName(e.target.value)} placeholder="Transport company name" /></Field>
              <Field label="Vehicle No." cl="s2"><GIn value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} placeholder="MH 12 AB 1234" /></Field>
            </div>
          )}
        </div>
      )}

      {/* Payment Mode */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.05em" }}>PAYMENT MODE</span>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {["Cash", "NEFT / RTGS", "UPI", "Cheque", "Credit", "On Account"].map(pm => (
            <button type="button" key={pm} onClick={() => setPaymentMode(paymentMode === pm ? "" : pm)} style={{ padding: "4px 12px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: `1px solid ${paymentMode === pm ? T.accent : T.borderSubtle}`, cursor: "pointer", background: paymentMode === pm ? T.accent : "transparent", color: paymentMode === pm ? "#fff" : T.textSub, transition: "all .15s" }}>{pm}</button>
          ))}
        </div>
      </div>

      <Field label="Notes / Reference">
        <GTa value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Remarks, reference, instructions…" />
      </Field>
    </form>
  );
}
