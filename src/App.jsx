import React, { useState, useEffect, useCallback } from "react";
import { Layers } from "lucide-react";

import { COPPER, DARK, ThemeCtx, makeCSS } from "./theme";
import { SK, lsGet, lsSet } from "./storage";
import { sheetsGet, syncEnt } from "./sheets";
import { uid, today } from "./utils";

// ── Default Google Sheets Web App URL ────────────────────────────────────────
const DEFAULT_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxiLGcaBsuNtUrT7tBFSzAe0LOmMqTKWIfjZAR6YCE7kTfLjAF-7FeeMY1VRyuTSHVh/exec";

import { Sidebar, MobNav, TopBar, ALL_NAV } from "./components/Nav";
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

export default function App() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [col, setCol] = useState(false);

  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [channels, setChannels] = useState([]);
  const [bills, setBills] = useState([]);

  const [sheetsUrl, setSheetsUrl] = useState(DEFAULT_SHEETS_URL);
  const [syncSt, setSyncSt] = useState("idle");
  const [lastSync, setLastSync] = useState(null);
  const [testStatus, setTestStatus] = useState(null);
  const [isDark, setIsDark] = useState(false);
  const [changeReqs, setChangeReqs] = useState([]);
  const [actLog, setActLog] = useState([]);
  const [toast, setToast] = useState(null);

  const theme = isDark ? DARK : COPPER;

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const lnk = document.createElement("link");
    lnk.rel = "stylesheet";
    lnk.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap";
    document.head.appendChild(lnk);

    (async () => {
      const [u, p, c, v, t, ch, b, sUrl, ok, dp, cr, al] = await Promise.all([
        lsGet(SK.users, null), lsGet(SK.products, null), lsGet(SK.categories, null),
        lsGet(SK.vendors, null), lsGet(SK.transactions, null), lsGet(SK.channels, null),
        lsGet(SK.bills, []), lsGet(SK.sheetsUrl, DEFAULT_SHEETS_URL), lsGet(SK.seeded, false),
        lsGet(SK.theme, false), lsGet(SK.changeReqs, []), lsGet(SK.actLog, [])
      ]);

      const SEED_USERS = [
        { id: "u1", name: "Sahil Desai", username: "admin", password: "admin123", role: "admin", createdAt: today(), lockedPages: [] },
        { id: "u2", name: "Store Manager", username: "manager", password: "store123", role: "manager", createdAt: today(), lockedPages: [] }
      ];

      const fu = u || SEED_USERS, fp = p || [], fc = c || [], fv = v || [], fch = ch || [], ft = t || [];
      setUsers(fu); setProducts(fp); setCategories(fc); setVendors(fv);
      setChannels(fch); setTransactions(ft); setBills(b || []);
      setSheetsUrl(sUrl || DEFAULT_SHEETS_URL); setIsDark(dp || false);
      setChangeReqs(cr || []); setActLog(al || []);

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
        lsSet(SK.vendors, fv), lsSet(SK.channels, fch), lsSet(SK.transactions, ft),
        lsSet(SK.seeded, true)
      ]);

      setReady(true);
      const url = sUrl || DEFAULT_SHEETS_URL;
      if (url) pull(url);

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
  }, [isDark, theme]);

  const toggleTheme = () => { const n = !isDark; setIsDark(n); lsSet(SK.theme, n); };

  // ── Sheets sync ───────────────────────────────────────────────────────────
  async function pull(url) {
    if (!url) return;
    setSyncSt("syncing");
    try {
      const data = await sheetsGet(url);
      if (data.products?.length) { setProducts(data.products); lsSet(SK.products, data.products); }
      if (data.categories?.length) { setCategories(data.categories); lsSet(SK.categories, data.categories); }
      if (data.vendors?.length) { setVendors(data.vendors); lsSet(SK.vendors, data.vendors); }
      if (data.channels?.length) { setChannels(data.channels); lsSet(SK.channels, data.channels); }
      if (data.transactions?.length) { setTransactions(data.transactions); lsSet(SK.transactions, data.transactions); }
      if (data.users?.length) { setUsers(data.users); lsSet(SK.users, data.users); }
      if (data.bills?.length) { setBills(data.bills); lsSet(SK.bills, data.bills); }
      if (data.changeReqs?.length) { setChangeReqs(data.changeReqs); lsSet(SK.changeReqs, data.changeReqs); }
      if (data.actLog?.length) { setActLog(data.actLog); lsSet(SK.actLog, data.actLog); }
      setSyncSt("success");
      setLastSync(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      setTimeout(() => setSyncSt("idle"), 3000);
    } catch { setSyncSt("error"); }
  }

  async function push(entity, rows) {
    const url = sheetsUrl || DEFAULT_SHEETS_URL;
    if (!url) return;
    setSyncSt("syncing");
    try {
      await syncEnt(url, entity, rows);
      setSyncSt("success");
      setLastSync(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      setTimeout(() => setSyncSt("idle"), 2500);
    } catch { setSyncSt("error"); }
  }

  // ── Stock calc ────────────────────────────────────────────────────────────
  const getStock = useCallback((pid, txns = transactions) =>
    txns.filter(t => t.productId === pid).reduce((s, t) => {
      if (t.isDamaged) return s;
      return ["opening", "purchase", "return"].includes(t.type) ? s + Number(t.qty)
        : ["sale", "damaged"].includes(t.type) ? s - Number(t.qty) : s;
    }, 0), [transactions]);

  // ── Save helpers ──────────────────────────────────────────────────────────
  const saveProducts = async p => { setProducts(p); await lsSet(SK.products, p); push("products", p); };
  const saveCategories = async c => { setCategories(c); await lsSet(SK.categories, c); push("categories", c); };
  const saveVendors = async v => { setVendors(v); await lsSet(SK.vendors, v); push("vendors", v); };
  const saveTransactions = async t => { setTransactions(t); await lsSet(SK.transactions, t); push("transactions", t); };
  const saveUsers = async u => { setUsers(u); await lsSet(SK.users, u); push("users", u); };
  const saveChannels = async c => { setChannels(c); await lsSet(SK.channels, c); push("channels", c); };
  const saveBills = async b => { setBills(b); await lsSet(SK.bills, b); push("bills", b); };
  const saveChangeReqs = async r => { setChangeReqs(r); await lsSet(SK.changeReqs, r); push("changeReqs", r); };
  const saveActLog = async l => { setActLog(l); await lsSet(SK.actLog, l); push("actLog", l); };

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
    setActLog(updated); await lsSet(SK.actLog, updated); push("actLog", updated);
  }, [user, actLog]);

  const onTest = async url => {
    setTestStatus("testing");
    try { await sheetsGet(url); setTestStatus("ok"); }
    catch { setTestStatus("err"); }
  };

  // ── Context bundle ────────────────────────────────────────────────────────
  const ctx = {
    user, products, categories, vendors, transactions, channels, users, bills,
    getStock, saveProducts, saveCategories, saveVendors, saveTransactions,
    saveChannels, saveUsers, saveBills, changeReqs, saveChangeReqs,
    actLog, saveActLog, addChangeReq, addLog
  };

  const T = theme;
  const ml = `${(col ? T.sidebarC : T.sidebarW) + 24}px`;
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
      <style>{makeCSS(theme)}</style>
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
      <style>{makeCSS(T)}</style>
      <Login users={users} onLogin={handleLogin} />
    </ThemeCtx.Provider>
  );

  // ── App ───────────────────────────────────────────────────────────────────
  return (
    <ThemeCtx.Provider value={T}>
      <style>{makeCSS(T)}</style>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <Sidebar
        page={actualPage} setPage={setPage} user={user} onLogout={handleLogout}
        col={col} setCol={setCol} syncSt={syncSt} lastSync={lastSync}
        onSync={() => pull(sheetsUrl)} toggleTheme={toggleTheme} isDark={isDark}
        pendingCnt={changeReqs.filter(r => r.status === "pending").length}
      />
      <MobNav
        page={actualPage} setPage={setPage} user={user}
        pendingCnt={changeReqs.filter(r => r.status === "pending").length}
      />

      <div className="main-wrap" style={{ marginLeft: ml, padding: "12px 16px 24px", minHeight: "100vh", transition: "margin .2s" }}>
        <TopBar
          page={actualPage} user={user} syncSt={syncSt} lastSync={lastSync}
          onSync={() => pull(sheetsUrl)} toggleTheme={toggleTheme} isDark={isDark}
          setPage={setPage} ctx={ctx}
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
