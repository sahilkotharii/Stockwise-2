import React, { useState } from "react";
import { checkPassword } from "../utils";
import { Layers } from "lucide-react";
import { useT } from "../theme";
import { GIn, GBtn, Field } from "./UI";

export default function Login({ users, onLogin }) {
  const T = useT();
  const [un, setUn] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [showP, setShowP] = useState(false);

  const handle = () => {
    const u = users.find(x => x.username === un && x.password === pass);
    if (u) { setErr(""); onLogin(u); }
    else setErr("Invalid credentials");
  };

  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div style={{ width: "100%", maxWidth: 360 }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ width: 62, height: 62, borderRadius: 20, background: `linear-gradient(135deg,${T.accent},${T.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: `0 10px 30px ${T.accent}50` }}><Layers size={28} color="#fff" /></div>
        <div style={{ fontFamily: "Syne,sans-serif", fontWeight: 800, fontSize: 26, color: T.text, letterSpacing: "-0.03em" }}>StockWise</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4, fontWeight: 500 }}>Pipal Home · Inventory Management</div>
      </div>
      <div className="glass-strong" style={{ borderRadius: 20, padding: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Username" req><GIn value={un} onChange={e => setUn(e.target.value)} placeholder="Enter username" onKeyDown={e => e.key === "Enter" && handle()} /></Field>
          <Field label="Password" req>
            <div style={{ position: "relative" }}>
              <GIn value={pass} onChange={e => setPass(e.target.value)} type={showP ? "text" : "password"} placeholder="Enter password" onKeyDown={e => e.key === "Enter" && handle()} />
              <button onClick={() => setShowP(!showP)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{showP ? "Hide" : "Show"}</button>
            </div>
          </Field>
          {err && <div style={{ padding: "10px 14px", borderRadius: 10, background: T.redBg, color: T.red, fontSize: 12, fontWeight: 600, textAlign: "center" }}>{err}</div>}
          <GBtn onClick={handle} sz="lg" style={{ width: "100%" }}>Sign In →</GBtn>
        </div>
      </div>
    </div>
  </div>;
}
