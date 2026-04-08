import React, { useState } from "react";
import { Plus, Edit2, Trash2, Send, MapPin, Phone, Mail, Building } from "lucide-react";
import { useT } from "../theme";
import { GBtn, GIn, GS, GTa, Field, Modal } from "../components/UI";
import { uid, fmtCur } from "../utils";

export default function Vendors({ ctx }) {
  const T = useT();
  const { vendors, saveVendors, bills, transactions, user, addChangeReq, addLog } = ctx;
  const isAdmin = user.role === "admin";
  const isManager = user.role === "manager";
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const ff = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const doSave = () => {
    if (!form.name) return;
    if (editing) { saveVendors(vendors.map(v => v.id === editing ? { ...form } : v)); addLog("updated", "vendor", form.name); }
    else { saveVendors([...vendors, { id: uid(), ...form }]); addLog("created", "vendor", form.name); }
    setModal(false);
  };

  const doSubmit = () => {
    if (!form.name) return;
    addChangeReq({ entity: "vendor", action: editing ? "update" : "create", entityId: editing || null, entityName: form.name, currentData: editing ? vendors.find(v => v.id === editing) : null, proposedData: { ...form } });
    setModal(false);
  };

  const footer = isManager
    ? <><GBtn v="ghost" onClick={() => setModal(false)}>Cancel</GBtn><GBtn v="green" onClick={doSubmit} icon={<Send size={13} />}>{editing ? "Submit Edit" : "Submit Add"}</GBtn></>
    : <><GBtn v="ghost" onClick={() => setModal(false)}>Cancel</GBtn><GBtn onClick={doSave}>{editing ? "Save" : "Add Vendor"}</GBtn></>;

  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <GBtn onClick={() => { setForm({}); setEditing(null); setModal(true); }} icon={<Plus size={14} />}>Add Vendor</GBtn>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
      {vendors.map(v => {
        const vBills = bills ? bills.filter(b => b.type === "purchase" && b.vendorId === v.id) : [];
        const spend = vBills.reduce((s, b) => s + Number(b.total || 0), 0);
        const fullAddress = [v.address1, v.address2, v.city, v.state, v.pincode].filter(Boolean).join(", ");
        return <div key={v.id} className="glass" style={{ padding: 20, borderRadius: T.radius }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${T.blue}18`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: T.blue, flexShrink: 0 }}>{v.name[0]}</div>
              <div>
                <div style={{ fontWeight: 700, color: T.text, fontSize: 14 }}>{v.name}</div>
                {v.city && <div style={{ fontSize: 11, color: T.textMuted }}>{v.city}{v.state ? `, ${v.state}` : ""}</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <button className="btn-ghost" onClick={() => { setForm(v); setEditing(v.id); setModal(true); }} style={{ padding: "4px 7px" }}><Edit2 size={12} /></button>
              {isAdmin && <button className="btn-danger" onClick={() => { if (window.confirm("Delete vendor?")) saveVendors(vendors.filter(x => x.id !== v.id)); }} style={{ padding: "4px 7px" }}><Trash2 size={12} /></button>}
            </div>
          </div>

          {/* Details grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {fullAddress && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 11, color: T.textSub }}>
                <MapPin size={12} color={T.textMuted} style={{ marginTop: 1, flexShrink: 0 }} />
                <span>{fullAddress}</span>
              </div>
            )}
            {v.contact && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: T.textSub }}>
                <Phone size={12} color={T.textMuted} />
                <span>{v.contact}</span>
              </div>
            )}
            {v.email && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: T.textSub }}>
                <Mail size={12} color={T.textMuted} />
                <span>{v.email}</span>
              </div>
            )}
            {v.gstin && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: T.textSub }}>
                <Building size={12} color={T.textMuted} />
                <span style={{ fontFamily: "monospace" }}>GSTIN: {v.gstin}</span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "10px 12px", borderRadius: 10, background: T.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}>
            <div><div style={{ fontSize:11, color: T.textMuted, fontWeight: 600, marginBottom: 2 }}>ORDERS</div><div style={{ fontSize: 14, fontWeight: 700, color: T.blue }}>{vBills.length}</div></div>
            <div><div style={{ fontSize:11, color: T.textMuted, fontWeight: 600, marginBottom: 2 }}>TOTAL SPEND</div><div style={{ fontSize: 14, fontWeight: 700, color: T.accent }}>{fmtCur(spend)}</div></div>
          </div>
          {v.notes && <div style={{ fontSize: 11, color: T.textSub, padding: "8px 10px", borderRadius: 8, background: `${T.amber}10`, borderLeft: `3px solid ${T.amber}`, marginTop: 10 }}>{v.notes}</div>}
        </div>;
      })}
      {vendors.length === 0 && <div style={{ padding: "40px 0", textAlign: "center", color: T.textMuted, gridColumn: "1/-1" }}>No vendors yet. Add your first vendor.</div>}
    </div>

    <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Vendor" : "Add Vendor"} width={520} footer={footer}>
      <div className="fgrid">
        <Field label="Vendor / Company Name" req cl="s2"><GIn value={form.name || ""} onChange={e => ff("name", e.target.value)} placeholder="Blupipal Industries" /></Field>
        <Field label="Contact Person"><GIn value={form.contact || ""} onChange={e => ff("contact", e.target.value)} placeholder="Name or phone" /></Field>
        <Field label="Phone"><GIn value={form.phone || ""} onChange={e => ff("phone", e.target.value)} placeholder="+91 98765 43210" /></Field>
        <Field label="Email" cl="s2"><GIn value={form.email || ""} onChange={e => ff("email", e.target.value)} placeholder="vendor@example.com" /></Field>
        <Field label="GSTIN"><GIn value={form.gstin || ""} onChange={e => ff("gstin", e.target.value)} placeholder="22AAAAA0000A1Z5" /></Field>
        <Field label="State"><GIn value={form.state || ""} onChange={e => ff("state", e.target.value)} placeholder="Maharashtra" /></Field>
        <Field label="Address Line 1" cl="s2"><GIn value={form.address1 || ""} onChange={e => ff("address1", e.target.value)} placeholder="Street, Building No." /></Field>
        <Field label="Address Line 2" cl="s2"><GIn value={form.address2 || ""} onChange={e => ff("address2", e.target.value)} placeholder="Area, Landmark" /></Field>
        <Field label="City"><GIn value={form.city || ""} onChange={e => ff("city", e.target.value)} placeholder="Mumbai" /></Field>
        <Field label="Pincode"><GIn value={form.pincode || ""} onChange={e => ff("pincode", e.target.value)} placeholder="400001" /></Field>
        <Field label="Notes" cl="s2"><GTa value={form.notes || ""} onChange={e => ff("notes", e.target.value)} rows={2} placeholder="Payment terms, lead time…" /></Field>
      </div>
    </Modal>
  </div>;
}
