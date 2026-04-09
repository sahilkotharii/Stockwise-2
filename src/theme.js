import { createContext, useContext } from "react";

// ── Accent palette presets ────────────────────────────────────────────────────
export const ACCENT_PRESETS = {
  copper:  { name: "Copper",  light: "#C05C1E", dark: "#D4763A" },
  indigo:  { name: "Indigo",  light: "#4F46E5", dark: "#818CF8" },
  emerald: { name: "Emerald", light: "#059669", dark: "#34D399" },
  rose:    { name: "Rose",    light: "#E11D48", dark: "#FB7185" },
  sky:     { name: "Sky",     light: "#0284C7", dark: "#38BDF8" },
  violet:  { name: "Violet",  light: "#7C3AED", dark: "#A78BFA" },
  custom:  { name: "Custom",   light: "#C05C1E", dark: "#D4763A" },
};

// ── Build a full token set from accent + dark flag ────────────────────────────
function buildTokens(accentKey = "copper", isDark = false, customColor = null) {
  let p = ACCENT_PRESETS[accentKey] || ACCENT_PRESETS.copper;
  // If custom color passed, override the preset
  if (customColor && /^#[0-9a-fA-F]{6}$/.test(customColor)) {
    p = { light: customColor, dark: customColor };
  }
  const accent = isDark ? p.dark : p.light;
  // Darken/lighten accent by mixing
  const accentDark = isDark ? p.light : p.light;
  const accentLight = accent + "CC";
  if (isDark) {
    return {
      bg: "linear-gradient(145deg,#0a0a12 0%,#0d0d1a 40%,#120a1a 70%,#0a0d14 100%)",
      surface: "rgba(255,255,255,0.06)", surfaceStrong: "rgba(255,255,255,0.11)",
      border: "rgba(255,255,255,0.14)", borderSubtle: "rgba(255,255,255,0.07)",
      shadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
      shadowLg: "0 16px 48px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.10)",
      shadowXl: "0 24px 64px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.12)",
      blur: "saturate(180%) blur(40px)", accent, accentLight, accentDark: p.light, accentBg: accent + "22",
      text: "#EDEDED", textSub: "#BBBBBB", textMuted: "#888888",
      green: "#4ADE80", greenBg: "rgba(74,222,128,0.10)", blue: "#60A5FA", blueBg: "rgba(96,165,250,0.10)",
      red: "#F87171", redBg: "rgba(248,113,113,0.10)", amber: "#FBBF24", amberBg: "rgba(251,191,36,0.10)",
      purple: "#C084FC", purpleBg: "rgba(192,132,252,0.10)", cyan: "#22D3EE",
      sidebarBg: "", sidebarW: 224, radius: "14px", radiusXl: "20px", isDark: true, displayFont: "'Montserrat',sans-serif"
    };
  }
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
    sidebarBg: "", sidebarW: 224, sidebarC: 68, radius: "14px", radiusXl: "20px", isDark: false, displayFont: "'Montserrat',sans-serif"
  };
}

// ── Theme presets (3 visual styles) ──────────────────────────────────────────
// Each theme overrides the base tokens from buildTokens
export const THEMES = {
  glass: {
    name: "Glass",
    desc: "iOS26 liquid glass",
    icon: "◈",
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
    name: "Sharp",
    desc: "Minimal, Balenciaga-style",
    icon: "▪",
    light: (accent, cc) => {
      const base = buildTokens(accent, false, cc);
      return {
        ...base,
        bg: "#FFFFFF",
        surface: "#FFFFFF",
        surfaceStrong: "#FFFFFF",
        border: "#000000",
        borderSubtle: "#E0E0E0",
        blur: "none",
        shadow: "none",
        shadowLg: "2px 2px 0 #000",
        shadowXl: "4px 4px 0 #000",
        radius: "0px",
        radiusXl: "0px",
        text: "#000000",
        textSub: "#333333",
        textMuted: "#666666",
        displayFont: "'Helvetica Neue','Arial',sans-serif",
      };
    },
    dark: (accent, cc) => {
      const base = buildTokens(accent, true, cc);
      return {
        ...base,
        bg: "#000000",
        surface: "#111111",
        surfaceStrong: "#111111",
        border: "#FFFFFF",
        borderSubtle: "#333333",
        blur: "none",
        shadow: "none",
        shadowLg: "2px 2px 0 #fff",
        shadowXl: "4px 4px 0 #fff",
        radius: "0px",
        radiusXl: "0px",
        text: "#FFFFFF",
        textSub: "#CCCCCC",
        textMuted: "#888888",
        displayFont: "'Helvetica Neue','Arial',sans-serif",
      };
    },
  },
  solid: {
    name: "Solid",
    desc: "Clean blocks, flat colours",
    icon: "■",
    light: (accent, cc) => {
      const base = buildTokens(accent, false, cc);
      return {
        ...base,
        bg: "#F4F4F5",
        surface: "#FFFFFF",
        surfaceStrong: "#FFFFFF",
        border: "#E4E4E7",
        borderSubtle: "#E4E4E7",
        blur: "none",
        shadow: "0 1px 3px rgba(0,0,0,0.08)",
        shadowLg: "0 4px 12px rgba(0,0,0,0.10)",
        shadowXl: "0 8px 24px rgba(0,0,0,0.12)",
        radius: "8px",
        radiusXl: "10px",
        sidebarBg: base.accent,
        accentCard: true,
        text: "#18181B",
        textSub: "#3F3F46",
        textMuted: "#71717A",
        displayFont: "'Montserrat',sans-serif",
      };
    },
    dark: (accent, cc) => {
      const base = buildTokens(accent, true, cc);
      return {
        ...base,
        bg: "#09090B",
        surface: "#18181B",
        surfaceStrong: "#1C1C1F",
        border: "#27272A",
        borderSubtle: "#3F3F46",
        blur: "none",
        shadow: "0 1px 3px rgba(0,0,0,0.5)",
        shadowLg: "0 4px 12px rgba(0,0,0,0.6)",
        shadowXl: "0 8px 24px rgba(0,0,0,0.7)",
        radius: "8px",
        radiusXl: "10px",
        sidebarBg: base.accent,
        accentCard: true,
        text: "#FAFAFA",
        textSub: "#A1A1AA",
        textMuted: "#71717A",
        displayFont: "'Montserrat',sans-serif",
      };
    },
  },
};

export function buildTheme(themeId = "glass", accentKey = "copper", isDark = false, customColor = null, bgImage = "") {
  const preset = THEMES[themeId] || THEMES.glass;
  const base = isDark ? preset.dark(accentKey, customColor) : preset.light(accentKey, customColor);
  // Inject bgImage for glass theme
  if (bgImage && themeId === "glass") {
    return { ...base, bg: `url("${bgImage}") center/cover fixed, ${base.bg}` };
  }
  return base;
}

export const ThemeCtx = createContext(buildTheme());
export const useT = () => useContext(ThemeCtx);

// Legacy exports for compatibility
export const COPPER = buildTheme("glass", "copper", false);
export const DARK   = buildTheme("glass", "copper", true);

export const makeCSS = T => `
*{box-sizing:border-box;margin:0;padding:0}
html,body{overflow-x:hidden;max-width:100vw}
body{font-family:${T.displayFont};background:${T.bg};min-height:100vh;background-attachment:fixed}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${T.isDark?"rgba(255,255,255,0.14)":"rgba(0,0,0,0.15)"};border-radius:${T.radius}}
input,select,textarea,button{font-family:${T.displayFont};font-size:13px}
select option{background:${T.isDark?"#1a1a1a":"#fff"};color:${T.text}}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.fade-up{animation:fadeUp .25s ease backwards}
.glass{background:${T.surface};backdrop-filter:${T.blur};-webkit-backdrop-filter:${T.blur};border:1px solid ${T.border};box-shadow:${T.isGlass ? T.shadow + ", " + (T.shimmer||"none") : T.shadow}}
.glass-strong{background:${T.surfaceStrong};backdrop-filter:${T.blur};-webkit-backdrop-filter:${T.blur};border:1px solid ${T.border};box-shadow:${T.isGlass ? T.shadowLg + ", " + (T.shimmer||"none") : T.shadowLg}}
.btn-copper{background:${T.accent};color:#fff;border:${T.radius==="0px"?`2px solid ${T.accent}`:"none"};cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:${T.radius};font-weight:600;transition:all .15s;box-shadow:${T.shadow};white-space:nowrap;letter-spacing:-0.01em}
.btn-copper:hover{opacity:0.88;${T.radius!=="0px"?"transform:translateY(-1px)":""}}
.btn-ghost{background:${T.isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)"};color:${T.textSub};border:1px solid ${T.border};cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:${T.radius};font-weight:500;transition:all .15s;white-space:nowrap}
.btn-ghost:hover{background:${T.isDark?"rgba(255,255,255,0.10)":"rgba(0,0,0,0.08)"};color:${T.text}}
.btn-green{background:${T.green};color:#fff;border:${T.radius==="0px"?`2px solid ${T.green}`:"none"};cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:${T.radius};font-weight:600;transition:all .15s;white-space:nowrap}
.btn-green:hover{opacity:0.88}
.btn-danger{background:${T.redBg};color:${T.red};border:1px solid ${T.red}25;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;border-radius:${T.radius};font-weight:500;transition:all .15s}
.btn-danger:hover{filter:brightness(1.1)}
.inp{width:100%;background:${T.isDark?"rgba(255,255,255,0.07)":T.surface};border:1.5px solid ${T.border};border-radius:${T.radius};padding:9px 12px;color:${T.text};outline:none;transition:all .15s;font-size:13px}
.inp:focus{border-color:${T.accent};box-shadow:0 0 0 3px ${T.accent}20}
.inp::placeholder{color:${T.textSub}}
.sel{width:100%;background:${T.isDark?"rgba(255,255,255,0.07)":T.surface};border:1.5px solid ${T.border};border-radius:${T.radius};padding:9px 12px;color:${T.text};outline:none;appearance:none;transition:all .15s;cursor:pointer}
.sel:focus{border-color:${T.accent};box-shadow:0 0 0 3px ${T.accent}20}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:${T.radius};cursor:pointer;transition:all .15s;color:${T.textSub};font-weight:500;font-size:13px;border:none;background:transparent;width:100%;text-align:left;letter-spacing:-0.01em;white-space:nowrap}
.nav-item:hover{background:${T.isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.06)"};color:${T.text}}
.nav-item.active{background:${T.accent}1C;color:${T.accent};font-weight:600;${T.radius==="0px"?`border-left:3px solid ${T.accent};`:""}}
.badge{display:inline-flex;align-items:center;gap:3px;padding:4px 10px;border-radius:${T.radius==="0px"?"2px":"99px"};font-size:12px;font-weight:600;letter-spacing:.01em}
.trow:hover{background:${T.isDark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)"}}
.trow.row-sel{background:${T.accent}18!important}
.tag{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:${T.radius==="0px"?"2px":"99px"};font-size:11px;font-weight:600}
.kcard{border-radius:${T.radiusXl};padding:20px;position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s;border:1px solid ${T.border};display:flex;flex-direction:column;min-height:140px}
.kcard:hover{${T.radius!=="0px"?"transform:translateY(-2px);":""};box-shadow:${T.shadowLg}}
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
.mobile-nav{display:none}
@media(max-width:768px){
  .mobile-nav{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:100;background:${T.surfaceStrong};backdrop-filter:blur(20px);border-top:1px solid ${T.border};justify-content:space-evenly;align-items:stretch}
  
  .desktop-sidebar{display:none!important}
  .main-wrap{margin-left:0!important;padding:8px 10px 84px!important;overflow-x:hidden!important}
  .kgrid{grid-auto-flow:row!important;grid-template-columns:1fr 1fr!important;gap:10px!important}
  .kcard{padding:14px!important}
  .chart-row{grid-template-columns:1fr!important}
  .pgrid{grid-template-columns:1fr 1fr!important}
  .fgrid{grid-template-columns:1fr!important}
  .fgrid .s2{grid-column:1}
  .filter-wrap{gap:6px!important}
  .filter-wrap>*{min-width:0;flex-shrink:1}
  .filter-wrap input[type="date"]{flex:1 1 100px!important;min-width:80px!important}
  .bill-item-row{grid-template-columns:1fr 55px 85px 75px 28px!important;gap:4px!important;padding:6px 8px!important}
  .bill-item-hdr{display:none!important}
  .hide-mob{display:none!important}
  table{font-size:12px!important}
  .td{padding:8px 10px!important}
  .th{padding:8px 10px!important}
}
@media(max-width:400px){
  .kgrid{grid-auto-flow:row!important;grid-template-columns:1fr!important}
  .pgrid{grid-template-columns:1fr!important}
  .main-wrap{padding:6px 8px 84px!important}
}
`;
