import React, { useRef } from "react";
import { Printer, X } from "lucide-react";
import { useT } from "../theme";
import { GBtn } from "./UI";

/* ── Amount to words (Indian system) ────────────────────────────────────── */
function amountToWords(n) {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function conv(n) {
    if (!n) return "";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "");
    if (n < 1000) return ones[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + conv(n%100) : "");
    if (n < 100000) return conv(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + conv(n%1000) : "");
    if (n < 10000000) return conv(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + conv(n%100000) : "");
    return conv(Math.floor(n/10000000)) + " Crore" + (n%10000000 ? " " + conv(n%10000000) : "");
  }
  const rupees = Math.floor(n), paise = Math.round((n - rupees)*100);
  return (conv(rupees) || "Zero") + " Rupees" + (paise ? " and " + conv(paise) + " Paise" : "") + " Only";
}

/* ── Build invoice HTML ──────────────────────────────────────────────────── */
function buildHTML(bill, inv, vendor) {
  const isIGST = (bill.gstType || "cgst_sgst") === "igst";
  const dateStr = bill.date ? new Date(bill.date).toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"}) : "";

  // Compute taxable value per item (ex-GST)
  const itemsData = (bill.items || []).map(it => {
    const rate = Number(it.gstRate || 0);
    const effPrice = Number(it.effectivePrice || it.price || 0);
    const qty = Number(it.qty || 0);
    const taxablePerUnit = rate > 0 ? effPrice * 100 / (100 + rate) : effPrice;
    const taxableTotal = qty * taxablePerUnit;
    const gstTotal = qty * effPrice - taxableTotal;
    return { ...it, taxablePerUnit, taxableTotal, gstTotal, rate, effPrice, qty };
  });

  // GST breakdown by rate
  const gstByRate = {};
  itemsData.forEach(it => {
    if (!it.rate) return;
    if (!gstByRate[it.rate]) gstByRate[it.rate] = { taxable: 0, gst: 0 };
    gstByRate[it.rate].taxable += it.taxableTotal;
    gstByRate[it.rate].gst += it.gstTotal;
  });

  const grandTaxable = itemsData.reduce((s,i) => s + i.taxableTotal, 0);
  const grandGst = itemsData.reduce((s,i) => s + i.gstTotal, 0);
  const grandTotal = Number(bill.total || 0);
  const discount = Number(bill.discAmount || 0);

  // Bill To / Ship To
  const billToLines = [];
  if (vendor) {
    if (vendor.name) billToLines.push(`<strong style="font-size:14px">${vendor.name}</strong>`);
    const addrParts = [vendor.address1, vendor.address2].filter(Boolean);
    if (addrParts.length) billToLines.push(addrParts.join(", "));
    const cityState = [vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(", ");
    if (cityState) billToLines.push(cityState);
    if (vendor.gstin) billToLines.push(`<span style="font-family:monospace;font-weight:600">GSTIN: ${vendor.gstin}</span>`);
    if (vendor.phone) billToLines.push(`Ph: ${vendor.phone}`);
    if (vendor.email) billToLines.push(vendor.email);
  } else if (bill.billToAddress) {
    bill.billToAddress.split(",").forEach(p => billToLines.push(p.trim()));
  }

  const shipAddr = bill.shipToSameAsBill !== false ? (billToLines.join(", ")) : (bill.shipTo || "");
  const shipLines = shipAddr ? shipAddr.split(", ").filter(Boolean) : billToLines;

  // Items table rows
  const itemRows = itemsData.map((it, idx) => `
    <tr>
      <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #eee">${idx+1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">
        <div style="font-weight:600">${it.productName || ""}</div>
        ${it.hsnCode || it.hsn ? `<div style="font-size:10px;color:#666">HSN: ${it.hsnCode || it.hsn}</div>` : ""}
      </td>
      <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #eee">${it.unit || "Pcs"}</td>
      <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee">${it.qty}</td>
      <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee">₹${it.taxablePerUnit.toFixed(2)}</td>
      <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee;font-weight:600">₹${it.taxableTotal.toFixed(2)}</td>
      <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee;font-weight:700">₹${(it.qty * it.effPrice).toFixed(2)}</td>
    </tr>`).join("");

  // GST rows for totals
  const gstRows = Object.entries(gstByRate).map(([rate, v]) => {
    if (isIGST) {
      return `<tr><td style="padding:3px 8px;color:#555">IGST @${rate}%</td><td style="padding:3px 8px;text-align:right;font-weight:600">₹${v.gst.toFixed(2)}</td></tr>`;
    } else {
      const half = v.gst / 2;
      const halfRate = (Number(rate) / 2).toFixed(1);
      return `
        <tr><td style="padding:3px 8px;color:#555">CGST @${halfRate}%</td><td style="padding:3px 8px;text-align:right">₹${half.toFixed(2)}</td></tr>
        <tr><td style="padding:3px 8px;color:#555">SGST @${halfRate}%</td><td style="padding:3px 8px;text-align:right">₹${half.toFixed(2)}</td></tr>`;
    }
  }).join("");

  // Footer points
  const footerPoints = inv.footerPoints || ["E & O.E.", "Subject to local jurisdiction.", "Goods once sold will not be taken back."];

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Tax Invoice - ${bill.billNo}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; background: #fff; }
  .page { width: 794px; min-height: 1050px; margin: 0 auto; padding: 24px; display: flex; flex-direction: column; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2px solid #333; gap: 16px; }
  .company h1 { font-size: 20px; font-weight: 900; color: #B5541A; }
  .company p { font-size: 11px; color: #555; line-height: 1.7; }
  .inv-title { text-align: right; }
  .inv-title h2 { font-size: 24px; font-weight: 900; letter-spacing: 3px; color: #B5541A; }
  .inv-title .meta { font-size: 12px; color: #333; margin-top: 6px; line-height: 1.8; }
  .addr-row { display: flex; gap: 0; border: 1px solid #ddd; margin: 12px 0; }
  .addr-box { flex: 1; padding: 10px 14px; }
  .addr-box + .addr-box { border-left: 1px solid #ddd; }
  .addr-label { font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
  .addr-box p { font-size: 12px; color: #333; line-height: 1.7; }
  .eway-box { border: 1px solid #ddd; border-top: none; padding: 8px 14px; background: #fafafa; }
  .eway-grid { display: flex; gap: 24px; font-size: 11px; }
  .eway-grid span { color: #666; }
  .eway-grid strong { color: #222; }
  table.items { width: 100%; border-collapse: collapse; margin: 12px 0 0; }
  table.items thead th { background: #f0f0f0; padding: 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid #ddd; }
  table.items tfoot td { background: #f9f9f9; font-weight: 700; padding: 7px 8px; border-top: 2px solid #ccc; }
  .totals-row { display: flex; gap: 0; border: 1px solid #ddd; border-top: none; }
  .words-box { flex: 1; padding: 10px 14px; background: #fafafa; border-right: 1px solid #ddd; }
  .words-box .label { font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
  .words-box p { font-size: 11px; font-weight: 600; color: #222; }
  .summary { min-width: 260px; padding: 8px 14px; }
  .summary table { width: 100%; border-collapse: collapse; }
  .summary td { padding: 3px 4px; font-size: 12px; }
  .summary .grand td { font-size: 15px; font-weight: 900; color: #B5541A; border-top: 2px solid #B5541A; padding-top: 6px; }
  .footer { display: flex; gap: 0; margin-top: auto; padding-top: 14px; border-top: 1px solid #ddd; }
  .footer-bank { flex: 1; padding-right: 20px; }
  .footer-bank p { font-size: 11px; color: #555; line-height: 1.9; }
  .footer-points { flex: 1; padding: 0 20px; border-left: 1px solid #eee; border-right: 1px solid #eee; }
  .footer-points li { font-size: 11px; color: #555; margin-bottom: 4px; }
  .footer-sign { min-width: 160px; text-align: center; }
  .footer-sign .company-name { font-size: 12px; font-weight: 700; margin-bottom: 50px; }
  .footer-sign .sig-line { border-top: 1px solid #999; padding-top: 4px; font-size: 10px; color: #666; }
  .gst-badge { display: inline-block; padding: 2px 10px; background: #f0f4ff; border: 1px solid #bcd; border-radius: 99px; font-size: 10px; font-weight: 700; color: #446; margin-top: 4px; }
  @media print {
    .page { width: 100%; padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="company" style="display:flex;gap:14px;align-items:flex-start">
      ${inv.logoUrl ? `<img src="${inv.logoUrl}" style="height:56px;max-width:120px;object-fit:contain" alt="logo"/>` : ""}
      <div>
        <h1>${inv.businessName || "Your Business"}</h1>
        <p>
          ${[inv.address1, inv.address2, inv.city, inv.state, inv.pincode].filter(Boolean).join(", ")}<br/>
          ${inv.gstin ? `GSTIN: <strong>${inv.gstin}</strong><br/>` : ""}
          ${inv.phone ? `Ph: ${inv.phone}` : ""}${inv.email ? ` &nbsp;|&nbsp; ${inv.email}` : ""}
        </p>
      </div>
    </div>
    <div class="inv-title">
      <h2>TAX INVOICE</h2>
      <div class="meta">
        <div><strong>Invoice No:</strong> ${bill.billNo || "—"}</div>
        <div><strong>Date:</strong> ${dateStr}</div>
        ${bill.purchaseInvoiceNo ? `<div><strong>Ref No:</strong> ${bill.purchaseInvoiceNo}</div>` : ""}
      </div>
      <div class="gst-badge">${isIGST ? "IGST (Inter-state)" : "CGST + SGST (Intra-state)"}</div>
    </div>
  </div>

  <!-- BILL TO / SHIP TO -->
  <div class="addr-row">
    <div class="addr-box">
      <div class="addr-label">Bill To</div>
      <p>${billToLines.join("<br/>") || "—"}</p>
    </div>
    <div class="addr-box">
      <div class="addr-label">Ship To</div>
      <p>${shipLines.length > 0 ? shipLines.join("<br/>") : billToLines.join("<br/>") || "—"}</p>
    </div>
    <div class="addr-box" style="max-width:200px">
      <div class="addr-label">Sold By</div>
      <p>
        <strong>${inv.businessName || "—"}</strong><br/>
        ${inv.state ? `State: ${inv.state}` : ""}
        ${inv.gstin ? `<br/>GSTIN: ${inv.gstin}` : ""}
      </p>
    </div>
  </div>

  <!-- E-WAY BILL -->
  ${bill.ewayBill ? `
  <div class="eway-box">
    <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">E-Way Bill Details</div>
    <div class="eway-grid">
      ${bill.ewayBillNo ? `<div><span>EWB No: </span><strong>${bill.ewayBillNo}</strong></div>` : ""}
      ${bill.transportName ? `<div><span>Transporter: </span><strong>${bill.transportName}</strong></div>` : ""}
      ${bill.vehicleNo ? `<div><span>Vehicle: </span><strong>${bill.vehicleNo}</strong></div>` : ""}
    </div>
  </div>` : ""}

  <!-- ITEMS TABLE -->
  <table class="items">
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th style="text-align:left">Description of Goods / Services</th>
        <th style="width:50px">Unit</th>
        <th style="width:45px">Qty</th>
        <th style="width:100px;text-align:right">Rate (ex-GST)</th>
        <th style="width:110px;text-align:right">Taxable Value</th>
        <th style="width:110px;text-align:right">Total (incl. GST)</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align:right;padding:7px 8px">Totals</td>
        <td style="text-align:right;padding:7px 8px">₹${grandTaxable.toFixed(2)}</td>
        <td style="text-align:right;padding:7px 8px">₹${grandTotal.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- AMOUNT IN WORDS + SUMMARY -->
  <div class="totals-row">
    <div class="words-box">
      <div class="label">Amount in Words</div>
      <p>${amountToWords(grandTotal)}</p>
    </div>
    <div class="summary">
      <table>
        <tr><td style="color:#555">Subtotal (ex-GST)</td><td style="text-align:right">₹${grandTaxable.toFixed(2)}</td></tr>
        ${discount > 0 ? `<tr><td style="color:#c00">Discount</td><td style="text-align:right;color:#c00">-₹${discount.toFixed(2)}</td></tr>` : ""}
        ${gstRows}
        <tr><td style="color:#555;padding-top:4px">Total GST</td><td style="text-align:right;padding-top:4px;font-weight:600">₹${grandGst.toFixed(2)}</td></tr>
        <tr class="grand"><td>Grand Total</td><td style="text-align:right">₹${grandTotal.toFixed(2)}</td></tr>
      </table>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-bank">
      <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px">Bank Details</div>
      ${inv.bankName ? `<p>Bank: <strong>${inv.bankName}</strong></p>` : ""}
      ${inv.bankAccount ? `<p>A/C No: <strong>${inv.bankAccount}</strong></p>` : ""}
      ${inv.ifsc ? `<p>IFSC: <strong>${inv.ifsc}</strong></p>` : ""}
      ${inv.upiId ? `<p>UPI: <strong>${inv.upiId}</strong></p>` : ""}
    </div>
    <div class="footer-points">
      <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px">Terms & Conditions</div>
      <ul style="padding-left:16px">
        ${footerPoints.map(p => `<li>${p}</li>`).join("")}
      </ul>
    </div>
    <div class="footer-sign">
      <div class="company-name">For ${inv.businessName || "Your Business"}</div>
      ${inv.signatureUrl ? `<img src="${inv.signatureUrl}" style="height:40px;max-width:140px;object-fit:contain;margin-bottom:6px" alt="signature"/>` : ""}
      <div class="sig-line">Authorized Signatory</div>
    </div>
  </div>

</div>
</body>
</html>`;
}

/* ── InvoiceModal Component ──────────────────────────────────────────────── */
export default function InvoiceModal({ bill, invSettings, vendors, products, onClose }) {
  const T = useT();
  if (!bill) return null;

  const vendor = vendors?.find(v => v.id === bill.vendorId) || null;
  const html = buildHTML(bill, invSettings || {}, vendor);

  const handlePrint = () => {
    const win = window.open("", "_blank", "width=900,height=700");
    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 400); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: "12px" }}>
      <div style={{ background: T.surfaceStrong, borderRadius: 18, boxShadow: T.shadowXl, width: "100%", maxWidth: 880, maxHeight: "95vh", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${T.borderSubtle}`, flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text }}>Tax Invoice — {bill.billNo}</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>A4 Preview · Print → Save as PDF to download</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <GBtn onClick={handlePrint} icon={<Printer size={14} />}>Print / Download PDF</GBtn>
            <button onClick={onClose} className="btn-ghost" style={{ padding: "6px 10px" }}><X size={15} /></button>
          </div>
        </div>

        {/* Preview — scales down on mobile */}
        <div style={{ flex: 1, overflow: "auto", padding: "12px", background: T.isDark ? "#1a1a1a" : "#e8e8e8" }}>
          <div style={{
            transformOrigin: "top center",
            transform: typeof window !== "undefined" && window.innerWidth < 800 ? `scale(${Math.min(1, (window.innerWidth - 24) / 794)})` : "scale(1)",
            marginBottom: typeof window !== "undefined" && window.innerWidth < 800 ? `-${794 * (1 - Math.min(1, (window.innerWidth - 24) / 794))}px` : "0"
          }}>
            <iframe
              srcDoc={html}
              style={{ width: "794px", height: "1080px", border: "none", borderRadius: 4, background: "#fff", display: "block" }}
              title="Invoice Preview"
            />
          </div>
        </div>

        {/* Footer note */}
        <div style={{ padding: "8px 18px", borderTop: `1px solid ${T.borderSubtle}`, fontSize: 11, color: T.textMuted, flexShrink: 0 }}>
          💡 In print dialog: set Destination → "Save as PDF", Paper size → A4, Margins → None.
          Set invoice details in <strong>Settings → Invoice</strong>.
        </div>
      </div>
    </div>
  );
}
