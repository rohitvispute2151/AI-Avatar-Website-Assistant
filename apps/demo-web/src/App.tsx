import React, { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { HeroSection } from "./components/HeroSection";
import { AboutSection } from "./components/AboutSection";
import { FeaturesSection } from "./components/FeaturesSection";
import { PricingSection } from "./components/PricingSection";
import { ContactFormSection } from "./components/ContactFormSection";
import { Footer } from "./components/Footer";
import { SiteGuide } from "@ai-avatar/widget";

export const App: React.FC = () => {
  const [promoActive, setPromoActive] = useState(false);

  useEffect(() => {
    // Initialize AI Avatar Website Assistant widget
    const handle = SiteGuide.init({
      widgetId: "demo-site-widget",
      apiBaseUrl: (import.meta as any).env?.VITE_WIDGET_API_BASE_URL || "http://localhost:8000",
      position: "bottom-right",
      locale: "en-US",
      voiceEnabled: true,
      textEnabled: true,
      avatarAssetUrl: "/assets/avatar/avatar.glb",
      avatarHdriUrl: "/assets/avatar/studio.hdr",
      quality: "auto",
      cameraFraming: "bust",
      onReady: () => {
        console.log("SiteGuide widget initialized and ready with 3D Humanoid Avatar.");
      },
      onError: (err: any) => {
        console.warn("SiteGuide widget notice:", err);
      },
    });

    return () => {
      handle.destroy();
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <Header />
      <main>
        <HeroSection
          promoActive={promoActive}
          onTogglePromo={() => setPromoActive((prev) => !prev)}
        />
        <AboutSection />
        <FeaturesSection />
        <PricingSection />
        <ContactFormSection />
      </main>
      <Footer />
    </div>
  );
};

export default App;

