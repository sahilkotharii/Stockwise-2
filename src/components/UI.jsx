import React, { useEffect } from "react";
import { useT } from "../theme";
import { X, ChevronDown } from "lucide-react";

export function GCard({ c, style, cl = "", onClick }) {
  const T = useT();
  return <div className={`glass ${cl}`} style={{ borderRadius: T.radius, ...style }} onClick={onClick}>{c}</div>;
}

export function Pill({ c, color }) {
  return <span className="badge" style={{ background: color + "1A", color }}>{c}</span>;
}

export function GBtn({ c, children, onClick, v = "copper", sz = "md", dis, icon, style = {}, type = "button", form }) {
  const s = { sm: { padding: "6px 12px", fontSize: 12 }, md: { padding: "9px 16px", fontSize: 13 }, lg: { padding: "12px 22px", fontSize: 14 } }[sz];
  return <button type={type} form={form} onClick={onClick} disabled={dis} className={`btn-${v}`} style={{ ...s, opacity: dis ? .45 : 1, cursor: dis ? "not-allowed" : "pointer", ...style }}>{icon}{c || children}</button>;
}

export function Lbl({ c, req }) {
  const T = useT();
  return <div style={{ fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 5, letterSpacing: "0.03em", textTransform: "uppercase" }}>{c}{req && <span style={{ color: T.red }}> *</span>}</div>;
}

export function Field({ label, children, req, cl = "" }) {
  return <div className={cl}><Lbl c={label} req={req} />{children}</div>;
}

export function GIn({ value, onChange, placeholder, type = "text", readOnly, onKeyDown, min, max, step }) {
  return <input className="inp" type={type} value={value} onChange={onChange} placeholder={placeholder} readOnly={readOnly} onKeyDown={onKeyDown} min={min} max={max} step={step} style={readOnly ? { opacity: .55, cursor: "not-allowed" } : {}} />;
}

export function GS({ value, onChange, children, placeholder, cl = "" }) {
  const T = useT();
  return <div style={{ position: "relative" }} className={cl}>
    <select className="sel" value={value} onChange={onChange}>
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
    <ChevronDown size={12} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none" }} />
  </div>;
}

export function GTa({ value, onChange, placeholder, rows = 3 }) {
  return <textarea className="inp" value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{ resize: "none" }} />;
}

export function StChip({ stock, min }) {
  const T = useT();
  if (stock <= 0) return <Pill c="Out of Stock" color={T.red} />;
  if (stock <= min) return <Pill c="Low Stock" color={T.amber} />;
  return <Pill c="In Stock" color={T.green} />;
}

export function Toast({ msg, type }) {
  const T = useT();
  const c = type === "error" ? T.red : type === "success" ? T.green : T.amber;
  return <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", zIndex: 500, padding: "10px 20px", borderRadius: 12, background: T.surfaceStrong, border: `1.5px solid ${c}40`, color: c, fontSize: 13, fontWeight: 600, boxShadow: T.shadowXl, whiteSpace: "nowrap" }}>{msg}</div>;
}

export function Modal({ open, onClose, title, children, footer, width = 520 }) {
  const T = useT();
  useEffect(() => {
    if (open) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
      <div style={{ minHeight: "100%", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px 60px", boxSizing: "border-box" }}>
        <div className="glass-strong fade-up" onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: width, borderRadius: T.radiusXl, boxShadow: T.shadowXl, flexShrink: 0, alignSelf: "flex-start", overflow: "visible" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${T.borderSubtle}`, background: T.surfaceStrong, borderRadius: `${T.radiusXl} ${T.radiusXl} 0 0` }}>
            <div style={{ fontFamily: T.displayFont, fontWeight: 700, fontSize: 16, color: T.text, letterSpacing: "-0.01em" }}>{title}</div>
            <button onClick={onClose} className="btn-ghost" style={{ padding: "5px", borderRadius: 8, flexShrink: 0 }}><X size={15} /></button>
          </div>
          <div style={{ padding: 20, overflowY: "auto", maxHeight: "75vh", WebkitOverflowScrolling: "touch" }}>{children}</div>
          {footer && <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.borderSubtle}`, display: "flex", justifyContent: "flex-end", gap: 10, background: T.surfaceStrong, flexWrap: "wrap", borderRadius: `0 0 ${T.radiusXl} ${T.radiusXl}` }}>{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export function KCard({ label, value, sub, icon: Icon, color, delta }) {
  const T = useT();
  // Solid theme: full accent color background with white text
  const isSolid = T.accentCard;
  const c = T.accent; // always use accent in solid; keep original color in others
  const fg = isSolid ? "#fff" : T.text;
  const fgSub = isSolid ? "rgba(255,255,255,0.80)" : T.textSub;
  const fgMuted = isSolid ? "rgba(255,255,255,0.60)" : T.textMuted;
  const cardStyle = isSolid
    ? { background: c, border: `1px solid ${c}`, boxShadow: `0 4px 16px ${c}40` }
    : {};
  return <div className="kcard glass" style={cardStyle}>
    <div style={{ position: "absolute", top: -24, right: -24, width: 90, height: 90, borderRadius: "50%", background: isSolid ? "rgba(255,255,255,0.12)" : `${color}10` }} />
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, flex: "0 0 auto" }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: isSolid ? "rgba(255,255,255,0.2)" : `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={19} color={isSolid ? "#fff" : color} />
      </div>
      {delta !== undefined && <span className="badge" style={{ background: isSolid ? "rgba(255,255,255,0.2)" : (delta >= 0 ? T.greenBg : T.redBg), color: isSolid ? "#fff" : (delta >= 0 ? T.green : T.red) }}>{delta >= 0 ? "↑" : "↓"}{Math.abs(delta).toFixed(1)}%</span>}
    </div>
    <div style={{ fontFamily: T.displayFont, fontWeight: 800, fontSize: 24, color: fg, letterSpacing: "-0.03em", marginTop: "auto" }}>{value}</div>
    <div style={{ fontSize: 12, fontWeight: 600, color: fgSub, marginTop: 4 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: fgMuted, marginTop: 3, lineHeight: 1.3 }}>{sub}</div>}
  </div>;
}

export function CTip({ active, payload, label, fmt }) {
  const T = useT();
  if (!active || !payload?.length) return null;
  return <div className="glass-strong" style={{ padding: "10px 14px", borderRadius: 12, fontSize: 12 }}>
    <div style={{ fontWeight: 700, color: T.text, marginBottom: 5 }}>{label}</div>
    {payload.map((p, i) => <div key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {fmt ? ("₹" + Number(p.value || 0).toLocaleString("en-IN")) : p.value}</div>)}
  </div>;
}

export function Pager({ total, page, ps, setPage, setPs }) {
  const T = useT();
  const tp = Math.ceil(total / ps);
  if (total <= 0) return null;
  let s = Math.max(1, page - 2), e = Math.min(tp, s + 4);
  if (e - s < 4) s = Math.max(1, e - 4);
  const nb = dis => ({ padding: "5px 9px", minWidth: 32, borderRadius: 8, border: `1px solid ${T.borderSubtle}`, cursor: dis ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 12, background: "transparent", color: dis ? T.textMuted : T.textSub, opacity: dis ? .4 : 1 });
  const range = [];
  for (let i = s; i <= e; i++) range.push(i);
  return <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderTop: `1px solid ${T.borderSubtle}`, flexWrap: "wrap" }}>
    <span style={{ fontSize: 12, color: T.textMuted, flex: 1, minWidth: 100 }}>{Math.min((page - 1) * ps + 1, total)}–{Math.min(page * ps, total)} <span style={{ color: T.textSub }}>of {total}</span></span>
    <select className="sel" value={ps} onChange={e => { setPs(Number(e.target.value)); setPage(1); }} style={{ width: "auto", padding: "5px 26px 5px 8px", fontSize: 12, borderRadius: 8 }}>
      {[20, 50, 100].map(n => <option key={n} value={n}>{n}/page</option>)}
    </select>
    <div style={{ display: "flex", gap: 3 }}>
      <button onClick={() => setPage(1)} disabled={page <= 1} style={nb(page <= 1)}>«</button>
      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={nb(page <= 1)}>‹</button>
      {s > 1 && <span style={{ fontSize: 12, color: T.textMuted, padding: "0 4px", alignSelf: "center" }}>…</span>}
      {range.map(p => <button key={p} onClick={() => setPage(p)} style={{ padding: "5px 9px", minWidth: 32, borderRadius: 8, border: `1px solid ${p === page ? T.accent : T.borderSubtle}`, cursor: "pointer", fontWeight: 600, fontSize: 12, background: p === page ? T.accent : "transparent", color: p === page ? "#fff" : T.textSub }}>{p}</button>)}
      {e < tp && <span style={{ fontSize: 12, color: T.textMuted, padding: "0 4px", alignSelf: "center" }}>…</span>}
      <button onClick={() => setPage(p => Math.min(tp, p + 1))} disabled={page >= tp} style={nb(page >= tp)}>›</button>
      <button onClick={() => setPage(tp)} disabled={page >= tp} style={nb(page >= tp)}>»</button>
    </div>
  </div>;
}
