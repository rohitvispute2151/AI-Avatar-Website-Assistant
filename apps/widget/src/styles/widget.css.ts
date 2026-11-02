export const widgetStyles = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color-scheme: dark;
}

.site-guide-root {
  position: fixed;
  z-index: 999999;
  font-size: 14px;
  line-height: 1.5;
  color: #f8fafc;
  user-select: none;
}

/* =============================================
   1. FLOATING LAUNCHER BUTTON
   Shown when BOTH chat is closed AND avatar is hidden
   ============================================= */
.sg-launcher-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999999;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
  color: #ffffff;
  border: none;
  border-radius: 9999px;
  cursor: pointer;
  box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.5), 0 8px 10px -6px rgba(79, 70, 229, 0.4);
  font-weight: 600;
  font-size: 14px;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
}

.sg-launcher-btn:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 15px 30px -5px rgba(79, 70, 229, 0.6);
}

.sg-launcher-btn:active {
  transform: translateY(0) scale(0.98);
}

/* =============================================
   2. INDEPENDENT AVATAR LAYER
   Always rendered in front of chat (z-index: 1000000)
   Adapts position: beside chat when open, corner when closed
   ============================================= */
.sg-avatar-layer {
  position: fixed;
  bottom: 0;
  z-index: 1000000;
  width: 290px;
  height: min(550px, calc(100vh - 16px));
  pointer-events: none;
  overflow: visible;
  transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1), 
              bottom 0.4s cubic-bezier(0.16, 1, 0.3, 1), 
              opacity 0.28s ease, 
              transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Beside chat when chat is OPEN */
.sg-avatar-layer.beside-chat {
  right: 414px;
}

/* Docked at corner when chat is CLOSED */
.sg-avatar-layer.corner {
  right: 20px;
}

/* 3D Canvas wrapper */
.sg-avatar-canvas-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: visible;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

.sg-avatar-canvas-wrap canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
  pointer-events: auto;
  cursor: pointer;
}

/* Speech hint bubble on avatar when chat is closed */
.sg-avatar-tap-hint {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(23, 33, 56, 0.92);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 9999px;
  padding: 5px 14px;
  font-size: 11px;
  font-weight: 500;
  color: #f1f5f9;
  white-space: nowrap;
  pointer-events: auto;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  gap: 6px;
  transition: opacity 0.25s ease, transform 0.25s ease;
  opacity: 0;
  pointer-events: none;
}

.sg-avatar-layer.corner .sg-avatar-tap-hint {
  opacity: 1;
  pointer-events: auto;
}

.sg-avatar-tap-hint:hover {
  background: rgba(37, 99, 235, 0.9);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateX(-50%) translateY(-2px);
}

/* =============================================
   3. CHAT PANEL (RIGHT SIDE)
   Independent layer (z-index: 999995)
   ============================================= */
.sg-chat-panel {
  position: fixed;
  bottom: 16px;
  right: 20px;
  z-index: 999995;
  width: 384px;
  max-width: calc(100vw - 32px);
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: auto;
  box-sizing: border-box;
  transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Top Quick Suggestion Pills (e.g. 'Say hello 👋', 'Not now') */
.sg-quick-suggestions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}
.sg-quick-suggestions::-webkit-scrollbar { display: none; }

.sg-pill-primary {
  background: #2563eb;
  color: #ffffff;
  padding: 6px 16px;
  border-radius: 9999px;
  font-weight: 500;
  font-size: 13px;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
  transition: all 0.15s ease;
  white-space: nowrap;
}
.sg-pill-primary:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
}

.sg-pill-secondary {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  color: #cbd5e1;
  padding: 6px 13px;
  border-radius: 9999px;
  font-size: 13px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.sg-pill-secondary:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
}

/* Tour Toolbar */
.sg-tour-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: rgba(79, 70, 229, 0.25);
  border: 1px solid rgba(79, 70, 229, 0.4);
  border-radius: 12px;
  font-size: 12px;
}

.sg-tour-controls {
  display: flex;
  gap: 6px;
}

.sg-tour-btn {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  cursor: pointer;
}
.sg-tour-btn:hover {
  background: rgba(255, 255, 255, 0.22);
}

/* Messages Card — Frosted Dark Glass */
.sg-messages-card {
  background: rgba(16, 24, 40, 0.88);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 22px;
  box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05);
  padding: 14px 16px;
  min-height: 180px;
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  user-select: text;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.12) transparent;
}

.sg-messages-card::-webkit-scrollbar {
  width: 4px;
}
.sg-messages-card::-webkit-scrollbar-track {
  background: transparent;
}
.sg-messages-card::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.16);
  border-radius: 4px;
}

/* Individual Message Rows with Dot Indicators */
.sg-message-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.sg-message-item.user {
  justify-content: flex-end;
}

.sg-msg-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sg-bubble {
  padding: 9px 16px;
  border-radius: 9999px;
  font-size: 13px;
  line-height: 1.45;
  word-break: break-word;
}

/* Assistant Message — Cyan/Blue Gradient Capsule */
.sg-bubble.assistant {
  background: linear-gradient(90deg, rgba(30, 58, 138, 0.65) 0%, rgba(59, 130, 246, 0.75) 100%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #f8fafc;
  border-radius: 18px;
  max-width: 90%;
  box-shadow: 0 4px 12px rgba(30, 58, 138, 0.25);
}

/* User Message */
.sg-bubble.user {
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  color: #ffffff;
  border-radius: 18px 18px 4px 18px;
  max-width: 85%;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
}

/* System Message */
.sg-bubble.system {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  font-size: 11px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  align-self: center;
}

/* =============================================
   INPUT BAR — Pill Styled (Image 2 Reference)
   ============================================= */
.sg-input-pill {
  background: rgba(23, 33, 56, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 9999px;
  padding: 6px 14px 6px 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05);
  box-sizing: border-box;
}

.sg-mic-btn {
  background: rgba(255, 255, 255, 0.12);
  border: none;
  color: #e2e8f0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.sg-mic-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.sg-mic-btn.recording {
  background: #ef4444;
  color: #ffffff;
  animation: sg-pulse 0.8s infinite;
}

@keyframes sg-pulse {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

.sg-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  color: #f8fafc;
  padding: 6px 6px;
  font-size: 13.5px;
  outline: none;
  font-family: inherit;
}

.sg-input::placeholder {
  color: #94a3b8;
}

.sg-send-btn {
  background: transparent;
  border: none;
  color: #cbd5e1;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
  padding: 0;
}

.sg-send-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  transform: translateX(1px);
}

.sg-pill-divider {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.18);
  margin: 0 4px;
  flex-shrink: 0;
}

.sg-pill-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.sg-action-icon {
  background: transparent;
  border: none;
  color: #94a3b8;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
  padding: 0;
}

.sg-action-icon:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

.sg-action-icon.active {
  color: #38bdf8;
}

/* Status indicator dot */
.sg-status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
  display: inline-block;
  margin-left: auto;
}
.sg-status-indicator.thinking { background: #f59e0b; box-shadow: 0 0 8px #f59e0b; }
.sg-status-indicator.speaking { background: #06b6d4; box-shadow: 0 0 8px #06b6d4; }
.sg-status-indicator.listening { background: #ef4444; box-shadow: 0 0 8px #ef4444; }

.sg-hidden {
  display: none !important;
}

/* =============================================
   4. RESPONSIVE DESIGN FOR EMBEDDING
   ============================================= */
@media (max-width: 680px) {
  .sg-avatar-layer {
    width: 150px;
    height: 380px;
  }
  .sg-avatar-layer.beside-chat {
    right: auto;
    left: 8px;
    bottom: 0;
    width: 120px;
    height: 320px;
  }
  .sg-avatar-layer.corner {
    right: 12px;
    bottom: 0;
  }
  .sg-chat-panel {
    right: 8px;
    bottom: 8px;
    width: calc(100vw - 16px);
  }
  .sg-messages-card {
    max-height: 240px;
    padding: 10px 12px;
  }
}
`;
