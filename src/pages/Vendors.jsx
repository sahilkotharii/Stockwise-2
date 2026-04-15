import React, { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, Send, Search } from "lucide-react";
import { useT } from "../theme";
import { GBtn, DeleteConfirmModal, GIn, GS, GTa, Field, Modal } from "../components/UI";
import { uid, today, fmtCur, fetchPincodeData } from "../utils";

export default function Vendors({ ctx }) {
  const T = useT();
  const { vendors, saveVendors, bills, user, addChangeReq, addLog } = ctx;
  const isAdmin = user.role === "admin";
  const isManager = user.role === "manager";
  const [modal, setModal] = useState(false);
  const [delConfirmVend, setDelConfirmVend] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState("");
  const [pg, setPg] = useState(1);
  const PS = 24;
  const ff = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Pre-index bills by vendorId once — O(n) not O(n*m)
  const billStatsByVendor = useMemo(() => {
    const m = {};
    (bills || []).forEach(b => {
      if (!b.vendorId) return;
      if (!m[b.vendorId]) m[b.vendorId] = { orders: 0, spend: 0, sales: 0, saleRev: 0 };
      if (b.type === "purchase") { m[b.vendorId].orders++; m[b.vendorId].spend += Number(b.total || 0); }
      if (b.type === "sale") { m[b.vendorId].sales++; m[b.vendorId].saleRev += Number(b.total || 0); }
    });
    return m;
  }, [bills]);

  const filtered = useMemo(() => {
    if (!search) return vendors;
    const q = search.toLowerCase();
    return vendors.filter(v =>
      String(v.name || "").toLowerCase().includes(q) ||
      String(v.city || "").toLowerCase().includes(q) ||
      String(v.gstin || "").toLowerCase().includes(q) ||
      String(v.phone || "").toLowerCase().includes(q) ||
      String(v.contact || "").toLowerCase().includes(q)
    );
  }, [vendors, search]);

  const paged = filtered.slice((pg - 1) * PS, pg * PS);
  const totalPages = Math.ceil(filtered.length / PS);

  const doSave = () => {
    if (!form.name) { alert("Vendor name is required"); return; }
    // Check duplicate GSTIN
    if (form.gstin) {
      const dup = vendors.find(v => v.gstin === form.gstin && v.id !== editing);
      if (dup) { alert(`GSTIN already exists for vendor: ${dup.name}`); return; }
    }
    if (editing) { saveVendors(vendors.map(v => v.id === editing ? { ...v, ...form } : v)); addLog("updated", "vendor", form.name); }
    else { saveVendors([...vendors, { id: uid(), ...form }]); addLog("created", "vendor", form.name); }
    setModal(false);
  };

  const doSubmit = () => {
    if (!form.name) { alert("Vendor name is required"); return; }
    addChangeReq({ entity: "vendor", action: editing ? "update" : "create", entityId: editing || null, entityName: form.name, currentData: editing ? vendors.find(v => v.id === editing) : null, proposedData: { ...form } });
    setModal(false);
  };

  const doDelete = v => {
    const used = (bills || []).some(b => b.vendorId === v.id);
    if (used) { alert(`${v.name} has bills. Vendor cannot be deleted while bills exist.`); return; }
    setDelConfirmVend(v);
  };

  const executeDelete = () => {
    if (!delConfirmVend) return;
    saveVendors(vendors.filter(x => x.id !== delConfirmVend.id));
    addLog("deleted", "vendor", delConfirmVend.name);
    setDelConfirmVend(null);
  };

  const openEdit = v => { setForm({ ...v }); setEditing(v.id); setModal(true); };

  const footer = isManager
    ? <><GBtn v="ghost" onClick={() => setModal(false)}>Cancel</GBtn><GBtn v="green" onClick={doSubmit} icon={<Send size={13} />}>{editing ? "Submit Edit" : "Submit Add"}</GBtn></>
    : <><GBtn v="ghost" onClick={() => setModal(false)}>Cancel</GBtn><GBtn onClick={doSave}>{editing ? "Save Changes" : "Add Vendor"}</GBtn></>;

  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    {/* Header */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <div>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 17, color: T.text }}>Vendors</div>
        <div style={{ fontSize: 12, color: T.textMuted }}>{vendors.length} vendors · {(bills || []).filter(b => b.type === "purchase").length} purchase bills</div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
          <input className="inp" value={search} onChange={e => { setSearch(e.target.value); setPg(1); }} placeholder="Search name, city, GSTIN…" style={{ paddingLeft: 30, width: 220 }} />
        </div>
        <GBtn onClick={() => { setForm({}); setEditing(null); setModal(true); }} icon={<Plus size={14} />}>Add Vendor</GBtn>
      </div>
    </div>

    {/* Grid */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
      {paged.map(v => {
        const stats = billStatsByVendor[v.id] || { orders: 0, spend: 0, sales: 0, saleRev: 0 };
        return (
          <div key={v.id} className="glass" style={{ padding: 18, borderRadius: T.radius }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</div>
                {v.gstin && <div style={{ fontSize: 11, fontFamily: "monospace", color: T.accent, marginTop: 2 }}>{v.gstin}</div>}
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                <button className="btn-ghost" onClick={() => openEdit(v)} style={{ padding: "4px 8px" }} title="Edit"><Edit2 size={13} /></button>
                {isAdmin && <button className="btn-danger" onClick={() => doDelete(v)} style={{ padding: "4px 8px" }} title="Delete"><Trash2 size={13} /></button>}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: T.textSub }}>
              {(v.address1 || v.city) && <div> {[v.address1, v.address2, v.city, v.state, v.pincode].filter(Boolean).join(", ")}</div>}
              {v.phone && <div> {v.phone}{v.contact ? ` · ${v.contact}` : ""}</div>}
              {v.email && <div> {v.email}</div>}
              {v.notes && <div style={{ fontStyle: "italic", color: T.textMuted, fontSize: 11 }}>{v.notes}</div>}
            </div>

            {(stats.orders > 0 || stats.sales > 0) && (
              <div style={{ display: "flex", gap: 10, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.borderSubtle}` }}>
                {stats.orders > 0 && (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: T.textMuted }}>Purchase Orders</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.blue }}>{stats.orders}</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>{fmtCur(stats.spend)} total</div>
                  </div>
                )}
                {stats.sales > 0 && (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: T.textMuted }}>Sale Orders</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.green }}>{stats.sales}</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>{fmtCur(stats.saleRev)} total</div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {filtered.length === 0 && (
        <div style={{ gridColumn: "1/-1", padding: "40px 0", textAlign: "center", color: T.textMuted }}>
          {search ? `No vendors match "${search}"` : "No vendors yet — add your first vendor"}
        </div>
      )}
    </div>

    {/* Pagination */}
    {totalPages > 1 && (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <button className="btn-ghost" onClick={() => setPg(p => Math.max(1, p - 1))} disabled={pg === 1} style={{ padding: "6px 14px" }}>← Prev</button>
        <span style={{ fontSize: 12, color: T.textSub }}>{pg} / {totalPages} ({filtered.length} vendors)</span>
        <button className="btn-ghost" onClick={() => setPg(p => Math.min(totalPages, p + 1))} disabled={pg === totalPages} style={{ padding: "6px 14px" }}>Next →</button>
      </div>
    )}

    {/* Modal */}
    <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Vendor" : `Add Vendor${isManager ? " (Requires Approval)" : ""}`} width={560} footer={footer}>
      <div className="fgrid">
        <Field label="Vendor / Company Name" req cl="s2"><GIn value={form.name || ""} onChange={e => ff("name", e.target.value)} placeholder="Blupipal Industries" /></Field>
        <Field label="Contact Person"><GIn value={form.contact || ""} onChange={e => ff("contact", e.target.value)} placeholder="Name or phone" /></Field>
        <Field label="Phone"><GIn value={form.phone || ""} onChange={e => ff("phone", e.target.value)} placeholder="+91 98765 43210" /></Field>
        <Field label="Email" cl="s2"><GIn value={form.email || ""} onChange={e => ff("email", e.target.value)} placeholder="vendor@example.com" /></Field>
        <Field label="GSTIN"><GIn value={form.gstin || ""} onChange={e => ff("gstin", e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" /></Field>
        <Field label="State"><GIn value={form.state || ""} onChange={e => ff("state", e.target.value)} placeholder="Maharashtra" /></Field>
        <Field label="Address Line 1" cl="s2"><GIn value={form.address1 || ""} onChange={e => ff("address1", e.target.value)} placeholder="Street, Building No." /></Field>
        <Field label="Address Line 2" cl="s2"><GIn value={form.address2 || ""} onChange={e => ff("address2", e.target.value)} placeholder="Area, Landmark" /></Field>
        <Field label="City"><GIn value={form.city || ""} onChange={e => ff("city", e.target.value)} placeholder="Mumbai" /></Field>
        <Field label="Pincode"><GIn value={form.pincode || ""} onChange={async e => {
              const pin = e.target.value; ff("pincode", pin);
              if (pin.length === 6) {
                const d = await fetchPincodeData(pin);
                if (d) { ff("city", d.city); ff("state", d.state); }
              }
            }} placeholder="400001" maxLength={6} /></Field>
        <Field label="Notes" cl="s2"><GTa value={form.notes || ""} onChange={e => ff("notes", e.target.value)} placeholder="Payment terms, lead time…" rows={2} /></Field>
      </div>
    </Modal>

    <DeleteConfirmModal
      open={!!delConfirmVend}
      onClose={() => setDelConfirmVend(null)}
      onConfirm={executeDelete}
      user={user}
      label={`vendor "${delConfirmVend?.name}"`}
    />
  </div>;
}
