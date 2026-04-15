import { createContext, useContext } from "react";

// ── Accent palette presets ─────────────────────────────────────────────────
export const ACCENT_PRESETS = {
  copper:  { name: "Copper",  light: "#C05C1E", dark: "#D4763A" },
  indigo:  { name: "Indigo",  light: "#4F46E5", dark: "#818CF8" },
  emerald: { name: "Emerald", light: "#059669", dark: "#34D399" },
  rose:    { name: "Rose",    light: "#E11D48", dark: "#FB7185" },
  sky:     { name: "Sky",     light: "#0284C7", dark: "#38BDF8" },
  violet:  { name: "Violet",  light: "#7C3AED", dark: "#A78BFA" },
  custom:  { name: "Custom",  light: "#C05C1E", dark: "#D4763A" },
};

// ── Corner style presets ───────────────────────────────────────────────────
// Applied as a final override on top of any theme
export const CORNER_STYLES = {
  round:   { name: "Round",   icon: "○", radius: "18px", radiusXl: "24px", radiusFull: "999px" },
  rounded: { name: "Rounded", icon: "◻", radius: "12px", radiusXl: "18px", radiusFull: "99px"  },
  sharp:   { name: "Sharp",   icon: "□", radius: "0px",  radiusXl: "0px",  radiusFull: "2px"  },
};

// ── Build base tokens from accent + dark flag ──────────────────────────────
function buildTokens(accentKey = "copper", isDark = false, customColor = null) {
  let p = ACCENT_PRESETS[accentKey] || ACCENT_PRESETS.copper;
  if (customColor && /^#[0-9a-fA-F]{6}$/.test(customColor)) {
    p = { light: customColor, dark: customColor };
  }
  const accent = isDark ? p.dark : p.light;
  const accentDark = p.light;
  const accentLight = accent + "CC";

  if (isDark) return {
    bg: "linear-gradient(145deg,#0a0a12 0%,#0d0d1a 40%,#120a1a 70%,#0a0d14 100%)",
    surface: "rgba(255,255,255,0.06)", surfaceStrong: "rgba(255,255,255,0.11)",
    border: "rgba(255,255,255,0.14)", borderSubtle: "rgba(255,255,255,0.07)",
    shadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
    shadowLg: "0 16px 48px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.10)",
    shadowXl: "0 24px 64px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.12)",
    blur: "saturate(180%) blur(40px)", accent, accentLight, accentDark, accentBg: accent + "22",
    text: "#EDEDED", textSub: "#BBBBBB", textMuted: "#888888",
    green: "#4ADE80", greenBg: "rgba(74,222,128,0.10)", blue: "#60A5FA", blueBg: "rgba(96,165,250,0.10)",
    red: "#F87171", redBg: "rgba(248,113,113,0.10)", amber: "#FBBF24", amberBg: "rgba(251,191,36,0.10)",
    purple: "#C084FC", purpleBg: "rgba(192,132,252,0.10)", cyan: "#22D3EE",
    isGlass: false, shimmer: "", sidebarBg: "", accentCard: false,
    sidebarW: 224, isDark: true, displayFont: "'Montserrat',sans-serif"
  };
  return {
    bg: "linear-gradient(145deg,#e8f4f8 0%,#dde8f0 30%,#e4d5f5 60%,#f5e8e0 100%)",
    surface: "rgba(255,255,255,0.18)", surfaceStrong: "rgba(255,255,255,0.72)",
    border: "rgba(255,255,255,0.65)", borderSubtle: "rgba(255,255,255,0.35)",
    shadow: "0 8px 32px rgba(0,0,40,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
    shadowLg: "0 16px 48px rgba(0,0,40,0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
    shadowXl: "0 24px 64px rgba(0,0,40,0.16), inset 0 1px 0 rgba(255,255,255,0.95)",
    blur: "saturate(200%) blur(40px)", accent, accentLight, accentDark, accentBg: accent + "18",
    text: "#1a1a2e", textSub: "#2d2d4a", textMuted: "#6b6b8a",
    green: "#16A34A", greenBg: "#DCFCE7", blue: "#2563EB", blueBg: "#DBEAFE",
    red: "#DC2626", redBg: "#FEE2E2", amber: "#D97706", amberBg: "#FEF3C7",
    purple: "#7C3AED", purpleBg: "#EDE9FE", cyan: "#0891B2",
    isGlass: false, shimmer: "", sidebarBg: "", accentCard: false,
    sidebarW: 224, isDark: false, displayFont: "'Montserrat',sans-serif"
  };
}

// ── Theme presets ─────────────────────────────────────────────────────────
export const THEMES = {
  glass: {
    name: "Glass", desc: "iOS26 liquid glass", icon: "◈",
    light: (accent, cc) => {
      const base = buildTokens(accent, false, cc);
      return { ...base, isGlass: true, shimmer: "inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.15)" };
    },
    dark: (accent, cc) => {
      const base = buildTokens(accent, true, cc);
      return { ...base, isGlass: true, shimmer: "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.3)" };
    },
  },
  sharp: {
    name: "Sharp", desc: "Minimal, Balenciaga-style", icon: "▪",
    light: (accent, cc) => ({ ...buildTokens(accent, false, cc), bg:"#FFFFFF", surface:"#FFFFFF", surfaceStrong:"#FFFFFF", border:"#000000", borderSubtle:"#E0E0E0", blur:"none", shadow:"none", shadowLg:"2px 2px 0 #000", shadowXl:"4px 4px 0 #000", text:"#000000", textSub:"#333333", textMuted:"#666666", displayFont:"'Helvetica Neue','Arial',sans-serif" }),
    dark:  (accent, cc) => ({ ...buildTokens(accent, true, cc),  bg:"#000000", surface:"#111111", surfaceStrong:"#111111", border:"#FFFFFF", borderSubtle:"#333333", blur:"none", shadow:"none", shadowLg:"2px 2px 0 #fff", shadowXl:"4px 4px 0 #fff", text:"#FFFFFF", textSub:"#CCCCCC", textMuted:"#888888", displayFont:"'Helvetica Neue','Arial',sans-serif" }),
  },
  solid: {
    name: "Solid", desc: "Clean blocks, flat colours", icon: "■",
    light: (accent, cc) => {
      const base = buildTokens(accent, false, cc);
      return { ...base, bg:"#F4F4F5", surface:"#FFFFFF", surfaceStrong:"#FFFFFF", border:"#E4E4E7", borderSubtle:"#E4E4E7", blur:"none", shadow:"0 1px 3px rgba(0,0,0,0.08)", shadowLg:"0 4px 12px rgba(0,0,0,0.10)", shadowXl:"0 8px 24px rgba(0,0,0,0.12)", text:"#18181B", textSub:"#3F3F46", textMuted:"#71717A", sidebarBg: base.accent, accentCard: true, displayFont:"'Montserrat',sans-serif" };
    },
    dark: (accent, cc) => {
      const base = buildTokens(accent, true, cc);
      return { ...base, bg:"#09090B", surface:"#18181B", surfaceStrong:"#1C1C1F", border:"#27272A", borderSubtle:"#3F3F46", blur:"none", shadow:"0 1px 3px rgba(0,0,0,0.5)", shadowLg:"0 4px 12px rgba(0,0,0,0.6)", shadowXl:"0 8px 24px rgba(0,0,0,0.7)", text:"#FAFAFA", textSub:"#A1A1AA", textMuted:"#71717A", sidebarBg: base.accent, accentCard: true, displayFont:"'Montserrat',sans-serif" };
    },
  },
};

// ── buildTheme — applies theme + corner style + optional bgImage ───────────
export function buildTheme(themeId = "glass", accentKey = "copper", isDark = false, customColor = null, bgImage = "", cornerStyle = "rounded") {
  const preset = THEMES[themeId] || THEMES.glass;
  const base = isDark ? preset.dark(accentKey, customColor) : preset.light(accentKey, customColor);

  // Apply corner style override
  const corners = CORNER_STYLES[cornerStyle] || CORNER_STYLES.rounded;
  const themed = { ...base, radius: corners.radius, radiusXl: corners.radiusXl, radiusFull: corners.radiusFull };

  // Background image for glass theme
  if (bgImage && themeId === "glass") {
    return { ...themed, bg: `url("${bgImage}") center/cover fixed, ${themed.bg}` };
  }
  return themed;
}

export const ThemeCtx = createContext(buildTheme());
export const useT = () => useContext(ThemeCtx);

// Legacy exports
export const COPPER = buildTheme("glass","copper",false);
export const DARK   = buildTheme("glass","copper",true);

export const makeCSS = T => `
*{box-sizing:border-box;margin:0;padding:0}
html,body{overflow-x:hidden;max-width:100vw}
body{font-family:${T.displayFont};background:${T.bg};min-height:100vh;background-attachment:fixed}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${T.isDark?"rgba(255,255,255,0.14)":"rgba(0,0,0,0.15)"};border-radius:${T.radiusFull}}
input,select,textarea,button{font-family:${T.displayFont};font-size:13px}
select option{background:${T.isDark?"#1a1a1a":"#fff"};color:${T.text}}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}

/* ── Morphing glass animations ───────────────────────────────────── */
@keyframes morphIn{
  0%{opacity:0;transform:scale(0.94) translateY(8px);filter:blur(6px)}
  60%{opacity:1;filter:blur(1px)}
  100%{opacity:1;transform:scale(1) translateY(0);filter:blur(0)}
}
@keyframes morphDown{
  0%{opacity:0;transform:scale(0.96) translateY(-10px);filter:blur(4px)}
  60%{opacity:1;filter:blur(0.5px)}
  100%{opacity:1;transform:scale(1) translateY(0);filter:blur(0)}
}
@keyframes morphUp{
  0%{opacity:0;transform:scale(0.96) translateY(14px);filter:blur(4px)}
  60%{opacity:1;filter:blur(0.5px)}
  100%{opacity:1;transform:scale(1) translateY(0);filter:blur(0)}
}
@keyframes morphExpand{
  0%{opacity:0;transform:scaleY(0.6);filter:blur(3px);transform-origin:top center}
  70%{opacity:1;filter:blur(0)}
  100%{opacity:1;transform:scaleY(1);filter:blur(0);transform-origin:top center}
}
@keyframes overlayIn{from{opacity:0;backdrop-filter:blur(0px)}to{opacity:1;backdrop-filter:blur(8px)}}

.fade-up{animation:morphIn .3s cubic-bezier(.25,.46,.45,.94) backwards}
.spring-in{animation:morphIn .3s cubic-bezier(.25,.46,.45,.94) backwards}
.spring-down{animation:morphDown .25s cubic-bezier(.25,.46,.45,.94) backwards}
.spring-up{animation:morphUp .25s cubic-bezier(.25,.46,.45,.94) backwards}
.expand-down{animation:morphExpand .28s cubic-bezier(.25,.46,.45,.94) backwards;transform-origin:top center}
.glass{background:${T.surface};backdrop-filter:${T.blur};-webkit-backdrop-filter:${T.blur};border:1px solid ${T.border};box-shadow:${T.isGlass?T.shadow+", "+(T.shimmer||"none"):T.shadow}}
.glass-strong{background:${T.surfaceStrong};backdrop-filter:${T.blur};-webkit-backdrop-filter:${T.blur};border:1px solid ${T.border};box-shadow:${T.isGlass?T.shadowLg+", "+(T.shimmer||"none"):T.shadowLg}}
.btn-copper{background:${T.accent};color:#fff;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:${T.radius};font-weight:600;transition:filter .18s ease,transform .18s ease,opacity .18s ease,box-shadow .18s ease;box-shadow:${T.shadow};white-space:nowrap;letter-spacing:-0.01em}
.btn-copper:hover{opacity:0.88;filter:brightness(1.07)}.btn-copper:active{transform:scale(0.97);filter:brightness(0.95)}
.btn-ghost{background:${T.isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)"};color:${T.textSub};border:1px solid ${T.border};cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:${T.radius};font-weight:500;transition:background .18s ease,color .18s ease,transform .18s ease;white-space:nowrap}
.btn-ghost:hover{background:${T.isDark?"rgba(255,255,255,0.10)":"rgba(0,0,0,0.08)"};color:${T.text}}.btn-ghost:active{transform:scale(0.97)}
.btn-green{background:${T.green};color:#fff;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:${T.radius};font-weight:600;transition:all .15s;white-space:nowrap}
.btn-green:hover{opacity:0.88}
.btn-danger{background:${T.redBg};color:${T.red};border:1px solid ${T.red}25;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;border-radius:${T.radius};font-weight:500;transition:all .15s}
.btn-danger:hover{filter:brightness(1.1)}
.inp{width:100%;background:${T.isDark?"rgba(255,255,255,0.07)":T.surface};border:1.5px solid ${T.border};border-radius:${T.radius};padding:9px 12px;color:${T.text};outline:none;transition:all .15s;font-size:13px}
.inp:focus{border-color:${T.accent};box-shadow:0 0 0 3px ${T.accent}20}
.inp::placeholder{color:${T.textSub}}
.sel{width:100%;background:${T.isDark?"rgba(255,255,255,0.07)":T.surface};border:1.5px solid ${T.border};border-radius:${T.radius};padding:9px 12px;color:${T.text};outline:none;appearance:none;transition:all .15s;cursor:pointer}
.sel:focus{border-color:${T.accent};box-shadow:0 0 0 3px ${T.accent}20}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:${T.radius};cursor:pointer;transition:all .15s;color:${T.textSub};font-weight:500;font-size:13px;border:none;background:transparent;width:100%;text-align:left;letter-spacing:-0.01em;white-space:nowrap}
.nav-item{transition:background .18s ease,color .18s ease,transform .18s ease}.nav-item:hover{background:${T.isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.06)"};color:${T.text}}.nav-item:active{transform:scale(0.97)}
.nav-item.active{background:${T.accent}1C;color:${T.accent};font-weight:600}
.badge{display:inline-flex;align-items:center;gap:3px;padding:4px 10px;border-radius:${T.radiusFull};font-size:12px;font-weight:600;letter-spacing:.01em}
.trow:hover{background:${T.isDark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)"}}
.trow.row-sel{background:${T.accent}18!important}
.tag{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:${T.radiusFull};font-size:11px;font-weight:600}
.kcard{border-radius:${T.radiusXl};padding:20px;position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s;border:1px solid ${T.border};display:flex;flex-direction:column;min-height:140px}
.kcard{transition:transform .22s ease,box-shadow .22s ease,filter .22s ease}.kcard:hover{box-shadow:${T.shadowLg};transform:translateY(-3px);filter:brightness(1.03)}
.kgrid{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:14px;align-items:stretch}
.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.fgrid .s2{grid-column:1/-1}
.cb{width:15px;height:15px;accent-color:${T.accent};cursor:pointer;flex-shrink:0}
.filter-wrap{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.th{padding:11px 14px;font-weight:700;color:${T.textSub};font-size:11px;letter-spacing:0.05em;text-align:left;white-space:nowrap}
.th.r{text-align:right}
.td{padding:10px 14px;color:${T.text};font-size:13px;border-top:1px solid ${T.borderSubtle}}
.td.m{color:${T.textSub};font-size:13px}
.td.r{text-align:right}
.bill-item-row{display:grid;grid-template-columns:1fr 70px 90px 90px 60px 32px;gap:8px;padding:8px 12px;align-items:center;border-top:1px solid ${T.borderSubtle}}
.bill-item-hdr{display:grid;grid-template-columns:1fr 70px 90px 90px 60px 32px;gap:8px;padding:8px 12px;background:${T.isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)"}}
.chart-row{display:grid;grid-template-columns:2fr 1fr;gap:14px}
/* ── Mobile bottom nav ──────────────────────────────────────── */
.mobile-nav{display:none}

/* ── Settings tabs: horizontal scroll on small screens ────── */
.settings-tabs{display:flex;flex-wrap:wrap;gap:6px}

@media(max-width:768px){
  .mobile-nav{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:100;background:${T.surfaceStrong};backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid ${T.border};justify-content:space-evenly;align-items:stretch;padding-bottom:env(safe-area-inset-bottom,0px)}
  .desktop-sidebar{display:none!important}
  .main-wrap{margin-left:0!important;padding:12px 14px 90px!important;overflow-x:hidden!important}

  /* ── KPI cards: 2-col with smaller padding ──────────────── */
  .kgrid{grid-auto-flow:row!important;grid-template-columns:1fr 1fr!important;gap:10px!important}
  .kcard{padding:14px!important;min-height:110px!important}
  .kcard .kval{font-size:20px!important}

  /* ── Layout grids ───────────────────────────────────────── */
  .chart-row{grid-template-columns:1fr!important}
  .pgrid{grid-template-columns:1fr 1fr!important}

  /* ── Form grid: SINGLE COLUMN on mobile ─────────────────── */
  .fgrid{grid-template-columns:1fr!important;gap:12px!important}
  .fgrid .s2{grid-column:1!important}

  /* ── Filters: wrap nicely, dates get bigger touch targets ─ */
  .filter-wrap{gap:8px!important;flex-wrap:wrap!important}
  .filter-wrap>*{min-width:0;flex-shrink:1}
  .filter-wrap input[type="date"]{flex:1 1 120px!important;min-width:100px!important;font-size:14px!important;padding:10px 12px!important}
  .filter-wrap select{font-size:14px!important;padding:10px!important}

  /* ── Bill form product rows: stack vertically ───────────── */
  .bill-item-row{grid-template-columns:1fr 32px!important;gap:6px!important;padding:10px 10px 4px!important}
  .bill-item-hdr{display:none!important}
  .bill-item-sub{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:6px!important;padding:4px 10px 10px!important}

  /* ── Inputs: larger touch targets on mobile ─────────────── */
  input.inp,select.sel,textarea.inp{font-size:16px!important;padding:11px 12px!important;min-height:44px}

  /* ── Settings tabs: horizontal scroll instead of wrap ────── */
  .settings-tabs{flex-wrap:nowrap!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch;gap:6px!important;padding-bottom:4px;scrollbar-width:none;-ms-overflow-style:none}
  .settings-tabs::-webkit-scrollbar{display:none}
  .settings-tabs>button{flex-shrink:0!important;white-space:nowrap!important}

  /* ── Table responsiveness ──────────────────────────────── */
  .hide-mob{display:none!important}
  table{font-size:12px!important}
  .td{padding:8px 10px!important}
  .th{padding:8px 10px!important}

  /* ── Buttons: bigger touch targets ─────────────────────── */
  .btn-copper,.btn-ghost,.btn-green,.btn-danger{min-height:40px;font-size:13px!important}

  /* ── Product search dropdown: wider on mobile ──────────── */
  .ps-dropdown{left:0!important;right:0!important;width:auto!important;min-width:280px}
}

@media(max-width:400px){
  .kgrid{grid-template-columns:1fr!important}
  .pgrid{grid-template-columns:1fr!important}
  .main-wrap{padding:8px 10px 90px!important}
  .bill-item-sub{grid-template-columns:1fr 1fr!important}
}
`;
