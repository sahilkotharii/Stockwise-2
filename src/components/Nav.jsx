import React, { useState } from "react";
import { LayoutDashboard, TrendingUp, ShoppingCart, RotateCcw, Package, BarChart2, PieChart, Tag, Users, ArrowLeftRight, CheckSquare, Settings, LogOut, Bell, AlertTriangle, CheckCircle, RefreshCw, Sun, Moon, Layers, X, User, Download } from "lucide-react";
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
  { id: "approvals",    label: "Approvals",    icon: CheckSquare, adminOnly: true },
  { id: "settings",     label: "Settings",     icon: Settings, alwaysAllow: true },
];
// Pages each role can access (admin = all)
const ROLE_PAGES = {
  admin:      null, // null = all
  manager:    ["dashboard","sales","purchase","returns","inventory","reports","pnl","products","vendors","transactions","approvals","settings"],
  sales:      ["dashboard","sales","inventory","returns","vendors","settings"],
  purchase:   ["dashboard","purchase","vendors","inventory","settings"],
  accountant: ["dashboard","sales","purchase","returns","inventory","pnl","transactions","settings"],
  production: ["dashboard","products","inventory","reports","settings"],
};
export { ROLE_PAGES };

export const visNav = (user) => {
  if (!user || user.role === "admin") return ALL_NAV;
  const allowed = ROLE_PAGES[user.role] || ROLE_PAGES.manager;
  const locked = user.lockedPages || [];
  return ALL_NAV.filter(n => allowed.includes(n.id) && !locked.includes(n.id));
};

// ── Shared Avatar component ──────────────────────────────────────────────────
function Avatar({ user, size = 28 }) {
  const T = useT();
  return (
    <div style={{ width: size, height: size, borderRadius: T.radiusFull, background: `${T.accent}22`, border: `2px solid ${T.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: size * 0.42, color: T.accent, flexShrink: 0, userSelect: "none" }}>
      {(user?.name || "?")[0].toUpperCase()}
    </div>
  );
}

// ── Shared Profile Dropdown ─────────────────────────────────────────────────
function ProfileDropdown({ user, onClose, setPage, setSettingsTab, onLogout, align = "left" }) {
  const T = useT();
  const menuItems = [
    { icon: User, label: "Edit Profile", action: () => { setPage("settings"); setSettingsTab?.("profile"); onClose(); } },
    { icon: Download, label: "Export Data", action: () => { setPage("settings"); setSettingsTab?.("export"); onClose(); } },
    { icon: Settings, label: "Settings", action: () => { setPage("settings"); onClose(); } },
  ];
  return (
    <div className="glass-strong spring-down" onClick={e => e.stopPropagation()}
      style={{ position: "absolute", [align === "right" ? "right" : "left"]: 0, bottom: align === "left" ? "calc(100% + 8px)" : undefined, top: align === "right" ? "calc(100% + 8px)" : undefined, width: 220, borderRadius: T.radiusXl, padding: 12, boxShadow: T.shadowLg, zIndex: 200 }}>
      {/* User info header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px 12px", borderBottom: `1px solid ${T.borderSubtle}`, marginBottom: 8 }}>
        <Avatar user={user} size={36} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name}</div>
          <div style={{ fontSize: 11, color: T.textMuted, textTransform: "capitalize" }}>{user?.role}</div>
        </div>
      </div>
      {/* Menu items */}
      {menuItems.map(item => (
        <button key={item.label} onClick={item.action} className="btn-ghost"
          style={{ width: "100%", justifyContent: "flex-start", padding: "9px 10px", marginBottom: 4, gap: 10 }}>
          <item.icon size={14} color={T.textSub} /><span style={{ fontSize: 13 }}>{item.label}</span>
        </button>
      ))}
      {/* Sign out */}
      <div style={{ borderTop: `1px solid ${T.borderSubtle}`, marginTop: 4, paddingTop: 8 }}>
        <button onClick={() => { onLogout(); onClose(); }} className="btn-ghost"
          style={{ width: "100%", justifyContent: "flex-start", padding: "9px 10px", gap: 10, color: T.red }}>
          <LogOut size={14} color={T.red} /><span style={{ fontSize: 13 }}>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

// ── Desktop Sidebar ─────────────────────────────────────────────────────────
export default function Sidebar({ page, setPage, user, onLogout, isDark, toggleTheme, ctx }) {
  const T = useT();
  const { logoUrl, changeReqs, setSettingsTab } = ctx || {};
  const pendingCnt = (changeReqs || []).filter(r => r.status === "pending").length;
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="desktop-sidebar" style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: T.sidebarW, display: "flex", flexDirection: "column", zIndex: 50, overflow: "hidden", ...(T.isGlass ? { background: T.surface, backdropFilter: T.blur, WebkitBackdropFilter: T.blur, borderRight: `1px solid ${T.border}`, boxShadow: T.shadowLg + (T.shimmer ? ", " + T.shimmer : "") } : T.sidebarBg ? { background: T.sidebarBg, borderRight: "none" } : { background: T.surfaceStrong, borderRight: `1px solid ${T.border}` }) }}>

      {/* Logo */}
      <div style={{ padding: "20px 14px 14px", borderBottom: `1px solid ${T.borderSubtle}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: T.radiusXl, background: logoUrl ? "transparent" : `linear-gradient(135deg,${T.accent},${T.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
            {logoUrl ? <img src={logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Layers size={18} color="#fff" />}
          </div>
          <div>
            <div style={{ fontFamily: T.displayFont, fontWeight: 800, fontSize: 16, color: T.sidebarBg ? "#fff" : T.text, letterSpacing: "-0.03em" }}>StockWise</div>
            <div style={{ fontSize: 10, color: T.sidebarBg ? "rgba(255,255,255,0.7)" : T.textMuted, marginTop: 1 }}>Pipal Home</div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: 1 }}>
        {visNav(user).map(n => (
          <button key={n.id} className={`nav-item${page === n.id ? " active" : ""}`} onClick={() => setPage(n.id)}
            style={T.sidebarBg ? { color: page === n.id ? "#fff" : "rgba(255,255,255,0.75)", background: page === n.id ? "rgba(255,255,255,0.2)" : "transparent" } : {}}>
            <n.icon size={16} />
            <span>{n.label}</span>
            {n.id === "approvals" && pendingCnt > 0 && <span style={{ marginLeft: "auto", minWidth: 18, height: 18, borderRadius: T.radiusFull, background: T.red, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{pendingCnt}</span>}
          </button>
        ))}
      </div>

      {/* Bottom — avatar with dropdown, dark toggle */}
      <div style={{ padding: "8px", borderTop: `1px solid ${T.borderSubtle}` }}>
        {/* Dark mode toggle only */}
        <button onClick={toggleTheme} className="btn-ghost" style={{ width: "100%", marginBottom: 6, padding: "7px", justifyContent: "center", background: T.sidebarBg ? "rgba(255,255,255,0.15)" : undefined, borderColor: T.sidebarBg ? "rgba(255,255,255,0.25)" : undefined, color: T.sidebarBg ? "#fff" : undefined }}>
          {isDark ? <Sun size={14} color={T.amber} /> : <Moon size={14} color={T.accent} />}
          <span style={{ fontSize: 11, marginLeft: 6 }}>{isDark ? "Light Mode" : "Dark Mode"}</span>
        </button>

        {/* Avatar row with dropdown */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowProfile(p => !p)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: T.radius, border: "none", background: showProfile ? (T.sidebarBg ? "rgba(255,255,255,0.15)" : `${T.accent}10`) : "transparent", cursor: "pointer", transition: "all .15s" }}>
            <Avatar user={user} size={28} />
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.sidebarBg ? "#fff" : T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: T.sidebarBg ? "rgba(255,255,255,0.65)" : T.textMuted, textTransform: "capitalize" }}>{user?.role}</div>
            </div>
            <span style={{ fontSize: 10, color: T.sidebarBg ? "rgba(255,255,255,0.5)" : T.textMuted }}>{showProfile ? "▲" : "▼"}</span>
          </button>
          {showProfile && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setShowProfile(false)} />
              <ProfileDropdown user={user} onClose={() => setShowProfile(false)} setPage={setPage} setSettingsTab={setSettingsTab} onLogout={onLogout} align="left" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mobile Nav ──────────────────────────────────────────────────────────────
export function MobNav({ page, setPage, user, onLogout, isDark, toggleTheme, pendingCnt, ctx }) {
  const T = useT();
  const { setSettingsTab } = ctx || {};
  const [showMenu, setShowMenu] = useState(false);
  const mainItems = visNav(user).slice(0, 5);

  return <>
    {showMenu && (
      <div style={{ position: "fixed", inset: 0, zIndex: 150 }} onClick={() => setShowMenu(false)}>
        <div className="glass-strong spring-up" onClick={e => e.stopPropagation()} style={{ position: "fixed", bottom: 68, left: 0, right: 0, borderTop: `1px solid ${T.border}`, padding: "12px 16px", maxHeight: "60vh", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Menu</span>
            <button className="btn-ghost" onClick={() => setShowMenu(false)} style={{ padding: "4px 8px" }}><X size={14} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {visNav(user).map(n => (
              <button key={n.id} onClick={() => { setPage(n.id); setShowMenu(false); }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: T.radius, border: `1px solid ${page === n.id ? T.accent : T.border}`, background: page === n.id ? T.accent + "15" : "transparent", cursor: "pointer", color: page === n.id ? T.accent : T.text, fontWeight: page === n.id ? 700 : 500, fontSize: 13 }}>
                <n.icon size={15} />
                <span>{n.label}</span>
                {n.id === "approvals" && pendingCnt > 0 && <span style={{ marginLeft: "auto", minWidth: 16, height: 16, borderRadius: T.radiusFull, background: T.red, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{pendingCnt}</span>}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: `1px solid ${T.borderSubtle}` }}>
            <button onClick={() => { toggleTheme(); setShowMenu(false); }} className="btn-ghost" style={{ flex: 1, padding: "10px", justifyContent: "center" }}>
              {isDark ? <><Sun size={14} color={T.amber} /><span>Light</span></> : <><Moon size={14} /><span>Dark</span></>}
            </button>
            <button onClick={() => { setPage("settings"); setSettingsTab?.("profile"); setShowMenu(false); }} className="btn-ghost" style={{ flex: 1, padding: "10px", justifyContent: "center" }}>
              <User size={14} /><span>Profile</span>
            </button>
            <button onClick={() => { setPage("settings"); setSettingsTab?.("export"); setShowMenu(false); }} className="btn-ghost" style={{ flex: 1, padding: "10px", justifyContent: "center" }}>
              <Download size={14} /><span>Export</span>
            </button>
            <button onClick={() => { onLogout(); setShowMenu(false); }} className="btn-ghost" style={{ flex: 1, padding: "10px", color: T.red, justifyContent: "center" }}>
              <LogOut size={14} /><span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="mobile-nav">
      {mainItems.map(n => (
        <button key={n.id} onClick={() => setPage(n.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "8px 4px", border: "none", background: "transparent", cursor: "pointer", color: page === n.id ? T.accent : T.textMuted, fontSize: 10, fontWeight: 600, position: "relative" }}>
          <n.icon size={20} />
          <span style={{ whiteSpace: "nowrap", lineHeight: 1 }}>{n.label.split(" ")[0]}</span>
          {n.id === "approvals" && pendingCnt > 0 && <span style={{ position: "absolute", top: 4, right: "22%", minWidth: 14, height: 14, borderRadius: T.radiusFull, background: T.red, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{pendingCnt}</span>}
        </button>
      ))}
      <button onClick={() => setShowMenu(true)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "8px 4px", border: "none", background: "transparent", cursor: "pointer", color: T.textMuted, fontSize: 10, fontWeight: 600 }}>
        <Layers size={20} />
        <span style={{ lineHeight: 1 }}>More</span>
      </button>
    </div>
  </>;
}

// ── Top Bar ──────────────────────────────────────────────────────────────────
export function TopBar({ page, user, syncSt, lastSync, onSync, toggleTheme, isDark, setPage, ctx, onLogout }) {
  const T = useT();
  const { changeReqs, products, getStock, setSettingsTab } = ctx;
  const titles = { dashboard:"Dashboard", sales:"Sales", purchase:"Purchase", returns:"Returns", inventory:"Inventory", reports:"Reports", pnl:"P&L", products:"Products", vendors:"Vendors", transactions:"Transactions", approvals:"Approvals", settings:"Settings" };
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const pending = (changeReqs || []).filter(r => r.status === "pending");
  const oos = products.filter(p => getStock(p.id) <= 0);
  const low = products.filter(p => getStock(p.id) > 0 && getStock(p.id) <= Number(p.minStock));
  const alertsCnt = oos.length + low.length;
  const badgeCnt = user.role === "admin"
    ? (pending.length + alertsCnt)
    : alertsCnt; // non-admin still sees stock alerts

  return (
    <div style={{ position: "sticky", top: 12, zIndex: 40, marginBottom: 20 }}>
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

          {badgeCnt > 0 && (
            <div style={{ position: "relative", cursor: "pointer" }} onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); }}>
              <div style={{ width: 36, height: 36, borderRadius: T.radius, background: T.amberBg, display: "flex", alignItems: "center", justifyContent: "center" }}><Bell size={16} color={T.amber} /></div>
              <div style={{ position: "absolute", top: -4, right: -4, minWidth: 17, height: 17, borderRadius: T.radiusFull, background: T.red, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{badgeCnt}</div>
              {showNotifs && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setShowNotifs(false)} />
                  <div className="glass-strong spring-down" onClick={e=>e.stopPropagation()} style={{ position: "absolute", top: 46, right: 0, width: 300, borderRadius: T.radiusXl, boxShadow: T.shadowXl, zIndex: 200, maxHeight: "70vh", overflowY: "auto" }}>
                    <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${T.borderSubtle}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 14, color: T.text }}>Notifications</span>
                      <button onClick={()=>setShowNotifs(false)} style={{ background:"none", border:"none", cursor:"pointer", color:T.textMuted, fontSize:18, lineHeight:1 }}>×</button>
                    </div>
                    {pending.length === 0 && alertsCnt === 0 && (
                      <div style={{ padding: "20px 16px", textAlign:"center", color:T.textMuted, fontSize:13 }}>No new notifications</div>
                    )}
                    {pending.length > 0 && (
                      <div>
                        <div style={{ padding:"8px 16px 4px", fontSize:10, fontWeight:700, color:T.textMuted, letterSpacing:"0.05em" }}>APPROVALS PENDING</div>
                        <button onClick={() => { setPage("approvals"); setShowNotifs(false); }}
                          style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 16px", background:"transparent", border:"none", borderBottom:`1px solid ${T.borderSubtle}`, cursor:"pointer", textAlign:"left" }}
                          onMouseEnter={e=>e.currentTarget.style.background=T.isDark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.03)"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <div style={{ width:32, height:32, borderRadius:T.radiusFull, background:T.amberBg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><CheckCircle size={15} color={T.amber}/></div>
                          <div><div style={{ fontSize:13, fontWeight:600, color:T.text }}>{pending.length} Change Request{pending.length>1?"s":""} Pending</div><div style={{ fontSize:11, color:T.textMuted }}>Tap to review in Approvals</div></div>
                        </button>
                      </div>
                    )}
                    {oos.length > 0 && (
                      <div>
                        <div style={{ padding:"8px 16px 4px", fontSize:10, fontWeight:700, color:T.textMuted, letterSpacing:"0.05em" }}>OUT OF STOCK</div>
                        {oos.slice(0,5).map(p => (
                          <button key={p.id} onClick={() => { setPage("inventory"); setShowNotifs(false); }}
                            style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 16px", background:"transparent", border:"none", borderBottom:`1px solid ${T.borderSubtle}`, cursor:"pointer", textAlign:"left" }}
                            onMouseEnter={e=>e.currentTarget.style.background=T.isDark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.03)"}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <div style={{ width:8, height:8, borderRadius:"50%", background:T.red, flexShrink:0 }}/>
                            <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:12, fontWeight:600, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div><div style={{ fontSize:11, color:T.red }}>Out of stock</div></div>
                          </button>
                        ))}
                        {oos.length > 5 && <div style={{ padding:"6px 16px", fontSize:11, color:T.textMuted }}>+{oos.length-5} more out of stock</div>}
                      </div>
                    )}
                    {low.length > 0 && (
                      <div>
                        <div style={{ padding:"8px 16px 4px", fontSize:10, fontWeight:700, color:T.textMuted, letterSpacing:"0.05em" }}>LOW STOCK</div>
                        {low.slice(0,5).map(p => (
                          <button key={p.id} onClick={() => { setPage("inventory"); setShowNotifs(false); }}
                            style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 16px", background:"transparent", border:"none", borderBottom:`1px solid ${T.borderSubtle}`, cursor:"pointer", textAlign:"left" }}
                            onMouseEnter={e=>e.currentTarget.style.background=T.isDark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.03)"}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <div style={{ width:8, height:8, borderRadius:"50%", background:T.amber, flexShrink:0 }}/>
                            <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:12, fontWeight:600, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div><div style={{ fontSize:11, color:T.amber }}>Stock: {getStock(p.id)} · Min: {p.minStock||0}</div></div>
                          </button>
                        ))}
                        {low.length > 5 && <div style={{ padding:"6px 16px", fontSize:11, color:T.textMuted }}>+{low.length-5} more low stock</div>}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Avatar with dropdown */}
          <div style={{ position: "relative" }}>
            <div onClick={() => { setShowProfile(p => !p); setShowNotifs(false); }} style={{ cursor: "pointer" }}>
              <Avatar user={user} size={36} />
            </div>
            {showProfile && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setShowProfile(false)} />
                <ProfileDropdown user={user} onClose={() => setShowProfile(false)} setPage={setPage} setSettingsTab={setSettingsTab} onLogout={onLogout} align="right" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
