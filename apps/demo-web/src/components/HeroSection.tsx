import React from "react";

interface HeroProps {
  onTogglePromo: () => void;
  promoActive: boolean;
}

export const HeroSection: React.FC<HeroProps> = ({ onTogglePromo, promoActive }) => {
  return (
    <section id="hero" data-guide="hero" style={{ paddingTop: "140px", paddingBottom: "80px", position: "relative" }}>
      <div className="glow-orb-1" />
      <div className="container" style={{ textAlign: "center", maxWidth: "900px" }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(99, 102, 241, 0.1)",
          border: "1px solid rgba(99, 102, 241, 0.25)",
          padding: "6px 16px",
          borderRadius: "9999px",
          color: "#818cf8",
          fontSize: "13px",
          fontWeight: "600",
          marginBottom: "24px"
        }}>
          <span>🚀</span>
          <span>Next-Generation Spatial Website Guide</span>
        </div>

        <h1 style={{ fontSize: "52px", lineHeight: "1.15", marginBottom: "20px" }}>
          Turn your static website into an <span className="gradient-text">interactive spatial journey</span> with a 3D AI Avatar.
        </h1>

        <p style={{ fontSize: "19px", color: "#94a3b8", maxWidth: "720px", margin: "0 auto 36px" }}>
          NovaAI embeds a full-body 3D assistant directly on your website. It observes rendered page structure, answers visitor questions, smoothly navigates to key sections, points to controls, and walks visitors through complex forms.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap", marginBottom: "32px" }}>
          <a href="#contact" id="hero-get-started" data-guide="hero-cta" className="btn-primary" style={{ padding: "16px 36px", fontSize: "16px" }}>
            Get Started Free
          </a>
          <button onClick={onTogglePromo} className="btn-secondary" style={{ padding: "16px 28px", fontSize: "14px" }}>
            {promoActive ? "Remove Live Promo Offer" : "Simulate Live DOM Update (Promo Offer)"}
          </button>
        </div>

        {promoActive && (
          <div
            id="dynamic-promo-banner"
            style={{
              background: "linear-gradient(90deg, rgba(236, 72, 153, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)",
              border: "1px solid rgba(236, 72, 153, 0.4)",
              borderRadius: "12px",
              padding: "16px",
              marginTop: "16px",
              animation: "fadeIn 0.3s ease"
            }}
          >
            <p style={{ color: "#f472b6", fontWeight: "600", fontSize: "15px" }}>
              🎉 Limited Time Offer: Get 30% off any annual subscription with code <code style={{ background: "rgba(0,0,0,0.3)", padding: "2px 8px", borderRadius: "4px" }}>SPATIAL30</code>!
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

