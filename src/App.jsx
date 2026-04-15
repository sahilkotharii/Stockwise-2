// ╔═══════════════════════════════════════════════════════════════════╗
// ║  App.jsx — Thin shell: theme + routing + rendering              ║
// ║  All state management lives in src/hooks/useAppState.js         ║
// ╚═══════════════════════════════════════════════════════════════════╝

import React, { useEffect } from "react";
import { Layers } from "lucide-react";

import { buildTheme, ThemeCtx, makeCSS, THEMES, ACCENT_PRESETS, CORNER_STYLES } from "./theme";
import { lsSet } from "./storage";
import useAppState from "./hooks/useAppState";

import Sidebar, { MobNav, TopBar, ROLE_PAGES } from "./components/Nav";
import Login from "./components/Login";
import { Toast } from "./components/UI";

import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Purchase from "./pages/Purchase";
import Inventory from "./pages/Inventory";
import Reports from "./pages/Reports";
import Products from "./pages/Products";
import Vendors from "./pages/Vendors";
import Transactions from "./pages/Transactions";
import Approvals from "./pages/Approvals";
import Settings from "./pages/Settings";
import Returns from "./pages/Returns";
import PnL from "./pages/PnL";

export default function App() {
  const state = useAppState();
  const {
    ready, user, page, setPage, toast,
    ctx, isDark, themeId, accentKey, customColor, bgImage, cornerStyle, logoUrl,
    sheetsUrl, setSheetsUrl, syncSt, lastSync, testStatus, onTest,
    handleLogin, handleLogout, pull, toggleTheme,
  } = state;

  // Inject shared constants into ctx (avoids circular import in hook)
  ctx.THEMES = THEMES;
  ctx.ACCENT_PRESETS = ACCENT_PRESETS;
  ctx.CORNER_STYLES = CORNER_STYLES;

  // ── Build theme + inject CSS ──────────────────────────────────────────────
  const theme = buildTheme(themeId, accentKey, isDark, customColor, bgImage, cornerStyle);
  const T = theme;

  useEffect(() => {
    let el = document.getElementById("sw-css");
    if (!el) { el = document.createElement("style"); el.id = "sw-css"; document.head.appendChild(el); }
    el.textContent = makeCSS(theme);
    document.body.style.background = theme.bg;
  }, [themeId, accentKey, isDark, customColor, bgImage, cornerStyle]);

  // ── Page guard ────────────────────────────────────────────────────────────
  const actualPage = (() => {
    if (!user || user.role === "admin") return page;
    const allowed = ROLE_PAGES[user.role] || ROLE_PAGES.manager;
    const locked = user?.lockedPages || [];
    if (!allowed.includes(page) || locked.includes(page)) return "dashboard";
    return page;
  })();

  // ── Loading screen ────────────────────────────────────────────────────────
  if (!ready) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 54, height: 54, borderRadius: 17, background: `linear-gradient(135deg,${T.accent},${T.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", animation: "pulse 1.5s ease infinite", boxShadow: `0 8px 28px ${T.accent}50` }}>
          <Layers size={24} color="#fff" />
        </div>
        <div style={{ fontSize: 14, color: T.textMuted, fontWeight: 500 }}>Loading StockWise…</div>
      </div>
    </div>
  );

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!user) return (
    <ThemeCtx.Provider value={T}>
      <Login users={ctx.users} onLogin={handleLogin} logoUrl={logoUrl} />
    </ThemeCtx.Provider>
  );

  // ── Main app ──────────────────────────────────────────────────────────────
  const ml = `${T.sidebarW + 24}px`;

  return (
    <ThemeCtx.Provider value={T}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <Sidebar page={actualPage} setPage={setPage} user={user} onLogout={handleLogout} isDark={isDark} toggleTheme={toggleTheme} ctx={ctx} />
      <MobNav page={actualPage} setPage={setPage} user={user} onLogout={handleLogout} isDark={isDark} toggleTheme={toggleTheme} pendingCnt={ctx.changeReqs.filter(r => r.status === "pending").length} ctx={ctx} />

      <div className="main-wrap" style={{ marginLeft: ml, padding: "12px 16px 24px", minHeight: "100vh", transition: "margin .2s" }}>
        <TopBar page={actualPage} user={user} syncSt={syncSt} lastSync={lastSync} onSync={pull} toggleTheme={toggleTheme} isDark={isDark} setPage={setPage} ctx={ctx} onLogout={handleLogout} />
        <div className="fade-up">
          {actualPage === "dashboard"    && <Dashboard    ctx={ctx} />}
          {actualPage === "sales"        && <Sales        ctx={ctx} />}
          {actualPage === "purchase"     && <Purchase     ctx={ctx} />}
          {actualPage === "inventory"    && <Inventory    ctx={ctx} />}
          {actualPage === "reports"      && <Reports      ctx={ctx} />}
          {actualPage === "products"     && <Products     ctx={ctx} />}
          {actualPage === "vendors"      && <Vendors      ctx={ctx} />}
          {actualPage === "transactions" && <Transactions ctx={ctx} />}
          {actualPage === "returns"      && <Returns      ctx={ctx} />}
          {actualPage === "pnl"          && <PnL ctx={ctx} />}
          {actualPage === "approvals"    && user.role === "admin" && <Approvals ctx={ctx} />}
          {actualPage === "settings"     && <Settings ctx={ctx} sheetsUrl={sheetsUrl} setSheetsUrl={url => { setSheetsUrl(url); lsSet("sw_url", url); }} testStatus={testStatus} onTest={onTest} />}
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
