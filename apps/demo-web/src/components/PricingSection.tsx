import React from "react";

export const PricingSection: React.FC = () => {
  return (
    <section id="pricing" data-guide="pricing" style={{ padding: "80px 0", background: "rgba(15, 23, 42, 0.4)" }}>
      <div className="container">
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <h2 style={{ fontSize: "36px", marginBottom: "12px" }}>
            Transparent <span className="gradient-blue">Pricing Plans</span>
          </h2>
          <p style={{ color: "#94a3b8", fontSize: "16px" }}>
            Choose the plan that fits your website's traffic and customization needs.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "32px",
          maxWidth: "860px",
          margin: "0 auto"
        }}>
          {/* Starter Plan */}
          <div className="glass-card" style={{ padding: "40px", display: "flex", flexDirection: "column" }}>
            <h3 style={{ fontSize: "22px", marginBottom: "8px" }}>Starter Plan</h3>
            <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "24px" }}>
              Perfect for marketing pages and emerging startups.
            </p>
            <div style={{ fontSize: "42px", fontWeight: "800", color: "#fff", marginBottom: "24px" }}>
              $49 <span style={{ fontSize: "16px", color: "#64748b", fontWeight: "500" }}>/ month</span>
            </div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px", flex: 1 }}>
              <li style={{ color: "#cbd5e1", fontSize: "14px" }}>✓ 1 Host Domain</li>
              <li style={{ color: "#cbd5e1", fontSize: "14px" }}>✓ Up to 5,000 visitor turns / month</li>
              <li style={{ color: "#cbd5e1", fontSize: "14px" }}>✓ Standard 3D VRM Avatar</li>
              <li style={{ color: "#cbd5e1", fontSize: "14px" }}>✓ Full page tour & form guidance</li>
              <li style={{ color: "#cbd5e1", fontSize: "14px" }}>✓ Browser-based voice synthesis</li>
            </ul>
            <a href="#contact" className="btn-secondary" style={{ textAlign: "center" }}>Select Starter</a>
          </div>

          {/* Professional Plan */}
          <div className="glass-card" style={{
            padding: "40px",
            display: "flex",
            flexDirection: "column",
            border: "2px solid #6366f1",
            boxShadow: "0 0 30px rgba(99, 102, 241, 0.2)"
          }}>
            <div style={{
              alignSelf: "flex-start",
              background: "#4f46e5",
              color: "#fff",
              padding: "4px 12px",
              borderRadius: "9999px",
              fontSize: "12px",
              fontWeight: "700",
              marginBottom: "12px"
            }}>
              RECOMMENDED
            </div>
            <h3 style={{ fontSize: "22px", marginBottom: "8px" }}>Professional Plan</h3>
            <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "24px" }}>
              Designed for high-traffic products with custom branding.
            </p>
            <div style={{ fontSize: "42px", fontWeight: "800", color: "#fff", marginBottom: "24px" }}>
              $149 <span style={{ fontSize: "16px", color: "#64748b", fontWeight: "500" }}>/ month</span>
            </div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px", flex: 1 }}>
              <li style={{ color: "#cbd5e1", fontSize: "14px" }}>✓ Unlimited Host Domains</li>
              <li style={{ color: "#cbd5e1", fontSize: "14px" }}>✓ Up to 50,000 visitor turns / month</li>
              <li style={{ color: "#cbd5e1", fontSize: "14px" }}>✓ Custom 3D VRM Model Upload</li>
              <li style={{ color: "#cbd5e1", fontSize: "14px" }}>✓ High-fidelity neural voice (ElevenLabs)</li>
              <li style={{ color: "#cbd5e1", fontSize: "14px" }}>✓ Priority 24/7 SLA & support</li>
            </ul>
            <a href="#contact" id="btn-select-pro" className="btn-primary" style={{ textAlign: "center" }}>Select Professional</a>
          </div>
        </div>
      </div>
    </section>
  );
};

