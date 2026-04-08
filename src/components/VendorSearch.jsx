import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { useT } from "../theme";

/* Reusable typeahead vendor search — handles 100-200+ vendors */
export default function VendorSearch({ value, onChange, vendors = [], placeholder = "Search vendor…" }) {
  const T = useT();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = vendors.find(v => v.id === value);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return vendors.slice(0, 40);
    return vendors.filter(v =>
      (v.name || "").toLowerCase().includes(q) ||
      (v.city || "").toLowerCase().includes(q) ||
      (v.gstin || "").toLowerCase().includes(q)
    ).slice(0, 50);
  }, [query, vendors]);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search size={11} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none" }} />
        <input className="inp" style={{ paddingLeft: 26 }}
          value={open ? query : (selected ? selected.name : "")}
          placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setQuery(""); setOpen(true); }}
        />
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 400, marginTop: 3, background: T.surfaceStrong, border: `1px solid ${T.borderSubtle}`, borderRadius: 10, boxShadow: T.shadowLg, maxHeight: 260, overflowY: "auto" }}>
          {vendors.length === 0 && <div style={{ padding: "12px", fontSize: 12, color: T.textMuted }}>No vendors yet — add one in Vendors page</div>}
          {vendors.length > 0 && filtered.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12, color: T.textMuted }}>No vendors match "{query}"</div>}
          {filtered.map(v => (
            <div key={v.id} onMouseDown={() => { onChange(v.id); setOpen(false); setQuery(""); }}
              style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${T.borderSubtle}`, background: v.id === value ? T.accentBg : "transparent" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{v.name}</div>
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
                {[v.city, v.state].filter(Boolean).join(", ")}
                {v.gstin ? ` · ${v.gstin}` : ""}
              </div>
            </div>
          ))}
          {filtered.length < vendors.filter(v => { const q = query.toLowerCase(); return !q || (v.name||"").toLowerCase().includes(q); }).length && (
            <div style={{ padding: "6px 12px", fontSize: 10, color: T.textMuted, fontStyle: "italic" }}>Type to narrow results…</div>
          )}
        </div>
      )}
    </div>
  );
}
