import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { useT } from "../theme";

const ITEM_H = 52;
const VISIBLE = 4;

export default function ProductSearch({ value, onChange, products, placeholder }) {
  const T = useT();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const openRef = useRef(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 200 });
  const selected = products.find(p => p.id === value);

  useEffect(() => { openRef.current = open; }, [open]);

  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    if (!q) return products.slice(0, 50);
    return products.filter(p =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q) ||
      (p.alias || "").toLowerCase().includes(q)
    ).slice(0, 50);
  }, [query, products]);

  const updatePos = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 280) });
    }
  };

  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(""); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); };
  }, []);

  const handleFocus = () => {
    if (!openRef.current) {
      setQuery("");
      updatePos();
      setOpen(true);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search size={11} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none" }} />
        <input ref={inputRef} className="inp" style={{ paddingLeft: 26 }}
          value={open ? query : (selected ? selected.name : "")}
          placeholder={placeholder || "Search product…"}
          autoComplete="off"
          onChange={e => { setQuery(e.target.value); if (!open) { updatePos(); setOpen(true); } }}
          onFocus={handleFocus}
        />
        {value && !open && (
          <button type="button" onClick={() => onChange("")}
            style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:T.textMuted, fontSize:16, lineHeight:1 }}>×</button>
        )}
      </div>
      {open && (
        <div style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999, background: T.surfaceStrong, border: `1px solid ${T.accent}40`, borderRadius: T.radius, boxShadow: T.shadowXl, maxHeight: ITEM_H * VISIBLE + 4, overflowY: "auto" }}>
          {filtered.length === 0
            ? <div style={{ padding: "12px", fontSize: 12, color: T.textMuted }}>No products found</div>
            : filtered.map(p => (
              <div key={p.id}
                onMouseDown={e => { e.preventDefault(); onChange(p.id); setOpen(false); setQuery(""); }}
                style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${T.borderSubtle}`, background: p.id === value ? T.accentBg : "transparent", minHeight: ITEM_H }}
                onMouseEnter={e => e.currentTarget.style.background = T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = p.id === value ? T.accentBg : "transparent"}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{p.name}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                  {p.sku}{p.gstRate > 0 ? ` · GST ${p.gstRate}%` : ""} · MRP ₹{Number(p.mrp || 0).toLocaleString("en-IN")} · Stock: {p.stock ?? ""}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
