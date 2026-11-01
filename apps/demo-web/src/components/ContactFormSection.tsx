import React, { useState } from "react";

export const ContactFormSection: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section id="contact" style={{ padding: "80px 0" }}>
      <div className="container" style={{ maxWidth: "700px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h2 style={{ fontSize: "36px", marginBottom: "12px" }}>
            Get in <span className="gradient-text">Touch / Sign Up</span>
          </h2>
          <p style={{ color: "#94a3b8", fontSize: "16px" }}>
            Experience the future of guided spatial web interactions on your own site.
          </p>
        </div>

        <div className="glass-card" style={{ padding: "40px" }}>
          {submitted ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎉</div>
              <h3 style={{ fontSize: "24px", color: "#34d399", marginBottom: "8px" }}>Message Received!</h3>
              <p style={{ color: "#94a3b8" }}>Thank you for reaching out. Our team will contact you shortly.</p>
            </div>
          ) : (
            <form id="signup-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label htmlFor="input-name" style={{ display: "block", color: "#e2e8f0", fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}>
                  Full Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="input-name"
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "10px",
                    color: "#fff",
                    fontSize: "15px",
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <label htmlFor="input-email" style={{ display: "block", color: "#e2e8f0", fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}>
                  Work Email <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="input-email"
                  type="email"
                  required
                  placeholder="alex@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "10px",
                    color: "#fff",
                    fontSize: "15px",
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <label htmlFor="input-company" style={{ display: "block", color: "#e2e8f0", fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}>
                  Company Name
                </label>
                <input
                  id="input-company"
                  type="text"
                  placeholder="Your Organization"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "10px",
                    color: "#fff",
                    fontSize: "15px",
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <label htmlFor="input-message" style={{ display: "block", color: "#e2e8f0", fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}>
                  Project Details / Questions
                </label>
                <textarea
                  id="input-message"
                  rows={4}
                  placeholder="Tell us about your website or integration goals..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "10px",
                    color: "#fff",
                    fontSize: "15px",
                    outline: "none",
                    resize: "vertical"
                  }}
                />
              </div>

              <div style={{ marginTop: "10px" }}>
                <button id="btn-submit-contact" type="submit" className="btn-primary" style={{ width: "100%" }}>
                  Submit Inquiry
                </button>
              </div>

              <p style={{ fontSize: "12px", color: "#64748b", textAlign: "center", marginTop: "4px" }}>
                🔒 Privacy guarantee: The AI Avatar Guide never reads or types into these fields automatically. All submissions are visitor-controlled.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

