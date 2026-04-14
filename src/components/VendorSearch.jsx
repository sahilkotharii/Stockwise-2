import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { useT } from "../theme";

export default function VendorSearch({ value, onChange, vendors = [], placeholder = "Search vendor…" }) {
  const T = useT();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const selected = vendors.find(v => v.id === value);

  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase();
    if (!q) return vendors.slice(0, 40);
    return vendors.filter(v =>
      (v.name || "").toLowerCase().includes(q) ||
      (v.city || "").toLowerCase().includes(q) ||
      (v.gstin || "").toLowerCase().includes(q)
    ).slice(0, 50);
  }, [query, vendors]);

  // Close on outside click/touch
  useEffect(() => {
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("touchstart", h);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("touchstart", h);
    };
  }, []);

  const selectItem = (id) => {
    onChange(id);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search size={11} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none" }} />
        <input
          ref={inputRef}
          className="inp"
          style={{ paddingLeft: 26 }}
          value={open ? query : (selected ? selected.name : "")}
          placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setQuery(""); setOpen(true); }}
          autoComplete="off"
        />
        {value && !open && (
          <button
            type="button"
            onClick={() => { onChange(""); setQuery(""); }}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 2, fontSize: 14, lineHeight: 1 }}
          >×</button>
        )}
      </div>
      {open && (
        <div className="spring-down" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 500, marginTop: 3, background: T.surfaceStrong, border: `1px solid ${T.borderSubtle}`, borderRadius: T.radius, boxShadow: T.shadowLg, maxHeight: 260, overflowY: "auto" }}>
          {vendors.length === 0 && <div style={{ padding: "12px", fontSize: 12, color: T.textMuted }}>No vendors yet — add one in Vendors page</div>}
          {vendors.length > 0 && filtered.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12, color: T.textMuted }}>No vendors match "{query}"</div>}
          {filtered.map(v => (
            <div
              key={v.id}
              onClick={() => selectItem(v.id)}
              style={{ padding: "9px 12px", cursor: "pointer", borderBottom: `1px solid ${T.borderSubtle}`, background: v.id === value ? T.accentBg : "transparent", transition: "background .1s" }}
              onMouseEnter={e => { if (v.id !== value) e.currentTarget.style.background = T.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"; }}
              onMouseLeave={e => { if (v.id !== value) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{v.name}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
                {[v.city, v.state].filter(Boolean).join(", ")}{v.gstin ? ` · ${v.gstin}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
