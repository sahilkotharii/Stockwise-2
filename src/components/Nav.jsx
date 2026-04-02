import React, { useState } from "react";
import { LayoutDashboard, TrendingUp, ShoppingCart, Package, Truck, ArrowLeftRight, BarChart2, Settings, LogOut, Layers, ChevronRight, RefreshCw, Bell, CheckCircle, AlertTriangle, Sun, Moon, Box } from "lucide-react";
import { useT } from "../theme";
import { GBtn } from "./UI";

export const ALL_NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, alwaysAllow: true },
  { id: "sales", label: "Sales", icon: TrendingUp },
  { id: "purchase", label: "Purchase", icon: ShoppingCart },
  { id: "inventory", label: "Inventory", icon: Box },
  { id: "reports", label: "Reports", icon: BarChart2 },
  { id: "products", label: "Products", icon: Package },
  { id: "vendors", label: "Vendors", icon: Truck },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "approvals", label: "Approvals", icon: CheckCircle, adminOnly: true },
  { id: "settings", label: "Settings", icon: Settings, adminOnly: true },
];

export const visNav = user => {
  const lk = user.lockedPages || [];
  return ALL_NAV.filter(n => {
    if (n.adminOnly) return user.role === "admin";
    if (user.role === "admin") return true;
    if (n.alwaysAllow) return true;
    return !lk.includes(n.id);
  });
};

export function Sidebar({ page, setPage, user, onLogout, col, setCol, syncSt, lastSync, onSync, toggleTheme, isDark, pendingCnt }) {
  const T = useT();
  const items = visNav(user);
  return <div className="desktop-sidebar glass" style={{ position: "fixed", left: 12, top: 12, bottom: 12, width: col ? T.sidebarC : T.sidebarW, borderRadius: 20, display: "flex", flexDirection: "column", zIndex: 50, transition: "width .2s", overflow: "hidden" }}>
    <div style={{ padding: col ? "14px 10px" : "18px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${T.borderSubtle}`, minHeight: 70 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${T.accent},${T.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 4px 12px ${T.accent}45` }}><Layers size={18} color="#fff" /></div>
      {!col && <div><div style={{ fontFamily: T.displayFont, fontWeight: 800, fontSize: 15, color: T.text, letterSpacing: "-0.02em" }}>StockWise</div><div style={{ fontSize: 10, color: T.textMuted, fontWeight: 500, marginTop: 1 }}>Pipal Home</div></div>}
    </div>
    <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
      {items.map(n => <button key={n.id} onClick={() => setPage(n.id)} className={`nav-item${page === n.id ? " active" : ""}`} title={col ? n.label : ""} style={{ justifyContent: col ? "center" : "flex-start", padding: col ? "10px" : "9px 12px", position: "relative" }}>
        <n.icon size={17} style={{ flexShrink: 0 }} />{!col && <span>{n.label}</span>}
        {n.id === "approvals" && pendingCnt > 0 && <span style={{ position: "absolute", top: 6, right: col ? 4 : 8, minWidth: 18, height: 18, borderRadius: 99, background: T.red, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{pendingCnt}</span>}
      </button>)}
    </nav>
    <div style={{ padding: "10px 8px", borderTop: `1px solid ${T.borderSubtle}` }}>
      {!col && <div style={{ padding: "10px 12px", borderRadius: 12, background: T.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}><span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.05em" }}>SYNC</span><button onClick={onSync} className="btn-ghost" style={{ padding: "3px 7px", fontSize: 11, borderRadius: 6 }}><RefreshCw size={11} style={{ animation: syncSt === "syncing" ? "spin 1s linear infinite" : "none" }} /></button></div>
        <span className="badge" style={{ background: syncSt === "success" ? T.greenBg : syncSt === "syncing" ? T.blueBg : `${T.accent}12`, color: syncSt === "success" ? T.green : syncSt === "syncing" ? T.blue : T.textMuted, fontSize: 10 }}>{syncSt === "syncing" ? "Syncing…" : syncSt === "success" ? `Synced ${lastSync || ""}` : "Offline"}</span>
      </div>}
      {!col && <div style={{ padding: "10px 12px", borderRadius: 12, background: `${T.accent}10`, marginBottom: 6 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{user.name}</div><div style={{ fontSize: 11, color: T.textMuted, marginTop: 1, textTransform: "capitalize" }}>{user.role}</div></div>}
      <button className="nav-item" onClick={toggleTheme} title={col ? (isDark ? "Light" : "Dark") : ""} style={{ justifyContent: col ? "center" : "flex-start" }}>{isDark ? <Sun size={16} style={{ color: T.amber }} /> : <Moon size={16} style={{ color: T.accent }} />}{!col && <span style={{ fontSize: 13 }}>{isDark ? "Light Mode" : "Dark Mode"}</span>}</button>
      <button className="nav-item" onClick={onLogout} style={{ color: T.red, justifyContent: col ? "center" : "flex-start" }} title={col ? "Sign Out" : ""}><LogOut size={16} />{!col && <span style={{ fontSize: 13 }}>Sign Out</span>}</button>
      <button className="nav-item" onClick={() => setCol(!col)} style={{ justifyContent: col ? "center" : "flex-start" }}>{col ? <ChevronRight size={16} /> : <><ChevronRight size={16} style={{ transform: "rotate(180deg)" }} /><span style={{ fontSize: 12 }}>Collapse</span></>}</button>
    </div>
  </div>;
}

export function MobNav({ page, setPage, user, pendingCnt }) {
  const T = useT();
  const items = visNav(user);
  return <div className="mobile-nav">{items.map(n => <button key={n.id} onClick={() => setPage(n.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "5px 10px", border: "none", background: "transparent", cursor: "pointer", color: page === n.id ? T.accent : T.textMuted, fontSize: 9, fontWeight: 600, flexShrink: 0, minWidth: 48, position: "relative" }}><n.icon size={18} /><span style={{ whiteSpace: "nowrap" }}>{n.label.split(" ")[0]}</span>{n.id === "approvals" && pendingCnt > 0 && <span style={{ position: "absolute", top: 2, right: 6, minWidth: 15, height: 15, borderRadius: 99, background: T.red, color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 2px" }}>{pendingCnt}</span>}</button>)}</div>;
}

export function TopBar({ page, user, syncSt, lastSync, onSync, toggleTheme, isDark, setPage, ctx }) {
  const T = useT();
  const { changeReqs, products, getStock } = ctx;
  const titles = { dashboard: "Dashboard", sales: "Sales", purchase: "Purchase", inventory: "Inventory", reports: "Reports", products: "Products", vendors: "Vendors", transactions: "Transactions", approvals: "Approvals", settings: "Settings" };
  const [showNotifs, setShowNotifs] = useState(false);
  const pending = changeReqs.filter(r => r.status === "pending");
  const myReqs = changeReqs.filter(r => r.requestedBy === user.id).slice(0, 5);
  const oos = products.filter(p => getStock(p.id) <= 0);
  const low = products.filter(p => getStock(p.id) > 0 && getStock(p.id) <= Number(p.minStock));
  const alertsCnt = oos.length + low.length;
  const badgeCnt = user.role === "admin" ? (pending.length + alertsCnt) : myReqs.filter(r => r.status === "pending").length;

  return <div style={{ position: "sticky", top: 12, zIndex: 40, marginBottom: 20 }}>
    <div className="glass" style={{ borderRadius: 14, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <h2 style={{ fontFamily: T.displayFont, fontWeight: 800, fontSize: 21, color: T.text, letterSpacing: "-0.03em" }}>{titles[page] || "StockWise"}</h2>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={toggleTheme} className="btn-ghost" style={{ padding: "7px 7px", borderRadius: 10 }}>{isDark ? <Sun size={15} color={T.amber} /> : <Moon size={15} color={T.accent} />}</button>
        <span className="badge" style={{ background: syncSt === "success" ? T.greenBg : syncSt === "syncing" ? T.blueBg : `${T.accent}12`, color: syncSt === "success" ? T.green : syncSt === "syncing" ? T.blue : T.textMuted, cursor: "pointer", fontSize: 10 }} onClick={onSync}><RefreshCw size={10} style={{ animation: syncSt === "syncing" ? "spin 1s linear infinite" : "none" }} />{syncSt === "syncing" ? "Syncing" : syncSt === "success" ? `Synced ${lastSync || ""}` : "Offline"}</span>
        <div style={{ position: "relative", cursor: "pointer" }}>
          <div onClick={() => setShowNotifs(!showNotifs)}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: badgeCnt > 0 ? T.amberBg : `${T.accent}12`, display: "flex", alignItems: "center", justifyContent: "center" }}><Bell size={16} color={badgeCnt > 0 ? T.amber : T.textMuted} /></div>
            {badgeCnt > 0 && <div style={{ position: "absolute", top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 99, background: T.red, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{badgeCnt}</div>}
          </div>
          {showNotifs && (
            <div className="glass-strong fade-up" style={{ position: "absolute", top: 45, right: 0, width: 280, borderRadius: 14, padding: 14, boxShadow: T.shadowLg, zIndex: 100 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 10, borderBottom: `1px solid ${T.borderSubtle}`, paddingBottom: 8 }}>Notifications</div>
              {user.role === "admin" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pending.length > 0 && <button onClick={() => { setPage("approvals"); setShowNotifs(false); }} className="btn-ghost" style={{ justifyContent: "flex-start", width: "100%", color: T.text }}><CheckCircle size={14} color={T.amber} /> {pending.length} Pending Approvals</button>}
                  {alertsCnt > 0 && <button onClick={() => { setPage("inventory"); setShowNotifs(false); }} className="btn-ghost" style={{ justifyContent: "flex-start", width: "100%", color: T.text }}><AlertTriangle size={14} color={T.red} /> {alertsCnt} Low Stock / OOS Alerts</button>}
                  {pending.length === 0 && alertsCnt === 0 && <div style={{ fontSize: 12, color: T.textMuted, textAlign: "center", padding: 10 }}>All caught up!</div>}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {myReqs.length > 0 ? myReqs.map(r => <div key={r.id} style={{ fontSize: 11, color: T.text, padding: 8, background: T.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", borderRadius: 8 }}><div style={{ fontWeight: 600 }}>{r.entityName}</div><div style={{ color: r.status === "pending" ? T.amber : r.status === "approved" ? T.green : T.red, textTransform: "capitalize", marginTop: 2 }}>{r.status}</div></div>) : <div style={{ fontSize: 12, color: T.textMuted, textAlign: "center", padding: 10 }}>No recent requests</div>}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${T.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: T.text }}>{user.name[0]}</div>
      </div>
    </div>
  </div>;
}
