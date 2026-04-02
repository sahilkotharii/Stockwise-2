import { createContext, useContext } from "react";

export const COPPER={bg:"linear-gradient(135deg,#FDF3E9 0%,#F5E4CA 55%,#FDF0E8 100%)",surface:"rgba(255,245,232,0.76)",surfaceStrong:"rgba(255,248,240,0.97)",border:"rgba(255,245,232,0.90)",borderSubtle:"rgba(192,92,30,0.11)",shadow:"0 4px 24px rgba(80,25,5,0.08)",shadowLg:"0 12px 48px rgba(80,25,5,0.11)",shadowXl:"0 24px 64px rgba(80,25,5,0.16)",blur:"blur(20px)",accent:"#C05C1E",accentLight:"#D4763A",accentDark:"#963D0E",accentBg:"#FEF0E4",text:"#2C1204",textSub:"#6B3820",textMuted:"#A87A50",green:"#16A34A",greenBg:"#DCFCE7",blue:"#2563EB",blueBg:"#DBEAFE",red:"#DC2626",redBg:"#FEE2E2",amber:"#D97706",amberBg:"#FEF3C7",purple:"#7C3AED",purpleBg:"#EDE9FE",cyan:"#0891B2",sidebarW:224,sidebarC:68,radius:"14px",radiusXl:"20px",isDark:false,displayFont:"'Playfair Display',serif"};
export const DARK={bg:"#0D0D0D",surface:"rgba(255,255,255,0.045)",surfaceStrong:"rgba(22,22,22,0.99)",border:"rgba(255,255,255,0.08)",borderSubtle:"rgba(255,255,255,0.055)",shadow:"0 4px 20px rgba(0,0,0,0.7)",shadowLg:"0 12px 40px rgba(0,0,0,0.8)",shadowXl:"0 24px 60px rgba(0,0,0,0.9)",blur:"blur(24px)",accent:"#D4763A",accentLight:"#E8935A",accentDark:"#B5541A",accentBg:"rgba(212,118,58,0.13)",text:"#EDEDED",textSub:"#888",textMuted:"#505050",green:"#4ADE80",greenBg:"rgba(74,222,128,0.10)",blue:"#60A5FA",blueBg:"rgba(96,165,250,0.10)",red:"#F87171",redBg:"rgba(248,113,113,0.10)",amber:"#FBBF24",amberBg:"rgba(251,191,36,0.10)",purple:"#C084FC",purpleBg:"rgba(192,132,252,0.10)",cyan:"#22D3EE",sidebarW:224,sidebarC:68,radius:"14px",radiusXl:"20px",isDark:true,displayFont:"'Playfair Display',serif"};

export const ThemeCtx = createContext(COPPER);
export const useT = () => useContext(ThemeCtx);
export const PC = ["#C05C1E","#2563EB","#16A34A","#7C3AED","#DC2626","#0891B2","#D97706","#DB2777","#0D9488"];

export const makeCSS = T => `
*{box-sizing:border-box;margin:0;padding:0}
html,body{overflow-x:hidden;max-width:100vw}
body{font-family:'Montserrat',sans-serif;background:${T.bg};min-height:100vh;background-attachment:fixed}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${T.isDark?"rgba(255,255,255,0.14)":"rgba(192,92,30,0.2)"};border-radius:99px}
input,select,textarea,button{font-family:'Montserrat',sans-serif;font-size:13px}
select option{background:${T.isDark?"#1a1a1a":"#FFF8F0"};color:${T.text}}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.fade-up{animation:fadeUp .25s ease backwards}
.glass{background:${T.surface};backdrop-filter:${T.blur};-webkit-backdrop-filter:${T.blur};border:1px solid ${T.border};box-shadow:${T.shadow}}
.glass-strong{background:${T.surfaceStrong};backdrop-filter:${T.blur};-webkit-backdrop-filter:${T.blur};border:1px solid ${T.border};box-shadow:${T.shadowLg}}
.btn-copper{background:linear-gradient(135deg,${T.accent},${T.accentDark});color:#fff;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:10px;font-weight:600;transition:all .15s;box-shadow:0 2px 8px ${T.accent}45;white-space:nowrap;letter-spacing:-0.01em}
.btn-copper:hover{transform:translateY(-1px);box-shadow:0 4px 16px ${T.accent}55}
.btn-ghost{background:${T.isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)"};color:${T.textSub};border:1px solid ${T.isDark?"rgba(255,255,255,0.09)":"rgba(0,0,0,0.08)"};cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:10px;font-weight:500;transition:all .15s;white-space:nowrap}
.btn-ghost:hover{background:${T.isDark?"rgba(255,255,255,0.10)":"rgba(0,0,0,0.08)"};color:${T.text}}
.btn-green{background:linear-gradient(135deg,${T.green},#15803D);color:#fff;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:10px;font-weight:600;transition:all .15s;box-shadow:0 2px 8px ${T.green}45;white-space:nowrap}
.btn-green:hover{transform:translateY(-1px)}
.btn-danger{background:${T.redBg};color:${T.red};border:1px solid ${T.red}25;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;border-radius:8px;font-weight:500;transition:all .15s}
.btn-danger:hover{filter:brightness(1.1)}
.inp{width:100%;background:${T.isDark?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.75)"};border:1.5px solid ${T.isDark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.09)"};border-radius:10px;padding:9px 12px;color:${T.text};outline:none;transition:all .15s}
.inp:focus{border-color:${T.accent};background:${T.isDark?"rgba(255,255,255,0.11)":"rgba(255,255,255,0.97)"};box-shadow:0 0 0 3px ${T.accent}20}
.inp::placeholder{color:${T.textMuted}}
.sel{width:100%;background:${T.isDark?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.75)"};border:1.5px solid ${T.isDark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.09)"};border-radius:10px;padding:9px 12px;color:${T.text};outline:none;appearance:none;transition:all .15s;cursor:pointer}
.sel:focus{border-color:${T.accent};box-shadow:0 0 0 3px ${T.accent}20}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:12px;cursor:pointer;transition:all .15s;color:${T.textSub};font-weight:500;font-size:13px;border:none;background:transparent;width:100%;text-align:left;letter-spacing:-0.01em;white-space:nowrap}
.nav-item:hover{background:${T.isDark?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.65)"};color:${T.text}}
.nav-item.active{background:${T.accent}1C;color:${T.accent};font-weight:600}
.badge{display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:99px;font-size:11px;font-weight:600;letter-spacing:.01em}
.trow:hover{background:${T.isDark?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.55)"}}
.trow.sel{background:${T.accent}12!important}
.tag{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:600}
.kcard{border-radius:${T.radiusXl};padding:20px;position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s}
.kcard:hover{transform:translateY(-2px);box-shadow:${T.shadowLg}}
.kgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.fgrid .s2{grid-column:1/-1}
.cb{width:15px;height:15px;accent-color:${T.accent};cursor:pointer;flex-shrink:0}
.filter-wrap{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.th{padding:11px 14px;font-weight:700;color:${T.textMuted};font-size:10px;letter-spacing:0.06em;text-align:left;white-space:nowrap}
.th.r{text-align:right}
.td{padding:10px 14px;color:${T.text};font-size:12px;border-top:1px solid ${T.borderSubtle}}
.td.m{color:${T.textSub}}
.td.r{text-align:right}
.bill-item-row{display:grid;grid-template-columns:1fr 70px 90px 90px 60px 32px;gap:8px;padding:8px 12px;align-items:center;border-top:1px solid ${T.borderSubtle}}
.bill-item-hdr{display:grid;grid-template-columns:1fr 70px 90px 90px 60px 32px;gap:8px;padding:8px 12px;background:${T.isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)"}}
.chart-row{display:grid;grid-template-columns:2fr 1fr;gap:14px}
.mobile-nav{display:none}
@media(max-width:768px){
  .mobile-nav{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:100;background:${T.surfaceStrong};backdrop-filter:blur(20px);border-top:1px solid ${T.borderSubtle};overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
  .mobile-nav::-webkit-scrollbar{display:none}
  .desktop-sidebar{display:none!important}
  .main-wrap{margin-left:0!important;padding:8px 10px 76px!important;overflow-x:hidden!important}
  .kgrid{grid-template-columns:1fr 1fr!important;gap:10px!important}
  .chart-row{grid-template-columns:1fr!important}
  .pgrid{grid-template-columns:1fr 1fr!important}
  .fgrid{grid-template-columns:1fr!important}
  .fgrid .s2{grid-column:1}
  .filter-wrap{gap:6px!important}
  .filter-wrap>*{min-width:0;flex-shrink:1}
  .filter-wrap input[type="date"]{flex:1 1 100px!important;min-width:80px!important}
  .bill-item-row{grid-template-columns:1fr 60px 80px 80px 40px 28px!important;gap:5px!important;padding:6px 8px!important}
  .bill-item-hdr{display:none!important}
  .hide-mob{display:none!important}
  table{font-size:11px!important}
  .td{padding:8px 10px!important}
  .th{padding:8px 10px!important}
}
@media(max-width:480px){
  .kgrid{grid-template-columns:1fr 1fr!important}
  .pgrid{grid-template-columns:1fr!important}
  .main-wrap{padding:6px 8px 76px!important}
}
`;
