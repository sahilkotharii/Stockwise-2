import React, { useState, useEffect, useCallback } from "react";
import { Layers } from "lucide-react";

import { buildTheme, ThemeCtx, makeCSS, THEMES, ACCENT_PRESETS } from "./theme";
import { SK, lsGet, lsSet } from "./storage";
import { sheetsGet, syncEnt } from "./sheets";
import { uid, today } from "./utils";

// ── Default Google Sheets Web App URL ────────────────────────────────────────
const DEFAULT_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxiLGcaBsuNtUrT7tBFSzAe0LOmMqTKWIfjZAR6YCE7kTfLjAF-7FeeMY1VRyuTSHVh/exec";

import Sidebar, { MobNav, TopBar, ALL_NAV } from "./components/Nav";
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
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [settingsTab, setSettingsTab] = useState("profile");

  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [bills, setBills] = useState([]);

  const [sheetsUrl, setSheetsUrl] = useState(DEFAULT_SHEETS_URL);
  const [syncSt, setSyncSt] = useState("idle");
  const [lastSync, setLastSync] = useState(null);
  const [testStatus, setTestStatus] = useState(null);
  const [isDark, setIsDark] = useState(false);
  const [themeId, setThemeId] = useState("glass");
  const [accentKey, setAccentKey] = useState("copper");
  const [customColor, setCustomColorState] = useState("");
  const [bgImage, setBgImageState] = useState("");
  const [changeReqs, setChangeReqs] = useState([]);
  const [actLog, setActLog] = useState([]);
  const [toast, setToast] = useState(null);
  const [invoiceSettings, setInvoiceSettings] = useState({});

  const theme = buildTheme(themeId, accentKey, isDark, customColor, bgImage);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Debounce helper for push — prevents rapid sequential saves from flooding GAS
  const pushTimers = {};
  const debouncedPush = (entity, rows, delay = 1500) => {
    if (pushTimers[entity]) clearTimeout(pushTimers[entity]);
    pushTimers[entity] = setTimeout(() => push(entity, rows), delay);
  };

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const lnk = document.createElement("link");
    lnk.rel = "stylesheet";
    lnk.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(lnk);

    (async () => {
      const [u, p, c, v, t, b, sUrl, ok, dp, cr, al, tid, ak, cc, bgi] = await Promise.all([
        lsGet(SK.users, null), lsGet(SK.products, null), lsGet(SK.categories, null),
        lsGet(SK.vendors, null), lsGet(SK.transactions, null),
        lsGet(SK.bills, []), lsGet(SK.sheetsUrl, DEFAULT_SHEETS_URL), lsGet(SK.seeded, false),
        lsGet(SK.theme, false), lsGet(SK.changeReqs, []), lsGet(SK.actLog, []),
        lsGet("sw_theme_id", "glass"), lsGet("sw_accent_key", "copper"),
        lsGet("sw_custom_color", ""), lsGet("sw_bg_image", "")
      ]);

      const SEED_USERS = [
        { id: "u1", name: "Sahil Desai", username: "admin", password: "admin123", role: "admin", createdAt: today(), lockedPages: [] },
        { id: "u2", name: "Store Manager", username: "manager", password: "store123", role: "manager", createdAt: today(), lockedPages: [] }
      ];

      const fu = u || SEED_USERS, fp = p || [], fc = c || [], fv = v || [];
      // Sanitize dates from localStorage (may have old "Wed Apr 08 2026..." strings)
      const fixDatesLocal = rows => (rows || []).map(r => {
        if (!r || !r.date) return r;
        const ds = toYMD(r.date);
        return ds !== r.date ? { ...r, date: ds } : r;
      });
      const ft = fixDatesLocal(t);
      const fb = fixDatesLocal(b);
      setUsers(fu); setProducts(fp); setCategories(fc); setVendors(fv);
      setTransactions(ft); setBills(fb || []);
      setSheetsUrl(sUrl || DEFAULT_SHEETS_URL); setIsDark(dp || false);
      setThemeId(tid || "glass"); setAccentKey(ak || "copper");
      setCustomColorState(cc || ""); setBgImageState(bgi || "");
      setChangeReqs(cr || []); setActLog(al || []);
      const invS = await lsGet(SK.invoiceSettings, {});
      setInvoiceSettings(invS || {});

      // ── Restore saved session (stays logged in for 24h) ────────────────────
      const savedSession = await lsGet(SK.session, null);
      if (savedSession && savedSession.userId && savedSession.ts) {
        const age = Date.now() - savedSession.ts;
        if (age < 24 * 60 * 60 * 1000) {
          const sessionUser = (fu).find(x => x.id === savedSession.userId);
          if (sessionUser) setUser(sessionUser);
        } else {
          await lsSet(SK.session, null); // expired — clear it
        }
      }

      if (!ok) await Promise.all([
        lsSet(SK.users, fu), lsSet(SK.products, fp), lsSet(SK.categories, fc),
        lsSet(SK.vendors, fv), lsSet(SK.transactions, ft),
        lsSet(SK.seeded, true)
      ]);

      // Pull from Sheets first — use Sheets users if available, THEN show UI
      // This prevents seed users from overwriting saved credentials
      const url = sUrl || DEFAULT_SHEETS_URL;
      if (url) {
        try {
          const { sheetsGet } = await import("./sheets");
          const data = await sheetsGet(url);
          // Always prefer Sheets users over seed users
          if (data.users?.length) {
            const fixedUsers = data.users;
            setUsers(fixedUsers); await lsSet(SK.users, fixedUsers);
            // Re-resolve session user from Sheets data (fixes stale seed user object)
            const savedSession2 = await lsGet(SK.session, null);
            if (savedSession2?.userId) {
              const freshUser = fixedUsers.find(x => x.id === savedSession2.userId);
              if (freshUser) setUser(freshUser);
            }
          }
          if (data.products?.length) { setProducts(data.products); lsSet(SK.products, data.products); }
          if (data.categories?.length) { setCategories(data.categories); lsSet(SK.categories, data.categories); }
          if (data.vendors?.length) { setVendors(data.vendors); lsSet(SK.vendors, data.vendors); }
          if (data.transactions?.length) { const rows = fixDatesLocal(data.transactions); setTransactions(rows); lsSet(SK.transactions, rows); }
          if (data.bills?.length) { const rows = fixDatesLocal(data.bills); setBills(rows); lsSet(SK.bills, rows); }
          if (data.changeReqs?.length) { setChangeReqs(data.changeReqs); lsSet(SK.changeReqs, data.changeReqs); }
          if (data.appConfig?.length) {
            const cfg = {};
            data.appConfig.forEach(row => { if (!row.key) return; try { cfg[row.key] = JSON.parse(row.value); } catch { cfg[row.key] = row.value; } });
            if (Object.keys(cfg).length > 0) { setInvoiceSettings(cfg); lsSet(SK.invoiceSettings, cfg); }
          }
        } catch(e) { /* Offline — use localStorage data */ }
      }
      setReady(true);
      // Background auto-sync every 4 minutes
      if (url) pull(url);

      // ── Migrate plain-text passwords to hashed on first boot ───────────────
      (async () => {
        const { hashPassword } = await import("./utils");
        const needsMigration = fu.some(u => u.password && !u.password.startsWith("sha256:"));
        if (needsMigration) {
          const migrated = await Promise.all(fu.map(async u => {
            if (!u.password || u.password.startsWith("sha256:")) return u;
            const h = await hashPassword(u.password);
            return { ...u, password: "sha256:" + h };
          }));
          setUsers(migrated);
          await lsSet(SK.users, migrated);
          push("users", migrated);
        }
      })();

      // ── Auto-sync every 4 minutes ──────────────────────────────────────────
      const interval = setInterval(() => pull(url), 4 * 60 * 1000);
      return () => clearInterval(interval);
    })();
  }, []);

  // ── CSS injection ─────────────────────────────────────────────────────────
  useEffect(() => {
    let el = document.getElementById("sw-css");
    if (!el) { el = document.createElement("style"); el.id = "sw-css"; document.head.appendChild(el); }
    el.textContent = makeCSS(theme);
    document.body.style.background = theme.bg;
  }, [themeId, accentKey, isDark, customColor, bgImage]);

  const toggleTheme = () => { const n = !isDark; setIsDark(n); lsSet(SK.theme, n); };
  const setTheme = (tid) => { setThemeId(tid); lsSet("sw_theme_id", tid); };
  const setAccent = (ak) => { setAccentKey(ak); lsSet("sw_accent_key", ak); };
  const setCustomColor = (c) => { setCustomColorState(c); lsSet("sw_custom_color", c); };
  const setBgImage = (url) => { setBgImageState(url); lsSet("sw_bg_image", url); };

  // ── Sheets sync ───────────────────────────────────────────────────────────
  async function pull(url) {
    if (!url) return;
    setSyncSt("syncing");
    try {
      const data = await sheetsGet(url);
      const fixDates = rows => rows.map(r => {
        if (!r) return r;
        const out = { ...r };
        if (out.date) out.date = toYMD(out.date);
        if (out.ts && typeof out.ts === "string" && out.ts.length > 10) out.ts = out.ts; // keep full ts
        return out;
      });
      if (data.products?.length) { setProducts(data.products); lsSet(SK.products, data.products); }
      if (data.categories?.length) { setCategories(data.categories); lsSet(SK.categories, data.categories); }
      if (data.vendors?.length) { setVendors(data.vendors); lsSet(SK.vendors, data.vendors); }
      if (data.transactions?.length) { const rows = fixDates(data.transactions); setTransactions(rows); lsSet(SK.transactions, rows); }
      if (data.users?.length) { setUsers(data.users); lsSet(SK.users, data.users); }
      if (data.bills?.length) { const rows = fixDates(data.bills); setBills(rows); lsSet(SK.bills, rows); }
      if (data.changeReqs?.length) { setChangeReqs(data.changeReqs); lsSet(SK.changeReqs, data.changeReqs); }
      // Load appConfig (invoice settings, bill series)
      if (data.appConfig?.length) {
        const cfg = {};
        data.appConfig.forEach(row => {
          if (!row.key) return;
          try { cfg[row.key] = JSON.parse(row.value); } catch { cfg[row.key] = row.value; }
        });
        if (Object.keys(cfg).length > 0) {
          setInvoiceSettings(cfg);
          lsSet(SK.invoiceSettings, cfg);
        }
      }
      // Merge actLog: keep local entries (like login events) not yet in Sheets
      if (data.actLog?.length) {
        const localLog = await lsGet(SK.actLog, []);
        const sheetsIds = new Set(data.actLog.map(e => e.id));
        const localOnly = localLog.filter(e => !sheetsIds.has(e.id));
        const merged = [...data.actLog, ...localOnly].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 500);
        setActLog(merged); lsSet(SK.actLog, merged);
      }
      setSyncSt("success");
      setLastSync(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      setTimeout(() => setSyncSt("idle"), 3000);
    } catch { setSyncSt("error"); }
  }

  // ── Enrich data with human-readable names before syncing to Sheets ───────
  // Also normalises all date fields to YYYY-MM-DD to prevent full datetime strings
  const toYMD = v => {
    if (!v) return v;
    if (typeof v === "string") {
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
      const d = new Date(v); if (!isNaN(d)) return d.toISOString().split("T")[0];
    }
    if (v instanceof Date && !isNaN(v)) return v.toISOString().split("T")[0];
    return v;
  };
  function enrichForSync(entity, rows) {
    if (entity === "transactions") {
      return rows.map(t => ({
        ...t,
        date: toYMD(t.date),
        productName: products.find(p => p.id === t.productId)?.name || "",
        vendorName:  vendors.find(v => v.id === t.vendorId)?.name || "",
      }));
    }
    if (entity === "bills") {
      return rows.map(b => ({
        ...b,
        date: toYMD(b.date),
        vendorName: vendors.find(v => v.id === b.vendorId)?.name || "",
      }));
    }
    if (entity === "products") {
      return rows.map(p => ({
        ...p,
        categoryName: categories.find(c => c.id === p.categoryId)?.name || "",
      }));
    }
    return rows;
  }

  async function push(entity, rows) {
    const url = sheetsUrl || DEFAULT_SHEETS_URL;
    if (!url) return;
    setSyncSt("syncing");
    try {
      await syncEnt(url, entity, enrichForSync(entity, rows));
      setSyncSt("success");
      setLastSync(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      setTimeout(() => setSyncSt("idle"), 2500);
    } catch { setSyncSt("error"); }
  }

  // ── Stock calc ────────────────────────────────────────────────────────────
  // purchase_return reduces stock; damaged items flagged with isDamaged stay in stock
  const getStock = useCallback((pid, txns = transactions) =>
    txns.filter(t => t.productId === pid).reduce((s, t) => {
      const qty = Number(t.qty);
      if (["opening", "purchase", "return"].includes(t.type)) return s + qty;
      if (["sale", "damaged", "purchase_return"].includes(t.type)) return s - qty;
      return s;
    }, 0), [transactions]);

  // ── Save helpers ──────────────────────────────────────────────────────────
  const saveProducts = async p => { setProducts(p); await lsSet(SK.products, p); push("products", p); };
  const saveCategories = async c => { setCategories(c); await lsSet(SK.categories, c); push("categories", c); };
  const saveVendors = async v => { setVendors(v); await lsSet(SK.vendors, v); push("vendors", v); };
  const saveTransactions = async t => { setTransactions(t); await lsSet(SK.transactions, t); debouncedPush("transactions", t); };
  const saveUsers = async u => { setUsers(u); await lsSet(SK.users, u); push("users", u); };
  const saveBills = async b => { setBills(b); await lsSet(SK.bills, b); debouncedPush("bills", b); };
  const saveChangeReqs = async r => { setChangeReqs(r); await lsSet(SK.changeReqs, r); push("changeReqs", r); };
  const saveActLog = async l => { setActLog(l); await lsSet(SK.actLog, l); push("actLog", l); };
  const saveInvoiceSettings = async s => {
    setInvoiceSettings(s);
    await lsSet(SK.invoiceSettings, s);
    // Persist to Sheets as key-value rows
    const rows = Object.entries(s).map(([key, value]) => ({
      key,
      value: typeof value === "object" ? JSON.stringify(value) : String(value ?? ""),
      updatedTs: new Date().toISOString()
    }));
    push("appConfig", rows);
  };

  const addChangeReq = useCallback(async req => {
    if (!user) return;
    const r = { id: uid(), ts: new Date().toISOString(), requestedBy: user.id, requestedByName: user.name, ...req, status: "pending" };
    const updated = [r, ...changeReqs];
    setChangeReqs(updated); await lsSet(SK.changeReqs, updated); push("changeReqs", updated);
    showToast("Change request sent to admin for approval", "success");
  }, [user, changeReqs]);

  const addLog = useCallback(async (action, entity, entityName, details = "") => {
    if (!user) return;
    const entry = { id: uid(), ts: new Date().toISOString(), userId: user.id, userName: user.name, role: user.role, action, entity, entityName, details };
    const updated = [entry, ...actLog].slice(0, 500);
    setActLog(updated); await lsSet(SK.actLog, updated);
    // Batch: only push to Sheets every 10 log entries to reduce API calls
    if (updated.length % 10 === 0) push("actLog", updated);
  }, [user, actLog]);

  const onTest = async url => {
    setTestStatus("testing");
    try { await sheetsGet(url); setTestStatus("ok"); }
    catch { setTestStatus("err"); }
  };

  // ── Context bundle ────────────────────────────────────────────────────────
  const ctx = {
    user, products, categories, vendors, transactions, users, bills,
    getStock, saveProducts, saveCategories, saveVendors, saveTransactions,
    saveUsers, saveBills, changeReqs, saveChangeReqs,
    actLog, saveActLog, addChangeReq, addLog,
    invoiceSettings, saveInvoiceSettings,
    themeId, setTheme, accentKey, setAccent, customColor, setCustomColor, bgImage, setBgImage, THEMES, ACCENT_PRESETS,
    settingsTab, setSettingsTab,
  };

  const T = theme;
  const ml = `${T.sidebarW + 24}px`;
  const locked = user?.lockedPages || [];

  // ── Page guard (respect locked pages for managers) ────────────────────────
  const actualPage = (() => {
    if (!user || user.role === "admin") return page;
    const nav = ALL_NAV.find(n => n.id === page);
    if (!nav || nav.adminOnly || nav.alwaysAllow) return page;
    if (locked.includes(page)) return "dashboard";
    return page;
  })();

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!ready) return (
    <>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 54, height: 54, borderRadius: 17, background: `linear-gradient(135deg,${T.accent},${T.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", animation: "pulse 1.5s ease infinite", boxShadow: `0 8px 28px ${T.accent}50` }}>
            <Layers size={24} color="#fff" />
          </div>
          <div style={{ fontSize: 14, color: T.textMuted, fontWeight: 500 }}>Loading StockWise…</div>
        </div>
      </div>
    </>
  );

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async (u) => {
    setUser(u);
    // Save session for 24h persistence
    await lsSet(SK.session, { userId: u.id, ts: Date.now() });
    // Log the login event into actLog
    const entry = { id: uid(), ts: new Date().toISOString(), userId: u.id, userName: u.name, role: u.role, action: "login", entity: "session", entityName: u.name, details: "" };
    const updated = [entry, ...actLog].slice(0, 500);
    setActLog(updated);
    await lsSet(SK.actLog, updated);
  };

  const handleLogout = async () => {
    setUser(null);
    await lsSet(SK.session, null);
  };

  if (!user) return (
    <ThemeCtx.Provider value={T}>
      <Login users={users} onLogin={handleLogin} />
    </ThemeCtx.Provider>
  );

  // ── App ───────────────────────────────────────────────────────────────────
  return (
    <ThemeCtx.Provider value={T}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <Sidebar
        page={actualPage} setPage={setPage} user={user} onLogout={handleLogout}
        isDark={isDark} toggleTheme={toggleTheme} ctx={ctx}
      />
      <MobNav
        page={actualPage} setPage={setPage} user={user}
        onLogout={handleLogout} isDark={isDark} toggleTheme={toggleTheme}
        pendingCnt={changeReqs.filter(r => r.status === "pending").length}
      />

      <div className="main-wrap" style={{ marginLeft: ml, padding: "12px 16px 24px", minHeight: "100vh", transition: "margin .2s" }}>
        <TopBar
          page={actualPage} user={user} syncSt={syncSt} lastSync={lastSync}
          onSync={() => pull(sheetsUrl)} toggleTheme={toggleTheme} isDark={isDark}
          setPage={setPage} ctx={ctx} onLogout={handleLogout}
        />
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
          {actualPage === "pnl"          && user.role === "admin" && <PnL ctx={ctx} />}
          {actualPage === "approvals"    && user.role === "admin" && <Approvals ctx={ctx} />}
          {actualPage === "settings"     && <Settings
            ctx={ctx} sheetsUrl={sheetsUrl}
            setSheetsUrl={url => { setSheetsUrl(url); lsSet(SK.sheetsUrl, url); }}
            testStatus={testStatus} onTest={onTest}
          />}
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
