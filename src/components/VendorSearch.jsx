import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { useT } from "../theme";

/*
 * Architecture: TWO modes with ONE input.
 * - CLOSED: input shows selected vendor name, is read-only looking
 * - OPEN: input is editable for searching, dropdown shows filtered results
 * The key insight: NEVER programmatically clear the input during typing.
 * Only clear it in response to explicit user actions (click focus, click clear).
 */
export default function VendorSearch({ value, onChange, vendors = [], placeholder = "Search vendor…" }) {
  const T = useT();
  const selected = vendors.find(v => v.id === value);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const justOpened = useRef(false);

  // Position for fixed dropdown
  const [pos, setPos] = useState({ top: 0, left: 0, width: 200 });
  const calcPos = useCallback(() => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  }, []);

  // Filter vendors — when search is empty, show all
  const filtered = useMemo(() => {
    if (!isOpen) return [];
    const q = search.trim().toLowerCase();
    const list = q
      ? vendors.filter(v =>
          String(v.name || "").toLowerCase().includes(q) ||
          String(v.city || "").toLowerCase().includes(q) ||
          String(v.gstin || "").toLowerCase().includes(q) ||
          String(v.phone || "").toLowerCase().includes(q)
        )
      : vendors;
    return list.slice(0, 50);
  }, [search, vendors, isOpen]);

  // Close dropdown on outside click
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

  // Open dropdown
  const openDropdown = () => {
    if (!isOpen) {
      setSearch("");
      calcPos();
      setIsOpen(true);
      justOpened.current = true;
      // Reset flag after a tick so onChange can work
      requestAnimationFrame(() => { justOpened.current = false; });
    }
  };

  // Select a vendor
  const pick = (id) => {
    onChange(id);
    setIsOpen(false);
    setSearch("");
    inputRef.current?.blur();
  };

  // Clear selection
  const clear = () => {
    onChange("");
    setSearch("");
    setIsOpen(false);
  };

  // What to show in the input
  const displayValue = isOpen ? search : (selected?.name || "");

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search size={11} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none", zIndex: 1 }} />
        <input
          ref={inputRef}
          className="inp"
          style={{ paddingLeft: 26, paddingRight: value && !isOpen ? 28 : 12 }}
          value={displayValue}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={openDropdown}
          onClick={openDropdown}
          onChange={e => {
            if (!isOpen) openDropdown();
            setSearch(e.target.value);
          }}
        />
        {value && !isOpen && (
          <button type="button" onClick={e => { e.stopPropagation(); clear(); }}
            style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 2, fontSize: 14, lineHeight: 1, zIndex: 1 }}>
            <X size={13} />
          </button>
        )}
      </div>
      {isOpen && (
        <div style={{
          position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999,
          background: T.surfaceStrong, border: `1px solid ${T.accent}40`,
          borderRadius: T.radius, boxShadow: T.shadowXl, maxHeight: 240, overflowY: "auto"
        }}>
          {vendors.length === 0 && (
            <div style={{ padding: 12, fontSize: 12, color: T.textMuted }}>No vendors yet</div>
          )}
          {vendors.length > 0 && filtered.length === 0 && (
            <div style={{ padding: "10px 12px", fontSize: 12, color: T.textMuted }}>
              No match for "{search}"
            </div>
          )}
          {filtered.map(v => (
            <div key={v.id}
              onMouseDown={e => { e.preventDefault(); pick(v.id); }}
              style={{
                padding: "9px 12px", cursor: "pointer",
                borderBottom: `1px solid ${T.borderSubtle}`,
                background: v.id === value ? T.accentBg : "transparent"
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}
              onMouseLeave={e => e.currentTarget.style.background = v.id === value ? T.accentBg : "transparent"}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{v.name}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
                {[v.city, v.state].filter(Boolean).join(", ")}
                {v.gstin ? ` · ${v.gstin}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
