import React from "react";

export const FeaturesSection: React.FC = () => {
  const features = [
    {
      icon: "🧭",
      title: "Real-time Spatial Navigation",
      desc: "Automatically extracts semantic landmarks, scrolls smoothly to targets, and relocates the 3D character safely without blocking host page content.",
    },
    {
      icon: "🎭",
      title: "Full-Body 3D VRM Avatar",
      desc: "Renders standard humanoid avatars with layered locomotion, blended pointing gestures, procedural head cues, and amplitude lip synchronization.",
    },
    {
      icon: "🛡️",
      title: "Zero-Trust Privacy & Grounding",
      desc: "Answers are 100% grounded in rendered page evidence. The assistant abstains on unsupported questions and never collects form values.",
    },
    {
      icon: "📝",
      title: "Interactive Form Companion",
      desc: "Points to form fields one by one, explains validation requirements, and detects coarse progress while the visitor types and submits manually.",
    },
  ];

  return (
    <section id="features" style={{ padding: "80px 0" }}>
      <div className="container" style={{ maxWidth: "860px" }}>
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <h2 style={{ fontSize: "36px", marginBottom: "12px" }}>
            Powerful <span className="gradient-text">Core Capabilities</span>
          </h2>
          <p style={{ color: "#94a3b8", fontSize: "16px" }}>
            Built specifically for high-conversion marketing pages, complex documentation, and guided checkout funnels.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "24px"
        }}>
          {features.map((f, i) => (
            <div key={i} className="glass-card" style={{ padding: "32px" }}>
              <div style={{
                fontSize: "32px",
                width: "56px",
                height: "56px",
                borderRadius: "12px",
                background: "rgba(99, 102, 241, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px"
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: "20px", marginBottom: "12px" }}>{f.title}</h3>
              <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: "1.6" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

