import React, { useState } from "react";
import { Plus, Edit2, Trash2, Check, RefreshCw, Wifi, Download, Activity, Lock, Unlock, CheckCircle, XCircle, Loader, X } from "lucide-react";
import { useT } from "../theme";
import { GBtn, GIn, GTa, GS, Field, Modal } from "../components/UI";
import { uid, today, fmtTs, toCSV, dlCSV } from "../utils";
import { lsSet } from "../storage";

const LOCKABLE = [
  { id: "sales", label: "Sales" },
  { id: "purchase", label: "Purchase" },
  { id: "inventory", label: "Inventory" },
  { id: "reports", label: "Reports" },
  { id: "products", label: "Products" },
  { id: "vendors", label: "Vendors" },
  { id: "transactions", label: "Transactions" }
];

export default function Settings({ ctx, sheetsUrl, setSheetsUrl, testStatus, onTest }) {
  const T = useT();
  const { users, saveUsers, channels, saveChannels, user, actLog } = ctx;
  const isAdmin = user.role === "admin";
  const tabs = isAdmin ? ["profile", "users", "channels", "access", "export", "activity", "sessions", "sheets"] : ["profile"];
  const [tab, setTab] = useState("profile");
  const [localUrl, setLocalUrl] = useState(sheetsUrl || "");

  const [uModal, setUModal] = useState(false);
  const [eu, setEu] = useState(null);
  const [uForm, setUForm] = useState({});
  const uf = (k, v) => setUForm(p => ({ ...p, [k]: v }));

  const [chModal, setChModal] = useState(false);
  const [ech, setEch] = useState(null);
  const [chForm, setChForm] = useState({ name: "", color: "#C05C1E", logoUrl: "" });

  const [pForm, setPForm] = useState({ name: user.name, newPass: "", confirmPass: "" });
  const pf = (k, v) => setPForm(p => ({ ...p, [k]: v }));

  const saveProfile = () => {
    if (pForm.newPass && pForm.newPass !== pForm.confirmPass) { alert("Passwords don't match."); return; }
    saveUsers(users.map(u => u.id === user.id ? { ...u, name: pForm.name, ...(pForm.newPass ? { password: pForm.newPass } : {}) } : u));
    alert("Profile saved!");
  };

  const saveUser = () => {
    if (!uForm.username || !uForm.password || !uForm.name) return;
    if (eu) saveUsers(users.map(u => u.id === eu ? { ...u, ...uForm } : u));
    else saveUsers([...users, { id: uid(), ...uForm, createdAt: today(), lockedPages: [] }]);
    setUModal(false);
  };

  const saveCh = () => {
    if (!chForm.name) return;
    if (ech) saveChannels(channels.map(c => c.id === ech ? { id: ech, ...chForm } : c));
    else saveChannels([...channels, { id: uid(), ...chForm }]);
    setChModal(false);
  };

  const toggleLock = (uid2, pid) => {
    const u = users.find(x => x.id === uid2);
    if (!u) return;
    const lk = u.lockedPages || [];
    saveUsers(users.map(x => x.id === uid2 ? { ...x, lockedPages: lk.includes(pid) ? lk.filter(p => p !== pid) : [...lk, pid] } : x));
  };

  const tlbls = { profile: "Profile", users: "Users", channels: "Channels", access: "Access Control", export: "Export", activity: "Activity Log", sessions: "Login History", sheets: "Google Sheets" };
  const myLog = isAdmin ? actLog : actLog.filter(l => l.userId === user.id);

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {tabs.map(t => <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${tab === t ? T.accent : T.borderSubtle}`, cursor: "pointer", fontWeight: 600, fontSize: 12, background: tab === t ? T.accent : "transparent", color: tab === t ? "#fff" : T.textSub, transition: "all .15s" }}>{tlbls[t]}</button>)}
    </div>

    {tab === "profile" && <div className="glass" style={{ padding: 22, borderRadius: T.radius }}>
      <div className="fgrid">
        <Field label="Display Name" req cl="s2"><GIn value={pForm.name} onChange={e => pf("name", e.target.value)} /></Field>
        <Field label="New Password"><GIn type="password" value={pForm.newPass} onChange={e => pf("newPass", e.target.value)} placeholder="Leave blank to keep" /></Field>
        <Field label="Confirm Password"><GIn type="password" value={pForm.confirmPass} onChange={e => pf("confirmPass", e.target.value)} /></Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><GBtn onClick={saveProfile} icon={<Check size={13} />}>Save Profile</GBtn></div>
    </div>}

    {tab === "users" && isAdmin && <div className="glass" style={{ padding: 20, borderRadius: T.radius }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text }}>User Accounts</div>
        <GBtn sz="sm" onClick={() => { setUForm({ role: "manager" }); setEu(null); setUModal(true); }} icon={<Plus size={13} />}>Add User</GBtn>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {users.map(u => <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, background: T.isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.5)", border: `1px solid ${T.borderSubtle}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: u.role === "admin" ? `${T.accent}1C` : `${T.blue}1C`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: u.role === "admin" ? T.accent : T.blue }}>{u.name[0]}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: T.text }}>{u.name}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>@{u.username} · <span style={{ color: u.role === "admin" ? T.accent : T.blue, fontWeight: 600 }}>{u.role}</span></div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <button className="btn-ghost" style={{ padding: "5px 8px" }} onClick={() => { setUForm(u); setEu(u.id); setUModal(true); }}><Edit2 size={13} /></button>
            <button className="btn-danger" style={{ padding: "5px 8px" }} onClick={() => {
              if (u.role === "admin" && users.filter(x => x.role === "admin").length <= 1) { alert("Cannot delete only admin."); return; }
              if (u.id === user.id) { alert("Cannot delete yourself."); return; }
              if (window.confirm("Delete user?")) saveUsers(users.filter(x => x.id !== u.id));
            }}><Trash2 size={13} /></button>
          </div>
        </div>)}
      </div>
    </div>}

    {tab === "channels" && isAdmin && <div className="glass" style={{ padding: 20, borderRadius: T.radius }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text }}>Sales Channels</div>
        <GBtn sz="sm" onClick={() => { setChForm({ name: "", color: "#C05C1E", logoUrl: "" }); setEch(null); setChModal(true); }} icon={<Plus size={13} />}>Add Channel</GBtn>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {channels.map(c => <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 99, background: `${c.color}12`, border: `1.5px solid ${c.color}32` }}>
          {c.logoUrl
            ? <img src={c.logoUrl} alt="" style={{ width: 18, height: 18, borderRadius: 4, objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} />
            : <div style={{ width: 9, height: 9, borderRadius: "50%", background: c.color }} />}
          <span style={{ fontSize: 13, fontWeight: 600, color: c.color }}>{c.name}</span>
          <button onClick={() => { setChForm({ name: c.name, color: c.color, logoUrl: c.logoUrl || "" }); setEch(c.id); setChModal(true); }} style={{ border: "none", background: "none", cursor: "pointer", color: c.color, opacity: .6, padding: 0, display: "flex" }}><Edit2 size={11} /></button>
          <button onClick={() => { if (window.confirm("Delete?")) saveChannels(channels.filter(x => x.id !== c.id)); }} style={{ border: "none", background: "none", cursor: "pointer", color: T.red, opacity: .6, padding: 0, display: "flex" }}><X size={11} /></button>
        </div>)}
      </div>
    </div>}

    {tab === "access" && isAdmin && <div className="glass" style={{ padding: 20, borderRadius: T.radius }}>
      <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 4 }}>Page Access Control</div>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>Lock/unlock pages per manager. Dashboard always accessible.</div>
      {users.filter(u => u.role === "manager").map(u => {
        const lk = u.lockedPages || [];
        return <div key={u.id} style={{ padding: 16, borderRadius: 14, background: T.isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.5)", border: `1px solid ${T.borderSubtle}`, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${T.blue}1C`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: T.blue }}>{u.name[0]}</div>
            <div><div style={{ fontWeight: 600, color: T.text }}>{u.name}</div><div style={{ fontSize: 11, color: T.textMuted }}>@{u.username}</div></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 8 }}>
            {LOCKABLE.map(pg => {
              const isLocked = lk.includes(pg.id);
              return <button key={pg.id} onClick={() => toggleLock(u.id, pg.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${isLocked ? T.red + "40" : T.green + "40"}`, background: isLocked ? T.redBg : T.greenBg, cursor: "pointer", transition: "all .15s" }}>
                {isLocked ? <Lock size={12} color={T.red} /> : <Unlock size={12} color={T.green} />}
                <span style={{ fontSize: 12, fontWeight: 600, color: isLocked ? T.red : T.green }}>{pg.label}</span>
              </button>;
            })}
          </div>
        </div>;
      })}
      {users.filter(u => u.role === "manager").length === 0 && <div style={{ padding: "24px 0", textAlign: "center", color: T.textMuted }}>No managers yet</div>}
    </div>}

    {tab === "export" && isAdmin && <div className="glass" style={{ padding: 20, borderRadius: T.radius }}>
      <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 16 }}>Export Data</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
        {[
          { l: "Products", fn: () => dlCSV(toCSV(ctx.products, ["id", "name", "alias", "sku", "hsn", "mrp", "purchasePrice", "margin", "gstRate", "unit", "minStock", "categoryId", "description"]), "products") },
          { l: "Sales Bills", fn: () => dlCSV(toCSV(ctx.bills.filter(b => b.type === "sale").map(b => ({ ...b, itemsSummary: b.items.map(i => `${i.productName} x${i.qty}`).join("|") })), ["billNo", "date", "channelId", "itemsSummary", "subtotal", "discAmount", "total", "notes"]), "sales_bills") },
          { l: "Purchase Bills", fn: () => dlCSV(toCSV(ctx.bills.filter(b => b.type === "purchase").map(b => ({ ...b, itemsSummary: b.items.map(i => `${i.productName} x${i.qty}`).join("|") })), ["billNo", "date", "vendorId", "itemsSummary", "total", "notes"]), "purchase_bills") },
          { l: "Transactions", fn: () => dlCSV(toCSV(ctx.transactions, ["date", "type", "productId", "qty", "price", "vendorId", "channelId", "userName", "billId", "notes"]), "transactions") },
          { l: "Vendors", fn: () => dlCSV(toCSV(ctx.vendors, ["id", "name", "contact", "email", "city", "gstin"]), "vendors") },
          { l: "Activity Log", fn: () => dlCSV(toCSV(ctx.actLog, ["ts", "userName", "role", "action", "entity", "entityName"]), "activity") },
          { l: "Change Requests", fn: () => dlCSV(toCSV(ctx.changeReqs, ["ts", "requestedByName", "entity", "action", "entityName", "status", "reviewedByName"]), "change_requests") },
        ].map((item, i) => <button key={i} onClick={item.fn} className="btn-ghost" style={{ padding: 16, borderRadius: 12, flexDirection: "column", gap: 10, alignItems: "flex-start", border: `1px solid ${T.borderSubtle}`, cursor: "pointer" }}>
          <Download size={18} color={T.accent} />
          <div><div style={{ fontSize: 13, fontWeight: 600, color: T.text, textAlign: "left" }}>{item.l}</div><div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Download CSV</div></div>
        </button>)}
      </div>
    </div>}

    {tab === "activity" && <div className="glass" style={{ padding: 20, borderRadius: T.radius }}>
      <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 16 }}>Activity Log</div>
      {myLog.length === 0
        ? <div style={{ padding: "32px 0", textAlign: "center", color: T.textMuted }}>No activity yet</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {myLog.slice(0, 100).map((l, i) => <div key={l.id || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 10, background: T.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)" }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: `${T.accent}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Activity size={13} color={T.accent} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                <span style={{ color: l.role === "admin" ? T.accent : T.blue }}>{l.userName}</span>{" "}
                <span style={{ textTransform: "capitalize", color: T.textSub }}>{l.action}</span>{" "}
                <strong>{l.entityName}</strong>
              </div>
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, flexShrink: 0, whiteSpace: "nowrap" }}>{fmtTs(l.ts)}</div>
          </div>)}
        </div>}
    </div>}

    {tab === "sessions" && isAdmin && <div className="glass" style={{ padding: 20, borderRadius: T.radius }}>
      <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 4 }}>Login History</div>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>All login events across users, most recent first.</div>
      {actLog.filter(l => l.action === "login").length === 0
        ? <div style={{ padding: "32px 0", textAlign: "center", color: T.textMuted }}>No login history yet</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {actLog.filter(l => l.action === "login").slice(0, 100).map((l, i) => (
            <div key={l.id || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: T.isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.6)", border: `1px solid ${T.borderSubtle}` }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: l.role === "admin" ? `${T.accent}18` : `${T.blue}18`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: l.role === "admin" ? T.accent : T.blue, flexShrink: 0 }}>
                {(l.userName || "?")[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{l.userName}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1, textTransform: "capitalize" }}>{l.role}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: T.textSub }}>{fmtTs(l.ts)}</div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>{new Date(l.ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
              </div>
            </div>
          ))}
        </div>}
    </div>}

    {tab === "sheets" && isAdmin && <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="glass" style={{ padding: 20, borderRadius: T.radius, background: T.isDark ? "rgba(37,99,235,0.07)" : "rgba(37,99,235,0.05)", borderColor: "rgba(37,99,235,0.18)" }}>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 15, color: T.blue, marginBottom: 12 }}>📊 Google Sheets Sync</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { n: "1", t: "Create a Google Sheet", d: 'sheets.google.com → New → name "StockWise"' },
            { n: "2", t: "Add Apps Script", d: "Extensions → Apps Script → paste Code.gs → save" },
            { n: "3", t: "Run setupSheets()", d: "Select from dropdown → Run → Allow permissions" },
            { n: "4", t: "Deploy as Web App", d: "Deploy → New Deployment → Web App → Anyone → copy URL" },
            { n: "5", t: "Paste URL below", d: "Test then Save" }
          ].map(s => <div key={s.n} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 20, height: 20, borderRadius: 99, background: `linear-gradient(135deg,${T.blue},${T.cyan})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{s.n}</div>
            <div><div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{s.t}</div><div style={{ fontSize: 12, color: T.textSub, marginTop: 1 }}>{s.d}</div></div>
          </div>)}
        </div>
      </div>
      <div className="glass" style={{ padding: 20, borderRadius: T.radius }}>
        <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 12 }}>Web App URL</div>
        <input className="inp" value={localUrl} onChange={e => setLocalUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <GBtn v="ghost" onClick={() => onTest(localUrl)} icon={<Wifi size={14} />}>Test Connection</GBtn>
          <GBtn onClick={() => { setSheetsUrl(localUrl); lsSet("sw_url", localUrl); }} icon={<Check size={14} />}>Save & Enable Sync</GBtn>
        </div>
        {testStatus === "ok" && <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: T.greenBg, color: T.green, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><CheckCircle size={15} />Connected!</div>}
        {testStatus === "err" && <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: T.redBg, color: T.red, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><XCircle size={15} />Failed. Check URL and "Anyone" access.</div>}
        {testStatus === "testing" && <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: T.blueBg, color: T.blue, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><Loader size={15} style={{ animation: "spin 1s linear infinite" }} />Testing…</div>}
      </div>
    </div>}

    <Modal open={uModal} onClose={() => setUModal(false)} title={eu ? "Edit User" : "Add User"} width={400}
      footer={<><GBtn v="ghost" onClick={() => setUModal(false)}>Cancel</GBtn><GBtn onClick={saveUser}>{eu ? "Save" : "Add User"}</GBtn></>}>
      <div className="fgrid">
        <Field label="Full Name" req cl="s2"><GIn value={uForm.name || ""} onChange={e => uf("name", e.target.value)} placeholder="Store Manager" /></Field>
        <Field label="Username" req><GIn value={uForm.username || ""} onChange={e => uf("username", e.target.value)} placeholder="manager1" /></Field>
        <Field label="Password" req><GIn type="password" value={uForm.password || ""} onChange={e => uf("password", e.target.value)} placeholder="Min 6 chars" /></Field>
        <Field label="Role" cl="s2">
          <GS value={uForm.role || "manager"} onChange={e => uf("role", e.target.value)}>
            <option value="admin">Admin (Full Access)</option>
            <option value="manager">Manager (Restricted)</option>
          </GS>
        </Field>
      </div>
    </Modal>

    <Modal open={chModal} onClose={() => setChModal(false)} title={ech ? "Edit Channel" : "Add Channel"} width={400}
      footer={<><GBtn v="ghost" onClick={() => setChModal(false)}>Cancel</GBtn><GBtn onClick={saveCh}>{ech ? "Save" : "Add"}</GBtn></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Channel Name" req>
          <GIn value={chForm.name} onChange={e => setChForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Meesho" />
        </Field>
        <Field label="Logo URL (optional)">
          <GIn value={chForm.logoUrl || ""} onChange={e => setChForm(p => ({ ...p, logoUrl: e.target.value }))} placeholder="https://example.com/logo.png" />
          {chForm.logoUrl ? (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <img src={chForm.logoUrl} alt="preview" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "contain", background: "#fff", border: `1px solid ${T.borderSubtle}`, padding: 2 }} onError={e => { e.target.style.display = "none"; }} />
              <span style={{ fontSize: 11, color: T.textMuted }}>Logo preview</span>
            </div>
          ) : null}
        </Field>
        <Field label="Brand Color">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="color" value={chForm.color} onChange={e => setChForm(p => ({ ...p, color: e.target.value }))} style={{ width: 42, height: 38, borderRadius: 8, border: `1.5px solid ${T.borderSubtle}`, padding: 3, background: "transparent", cursor: "pointer" }} />
            <GIn value={chForm.color} onChange={e => setChForm(p => ({ ...p, color: e.target.value }))} />
          </div>
        </Field>
      </div>
    </Modal>
  </div>;
}
