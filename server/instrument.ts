import * as Sentry from "@sentry/node";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || "development",

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0, // 10% in production, 100% in development

  // Release tracking
  release: process.env.APP_VERSION || "1.0.0",

  // Send default PII data (IP addresses, etc.)
  sendDefaultPii: true,

  // Integrations
  integrations: [
    // Using default integrations
  ],

  // Before sending error to Sentry
  beforeSend(event, hint) {
    // Filter out specific errors if needed
    if (event.exception) {
      const error = hint.originalException as Error | undefined;

      // Don't send 404 errors
      if (error?.message?.includes("404")) {
        return null;
      }

      // Don't send authentication errors in development
      if (process.env.NODE_ENV === "development" && error?.message?.includes("Unauthorized")) {
        return null;
      }
    }

    // Log the error locally
    console.error("Sentry capturing:", event.exception);

    return event;
  },

  // Error filtering
  ignoreErrors: [
    // Ignore common browser errors
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
    // Ignore network errors
    /Network error/i,
    /fetch/i,
  ],
});

export default Sentry;