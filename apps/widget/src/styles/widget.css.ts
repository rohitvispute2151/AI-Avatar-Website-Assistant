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

/* Floating Launcher Button */
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

/* Widget Shell Container */
.sg-shell {
  position: fixed;
  display: flex;
  flex-direction: column;
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 18px;
  box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08);
  width: 320px;
  max-width: calc(100vw - 24px);
  height: min(460px, calc(100vh - 32px));
  max-height: calc(100vh - 32px);
  box-sizing: border-box;
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.3s ease;
  overflow: hidden;
  z-index: 999999;
}

/* Position options */
.sg-position-bottom-right {
  bottom: 16px;
  right: 16px;
}

.sg-position-bottom-left {
  bottom: 16px;
  left: 16px;
}

/* Header bar */
.sg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(30, 41, 59, 0.6);
  flex-shrink: 0;
}

.sg-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sg-status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.sg-status-indicator.thinking {
  background: #f59e0b;
  box-shadow: 0 0 8px #f59e0b;
  animation: sg-pulse 1.2s infinite;
}

.sg-status-indicator.speaking {
  background: #06b6d4;
  box-shadow: 0 0 8px #06b6d4;
  animation: sg-pulse 0.8s infinite;
}

.sg-status-indicator.listening {
  background: #ef4444;
  box-shadow: 0 0 8px #ef4444;
  animation: sg-pulse 0.6s infinite;
}

@keyframes sg-pulse {
  0% { transform: scale(0.9); opacity: 0.7; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.7; }
}

.sg-title {
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.3px;
  color: #f1f5f9;
}

.sg-actions {
  display: flex;
  gap: 6px;
}

.sg-icon-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.sg-icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

/* 3D Avatar Stage Viewport */
.sg-avatar-canvas-wrap {
  position: relative;
  width: 100%;
  height: 135px;
  flex-shrink: 0;
  background: radial-gradient(ellipse at 50% 85%, rgba(99, 102, 241, 0.25) 0%, rgba(15, 23, 42, 0.5) 55%, transparent 85%);
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: height 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}

.sg-avatar-canvas-wrap.collapsed {
  height: 0 !important;
  opacity: 0;
  border-bottom: none;
  pointer-events: none;
}

/* Tour Toolbar */
.sg-tour-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(79, 70, 229, 0.2);
  border-bottom: 1px solid rgba(79, 70, 229, 0.3);
  font-size: 12px;
  flex-shrink: 0;
}

.sg-tour-controls {
  display: flex;
  gap: 6px;
}

.sg-tour-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
}

.sg-tour-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Chat Messages */
.sg-messages {
  flex: 1 1 auto;
  min-height: 80px;
  overflow-y: auto;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  user-select: text;
}

.sg-message {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
}

.sg-message.assistant {
  align-self: flex-start;
  background: rgba(51, 65, 85, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #f8fafc;
  border-bottom-left-radius: 2px;
}

.sg-message.user {
  align-self: flex-end;
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  color: #ffffff;
  border-bottom-right-radius: 2px;
}

.sg-message.system {
  align-self: center;
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  font-size: 11px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
}

/* Quick prompt pills */
.sg-quick-prompts {
  display: flex;
  gap: 6px;
  padding: 4px 10px;
  overflow-x: auto;
  white-space: nowrap;
  scrollbar-width: none;
  flex-shrink: 0;
}

.sg-quick-pill {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 3px 8px;
  border-radius: 9999px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sg-quick-pill:hover {
  background: rgba(79, 70, 229, 0.3);
  border-color: rgba(79, 70, 229, 0.5);
  color: #ffffff;
}

/* Input Bar - Always Pinned and Guaranteed Visible */
.sg-input-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(15, 23, 42, 0.96);
  flex-shrink: 0;
}

.sg-input {
  flex: 1;
  background: rgba(30, 41, 59, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #f8fafc;
  padding: 7px 10px;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s ease;
}
  outline: none;
  transition: border-color 0.15s ease;
}

.sg-input:focus {
  border-color: #6366f1;
}

.sg-mic-btn {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: #94a3b8;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sg-mic-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.sg-mic-btn.recording {
  background: #ef4444;
  color: #ffffff;
  animation: sg-pulse 0.8s infinite;
}

.sg-send-btn {
  background: #4f46e5;
  border: none;
  color: #ffffff;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sg-send-btn:hover {
  background: #4338ca;
}

.sg-hidden {
  display: none !important;
}
`;

