import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

// Initialize Sentry
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
  integrations: [
    // Performance monitoring
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  // Performance Monitoring
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0, // 10% in production, 100% in development
  // Session Replay
  replaysSessionSampleRate: 0.1, // 10% of sessions will be replayed
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors will be replayed
  // Release tracking
  release: import.meta.env.VITE_APP_VERSION || "1.0.0",
  // Send default PII data (IP addresses, etc.)
  sendDefaultPii: true,
  // Before sending error to Sentry
  beforeSend(event, hint) {
    // Filter out specific errors if needed
    if (event.exception) {
      const error = hint.originalException as Error | undefined;
      // Example: Don't send network errors in development
      if (import.meta.env.DEV && error?.message?.includes("Network")) {
        return null;
      }
    }
    return event;
  },
});

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

const root = createRoot(container);
root.render(<App />);
