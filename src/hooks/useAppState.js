// ╔═══════════════════════════════════════════════════════════════════╗
// ║  useAppState — All data, save functions, sync, and stock calc   ║
// ║  This is the single source of truth for the entire app's state  ║
// ║                                                                 ║
// ║  To add a new data entity:                                      ║
// ║    1. Add useState below                                        ║
// ║    2. Add save function                                         ║
// ║    3. Add to ctx object at the bottom                           ║
// ║    4. Add to boot() localStorage load                           ║
// ║    5. Add to pull() sheets sync                                 ║
// ╚═══════════════════════════════════════════════════════════════════╝

import { useState, useEffect, useCallback } from "react";
import React from "react";
import { SK, lsGet, lsSet } from "../storage";
import { sheetsGet, syncEnt } from "../sheets";
import { uid, today } from "../utils";

const DEFAULT_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxiLGcaBsuNtUrT7tBFSzAe0LOmMqTKWIfjZAR6YCE7kTfLjAF-7FeeMY1VRyuTSHVh/exec";

// ── Date normaliser (keeps dates as YYYY-MM-DD) ─────────────────────────────
const toYMD = v => {
  if (!v) return v;
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    const d = new Date(v); if (!isNaN(d)) return d.toISOString().split("T")[0];
  }
  if (v instanceof Date && !isNaN(v)) return v.toISOString().split("T")[0];
  return v;
};

export default function useAppState() {
  // ── Core data ─────────────────────────────────────────────────────────────
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [bills, setBills] = useState([]);
  const [changeReqs, setChangeReqs] = useState([]);
  const [actLog, setActLog] = useState([]);
  const [invoiceSettings, setInvoiceSettings] = useState({});

  // ── Sync state ────────────────────────────────────────────────────────────
  const [sheetsUrl, setSheetsUrl] = useState(DEFAULT_SHEETS_URL);
  const [syncSt, setSyncSt] = useState("idle");
  const [lastSync, setLastSync] = useState(null);
  const [testStatus, setTestStatus] = useState(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [settingsTab, setSettingsTab] = useState("profile");

  // ── Theme state ───────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(false);
  const [themeId, setThemeId] = useState("glass");
  const [accentKey, setAccentKey] = useState("copper");
  const [customColor, setCustomColorState] = useState("");
  const [bgImage, setBgImageState] = useState("");
  const [cornerStyle, setCornerStyleState] = useState("rounded");
  const [logoUrl, setLogoUrlState] = useState("");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Sync helpers ──────────────────────────────────────────────────────────
  const pushTimers = {};
  const pushPending = React.useRef(false);

  const debouncedPush = (entity, rows, delay = 2000) => {
    pushPending.current = true;
    if (pushTimers[entity]) clearTimeout(pushTimers[entity]);
    pushTimers[entity] = setTimeout(() => push(entity, rows), delay);
  };

  function enrichForSync(entity, rows) {
    if (entity === "transactions") {
      return rows.map(t => ({
        ...t, date: toYMD(t.date),
        productName: products.find(p => p.id === t.productId)?.name || "",
        vendorName: vendors.find(v => v.id === t.vendorId)?.name || "",
      }));
    }
    if (entity === "bills") {
      return rows.map(b => ({
        ...b, date: toYMD(b.date),
        vendorName: vendors.find(v => v.id === b.vendorId)?.name || "",
      }));
    }
    if (entity === "products") {
      return rows.map(p => ({
        ...p, categoryName: categories.find(c => c.id === p.categoryId)?.name || "",
      }));
    }
    return rows;
  }

  async function push(entity, rows) {
    delete pushTimers[entity];
    if (!Object.keys(pushTimers).length) pushPending.current = false;
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

  async function pull(url) {
    if (!url) return;
    if (pushPending.current) { setSyncSt("syncing"); setTimeout(() => pull(url), 3000); return; }
    setSyncSt("syncing");
    try {
      const data = await sheetsGet(url);
      const fixDates = rows => rows.map(r => {
        if (!r) return r;
        const out = { ...r };
        if (out.date) out.date = toYMD(out.date);
        return out;
      });
      if (data.products?.length) { setProducts(data.products); lsSet(SK.products, data.products); }
      if (data.categories?.length) { setCategories(data.categories); lsSet(SK.categories, data.categories); }
      if (data.vendors?.length) { setVendors(data.vendors); lsSet(SK.vendors, data.vendors); }
      if (data.transactions?.length) { const rows = fixDates(data.transactions); setTransactions(rows); lsSet(SK.transactions, rows); }
      if (data.users?.length) { setUsers(data.users); lsSet(SK.users, data.users); }
      if (data.bills?.length) { const rows = fixDates(data.bills); setBills(rows); lsSet(SK.bills, rows); }
      if (data.changeReqs?.length) { setChangeReqs(data.changeReqs); lsSet(SK.changeReqs, data.changeReqs); }
      if (data.appConfig?.length) {
        const cfg = {};
        data.appConfig.forEach(row => {
          if (!row.key) return;
          try { cfg[row.key] = JSON.parse(row.value); } catch { cfg[row.key] = row.value; }
        });
        if (Object.keys(cfg).length > 0) { setInvoiceSettings(cfg); lsSet(SK.invoiceSettings, cfg); }
      }
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

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const lnk = document.createElement("link");
    lnk.rel = "stylesheet";
    lnk.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(lnk);

    (async () => {
      try {
        const [u, p, c, v, t, b, sUrl, ok, dp, cr, al, tid, ak, cc, bgi, cs, lu, invS, sess] = await Promise.all([
          lsGet(SK.users, null), lsGet(SK.products, null), lsGet(SK.categories, null),
          lsGet(SK.vendors, null), lsGet(SK.transactions, null), lsGet(SK.bills, []),
          lsGet(SK.sheetsUrl, DEFAULT_SHEETS_URL), lsGet("sw_ok", false),
          lsGet(SK.theme, false), lsGet(SK.changeReqs, []), lsGet(SK.actLog, []),
          lsGet("sw_theme_id", "glass"), lsGet("sw_accent_key", "copper"),
          lsGet("sw_custom_color", ""), lsGet("sw_bg_image", ""),
          lsGet("sw_corner_style", "rounded"), lsGet("sw_logo_url", ""),
          lsGet(SK.invoiceSettings, {}), lsGet(SK.session, null)
        ]);

        const SEED_USERS = [
          { id: "u1", name: "Sahil Kothari", username: "sahil", password: "admin123", role: "admin", createdAt: today(), lockedPages: [] },
          { id: "u2", name: "Store Manager", username: "manager", password: "store123", role: "manager", createdAt: today(), lockedPages: [] }
        ];

        const fu = u || SEED_USERS;
        const fixDates = rows => (rows || []).map(r => {
          if (!r?.date) return r;
          const ds = toYMD(r.date);
          return ds !== r.date ? { ...r, date: ds } : r;
        });

        setUsers(fu); setProducts(p || []); setCategories(c || []); setVendors(v || []);
        setTransactions(fixDates(t)); setBills(fixDates(b) || []);
        setSheetsUrl(sUrl || DEFAULT_SHEETS_URL);
        setIsDark(dp || false);
        setThemeId(tid || "glass"); setAccentKey(ak || "copper");
        setCustomColorState(cc || ""); setBgImageState(bgi || "");
        setCornerStyleState(cs || "rounded"); setLogoUrlState(lu || "");
        setChangeReqs(cr || []); setActLog(al || []);
        setInvoiceSettings(invS || {});

        if (sess?.userId && sess?.ts && (Date.now() - sess.ts) < 86400000) {
          const sessionUser = fu.find(x => x.id === sess.userId);
          if (sessionUser) setUser(sessionUser);
        } else if (sess) { lsSet(SK.session, null); }

        setReady(true);

        const url = sUrl || DEFAULT_SHEETS_URL;
        if (url) pull(url);
        if (!ok) lsSet("sw_ok", true);

        const interval = setInterval(() => pull(url), 4 * 60 * 1000);
        return () => clearInterval(interval);
      } catch (err) {
        console.error("Boot error:", err);
        setReady(true);
      }
    })();
  }, []);

  // ── Stock calculation ─────────────────────────────────────────────────────
  const getStock = useCallback((pid, txns = transactions) =>
    txns.filter(t => t.productId === pid).reduce((s, t) => {
      const qty = Number(t.qty);
      if (["opening", "purchase", "return"].includes(t.type)) return s + qty;
      if (["sale", "damaged", "purchase_return"].includes(t.type)) return s - qty;
      return s;
    }, 0), [transactions]);

  // ── Save functions ────────────────────────────────────────────────────────
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
    const rows = Object.entries(s).map(([key, value]) => ({
      key, value: typeof value === "object" ? JSON.stringify(value) : String(value ?? ""),
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
    if (updated.length % 10 === 0) push("actLog", updated);
  }, [user, actLog]);

  // ── Theme setters (persist to localStorage) ───────────────────────────────
  const toggleTheme = () => { const n = !isDark; setIsDark(n); lsSet(SK.theme, n); };
  const setTheme = tid => { setThemeId(tid); lsSet("sw_theme_id", tid); };
  const setAccent = ak => { setAccentKey(ak); lsSet("sw_accent_key", ak); };
  const setCustomColor = c => { setCustomColorState(c); lsSet("sw_custom_color", c); };
  const setBgImage = url => { setBgImageState(url); lsSet("sw_bg_image", url); };
  const setCornerStyle = cs => { setCornerStyleState(cs); lsSet("sw_corner_style", cs); };
  const setLogoUrl = url => { setLogoUrlState(url); lsSet("sw_logo_url", url); };

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleLogin = async u => {
    setUser(u);
    await lsSet(SK.session, { userId: u.id, ts: Date.now() });
    const entry = { id: uid(), ts: new Date().toISOString(), userId: u.id, userName: u.name, role: u.role, action: "login", entity: "session", entityName: u.name, details: "" };
    const updated = [entry, ...actLog].slice(0, 500);
    setActLog(updated);
    await lsSet(SK.actLog, updated);
  };

  const handleLogout = async () => {
    setUser(null);
    await lsSet(SK.session, null);
  };

  const onTest = async url => {
    setTestStatus("testing");
    try { await sheetsGet(url); setTestStatus("ok"); }
    catch { setTestStatus("err"); }
  };

  // ── Return everything pages need ──────────────────────────────────────────
  return {
    ready, user, page, setPage, settingsTab, setSettingsTab, toast,

    // The ctx object that every page receives
    ctx: {
      user, products, categories, vendors, transactions, users, bills,
      getStock, saveProducts, saveCategories, saveVendors, saveTransactions,
      saveUsers, saveBills, changeReqs, saveChangeReqs,
      actLog, saveActLog, addChangeReq, addLog,
      invoiceSettings, saveInvoiceSettings,
      themeId, setTheme, accentKey, setAccent, customColor, setCustomColor,
      bgImage, setBgImage, cornerStyle, setCornerStyle, logoUrl, setLogoUrl,
      THEMES: null, ACCENT_PRESETS: null, CORNER_STYLES: null, // filled by App.jsx
      settingsTab, setSettingsTab, isDark, toggleTheme,
    },

    // Theme
    isDark, themeId, accentKey, customColor, bgImage, cornerStyle, logoUrl, toggleTheme,

    // Sync
    sheetsUrl, setSheetsUrl, syncSt, lastSync, testStatus, onTest,
    pull: () => pull(sheetsUrl),

    // Auth
    handleLogin, handleLogout,
  };
}
