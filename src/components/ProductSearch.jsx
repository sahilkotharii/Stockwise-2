import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { useT } from "../theme";

export default function ProductSearch({ value, onChange, products, placeholder, getStock }) {
  const T = useT();
  const selected = products.find(p => p.id === value);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const [pos, setPos] = useState({ top: 0, left: 0, width: 200 });
  const calcPos = useCallback(() => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 280) });
    }
  }, []);

  const filtered = useMemo(() => {
    if (!isOpen) return [];
    const q = search.trim().toLowerCase();
    const list = q
      ? products.filter(p =>
          String(p.name || "").toLowerCase().includes(q) ||
          String(p.sku || "").toLowerCase().includes(q) ||
          String(p.alias || "").toLowerCase().includes(q)
        )
      : products;
    return list.slice(0, 50);
  }, [search, products, isOpen]);

  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  const openDropdown = () => {
    if (!isOpen) {
      setSearch("");
      calcPos();
      setIsOpen(true);
    }
  };

  const pick = (id) => {
    onChange(id);
    setIsOpen(false);
    setSearch("");
    inputRef.current?.blur();
  };

  const displayValue = isOpen ? search : (selected?.name || "");

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search size={11} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none", zIndex: 1 }} />
        <input
          ref={inputRef}
          className="inp"
          style={{ paddingLeft: 26 }}
          value={displayValue}
          placeholder={placeholder || "Search product…"}
          autoComplete="off"
          onFocus={openDropdown}
          onClick={openDropdown}
          onChange={e => {
            if (!isOpen) openDropdown();
            setSearch(e.target.value);
          }}
        />
        {value && !isOpen && (
          <button type="button" onClick={e => { e.stopPropagation(); onChange(""); }}
            style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 14, lineHeight: 1, zIndex: 1 }}>
            <X size={13} />
          </button>
        )}
      </div>
      {isOpen && (
        <div style={{
          position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999,
          background: T.surfaceStrong, border: `1px solid ${T.accent}40`,
          borderRadius: T.radius, boxShadow: T.shadowXl, maxHeight: 220, overflowY: "auto"
        }}>
          {filtered.length === 0
            ? <div style={{ padding: 12, fontSize: 12, color: T.textMuted }}>No products found</div>
            : filtered.map(p => (
              <div key={p.id}
                onMouseDown={e => { e.preventDefault(); pick(p.id); }}
                style={{
                  padding: "8px 12px", cursor: "pointer", minHeight: 48,
                  borderBottom: `1px solid ${T.borderSubtle}`,
                  background: p.id === value ? T.accentBg : "transparent"
                }}
                onMouseEnter={e => e.currentTarget.style.background = T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = p.id === value ? T.accentBg : "transparent"}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{p.name}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                  {p.sku}
                  {Number(p.gstRate) > 0 ? ` · GST ${Number(p.gstRate)}%` : ""}
                  {` · MRP ₹${Number(p.mrp || 0).toLocaleString("en-IN")}`}
                  {getStock ? ` · Stock: ${getStock(p.id)}` : ""}
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}
