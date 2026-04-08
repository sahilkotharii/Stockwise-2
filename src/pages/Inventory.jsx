import React, { useState, useMemo, useRef, useEffect } from "react";
import { Box, CheckCircle, AlertTriangle, AlertOctagon, Download, Search, Edit2, X, Plus, Layers, Upload, DollarSign } from "lucide-react";
import { useT } from "../theme";
import { KCard, GBtn, GS, GIn, Field, Modal, StChip, Pager } from "../components/UI";
import { fmtCur, toCSV, dlCSV, uid, today, calcMgn } from "../utils";

export default function Inventory({ ctx }) {
  const T = useT();
  const { products, transactions, categories, getStock, saveTransactions, user, addLog } = ctx;
  const isAdmin = user.role === "admin";

  const [catF, setCatF] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("stock");
  const [pg, setPg] = useState(1);
  const [ps, setPs] = useState(50);
  useEffect(() => setPg(1), [search, catF, sortBy]);

  // ── Bulk Opening Stock CSV ──────────────────────────────────────────────
  const csvRef = useRef(null);
  const handleOsCsvFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = ev.target.result.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { alert("File empty"); return; }
      const hasHeader = lines[0].toLowerCase().includes("sku") || lines[0].toLowerCase().includes("name");
      const headers = hasHeader ? lines[0].toLowerCase().split(",").map(h => h.trim().replace(/[^a-z]/g,"")) : ["name","sku","qty","date"];
      const dataLines = hasHeader ? lines.slice(1) : lines;
      const skuIdx = headers.indexOf("sku"); const nameIdx = headers.indexOf("name");
      const qtyIdx = headers.indexOf("qty"); const dateIdx = headers.indexOf("date");

      let updated = 0;
      const newTxns = [...transactions.filter(t => t.type !== "opening")]; // strip all existing opening
      // Re-add all existing non-matching
      const existingOpening = transactions.filter(t => t.type === "opening");
      dataLines.forEach(line => {
        const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g,""));
        const skuVal = skuIdx >= 0 ? cols[skuIdx] : "";
        const nameVal = nameIdx >= 0 ? cols[nameIdx] : "";
        const qty = parseInt(qtyIdx >= 0 ? cols[qtyIdx] : cols[2]) || 0;
        const dt = dateIdx >= 0 ? cols[dateIdx] : today();
        if (qty <= 0) return;
        const pr = products.find(p =>
          (skuVal && p.sku?.toLowerCase() === skuVal.toLowerCase()) ||
          (nameVal && p.name?.toLowerCase() === nameVal.toLowerCase())
        );
        if (!pr) return;
        newTxns.push({ id: uid(), productId: pr.id, type: "opening", qty, price: Number(pr.purchasePrice||0), effectivePrice: Number(pr.purchasePrice||0), gstRate:0, gstAmount:0, vendorId:null, channelId:null, date: dt||today(), notes:"Bulk opening stock import", userId:user.id, userName:user.name, billId:null, isDamaged:false });
        updated++;
      });
      // Keep opening txns for products not in CSV
      existingOpening.forEach(t => {
        if (!newTxns.find(x => x.productId === t.productId && x.type === "opening")) newTxns.push(t);
      });
      saveTransactions(newTxns);
      addLog("bulk import", "opening stock", `${updated} products`);
      alert(`✅ Updated opening stock for ${updated} products`);
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const exportOsTemplate = () => {
    const header = "name,sku,qty,date";
    const rows = products.slice(0, 3).map(p => {
      const stock = transactions.filter(t=>t.productId===p.id&&t.type==="opening").reduce((s,t)=>s+Number(t.qty),0);
      return `"${p.name}",${p.sku},${stock},${today()}`;
    });
    const csv = [header, ...rows, ...products.slice(3).map(p=>`"${p.name}",${p.sku},0,${today()}`)].join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8,"+encodeURIComponent(csv); a.download = "opening_stock_template.csv"; a.click();
  };

  // ── Edit Opening Stock modal ─────────────────────────────────────────────
  const [editOsModal, setEditOsModal] = useState(false);
  const [editOsProduct, setEditOsProduct] = useState(null);
  const [editOsQty, setEditOsQty] = useState("");
  const [editOsDate, setEditOsDate] = useState(today());

  const openEditOs = (p) => {
    const currentOpening = transactions.filter(t => t.productId === p.id && t.type === "opening").reduce((s, t) => s + Number(t.qty), 0);
    setEditOsProduct(p);
    setEditOsQty(currentOpening.toString());
    setEditOsDate(today());
    setEditOsModal(true);
  };

  const saveEditOs = () => {
    if (!editOsProduct) return;
    const newQty = parseInt(editOsQty) || 0;
    if (newQty < 0) { alert("Quantity cannot be negative"); return; }
    // Remove existing opening transactions for this product
    const filtered = transactions.filter(t => !(t.productId === editOsProduct.id && t.type === "opening"));
    // Add new opening transaction if qty > 0
    const newTxns = newQty > 0
      ? [{
          id: uid(),
          productId: editOsProduct.id,
          type: "opening",
          qty: newQty,
          price: Number(editOsProduct.purchasePrice || 0),
          effectivePrice: Number(editOsProduct.purchasePrice || 0),
          gstRate: 0,
          gstAmount: 0,
          vendorId: null, channelId: null,
          date: editOsDate,
          notes: "Opening stock (edited)",
          userId: user.id, userName: user.name,
          billId: null, isDamaged: false
        }]
      : [];
    saveTransactions([...newTxns, ...filtered]);
    addLog("edited", "opening stock", editOsProduct.name, `Set to ${newQty} units`);
    setEditOsModal(false);
    setEditOsProduct(null);
  };

  // ── Product stats ─────────────────────────────────────────────────────────
  const productStats = useMemo(() => products.map(p => {
    const all = transactions.filter(t => t.productId === p.id);
    const opening = all.filter(t => t.type === "opening").reduce((s, t) => s + Number(t.qty), 0);
    const purchased = all.filter(t => t.type === "purchase").reduce((s, t) => s + Number(t.qty), 0);
    const sold = all.filter(t => t.type === "sale").reduce((s, t) => s + Number(t.qty), 0);
    const salesReturned = all.filter(t => t.type === "return").reduce((s, t) => s + (Number(t.qty)||0), 0);
    const purReturned = all.filter(t => t.type === "purchase_return").reduce((s, t) => s + (Number(t.qty)||0), 0);
    const damaged = all.filter(t => t.type === "damaged" || t.isDamaged).reduce((s, t) => s + (Number(t.qty)||0), 0);
    const stock = getStock(p.id);
    // Inventory value ALWAYS ex-GST (using product's purchasePrice which is ex-GST)
    const value = stock * Number(p.purchasePrice || 0);
    return { ...p, opening, purchased, sold, salesReturned, purReturned, damaged, stock, value };
  }), [products, transactions, getStock]);

  const filtered = useMemo(() => {
    let d = productStats.filter(p => {
      if (catF && p.categoryId !== catF) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.sku || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    if (sortBy === "stock") d.sort((a, b) => a.stock - b.stock);
    else if (sortBy === "value") d.sort((a, b) => b.value - a.value);
    else if (sortBy === "sold") d.sort((a, b) => b.sold - a.sold);
    else if (sortBy === "name") d.sort((a, b) => a.name.localeCompare(b.name));
    return d;
  }, [productStats, catF, search, sortBy]);

  // Inventory value = ex-GST purchase price * stock (correct basis for costing)
  const totalValue = filtered.reduce((s, p) => s + p.value, 0);
  const oos = filtered.filter(p => p.stock <= 0);
  const low = filtered.filter(p => p.stock > 0 && p.stock <= Number(p.minStock || 0));
  const healthy = filtered.filter(p => p.stock > Number(p.minStock || 0));


  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

    {/* KPIs */}
    <div className="kgrid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
      <KCard label="Inventory Value" value={fmtCur(totalValue)} sub={`ex-GST · ${filtered.length} products`} icon={Box} color={T.accent} />
      <KCard label="Healthy Stock" value={healthy.length.toString()} sub="Above min level" icon={CheckCircle} color={T.green} />
      <KCard label="Low Stock" value={low.length.toString()} sub="Below min level" icon={AlertTriangle} color={T.amber} />
      <KCard label="Out of Stock" value={oos.length.toString()} sub="Needs restocking" icon={AlertOctagon} color={T.red} />
    </div>



    {/* Total Inventory Value Banner */}
    <div className="glass" style={{ padding: "14px 20px", borderRadius: 14, background: `linear-gradient(135deg, ${T.accentBg}, ${T.accent}10)`, border: `1px solid ${T.accent}30`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg,${T.accent},${T.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center" }}><DollarSign size={18} color="#fff" /></div>
        <div>
          <div style={{ fontFamily: T.displayFont, fontWeight: 800, fontSize: 22, color: T.accent }}>{fmtCur(totalValue)}</div>
          <div style={{ fontSize: 12, color: T.textSub, marginTop: 1 }}>Total Inventory Value in Hand <span style={{ color: T.textMuted }}>(ex-GST · at purchase price)</span></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ padding: "6px 14px", borderRadius: 99, background: T.greenBg, border: `1px solid ${T.green}25`, fontSize: 12 }}><span style={{ color: T.green, fontWeight: 700 }}>{healthy.length}</span><span style={{ color: T.textMuted }}> healthy</span></div>
        <div style={{ padding: "6px 14px", borderRadius: 99, background: T.amberBg, border: `1px solid ${T.amber}25`, fontSize: 12 }}><span style={{ color: T.amber, fontWeight: 700 }}>{low.length}</span><span style={{ color: T.textMuted }}> low</span></div>
        <div style={{ padding: "6px 14px", borderRadius: 99, background: T.redBg, border: `1px solid ${T.red}25`, fontSize: 12 }}><span style={{ color: T.red, fontWeight: 700 }}>{oos.length}</span><span style={{ color: T.textMuted }}> OOS</span></div>
      </div>
    </div>

    {/* Stock Register */}
    <div className="glass" style={{ borderRadius: T.radius, overflow: "hidden" }}>
      <div style={{ padding: "18px 18px 12px", borderBottom: `1px solid ${T.borderSubtle}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text }}>Stock Register</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Inventory value calculated at ex-GST purchase price</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isAdmin && <>
              <GBtn sz="sm" v="ghost" onClick={exportOsTemplate} icon={<Download size={13} />}>Opening Stock Template</GBtn>
              <GBtn sz="sm" v="ghost" onClick={() => csvRef.current?.click()} icon={<Upload size={13} />}>Import Opening Stock</GBtn>
              <input ref={csvRef} type="file" accept=".csv" onChange={handleOsCsvFile} style={{ display: "none" }} />
            </>}
            <GBtn v="ghost" sz="sm" onClick={() => dlCSV(toCSV(filtered.map(p => ({ name: p.name, sku: p.sku, opening: p.opening, purchased: p.purchased, sold: p.sold, salesReturned: p.salesReturned, purReturned: p.purReturned, damaged: p.damaged, stock: p.stock, value: p.value })), ["name","sku","opening","purchased","sold","salesReturned","purReturned","damaged","stock","value"]), "inventory")} icon={<Download size={13} />}>Export Register</GBtn>
          </div>
        </div>
        <div className="filter-wrap">
          <div style={{ position: "relative", flex: "1 1 160px" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
            <input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product…" style={{ paddingLeft: 30 }} />
          </div>
          <GS value={catF} onChange={e => setCatF(e.target.value)} placeholder="All Categories">
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </GS>
          <GS value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="stock">Sort: Stock ↑</option>
            <option value="value">Sort: Value ↓</option>
            <option value="sold">Sort: Sold ↓</option>
            <option value="name">Sort: Name</option>
          </GS>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: T.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)" }}>
              {["Product", "SKU", "Category", "Opening", "+Purchased", "-Sold", "+Sale Ret", "-Pur Ret", "-Damaged", "= Stock", "Value (ex-GST)", "Status", isAdmin ? "Edit" : ""].filter(Boolean).map(h => (
                <th key={h} className="th" style={{ textAlign: ["Opening", "+Purchased", "-Sold", "+Sale Ret", "-Pur Ret", "-Damaged", "= Stock", "Value (ex-GST)"].includes(h) ? "right" : "left" }}>
                  {h.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice((pg-1)*ps, pg*ps).map(p => {
              const cat = categories.find(c => c.id === p.categoryId);
              return (
                <tr key={p.id} className="trow">
                  <td className="td">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {p.imageUrl && <img src={p.imageUrl} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} onError={e => e.target.style.display = "none"} />}
                      <div>
                        <div style={{ fontWeight: 600, color: T.text, fontSize: 12 }}>{p.name}</div>
                        <div style={{ color: T.textMuted, fontSize:11 }}>{p.alias}</div>
                      </div>
                    </div>
                  </td>
                  <td className="td m" style={{ fontFamily: "monospace", fontSize:11 }}>{p.sku}</td>
                  <td className="td">{cat && <span className="tag" style={{ background: cat.color + "18", color: cat.color }}>{cat.name}</span>}</td>
                  <td className="td r">{p.opening}</td>
                  <td className="td r" style={{ color: T.blue }}>{p.purchased}</td>
                  <td className="td r" style={{ color: T.red }}>-{p.sold}</td>
                  <td className="td r" style={{ color: T.green }}>+{p.salesReturned}</td>
                  <td className="td r" style={{ color: T.red }}>-{p.purReturned}</td>
                  <td className="td r" style={{ color: T.amber }}>-{p.damaged}</td>
                  <td className="td r" style={{ fontWeight: 700, fontSize: 14, color: p.stock <= 0 ? T.red : p.stock <= Number(p.minStock || 0) ? T.amber : T.text }}>{p.stock}</td>
                  <td className="td r" style={{ fontWeight: 600, color: T.accent }}>{fmtCur(p.value)}</td>
                  <td className="td"><StChip stock={p.stock} min={Number(p.minStock || 0)} /></td>
                  {isAdmin && (
                    <td className="td">
                      <button className="btn-ghost" onClick={() => openEditOs(p)} style={{ padding: "4px 8px" }} title="Edit opening stock">
                        <Edit2 size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${T.accent}30` }}>
              <td className="td" style={{ fontWeight: 700, fontSize: 13 }} colSpan={9}>TOTAL</td>
              <td className="td r" style={{ fontWeight: 700, color: T.accent, fontSize: 14 }}>{fmtCur(totalValue)}</td>
              <td className="td" />{isAdmin && <td className="td" />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    {/* Edit Opening Stock Modal */}
    <Modal open={editOsModal} onClose={() => setEditOsModal(false)} title={`Edit Opening Stock: ${editOsProduct?.name}`} width={400}
      footer={<><GBtn v="ghost" onClick={() => setEditOsModal(false)}>Cancel</GBtn><GBtn onClick={saveEditOs} icon={<Layers size={13} />}>Save Opening Stock</GBtn></>}>
      {editOsProduct && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: "10px 14px", borderRadius: 10, background: T.blueBg, border: `1px solid ${T.blue}25`, fontSize: 12, color: T.blue }}>
            Current opening stock: <strong>{transactions.filter(t => t.productId === editOsProduct.id && t.type === "opening").reduce((s, t) => s + Number(t.qty), 0)} units</strong> · Current total stock: <strong>{getStock(editOsProduct.id)} units</strong>
          </div>
          <Field label="New Opening Qty" req>
            <GIn type="number" min="0" value={editOsQty} onChange={e => setEditOsQty(e.target.value)} placeholder="Enter opening stock quantity" />
          </Field>
          <Field label="Date">
            <GIn type="date" value={editOsDate} onChange={e => setEditOsDate(e.target.value)} />
          </Field>
          <div style={{ fontSize: 11, color: T.textMuted, padding: "8px 12px", background: T.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", borderRadius: 8 }}>
            ⚠️ This replaces all existing opening stock entries for this product. Other transactions (purchases, sales) are unaffected.
          </div>
        </div>
      )}
    </Modal>
  </div>;
}
