import React, { useState, useMemo, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, Package, Tag, Send, X, Upload, Download, AlertTriangle, CheckCircle } from "lucide-react";
import { useT } from "../theme";
import { GBtn, GIn, GS, GTa, Field, Modal, StChip, Pager } from "../components/UI";
import { uid, calcMgn, dlCSV } from "../utils";

export default function Products({ ctx }) {
  const T = useT();
  const { products, categories, getStock, saveProducts, saveCategories, user, addChangeReq, addLog } = ctx;
  const isAdmin = user.role === "admin";
  const isManager = user.role === "manager";

  const [tab, setTab] = useState("products");
  const [search, setSearch] = useState("");
  const [cf, setCf] = useState("");
  const [modal, setModal] = useState(false);
  const [delConfirmProd, setDelConfirmProd] = useState(null);
  const [delConfirmCat, setDelConfirmCat] = useState(null);
  const [editId, setEditId] = useState(null);
  const [lb, setLb] = useState(null);
  const [form, setForm] = useState({});
  const [pg, setPg] = useState(1);
  const [ps, setPs] = useState(20);
  const [catModal, setCatModal] = useState(false);
  const [catEdit, setCatEdit] = useState(null);
  const [catForm, setCatForm] = useState({ name: "", color: "#C05C1E" });

  const [csvModal, setCsvModal] = useState(false);
  const [csvPreview, setCsvPreview] = useState([]); // parsed rows waiting to import
  const [csvErrors, setCsvErrors] = useState([]);
  const csvInputRef = React.useRef(null);

  useEffect(() => setPg(1), [search, cf, ps]);

  const ff = (k, v) => setForm(p => {
    const n = { ...p, [k]: v };
    n.margin = calcMgn(n.mrp || 0, n.purchasePrice || 0);
    return n;
  });

  const filtered = useMemo(() => products.filter(p => {
    if (cf && p.categoryId !== cf) return false;
    const q = search.toLowerCase();
    return (
      (p.name || "").toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q) ||
      (p.alias || "").toLowerCase().includes(q) ||
      (p.hsn || "").toLowerCase().includes(q)
    );
  }), [products, search, cf]);

  // ── CSV Template columns ─────────────────────────────────────────────────
  const CSV_COLS = ["name","alias","sku","hsn","category","gstRate","mrp","purchasePrice","unit","minStock","imageUrl","description"];
  const CSV_SAMPLE = [
    "Pipal Apex Matt Copper Bottle,Copper Bottle,PFGCO0592,74181022,Copper Bottle,5,2549,632,pcs,10,https://pipalhome.com/cdn/shop/files/img.jpg,Premium copper water bottle",
    "Brass Tumbler 250ml,Brass Tumbler,BT-001,74182000,Brass Cookware,12,899,210,pcs,5,,Handcrafted brass tumbler"
  ];

  const exportTemplate = () => {
    const header = CSV_COLS.join(",");
    const rows = [header, ...CSV_SAMPLE].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "products_import_template.csv"; a.click();
  };

  const handleCSVFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = ev.target.result.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { alert("File appears empty"); return; }

      // Detect header row
      const headerLine = lines[0].toLowerCase();
      const hasHeader = headerLine.includes("name") || headerLine.includes("sku") || headerLine.includes("mrp");
      const dataLines = hasHeader ? lines.slice(1) : lines;
      const headers = hasHeader
        ? lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z]/g,""))
        : CSV_COLS;

      const colIdx = col => {
        const aliases = { name:["name","productname"], alias:["alias","shortname"], sku:["sku","code"], hsn:["hsn","hsncode"], mrp:["mrp","sellingprice","price"], purchaseprice:["purchaseprice","cost","costprice","buyprice"], gstrate:["gstrate","gst","tax"], unit:["unit","uom"], minstock:["minstock","reorderqty","minqty"], description:["description","desc"], category:["category","categoryname","cat"], imageurl:["imageurl","image","imagelink","img"] };
        const aliasList = aliases[col] || [col];
        for (const a of aliasList) { const i = headers.indexOf(a); if (i !== -1) return i; }
        return -1;
      };

      const parsed = []; const errors = [];
      dataLines.forEach((line, idx) => {
        if (!line.trim()) return;
        // Handle quoted CSV fields
        const cols = [];
        let cur = "", inQ = false;
        for (const ch of line) {
          if (ch === '"') { inQ = !inQ; }
          else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
          else { cur += ch; }
        }
        cols.push(cur.trim());

        const get = col => { const i = colIdx(col); return i >= 0 ? (cols[i] || "").trim() : ""; };
        const name = get("name");
        if (!name) { errors.push(`Row ${idx+2}: Missing name — skipped`); return; }
        const mrp = parseFloat(get("mrp")) || 0;
        const cost = parseFloat(get("purchaseprice")) || 0;
        const catName = get("category");
        const cat = catName ? categories.find(c => c.name.toLowerCase() === catName.toLowerCase()) : null;
        parsed.push({
          id: uid(),
          name,
          alias: get("alias") || name.slice(0, 20),
          sku: get("sku") || `SKU-${Date.now()}-${idx}`,
          hsn: get("hsn") || "",
          mrp, purchasePrice: cost,
          margin: calcMgn(mrp, cost),
          gstRate: get("gstrate") || "0",
          unit: get("unit") || "pcs",
          minStock: parseInt(get("minstock")) || 5,
          imageUrl: get("imageurl") || "",
          description: get("description") || "",
          categoryId: cat?.id || "",
          categoryName: cat?.name || catName || "",
        });
      });

      setCsvPreview(parsed);
      setCsvErrors(errors);
      setCsvModal(true);
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (csvPreview.length === 0) return;
    // Skip duplicates by SKU
    const existingSkus = new Set(products.map(p => p.sku));
    const toAdd = csvPreview.filter(p => !existingSkus.has(p.sku));
    const dupes = csvPreview.length - toAdd.length;
    saveProducts([...products, ...toAdd]);
    addLog("bulk imported", "products", `${toAdd.length} products`);
    setCsvModal(false); setCsvPreview([]); setCsvErrors([]);
    alert(` Imported ${toAdd.length} products.${dupes > 0 ? ` Skipped ${dupes} duplicate SKUs.` : ""}`);
  };

  const doSave = () => {
    if (!form.name || !form.sku) return;
    const margin = calcMgn(form.mrp, form.purchasePrice);
    const d = { ...form, margin };
    if (editId) {
      saveProducts(products.map(p => p.id === editId ? d : p));
      addLog("updated", "product", form.name);
    } else {
      saveProducts([...products, { ...d, id: uid() }]);
      addLog("created", "product", form.name);
    }
    setModal(false);
  };

  const doSubmit = () => {
    if (!form.name || !form.sku) return;
    const margin = calcMgn(form.mrp, form.purchasePrice);
    addChangeReq({
      entity: "product",
      action: editId ? "update" : "create",
      entityId: editId || null,
      entityName: form.name,
      currentData: editId ? products.find(p => p.id === editId) : null,
      proposedData: { ...form, margin }
    });
    setModal(false);
  };

  const saveCat = () => {
    if (!catForm.name) return;
    if (catEdit) saveCategories(categories.map(c => c.id === catEdit ? { ...c, ...catForm } : c));
    else saveCategories([...categories, { id: uid(), ...catForm }]);
    setCatModal(false);
  };

  const footer = isManager
    ? <><GBtn v="ghost" onClick={() => setModal(false)}>Cancel</GBtn><GBtn v="green" onClick={doSubmit} icon={<Send size={13} />}>{editId ? "Submit Edit" : "Submit Add"}</GBtn></>
    : <><GBtn v="ghost" onClick={() => setModal(false)}>Cancel</GBtn><GBtn onClick={doSave}>{editId ? "Save Changes" : "Add Product"}</GBtn></>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      <div style={{ display: "flex", gap: 6 }}>
        {["products", "categories"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 18px", borderRadius: T.radius, border: `1px solid ${tab === t ? T.accent : T.borderSubtle}`, cursor: "pointer", fontWeight: 600, fontSize: 13, background: tab === t ? T.accent : "transparent", color: tab === t ? "#fff" : T.textSub, transition: "all .15s" }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "products" && (
        <React.Fragment>
          {isManager && (
            <div style={{ padding: "10px 14px", borderRadius: T.radius, background: T.amberBg, border: `1px solid ${T.amber}30`, fontSize: 12, color: T.amber, fontWeight: 600 }}>
               Product changes require admin approval
            </div>
          )}

          <div className="filter-wrap">
            <div style={{ position: "relative", flex: "1 1 200px" }}>
              <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
              <input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, SKU, alias, HSN…" style={{ paddingLeft: 34 }} />
            </div>
            <GS value={cf} onChange={e => setCf(e.target.value)} placeholder="All Categories">
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </GS>
            {isAdmin && <>
              <GBtn v="ghost" sz="sm" onClick={exportTemplate} icon={<Download size={13} />}>CSV Template</GBtn>
              <GBtn v="ghost" sz="sm" onClick={() => csvInputRef.current?.click()} icon={<Upload size={13} />}>Import CSV</GBtn>
              <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleCSVFile} style={{ display: "none" }} />
            </>}
            <GBtn onClick={() => { setForm({ unit: "pcs", minStock: 10, gstRate: "0", hsn: "" }); setEditId(null); setModal(true); }} icon={<Plus size={14} />}>Add Product</GBtn>
          </div>

          <div className="glass" style={{ borderRadius: T.radius, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: T.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)" }}>
                    <th className="th">PRODUCT</th>
                    <th className="th">SKU / HSN</th>
                    <th className="th">CATEGORY</th>
                    <th className="th r">MRP</th>
                    <th className="th r">COST</th>
                    <th className="th r">MARGIN</th>
                    <th className="th r">STOCK</th>
                    <th className="th">STATUS</th>
                    <th className="th" style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice((pg - 1) * ps, pg * ps).map(p => {
                    const stock = getStock(p.id);
                    const cat = categories.find(c => c.id === p.categoryId);
                    return (
                      <tr key={p.id} className="trow">
                        <td className="td">
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: T.radius, overflow: "hidden", background: T.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,.05)", cursor: "pointer", flexShrink: 0 }} onClick={() => p.imageUrl && setLb(p.imageUrl)}>
                              {p.imageUrl
                                ? <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <Package size={13} style={{ margin: "11px auto", display: "block", color: T.textMuted }} />}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: T.text, fontSize: 12 }}>{p.name}</div>
                              <div style={{ color: T.textMuted, fontSize:11 }}>{p.alias}</div>
                            </div>
                          </div>
                        </td>
                        <td className="td m">
                          <div style={{ fontFamily: "monospace", fontSize:11 }}>{p.sku}</div>
                          {p.hsn ? <div style={{ fontFamily: "monospace", fontSize:11, color: T.textMuted }}>HSN {p.hsn}</div> : null}
                        </td>
                        <td className="td">
                          {cat ? <span className="tag" style={{ background: cat.color + "18", color: cat.color }}>{cat.name}</span> : null}
                        </td>
                        <td className="td r" style={{ fontFamily: T.displayFont, fontWeight: 700, color: T.accent, fontSize: 13 }}>
                          ₹{Number(p.mrp || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="td r m">
                          ₹{Number(p.purchasePrice || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="td r" style={{ color: T.green, fontWeight: 600 }}>{p.margin || 0}%</td>
                        <td className="td r" style={{ fontWeight: 700, color: stock <= 0 ? T.red : stock <= Number(p.minStock || 0) ? T.amber : T.text }}>{stock}</td>
                        <td className="td"><StChip stock={stock} min={Number(p.minStock || 0)} /></td>
                        <td className="td">
                          <div style={{ display: "flex", gap: 5 }}>
                            <button className="btn-ghost" onClick={() => { setForm({ ...p }); setEditId(p.id); setModal(true); }} style={{ padding: "4px 8px" }}>
                              <Edit2 size={12} />
                            </button>
                            {isAdmin && (
                              <button className="btn-danger" onClick={() => { if(isManager){if(window.confirm("Request admin to delete this product?"))addChangeReq({entity:"product",action:"delete",entityId:p.id,entityName:p.name,currentData:p,proposedData:null});}else { setDelConfirmProd(p); } }} style={{ padding: "4px 7px" }}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div style={{ padding: "40px 0", textAlign: "center", color: T.textMuted }}>No products</div>
              )}
            </div>
            <Pager total={filtered.length} page={pg} ps={ps} setPage={setPg} setPs={setPs} />
          </div>
        </React.Fragment>
      )}

      {tab === "categories" && (
        <React.Fragment>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <GBtn onClick={() => { setCatForm({ name: "", color: "#C05C1E" }); setCatEdit(null); setCatModal(true); }} icon={<Plus size={14} />}>Add Category</GBtn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
            {categories.map(c => {
              const cnt = products.filter(p => p.categoryId === c.id).length;
              const col = c.color || "#C05C1E";
              return (
                <div key={c.id} className="glass" style={{ padding: 16, borderRadius: T.radius, display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* icon row */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{ width: 40, height: 40, borderRadius: T.radius, background: col + "18", border: "2px solid " + col + "28", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Tag size={18} color={col} />
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn-ghost" onClick={() => { setCatForm({ name: c.name, color: col }); setCatEdit(c.id); setCatModal(true); }} style={{ padding: "3px 6px" }}>
                        <Edit2 size={11} />
                      </button>
                      {isAdmin && (
                        <button className="btn-danger" onClick={() => { if (cnt > 0) { alert("Remove all products in this category first."); return; } setDelConfirmCat(c); }} style={{ padding: "3px 6px" }}>
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* name + count */}
                  <div>
                    <div style={{ fontWeight: 700, color: T.text, fontSize: 13, lineHeight: 1.3 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{cnt} product{cnt !== 1 ? "s" : ""}</div>
                  </div>
                  {/* color bar */}
                  <div style={{ height: 3, borderRadius: T.radiusFull, background: col + "40", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: cnt > 0 ? "100%" : "20%", background: col, borderRadius: T.radiusFull, opacity: cnt > 0 ? 1 : 0.3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </React.Fragment>
      )}

      {lb && (
        <div onClick={() => setLb(null)} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.78)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ position: "relative", maxWidth: 500, width: "100%" }} onClick={e => e.stopPropagation()}>
            <img src={lb} alt="" style={{ width: "100%", borderRadius: T.radiusXl }} />
            <button onClick={() => setLb(null)} style={{ position: "absolute", top: -12, right: -12, width: 30, height: 30, borderRadius: "50%", background: T.surfaceStrong, border: `1px solid ${T.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} color={T.text} />
            </button>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "Edit Product" : "Add Product"} width={540} footer={footer}>
        <div className="fgrid">
          <Field label="Product Name" req><GIn value={form.name || ""} onChange={e => ff("name", e.target.value)} placeholder="Copper Water Bottle 1L" /></Field>
          <Field label="Alias"><GIn value={form.alias || ""} onChange={e => ff("alias", e.target.value)} placeholder="Copper Bottle" /></Field>
          <Field label="SKU" req><GIn value={form.sku || ""} onChange={e => ff("sku", e.target.value)} placeholder="PH-CU-001" /></Field>
          <Field label="HSN Code"><GIn value={form.hsn || ""} onChange={e => ff("hsn", e.target.value)} placeholder="e.g. 74182090" /></Field>
          <Field label="Category">
            <GS value={form.categoryId || ""} onChange={e => ff("categoryId", e.target.value)} placeholder="Select">
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </GS>
          </Field>
          <Field label="GST Rate (%)">
            <GS value={form.gstRate || "0"} onChange={e => ff("gstRate", e.target.value)}>
              <option value="0">0%</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </GS>
          </Field>
          <Field label="MRP (₹)" req><GIn type="number" value={form.mrp || ""} onChange={e => ff("mrp", parseFloat(e.target.value) || 0)} /></Field>
          <Field label="Purchase Price (₹)" req><GIn type="number" value={form.purchasePrice || ""} onChange={e => ff("purchasePrice", parseFloat(e.target.value) || 0)} /></Field>
          <Field label="Margin %"><GIn value={form.margin ? form.margin + "%" : "—"} readOnly /></Field>
          <Field label="Min Stock Alert"><GIn type="number" value={form.minStock || ""} onChange={e => ff("minStock", parseInt(e.target.value) || 0)} /></Field>
          <Field label="Unit"><GIn value={form.unit || ""} onChange={e => ff("unit", e.target.value)} placeholder="pcs / set / kg" /></Field>
          <Field label="Image URL"><GIn value={form.imageUrl || ""} onChange={e => ff("imageUrl", e.target.value)} placeholder="https://…" /></Field>
          <Field label="Description" cl="s2"><GTa value={form.description || ""} onChange={e => ff("description", e.target.value)} rows={2} /></Field>
          {form.imageUrl ? <div className="s2" style={{ display: "flex", justifyContent: "center" }}><img src={form.imageUrl} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: T.radius }} onError={e => { e.target.style.display = "none"; }} /></div> : null}
        </div>
      </Modal>

      <Modal open={catModal} onClose={() => setCatModal(false)} title={catEdit ? "Edit Category" : "Add Category"} width={340} footer={<><GBtn v="ghost" onClick={() => setCatModal(false)}>Cancel</GBtn><GBtn onClick={saveCat}>{catEdit ? "Save" : "Add"}</GBtn></>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Name" req><GIn value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Copper" /></Field>
          <Field label="Color">
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input type="color" value={catForm.color} onChange={e => setCatForm(p => ({ ...p, color: e.target.value }))} style={{ width: 42, height: 38, borderRadius: T.radius, border: `1.5px solid ${T.borderSubtle}`, padding: 3, background: "transparent", cursor: "pointer" }} />
              <GIn value={catForm.color} onChange={e => setCatForm(p => ({ ...p, color: e.target.value }))} />
            </div>
          </Field>
        </div>
      </Modal>

      {/* CSV Import Preview Modal */}
      <Modal open={csvModal} onClose={() => { setCsvModal(false); setCsvPreview([]); setCsvErrors([]); }} title={`Import Products — ${csvPreview.length} found`} width={700}
        footer={<>
          <GBtn v="ghost" onClick={() => { setCsvModal(false); setCsvPreview([]); setCsvErrors([]); }}>Cancel</GBtn>
          <GBtn onClick={confirmImport} icon={<Upload size={13} />} disabled={csvPreview.length === 0}>Import {csvPreview.length} Products</GBtn>
        </>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {csvErrors.length > 0 && (
            <div style={{ padding: "10px 14px", borderRadius: T.radius, background: T.amberBg, border: `1px solid ${T.amber}30` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12, color: T.amber, marginBottom: 6 }}>
                <AlertTriangle size={13} /> {csvErrors.length} row{csvErrors.length !== 1 ? "s" : ""} skipped
              </div>
              {csvErrors.slice(0, 5).map((e, i) => <div key={i} style={{ fontSize: 11, color: T.amber }}>{e}</div>)}
              {csvErrors.length > 5 && <div style={{ fontSize: 11, color: T.amber }}>…and {csvErrors.length - 5} more</div>}
            </div>
          )}

          {csvPreview.length > 0 && (
            <div style={{ padding: "8px 12px", borderRadius: T.radius, background: T.greenBg, border: `1px solid ${T.green}30`, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.green }}>
              <CheckCircle size={13} /> {csvPreview.length} products ready to import. Duplicate SKUs will be skipped.
            </div>
          )}

          <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: T.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", position: "sticky", top: 0 }}>
                  {["Img", "Name", "Alias", "SKU", "HSN", "Category", "GST%", "MRP", "Cost", "Margin", "Unit", "Min Stock"].map(h => (
                    <th key={h} className="th" style={{ padding: "6px 10px", fontSize:11 }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvPreview.map((p, i) => (
                  <tr key={i} className="trow">
                    <td className="td" style={{ padding: "5px 8px" }}>
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
                        : <div style={{ width: 28, height: 28, borderRadius: 4, background: T.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}></div>}
                    </td>
                    <td className="td" style={{ padding: "5px 10px", fontWeight: 600 }}>{p.name}</td>
                    <td className="td" style={{ padding: "5px 10px", color: T.textMuted }}>{p.alias}</td>
                    <td className="td" style={{ padding: "5px 10px", fontFamily: "monospace" }}>{p.sku}</td>
                    <td className="td" style={{ padding: "5px 10px" }}>{p.hsn || "—"}</td>
                    <td className="td" style={{ padding: "5px 10px" }}>
                      {p.categoryName
                        ? <span style={{ color: p.categoryId ? T.green : T.amber, fontWeight: 600 }}>{p.categoryName}{!p.categoryId ? " " : ""}</span>
                        : <span style={{ color: T.textMuted }}>—</span>}
                    </td>
                    <td className="td r" style={{ padding: "5px 10px" }}>{p.gstRate}%</td>
                    <td className="td r" style={{ padding: "5px 10px", color: T.green }}>₹{Number(p.mrp).toLocaleString("en-IN")}</td>
                    <td className="td r" style={{ padding: "5px 10px" }}>₹{Number(p.purchasePrice).toLocaleString("en-IN")}</td>
                    <td className="td r" style={{ padding: "5px 10px", color: T.accent }}>{p.margin}%</td>
                    <td className="td" style={{ padding: "5px 10px" }}>{p.unit}</td>
                    <td className="td r" style={{ padding: "5px 10px" }}>{p.minStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {csvPreview.length === 0 && <div style={{ padding: "24px 0", textAlign: "center", color: T.textMuted }}>No valid products found in file</div>}
          </div>
          {csvPreview.some(p => p.categoryName && !p.categoryId) && (
            <div style={{ padding: "8px 12px", borderRadius: T.radius, background: T.amberBg, fontSize: 11, color: T.amber }}>
               Categories marked in orange don't exist yet — products will be imported without a category. Create the categories first and re-import to match them.
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
}
