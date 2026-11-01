import React from "react";

export const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/60" style={{ padding: "16px 0" }}>
      <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            color: "#fff",
            fontSize: "18px"
          }}>
            N
          </div>
          <span style={{ fontSize: "20px", fontWeight: "700", letterSpacing: "-0.5px" }}>NovaAI</span>
        </div>

        <nav style={{ display: "flex", gap: "28px", alignItems: "center" }}>
          <a href="#about" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px", fontWeight: "500" }}>About</a>
          <a href="#features" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px", fontWeight: "500" }}>Features</a>
          <a href="#pricing" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px", fontWeight: "500" }}>Pricing</a>
          <a href="#contact" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px", fontWeight: "500" }}>Contact</a>
          <a href="#signup" className="btn-primary" style={{ padding: "8px 20px", fontSize: "13px" }}>Get Started</a>
        </nav>
      </div>
    </header>
  );
};

