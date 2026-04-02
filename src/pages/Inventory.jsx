import React, { useState, useMemo } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Box, CheckCircle, AlertTriangle, AlertOctagon, Download, Search, Plus, X, Layers } from "lucide-react";
import { useT } from "../theme";
import { PC } from "../theme";
import { KCard, GBtn, GS, GIn, Field, Modal, StChip } from "../components/UI";
import { fmtCur, toCSV, dlCSV, uid, today } from "../utils";

export default function Inventory({ ctx }) {
  const T = useT();
  const { products, transactions, categories, getStock, saveTransactions, user, addLog } = ctx;
  const [catF, setCatF] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("stock");

  // ── Opening Stock modal state ────────────────────────────────────────────
  const [osModal, setOsModal] = useState(false);
  const [osDate, setOsDate] = useState(today());
  const [osNotes, setOsNotes] = useState("");
  // rows: [{id, productId, qty}]
  const [osRows, setOsRows] = useState([{ id: uid(), productId: "", qty: "" }]);

  const addOsRow = () => setOsRows(p => [...p, { id: uid(), productId: "", qty: "" }]);
  const remOsRow = id => setOsRows(p => p.filter(r => r.id !== id));
  const upOsRow = (id, k, v) => setOsRows(p => p.map(r => r.id === id ? { ...r, [k]: v } : r));

  const saveOpeningStock = () => {
    const valid = osRows.filter(r => r.productId && Number(r.qty) > 0);
    if (valid.length === 0) { alert("Add at least one product with qty > 0"); return; }
    const newTxns = valid.map(r => ({
      id: uid(),
      productId: r.productId,
      type: "opening",
      qty: Number(r.qty),
      price: Number(products.find(p => p.id === r.productId)?.purchasePrice || 0),
      vendorId: null,
      channelId: null,
      date: osDate,
      notes: osNotes || "Opening stock entry",
      userId: user.id,
      userName: user.name,
      billId: null,
      isDamaged: false
    }));
    saveTransactions([...newTxns, ...transactions]);
    addLog("created", "opening stock", `${valid.length} product${valid.length !== 1 ? "s" : ""}`);
    setOsModal(false);
    setOsRows([{ id: uid(), productId: "", qty: "" }]);
    setOsNotes("");
    setOsDate(today());
  };

  // ── Stats ────────────────────────────────────────────────────────────────
  const productStats = useMemo(() => products.map(p => {
    const all = transactions.filter(t => t.productId === p.id);
    const opening = all.filter(t => t.type === "opening").reduce((s, t) => s + Number(t.qty), 0);
    const purchased = all.filter(t => t.type === "purchase").reduce((s, t) => s + Number(t.qty), 0);
    const sold = all.filter(t => t.type === "sale").reduce((s, t) => s + Number(t.qty), 0);
    const returned = all.filter(t => t.type === "return").reduce((s, t) => s + Number(t.qty), 0);
    const damaged = all.filter(t => t.type === "damaged" || t.isDamaged).reduce((s, t) => s + Number(t.qty), 0);
    const stock = getStock(p.id);
    const value = stock * Number(p.purchasePrice);
    return { ...p, opening, purchased, sold, returned, damaged, stock, value };
  }), [products, transactions, getStock]);

  const filtered = useMemo(() => {
    let d = productStats.filter(p => {
      if (catF && p.categoryId !== catF) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    if (sortBy === "stock") d.sort((a, b) => a.stock - b.stock);
    else if (sortBy === "value") d.sort((a, b) => b.value - a.value);
    else if (sortBy === "sold") d.sort((a, b) => b.sold - a.sold);
    else if (sortBy === "name") d.sort((a, b) => a.name.localeCompare(b.name));
    return d;
  }, [productStats, catF, search, sortBy]);

  const totalValue = filtered.reduce((s, p) => s + p.value, 0);
  const oos = filtered.filter(p => p.stock <= 0);
  const low = filtered.filter(p => p.stock > 0 && p.stock <= p.minStock);
  const healthy = filtered.filter(p => p.stock > p.minStock);

  const catBreakdown = useMemo(() => {
    const m = {};
    productStats.forEach(p => {
      const cat = categories.find(c => c.id === p.categoryId);
      const n = cat?.name || "Other";
      const col = cat?.color || T.textMuted;
      if (!m[n]) m[n] = { name: n, value: 0, units: 0, color: col };
      m[n].value += p.value;
      m[n].units += p.stock;
    });
    return Object.values(m).sort((a, b) => b.value - a.value);
  }, [productStats, categories]);

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

    {/* KPI row */}
    <div className="kgrid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
      <KCard label="Total Inventory Value" value={fmtCur(totalValue)} sub={`${filtered.length} products`} icon={Box} color={T.accent} />
      <KCard label="Healthy Stock" value={healthy.length.toString()} sub="Above min level" icon={CheckCircle} color={T.green} />
      <KCard label="Low Stock" value={low.length.toString()} sub="Below min level" icon={AlertTriangle} color={T.amber} />
      <KCard label="Out of Stock" value={oos.length.toString()} sub="Needs restocking" icon={AlertOctagon} color={T.red} />
    </div>

    {/* Charts */}
    <div className="chart-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
      <div className="glass" style={{ padding: "18px 18px 10px", borderRadius: T.radius }}>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Stock Levels by Product</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={filtered.slice(0, 10)} layout="vertical" margin={{ left: 100 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="alias" tick={{ fontSize: 10, fill: T.textMuted }} width={100} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, n) => n === "Stock" ? v : fmtCur(v)} contentStyle={{ background: T.surfaceStrong, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 11 }} />
            <Bar dataKey="stock" name="Stock" fill={T.accent} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="glass" style={{ padding: 18, borderRadius: T.radius }}>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>Value by Category</div>
        <ResponsiveContainer width="100%" height={140}>
          <PieChart>
            <Pie data={catBreakdown} cx="50%" cy="50%" outerRadius={60} dataKey="value" paddingAngle={3}>
              {catBreakdown.map((_, i) => <Cell key={i} fill={catBreakdown[i].color || PC[i % PC.length]} />)}
            </Pie>
            <Tooltip formatter={v => fmtCur(v)} contentStyle={{ background: T.surfaceStrong, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
          {catBreakdown.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color || PC[i % PC.length] }} />
                <span style={{ color: T.textSub }}>{c.name}</span>
              </div>
              <span style={{ fontWeight: 600, color: T.text }}>{fmtCur(c.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Stock Register */}
    <div className="glass" style={{ borderRadius: T.radius, overflow: "hidden" }}>
      <div style={{ padding: "18px 18px 12px", borderBottom: `1px solid ${T.borderSubtle}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text }}>Stock Register</div>
          <div style={{ display: "flex", gap: 8 }}>
            <GBtn sz="sm" onClick={() => setOsModal(true)} icon={<Layers size={13} />}>Opening Stock</GBtn>
            <GBtn v="ghost" sz="sm" onClick={() => dlCSV(toCSV(filtered, ["name", "sku", "opening", "purchased", "sold", "returned", "damaged", "stock", "value"]), "inventory")} icon={<Download size={13} />}>Export CSV</GBtn>
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
            <option value="stock">Sort: Stock</option>
            <option value="value">Sort: Value</option>
            <option value="sold">Sort: Sold</option>
            <option value="name">Sort: Name</option>
          </GS>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: T.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)" }}>
              {["Product", "SKU", "Category", "Opening", "+Purchased", "-Sold", "+Returns", "-Damaged", "= Stock", "Value", "Status"].map(h => (
                <th key={h} className="th" style={{ textAlign: ["Opening", "+Purchased", "-Sold", "+Returns", "-Damaged", "= Stock", "Value"].includes(h) ? "right" : "left" }}>
                  {h.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const cat = categories.find(c => c.id === p.categoryId);
              return (
                <tr key={p.id} className="trow">
                  <td className="td">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {p.imageUrl && <img src={p.imageUrl} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} onError={e => e.target.style.display = "none"} />}
                      <div>
                        <div style={{ fontWeight: 600, color: T.text, fontSize: 12 }}>{p.name}</div>
                        <div style={{ color: T.textMuted, fontSize: 10 }}>{p.alias}</div>
                      </div>
                    </div>
                  </td>
                  <td className="td m" style={{ fontFamily: "monospace", fontSize: 10 }}>{p.sku}</td>
                  <td className="td">{cat && <span className="tag" style={{ background: cat.color + "18", color: cat.color }}>{cat.name}</span>}</td>
                  <td className="td r">{p.opening}</td>
                  <td className="td r" style={{ color: T.blue }}>{p.purchased}</td>
                  <td className="td r" style={{ color: T.red }}>-{p.sold}</td>
                  <td className="td r" style={{ color: T.green }}>+{p.returned}</td>
                  <td className="td r" style={{ color: T.amber }}>-{p.damaged}</td>
                  <td className="td r" style={{ fontWeight: 700, fontSize: 14, color: p.stock <= 0 ? T.red : p.stock <= p.minStock ? T.amber : T.text }}>{p.stock}</td>
                  <td className="td r" style={{ fontWeight: 600, color: T.accent }}>{fmtCur(p.value)}</td>
                  <td className="td"><StChip stock={p.stock} min={Number(p.minStock)} /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${T.accent}30` }}>
              <td className="td" style={{ fontWeight: 700, fontSize: 13 }} colSpan={9}>TOTAL</td>
              <td className="td r" style={{ fontWeight: 700, color: T.accent, fontSize: 14 }}>{fmtCur(totalValue)}</td>
              <td className="td" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    {/* ── Opening Stock Modal ── */}
    <Modal
      open={osModal}
      onClose={() => setOsModal(false)}
      title="Add Opening Stock"
      width={600}
      footer={
        <>
          <GBtn v="ghost" onClick={() => setOsModal(false)}>Cancel</GBtn>
          <GBtn onClick={saveOpeningStock} icon={<Layers size={13} />}>Save Opening Stock</GBtn>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Info banner */}
        <div style={{ padding: "10px 14px", borderRadius: 10, background: T.blueBg, border: `1px solid ${T.blue}25`, fontSize: 12, color: T.blue }}>
          Use this to set initial stock levels when you first start tracking, or to correct stock after a physical count. Each entry is saved as an "opening" transaction.
        </div>

        {/* Date + Notes */}
        <div className="fgrid">
          <Field label="Date" req>
            <GIn type="date" value={osDate} onChange={e => setOsDate(e.target.value)} />
          </Field>
          <Field label="Notes">
            <GIn value={osNotes} onChange={e => setOsNotes(e.target.value)} placeholder="e.g. Physical count Apr 2026" />
          </Field>
        </div>

        {/* Product rows */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.05em", marginBottom: 8 }}>PRODUCTS</div>
          <div style={{ border: `1px solid ${T.borderSubtle}`, borderRadius: 12, overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 32px", gap: 8, padding: "8px 12px", background: T.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted }}>PRODUCT</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted }}>OPENING QTY</div>
              <div />
            </div>
            {osRows.map((row, i) => {
              const pr = products.find(p => p.id === row.productId);
              const existingOpening = row.productId
                ? transactions.filter(t => t.productId === row.productId && t.type === "opening").reduce((s, t) => s + Number(t.qty), 0)
                : null;
              return (
                <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 100px 32px", gap: 8, padding: "8px 12px", borderTop: `1px solid ${T.borderSubtle}`, alignItems: "center" }}>
                  <div>
                    <GS value={row.productId} onChange={e => upOsRow(row.id, "productId", e.target.value)} placeholder={`Product ${i + 1}`}>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </GS>
                    {existingOpening > 0 && (
                      <div style={{ fontSize: 10, marginTop: 3, color: T.amber }}>
                        ⚠ Already has {existingOpening} opening units — this will add on top
                      </div>
                    )}
                    {pr && (
                      <div style={{ fontSize: 10, marginTop: 3, color: T.textMuted }}>
                        Current stock: {getStock(pr.id)} · Cost: ₹{Number(pr.purchasePrice || 0).toLocaleString("en-IN")}
                      </div>
                    )}
                  </div>
                  <GIn type="number" min="1" value={row.qty} onChange={e => upOsRow(row.id, "qty", e.target.value)} placeholder="0" />
                  <button
                    onClick={() => remOsRow(row.id)}
                    className="btn-danger"
                    style={{ padding: "4px", opacity: osRows.length <= 1 ? .3 : 1 }}
                    disabled={osRows.length <= 1}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
            <div style={{ padding: "8px 12px", borderTop: `1px solid ${T.borderSubtle}` }}>
              <GBtn v="ghost" sz="sm" onClick={addOsRow} icon={<Plus size={12} />}>Add Another Product</GBtn>
            </div>
          </div>
        </div>

        {/* Summary */}
        {osRows.some(r => r.productId && Number(r.qty) > 0) && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: T.accentBg, fontSize: 12, color: T.textSub }}>
            <span style={{ fontWeight: 700, color: T.text }}>
              {osRows.filter(r => r.productId && Number(r.qty) > 0).length} product{osRows.filter(r => r.productId && Number(r.qty) > 0).length !== 1 ? "s" : ""}
            </span>
            {" · "}
            <span>
              {osRows.filter(r => r.productId && Number(r.qty) > 0).reduce((s, r) => s + Number(r.qty), 0)} total units
            </span>
            {" · "}
            <span style={{ color: T.accent, fontWeight: 600 }}>
              {fmtCur(osRows.filter(r => r.productId && Number(r.qty) > 0).reduce((s, r) => {
                const cost = Number(products.find(p => p.id === r.productId)?.purchasePrice || 0);
                return s + Number(r.qty) * cost;
              }, 0))} inventory value
            </span>
          </div>
        )}
      </div>
    </Modal>

  </div>;
}
