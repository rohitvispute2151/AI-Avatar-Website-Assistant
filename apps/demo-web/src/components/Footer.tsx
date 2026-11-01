import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", padding: "40px 0", background: "#060911" }}>
      <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ color: "#64748b", fontSize: "14px" }}>
          © 2026 NovaAI Inc. All rights reserved. Next-Gen 3D Avatar Web Companion.
        </div>
        <div style={{ display: "flex", gap: "24px" }}>
          <a href="#about" style={{ color: "#64748b", fontSize: "13px", textDecoration: "none" }}>Privacy Policy</a>
          <a href="#features" style={{ color: "#64748b", fontSize: "13px", textDecoration: "none" }}>Terms of Service</a>
          <a href="#contact" style={{ color: "#64748b", fontSize: "13px", textDecoration: "none" }}>Support</a>
        </div>
      </div>
    </footer>
  );
};

