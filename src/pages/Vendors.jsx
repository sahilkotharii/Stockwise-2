import React, { useState } from "react";
import { Plus, Edit2, Trash2, Send } from "lucide-react";
import { useT } from "../theme";
import { GBtn, GIn, GTa, Field, Modal } from "../components/UI";
import { uid, fmtCur } from "../utils";

export default function Vendors({ ctx }) {
  const T = useT();
  const { vendors, saveVendors, transactions, user, addChangeReq, addLog } = ctx;
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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 14 }}>
      {vendors.map(v => {
        const orders = transactions.filter(t => t.type === "purchase" && t.vendorId === v.id).length;
        const spend = transactions.filter(t => t.type === "purchase" && t.vendorId === v.id).reduce((s, t) => s + Number(t.qty) * Number(t.price), 0);
        return <div key={v.id} className="glass" style={{ padding: 20, borderRadius: T.radius }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${T.blue}18`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: T.blue }}>{v.name[0]}</div>
              <div><div style={{ fontWeight: 700, color: T.text, fontSize: 14 }}>{v.name}</div><div style={{ fontSize: 12, color: T.textMuted }}>{v.city}</div></div>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <button className="btn-ghost" onClick={() => { setForm(v); setEditing(v.id); setModal(true); }} style={{ padding: "4px 7px" }}><Edit2 size={12} /></button>
              {isAdmin && <button className="btn-danger" onClick={() => { if (window.confirm("Delete?")) saveVendors(vendors.filter(x => x.id !== v.id)); }} style={{ padding: "4px 7px" }}><Trash2 size={12} /></button>}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "10px 12px", borderRadius: 12, background: T.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", marginBottom: 10 }}>
            <div><div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, marginBottom: 2 }}>CONTACT</div><div style={{ fontSize: 12, color: T.text }}>{v.contact || "—"}</div></div>
            <div><div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, marginBottom: 2 }}>GSTIN</div><div style={{ fontSize: 11, color: T.text, fontFamily: "monospace" }}>{v.gstin || "—"}</div></div>
            <div><div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, marginBottom: 2 }}>ORDERS</div><div style={{ fontSize: 14, fontWeight: 700, color: T.blue }}>{orders}</div></div>
            <div><div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, marginBottom: 2 }}>TOTAL SPEND</div><div style={{ fontSize: 14, fontWeight: 700, color: T.accent }}>{fmtCur(spend)}</div></div>
          </div>
          {v.notes && <div style={{ fontSize: 11, color: T.textSub, padding: "8px 10px", borderRadius: 8, background: `${T.amber}10`, borderLeft: `3px solid ${T.amber}` }}>{v.notes}</div>}
        </div>;
      })}
    </div>
    <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Vendor" : "Add Vendor"} width={460} footer={footer}>
      <div className="fgrid">
        <Field label="Vendor Name" req><GIn value={form.name || ""} onChange={e => ff("name", e.target.value)} placeholder="Company name" /></Field>
        <Field label="City"><GIn value={form.city || ""} onChange={e => ff("city", e.target.value)} placeholder="City" /></Field>
        <Field label="Contact No."><GIn value={form.contact || ""} onChange={e => ff("contact", e.target.value)} placeholder="9876543210" /></Field>
        <Field label="Email"><GIn value={form.email || ""} onChange={e => ff("email", e.target.value)} placeholder="vendor@example.com" /></Field>
        <Field label="GSTIN" cl="s2"><GIn value={form.gstin || ""} onChange={e => ff("gstin", e.target.value)} placeholder="22AAAAA0000A1Z5" /></Field>
        <Field label="Notes" cl="s2"><GTa value={form.notes || ""} onChange={e => ff("notes", e.target.value)} rows={2} /></Field>
      </div>
    </Modal>
  </div>;
}
