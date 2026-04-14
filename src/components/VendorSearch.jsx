import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { useT } from "../theme";

export default function VendorSearch({ value, onChange, vendors = [], placeholder = "Search vendor…" }) {
  const T = useT();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const openRef = useRef(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 200 });
  const selected = vendors.find(v => v.id === value);

  // Keep openRef in sync so the focus handler always sees the latest value
  useEffect(() => { openRef.current = open; }, [open]);

  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    if (!q) return vendors.slice(0, 40);
    return vendors.filter(v =>
      (v.name || "").toLowerCase().includes(q) ||
      (v.city || "").toLowerCase().includes(q) ||
      (v.gstin || "").toLowerCase().includes(q)
    ).slice(0, 50);
  }, [query, vendors]);

  const updatePos = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  };

  useEffect(() => {
    const close = e => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false); setQuery("");
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, []);

  const selectItem = id => {
    onChange(id); setOpen(false); setQuery("");
    inputRef.current?.blur();
  };

  const handleFocus = () => {
    // Only clear query when first opening — never clear while user is typing
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
        <input
          ref={inputRef}
          className="inp"
          style={{ paddingLeft: 26 }}
          value={open ? query : (selected ? selected.name : "")}
          placeholder={placeholder}
          autoComplete="off"
          onChange={e => { setQuery(e.target.value); if (!open) { updatePos(); setOpen(true); } }}
          onFocus={handleFocus}
        />
        {value && !open && (
          <button type="button" onClick={() => { onChange(""); setQuery(""); }}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 2, fontSize: 16, lineHeight: 1 }}>×</button>
        )}
      </div>
      {open && (
        <div style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999, background: T.surfaceStrong, border: `1px solid ${T.accent}40`, borderRadius: T.radius, boxShadow: T.shadowXl, maxHeight: 240, overflowY: "auto" }}>
          {vendors.length === 0 && <div style={{ padding: 12, fontSize: 12, color: T.textMuted }}>No vendors yet</div>}
          {vendors.length > 0 && filtered.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12, color: T.textMuted }}>No match for "{query}"</div>}
          {filtered.map(v => (
            <div key={v.id}
              onMouseDown={e => { e.preventDefault(); selectItem(v.id); }}
              style={{ padding: "9px 12px", cursor: "pointer", borderBottom: `1px solid ${T.borderSubtle}`, background: v.id === value ? T.accentBg : "transparent" }}
              onMouseEnter={e => e.currentTarget.style.background = T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}
              onMouseLeave={e => e.currentTarget.style.background = v.id === value ? T.accentBg : "transparent"}>
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
