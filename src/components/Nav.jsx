import React, { useState } from "react";
import { LayoutDashboard, TrendingUp, ShoppingCart, RotateCcw, Package, BarChart2, PieChart, Tag, Users, ArrowLeftRight, CheckSquare, Settings, LogOut, Bell, AlertTriangle, CheckCircle, RefreshCw, Sun, Moon, Layers, X, Palette } from "lucide-react";
import { useT } from "../theme";

export const ALL_NAV = [
  { id: "dashboard",    label: "Dashboard",    icon: LayoutDashboard,  alwaysAllow: true },
  { id: "sales",        label: "Sales",        icon: TrendingUp },
  { id: "purchase",     label: "Purchase",     icon: ShoppingCart },
  { id: "returns",      label: "Returns",      icon: RotateCcw },
  { id: "inventory",    label: "Inventory",    icon: Package },
  { id: "reports",      label: "Reports",      icon: BarChart2 },
  { id: "pnl",          label: "P&L",          icon: PieChart },
  { id: "products",     label: "Products",     icon: Tag },
  { id: "vendors",      label: "Vendors",      icon: Users },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "approvals",    label: "Approvals",    icon: CheckSquare },
  { id: "settings",     label: "Settings",     icon: Settings, alwaysAllow: true },
];
export const visNav = (user) => {
  if (!user || user.role === "admin") return ALL_NAV;
  const locked = user.lockedPages || [];
  return ALL_NAV.filter(n => n.alwaysAllow || !n.adminOnly && !locked.includes(n.id));
};

export default function Sidebar({ page, setPage, user, onLogout, isDark, toggleTheme, ctx }) {
  const T = useT();
  const col = false;
  const { changeReqs } = ctx;
  const pendingCnt = (changeReqs || []).filter(r => r.status === "pending").length;

  return <div className="desktop-sidebar" style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: T.sidebarW, display: "flex", flexDirection: "column", background: T.sidebarBg ? T.sidebarBg : T.surfaceStrong, backdropFilter: T.blur, borderRight: `1px solid ${T.border}`, zIndex: 50, overflow: "hidden" }}>
    {/* Logo */}
    <div style={{ padding: "20px 14px 14px", borderBottom: `1px solid ${T.borderSubtle}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: T.radiusXl, background: `linear-gradient(135deg,${T.accent},${T.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Layers size={18} color="#fff" /></div>
        <div><div style={{ fontFamily: T.displayFont, fontWeight: 800, fontSize: 16, color: T.sidebarBg ? '#fff' : T.text, letterSpacing: "-0.03em" }}>StockWise</div><div style={{ fontSize: 10, color: T.sidebarBg ? 'rgba(255,255,255,0.7)' : T.textMuted, marginTop: 1 }}>{user?.name?.split(" ")[0] || "Pipal Home"}</div></div>
      </div>
    </div>

    {/* Nav items */}
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px", display: "flex", flexDirection: "column", gap: 1 }}>
      {visNav(user).map(n => (
        <button key={n.id} className={`nav-item${page === n.id ? " active" : ""}`} onClick={() => setPage(n.id)} style={T.sidebarBg ? { color: page === n.id ? "#fff" : "rgba(255,255,255,0.75)", background: page === n.id ? "rgba(255,255,255,0.2)" : "transparent" } : {}}>
          <n.icon size={16} />
          <span>{n.label}</span>
          {n.id === "approvals" && pendingCnt > 0 && <span style={{ marginLeft: "auto", minWidth: 18, height: 18, borderRadius: 99, background: T.red, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{pendingCnt}</span>}
        </button>
      ))}
    </div>

    {/* Bottom controls */}
    <div style={{ padding: "8px", borderTop: `1px solid ${T.borderSubtle}` }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        <button onClick={toggleTheme} className="btn-ghost" style={{ flex: 1, padding: "7px", borderRadius: T.radius, justifyContent: "center", background: T.sidebarBg ? "rgba(255,255,255,0.15)" : undefined, borderColor: T.sidebarBg ? "rgba(255,255,255,0.25)" : undefined, color: T.sidebarBg ? "#fff" : undefined }} title={isDark ? "Light Mode" : "Dark Mode"}>
          {isDark ? <Sun size={14} color={T.amber} /> : <Moon size={14} color={T.accent} />}
          <span style={{ fontSize: 11 }}>{isDark ? "Light" : "Dark"}</span>
        </button>
        <button onClick={() => setPage("settings")} className="btn-ghost" style={{ flex: 1, padding: "7px", borderRadius: T.radius, justifyContent: "center", background: T.sidebarBg ? "rgba(255,255,255,0.15)" : undefined, borderColor: T.sidebarBg ? "rgba(255,255,255,0.25)" : undefined, color: T.sidebarBg ? "#fff" : undefined }} title="Theme Settings">
          <Palette size={14} color={T.accent} />
          <span style={{ fontSize: 11 }}>Theme</span>
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: T.radius }}>
        <div style={{ width: 28, height: 28, borderRadius: T.radius, background: `${T.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: T.accent, flexShrink: 0 }}>{(user?.name || "?")[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.sidebarBg ? '#fff' : T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name}</div>
          <div style={{ fontSize: 10, color: T.sidebarBg ? 'rgba(255,255,255,0.65)' : T.textMuted, textTransform: "capitalize" }}>{user?.role}</div>
        </div>
      </div>
      <button className="btn-ghost" onClick={onLogout} style={{ width: "100%", marginTop: 4, color: T.red, justifyContent: "center", padding: "8px" }}>
        <LogOut size={14} /><span style={{ fontSize: 12 }}>Sign Out</span>
      </button>
    </div>
  </div>;
}

export function MobNav({ page, setPage, user, onLogout, isDark, toggleTheme, pendingCnt }) {
  const T = useT();
  const [showMenu, setShowMenu] = useState(false);
  const mainItems = visNav(user).slice(0, 7); // first 7 in bottom bar

  return <>
    {/* More menu overlay */}
    {showMenu && <div style={{ position: "fixed", inset: 0, zIndex: 150 }} onClick={() => setShowMenu(false)}>
      <div className="glass-strong" onClick={e => e.stopPropagation()} style={{ position: "fixed", bottom: 68, left: 0, right: 0, borderTop: `1px solid ${T.border}`, padding: "12px 16px", maxHeight: "60vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>More</span>
          <button className="btn-ghost" onClick={() => setShowMenu(false)} style={{ padding: "4px 8px" }}><X size={14} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {visNav(user).map(n => (
            <button key={n.id} onClick={() => { setPage(n.id); setShowMenu(false); }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: T.radius, border: `1px solid ${page === n.id ? T.accent : T.border}`, background: page === n.id ? T.accent + "15" : "transparent", cursor: "pointer", color: page === n.id ? T.accent : T.text, fontWeight: page === n.id ? 700 : 500, fontSize: 13 }}>
              <n.icon size={15} />
              <span>{n.label}</span>
              {n.id === "approvals" && pendingCnt > 0 && <span style={{ marginLeft: "auto", minWidth: 16, height: 16, borderRadius: 99, background: T.red, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{pendingCnt}</span>}
            </button>
          ))}
        </div>
        {/* Theme + Sign out in menu */}
        <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: `1px solid ${T.borderSubtle}` }}>
          <button onClick={() => { toggleTheme(); setShowMenu(false); }} className="btn-ghost" style={{ flex: 1, padding: "10px", justifyContent: "center" }}>
            {isDark ? <><Sun size={14} color={T.amber} /><span>Light Mode</span></> : <><Moon size={14} color={T.accent} /><span>Dark Mode</span></>}
          </button>
          <button onClick={() => { setPage("settings"); setShowMenu(false); }} className="btn-ghost" style={{ flex: 1, padding: "10px", justifyContent: "center" }}>
            <Palette size={14} color={T.accent} /><span>Theme</span>
          </button>
          <button onClick={() => { onLogout(); setShowMenu(false); }} className="btn-ghost" style={{ flex: 1, padding: "10px", color: T.red, justifyContent: "center" }}>
            <LogOut size={14} /><span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>}

    {/* Bottom nav bar */}
    <div className="mobile-nav">
      {mainItems.slice(0, 5).map(n => (
        <button key={n.id} onClick={() => setPage(n.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "5px 10px", border: "none", background: "transparent", cursor: "pointer", color: page === n.id ? T.accent : T.textMuted, fontSize: 10, fontWeight: 600, flexShrink: 0, minWidth: 52, position: "relative" }}>
          <n.icon size={18} />
          <span style={{ whiteSpace: "nowrap" }}>{n.label.split(" ")[0]}</span>
          {n.id === "approvals" && pendingCnt > 0 && <span style={{ position: "absolute", top: 2, right: 6, minWidth: 14, height: 14, borderRadius: 99, background: T.red, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{pendingCnt}</span>}
        </button>
      ))}
      {/* More button */}
      <button onClick={() => setShowMenu(true)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "5px 10px", border: "none", background: "transparent", cursor: "pointer", color: T.textMuted, fontSize: 10, fontWeight: 600, flexShrink: 0, minWidth: 52 }}>
        <Layers size={18} />
        <span>More</span>
      </button>
    </div>
  </>;
}

export function TopBar({ page, user, syncSt, lastSync, onSync, toggleTheme, isDark, setPage, ctx, onLogout }) {
  const T = useT();
  const { changeReqs, products, getStock } = ctx;
  const titles = { dashboard: "Dashboard", sales: "Sales", purchase: "Purchase", returns: "Returns", inventory: "Inventory", reports: "Reports", pnl: "P&L", products: "Products", vendors: "Vendors", transactions: "Transactions", approvals: "Approvals", settings: "Settings" };
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const pending = (changeReqs || []).filter(r => r.status === "pending");
  const oos = products.filter(p => getStock(p.id) <= 0);
  const low = products.filter(p => getStock(p.id) > 0 && getStock(p.id) <= Number(p.minStock));
  const alertsCnt = oos.length + low.length;
  const badgeCnt = user.role === "admin" ? (pending.length + alertsCnt) : 0;

  return <div style={{ position: "sticky", top: 12, zIndex: 40, marginBottom: 20 }}>
    <div className="glass" style={{ borderRadius: T.radius, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <h2 style={{ fontFamily: T.displayFont, fontWeight: 800, fontSize: 21, color: T.text, letterSpacing: "-0.03em" }}>{titles[page] || "StockWise"}</h2>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="badge hide-mob" style={{ background: syncSt === "success" ? T.greenBg : syncSt === "syncing" ? T.blueBg : `${T.accent}12`, color: syncSt === "success" ? T.green : syncSt === "syncing" ? T.blue : T.textMuted, cursor: "pointer", fontSize: 11 }} onClick={onSync}>
          <RefreshCw size={10} style={{ animation: syncSt === "syncing" ? "spin 1s linear infinite" : "none" }} />
          {syncSt === "syncing" ? "Syncing" : syncSt === "success" ? `Synced ${lastSync || ""}` : "Offline"}
        </span>
        {badgeCnt > 0 && <div style={{ position: "relative", cursor: "pointer" }} onClick={() => setShowNotifs(!showNotifs)}>
          <div style={{ width: 36, height: 36, borderRadius: T.radius, background: T.amberBg, display: "flex", alignItems: "center", justifyContent: "center" }}><Bell size={16} color={T.amber} /></div>
          <div style={{ position: "absolute", top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 99, background: T.red, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{badgeCnt}</div>
          {showNotifs && <div className="glass-strong fade-up" style={{ position: "absolute", top: 45, right: 0, width: 260, borderRadius: T.radius, padding: 14, boxShadow: T.shadowLg, zIndex: 100 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>Alerts</div>
            {pending.length > 0 && <button onClick={() => { setPage("approvals"); setShowNotifs(false); }} className="btn-ghost" style={{ width: "100%", justifyContent: "flex-start", marginBottom: 6 }}><CheckCircle size={13} color={T.amber} /> {pending.length} Pending Approvals</button>}
            {alertsCnt > 0 && <button onClick={() => { setPage("inventory"); setShowNotifs(false); }} className="btn-ghost" style={{ width: "100%", justifyContent: "flex-start" }}><AlertTriangle size={13} color={T.red} /> {alertsCnt} Stock Alerts</button>}
          </div>}
        </div>}
        {/* User avatar with dropdown */}
        <div style={{ position: "relative" }}>
          <div onClick={() => setShowUser(!showUser)} style={{ width: 36, height: 36, borderRadius: T.radius, background: `${T.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: T.accent, cursor: "pointer", border: `1px solid ${T.accent}30` }}>{(user.name || "?")[0]}</div>
          {showUser && <div className="glass-strong fade-up" style={{ position: "absolute", top: 44, right: 0, width: 200, borderRadius: T.radius, padding: 12, boxShadow: T.shadowLg, zIndex: 100 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: "capitalize", marginBottom: 10 }}>{user.role}</div>
            <button className="btn-ghost" onClick={() => { setPage("settings"); setShowUser(false); }} style={{ width: "100%", justifyContent: "flex-start", marginBottom: 6 }}><Settings size={13} /> Settings & Theme</button>
            <button className="btn-ghost" onClick={() => { onLogout(); setShowUser(false); }} style={{ width: "100%", justifyContent: "flex-start", color: T.red }}><LogOut size={13} /> Sign Out</button>
          </div>}
        </div>
      </div>
    </div>
  </div>;
}
