import React, { useRef } from "react";
import { Printer, X } from "lucide-react";
import { useT } from "../theme";
import { GBtn } from "./UI";

/* ── Amount to words (Indian system) ────────────────────────────────────── */
function amountToWords(amount) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function convert(n) {
    if (n <= 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
  }
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let r = convert(rupees) || "Zero";
  return r + " Rupees" + (paise > 0 ? " and " + convert(paise) + " Paise" : "") + " Only";
}

/* ── Invoice HTML generator ──────────────────────────────────────────────── */
function buildInvoiceHTML(bill, invSettings, channels, products) {
  const ch = channels.find(c => c.id === bill.channelId) || {};
  const isIGST = (ch.gstType || "cgst_sgst") === "igst";

  // Build item rows
  const itemRows = (bill.items || []).map(item => {
    const rate = Number(item.gstRate || 0);
    const effPrice = Number(item.effectivePrice || item.price);
    const qty = Number(item.qty);
    const taxablePerUnit = rate > 0 ? effPrice * 100 / (100 + rate) : effPrice;
    const taxableValue = qty * taxablePerUnit;
    const gstAmt = qty * effPrice - taxableValue;
    const pr = products.find(p => p.id === item.productId);

    const gstCols = isIGST
      ? `<td style="text-align:right;padding:6px 8px;">₹${gstAmt.toFixed(2)}</td>`
      : `<td style="text-align:right;padding:6px 8px;">₹${(gstAmt / 2).toFixed(2)}</td><td style="text-align:right;padding:6px 8px;">₹${(gstAmt / 2).toFixed(2)}</td>`;

    return `<tr style="border-bottom:1px solid #eee;">
      <td style="padding:6px 8px;">${item.productName || ""}</td>
      <td style="padding:6px 8px;text-align:center;">${pr?.hsn || "—"}</td>
      <td style="padding:6px 8px;text-align:center;">${qty}</td>
      <td style="text-align:right;padding:6px 8px;">₹${taxablePerUnit.toFixed(2)}</td>
      <td style="text-align:right;padding:6px 8px;">₹${taxableValue.toFixed(2)}</td>
      <td style="text-align:center;padding:6px 8px;">${rate}%</td>
      ${gstCols}
      <td style="text-align:right;padding:6px 8px;font-weight:600;">₹${(qty * effPrice).toFixed(2)}</td>
    </tr>`;
  }).join("");

  const gstHeaderCols = isIGST
    ? `<th style="padding:6px 8px;background:#f5f5f5;border:1px solid #ddd;">IGST</th>`
    : `<th style="padding:6px 8px;background:#f5f5f5;border:1px solid #ddd;">CGST</th><th style="padding:6px 8px;background:#f5f5f5;border:1px solid #ddd;">SGST</th>`;

  const taxableTotal = (bill.items || []).reduce((s, i) => {
    const rate = Number(i.gstRate || 0);
    const effPrice = Number(i.effectivePrice || i.price);
    return s + Number(i.qty) * (rate > 0 ? effPrice * 100 / (100 + rate) : effPrice);
  }, 0);
  const gstTotal = Number(bill.total || 0) - taxableTotal;

  const gstSummaryRows = isIGST
    ? `<tr><td style="padding:4px 0;color:#666;">IGST:</td><td style="text-align:right;padding:4px 0;font-weight:600;">₹${gstTotal.toFixed(2)}</td></tr>`
    : `<tr><td style="padding:4px 0;color:#666;">CGST:</td><td style="text-align:right;padding:4px 0;">₹${(gstTotal / 2).toFixed(2)}</td></tr>
       <tr><td style="padding:4px 0;color:#666;">SGST:</td><td style="text-align:right;padding:4px 0;">₹${(gstTotal / 2).toFixed(2)}</td></tr>`;

  const dateStr = bill.date ? new Date(bill.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Tax Invoice - ${bill.billNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #222; background: #fff; padding: 20px; }
  .invoice-wrapper { max-width: 800px; margin: 0 auto; border: 2px solid #333; padding: 0; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px; border-bottom: 2px solid #333; gap: 20px; }
  .company-info h1 { font-size: 20px; font-weight: 800; color: #B5541A; margin-bottom: 4px; }
  .company-info p { font-size: 12px; color: #555; line-height: 1.6; }
  .invoice-title { text-align: right; }
  .invoice-title h2 { font-size: 22px; font-weight: 900; letter-spacing: 2px; color: #B5541A; }
  .invoice-title p { font-size: 12px; color: #555; margin-top: 4px; }
  .bill-to-row { display: flex; border-bottom: 1px solid #ddd; }
  .bill-to, .invoice-meta { flex: 1; padding: 14px 20px; }
  .bill-to { border-right: 1px solid #ddd; }
  .bill-to h3, .invoice-meta h3 { font-size: 11px; font-weight: 700; color: #888; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 6px; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items th { background: #f5f5f5; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid #ddd; }
  table.items td { border-bottom: 1px solid #eee; vertical-align: middle; }
  .totals-row { display: flex; border-top: 2px solid #333; }
  .amount-words { flex: 1; padding: 14px 20px; border-right: 1px solid #ddd; background: #fafafa; }
  .amount-words p { font-size: 11px; color: #666; margin-bottom: 4px; }
  .amount-words strong { font-size: 12px; color: #222; }
  .summary-table { padding: 14px 20px; min-width: 240px; }
  .summary-table table { width: 100%; }
  .grand-total td { font-weight: 800; font-size: 15px; color: #B5541A; border-top: 2px solid #333; padding-top: 8px; }
  .footer { display: flex; justify-content: space-between; align-items: flex-end; padding: 16px 20px; border-top: 1px solid #ddd; }
  .bank-details p { font-size: 11px; color: #555; line-height: 1.8; }
  .signature { text-align: right; }
  .signature .company-name { font-weight: 700; font-size: 13px; margin-bottom: 40px; }
  .signature .sig-line { border-top: 1px solid #999; padding-top: 6px; font-size: 11px; color: #666; }
  .logo-img { max-height: 60px; max-width: 120px; object-fit: contain; }
  @media print {
    body { padding: 0; }
    .invoice-wrapper { border: none; max-width: 100%; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="invoice-wrapper">
  <div class="header">
    <div style="display:flex;align-items:flex-start;gap:16px;">
      ${invSettings.logoUrl ? `<img src="${invSettings.logoUrl}" class="logo-img" alt="logo"/>` : ""}
      <div class="company-info">
        <h1>${invSettings.businessName || "Your Business"}</h1>
        <p>${invSettings.address1 || ""}${invSettings.address2 ? ", " + invSettings.address2 : ""}</p>
        <p>${invSettings.city || ""}${invSettings.state ? ", " + invSettings.state : ""}${invSettings.pincode ? " - " + invSettings.pincode : ""}</p>
        ${invSettings.gstin ? `<p><strong>GSTIN:</strong> ${invSettings.gstin}</p>` : ""}
        ${invSettings.phone ? `<p>Ph: ${invSettings.phone}</p>` : ""}
        ${invSettings.email ? `<p>${invSettings.email}</p>` : ""}
      </div>
    </div>
    <div class="invoice-title">
      <h2>TAX INVOICE</h2>
      <p style="margin-top:12px;font-size:13px;"><strong>Invoice No:</strong> ${bill.billNo}</p>
      <p><strong>Date:</strong> ${dateStr}</p>
      ${ch.name ? `<p><strong>Channel:</strong> ${ch.name}</p>` : ""}
      <p><strong>GST Type:</strong> ${isIGST ? "IGST (Inter-state)" : "CGST + SGST (Intra-state)"}</p>
    </div>
  </div>

  <div class="bill-to-row">
    <div class="bill-to">
      <h3>Bill To</h3>
      <p style="font-size:14px;font-weight:700;">${ch.name || "Customer"}</p>
      <p style="font-size:12px;color:#555;">Sales Channel</p>
    </div>
    <div class="invoice-meta">
      <h3>Invoice Details</h3>
      <p><strong>Original Invoice:</strong> ${bill.billNo}</p>
      <p><strong>Place of Supply:</strong> ${invSettings.state || "—"}</p>
      ${bill.notes ? `<p><strong>Note:</strong> ${bill.notes}</p>` : ""}
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="padding:8px;background:#f5f5f5;border:1px solid #ddd;">Description</th>
        <th style="padding:8px;background:#f5f5f5;border:1px solid #ddd;text-align:center;">HSN</th>
        <th style="padding:8px;background:#f5f5f5;border:1px solid #ddd;text-align:center;">Qty</th>
        <th style="padding:8px;background:#f5f5f5;border:1px solid #ddd;text-align:right;">Rate (ex-GST)</th>
        <th style="padding:8px;background:#f5f5f5;border:1px solid #ddd;text-align:right;">Taxable Value</th>
        <th style="padding:8px;background:#f5f5f5;border:1px solid #ddd;text-align:center;">GST%</th>
        ${gstHeaderCols}
        <th style="padding:8px;background:#f5f5f5;border:1px solid #ddd;text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
    <tfoot>
      <tr style="background:#fafafa;font-weight:600;">
        <td colspan="4" style="padding:8px;text-align:right;">Subtotal (Taxable)</td>
        <td style="padding:8px;text-align:right;">₹${taxableTotal.toFixed(2)}</td>
        <td></td>
        ${isIGST
          ? `<td style="padding:8px;text-align:right;">₹${gstTotal.toFixed(2)}</td>`
          : `<td style="padding:8px;text-align:right;">₹${(gstTotal / 2).toFixed(2)}</td><td style="padding:8px;text-align:right;">₹${(gstTotal / 2).toFixed(2)}</td>`}
        <td style="padding:8px;text-align:right;">₹${Number(bill.subtotal || 0).toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="totals-row">
    <div class="amount-words">
      <p>Amount in Words:</p>
      <strong>${amountToWords(Number(bill.total || 0))}</strong>
    </div>
    <div class="summary-table">
      <table>
        <tr><td style="padding:4px 0;color:#666;">Subtotal (MRP):</td><td style="text-align:right;padding:4px 0;">₹${Number(bill.subtotal || 0).toFixed(2)}</td></tr>
        ${Number(bill.discAmount || 0) > 0 ? `<tr><td style="padding:4px 0;color:#d00;">Discount (${bill.discType === "percent" ? bill.discValue + "%" : "₹" + bill.discValue}):</td><td style="text-align:right;padding:4px 0;color:#d00;">-₹${Number(bill.discAmount || 0).toFixed(2)}</td></tr>` : ""}
        <tr><td style="padding:4px 0;color:#666;">Taxable Value:</td><td style="text-align:right;padding:4px 0;">₹${taxableTotal.toFixed(2)}</td></tr>
        ${gstSummaryRows}
        <tr class="grand-total"><td>Grand Total:</td><td style="text-align:right;">₹${Number(bill.total || 0).toFixed(2)}</td></tr>
      </table>
    </div>
  </div>

  <div class="footer">
    <div class="bank-details">
      ${invSettings.bankName ? `<p><strong>Bank:</strong> ${invSettings.bankName}</p>` : ""}
      ${invSettings.bankAccount ? `<p><strong>A/C No:</strong> ${invSettings.bankAccount}</p>` : ""}
      ${invSettings.ifsc ? `<p><strong>IFSC:</strong> ${invSettings.ifsc}</p>` : ""}
      ${invSettings.upiId ? `<p><strong>UPI:</strong> ${invSettings.upiId}</p>` : ""}
      ${invSettings.footerText ? `<p style="margin-top:8px;font-style:italic;">${invSettings.footerText}</p>` : ""}
    </div>
    <div class="signature">
      <div class="company-name">For ${invSettings.businessName || "Your Business"}</div>
      <div class="sig-line">Authorized Signatory</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

/* ── Invoice Modal Component ─────────────────────────────────────────────── */
export default function InvoiceModal({ bill, invSettings, channels, products, onClose }) {
  const T = useT();
  const iframeRef = useRef(null);
  if (!bill) return null;

  const html = buildInvoiceHTML(bill, invSettings || {}, channels, products);

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.focus(); win.print(); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: T.surfaceStrong, borderRadius: 18, boxShadow: T.shadowXl, width: "100%", maxWidth: 860, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        {/* Modal Header */}
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${T.borderSubtle}` }}>
          <div>
            <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 16, color: T.text }}>Tax Invoice — {bill.billNo}</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Preview · Click Print / Download PDF to save</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <GBtn onClick={handlePrint} icon={<Printer size={14} />}>Print / Download PDF</GBtn>
            <button onClick={onClose} className="btn-ghost" style={{ padding: "6px 10px" }}><X size={15} /></button>
          </div>
        </div>

        {/* Invoice Preview */}
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          <iframe
            ref={iframeRef}
            srcDoc={html}
            style={{ width: "100%", height: 600, border: "none", borderRadius: 8 }}
            title="Invoice Preview"
          />
        </div>

        {/* Footer note */}
        <div style={{ padding: "10px 20px", borderTop: `1px solid ${T.borderSubtle}`, fontSize: 11, color: T.textMuted }}>
          💡 Click "Print / Download PDF" → in the print dialog, choose "Save as PDF" to download. Set Invoice details in Settings → Invoice.
        </div>
      </div>
    </div>
  );
}
