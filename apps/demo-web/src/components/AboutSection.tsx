import React from "react";

export const AboutSection: React.FC = () => {
  return (
    <section id="about" style={{ padding: "80px 0", background: "rgba(15, 23, 42, 0.4)" }}>
      <div className="container">
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <h2 style={{ fontSize: "36px", marginBottom: "12px" }}>
            About <span className="gradient-blue">NovaAI</span>
          </h2>
          <p style={{ color: "#94a3b8", fontSize: "16px", maxWidth: "600px", margin: "0 auto" }}>
            Pioneering embodied spatial intelligence for modern web applications.
          </p>
        </div>

        <div className="glass-card" style={{ padding: "40px", maxWidth: "860px", margin: "0 auto" }}>
          <p style={{ fontSize: "17px", color: "#e2e8f0", lineHeight: "1.8", marginBottom: "20px" }}>
            NovaAI builds embeddable 3D avatar guides that explain websites and guide visitors.
            Founded in 2024, NovaAI transforms passive web pages into interactive guided experiences.
            Unlike standard text-only chatbots, our spatial avatar walks across the viewport, physically points to buttons and headings, highlights target controls with non-destructive overlays, and speaks natural concise responses.
          </p>
          <p style={{ fontSize: "17px", color: "#cbd5e1", lineHeight: "1.8" }}>
            Our architecture operates with privacy by default: the avatar never reads visitor keystrokes, never stores passwords or form inputs, and strictly observes user consent by never automatically clicking or submitting forms.
          </p>
        </div>
      </div>
    </section>
  );
};

