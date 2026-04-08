import React, { useState } from "react";
import { checkPassword } from "../utils";
import { Layers, Eye, EyeOff } from "lucide-react";
import { useT } from "../theme";
import { GIn, GBtn, Field } from "./UI";

export default function Login({ users, onLogin }) {
  const T = useT();
  const [un, setUn] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [showP, setShowP] = useState(false);
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!un || !pass) { setErr("Enter username and password"); return; }
    setLoading(true); setErr("");
    try {
      const match = users.find(x => x.username === un);
      if (!match) { setErr("Invalid username or password"); setLoading(false); return; }
      const ok = await checkPassword(pass, match.password);
      if (ok) { onLogin(match); }
      else setErr("Invalid username or password");
    } catch(e) { setErr("Login error — try again"); }
    setLoading(false);
  };

  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: T.bg }}>
    <div style={{ width: "100%", maxWidth: 360 }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ width: 62, height: 62, borderRadius: T.radiusXl, background: `linear-gradient(135deg,${T.accent},${T.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: `0 10px 30px ${T.accent}50` }}>
          <Layers size={28} color="#fff" />
        </div>
        <div style={{ fontFamily: T.displayFont, fontWeight: 800, fontSize: 26, color: T.text, letterSpacing: "-0.03em" }}>StockWise</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4, fontWeight: 500 }}>Pipal Home · Inventory Management</div>
      </div>
      <div className="glass-strong" style={{ borderRadius: T.radiusXl, padding: 28, border: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Username" req>
            <GIn value={un} onChange={e => setUn(e.target.value)} placeholder="Enter username"
              onKeyDown={e => e.key === "Enter" && handle()} autoComplete="username" />
          </Field>
          <Field label="Password" req>
            <div style={{ position: "relative" }}>
              <GIn value={pass} onChange={e => setPass(e.target.value)}
                type={showP ? "text" : "password"} placeholder="Enter password"
                onKeyDown={e => e.key === "Enter" && handle()} autoComplete="current-password" />
              <button onClick={() => setShowP(!showP)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: T.textMuted }}>
                {showP ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>
          {err && <div style={{ padding: "10px 14px", borderRadius: T.radius, background: T.redBg, color: T.red, fontSize: 12, fontWeight: 600, textAlign: "center" }}>{err}</div>}
          <GBtn onClick={handle} sz="lg" style={{ width: "100%", opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? "Signing in…" : "Sign In →"}
          </GBtn>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: T.textMuted }}>
        Default: admin / admin123 &nbsp;·&nbsp; manager / store123
      </div>
    </div>
  </div>;
}
