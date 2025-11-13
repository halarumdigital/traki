import * as Sentry from "@sentry/react";
import { useCallback } from "react";

export function useSentry() {
  const captureException = useCallback((error: Error | unknown, context?: Record<string, any>) => {
    Sentry.captureException(error, {
      contexts: {
        custom: context,
      },
    });
  }, []);

  const captureMessage = useCallback((message: string, level: Sentry.SeverityLevel = "info", context?: Record<string, any>) => {
    Sentry.captureMessage(message, {
      level,
      contexts: {
        custom: context,
      },
    });
  }, []);

  const setUser = useCallback((user: { id?: string; email?: string; username?: string } | null) => {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.username,
      });
    } else {
      Sentry.setUser(null);
    }
  }, []);

  const addBreadcrumb = useCallback((breadcrumb: {
    message: string;
    category?: string;
    level?: Sentry.SeverityLevel;
    data?: Record<string, any>;
  }) => {
    Sentry.addBreadcrumb({
      message: breadcrumb.message,
      category: breadcrumb.category || "custom",
      level: breadcrumb.level || "info",
      data: breadcrumb.data,
      timestamp: Date.now() / 1000,
    });
  }, []);

  const startSpan = useCallback((name: string, fn: () => void) => {
    Sentry.startSpan({ name, op: "function" }, fn);
  }, []);

  return {
    captureException,
    captureMessage,
    setUser,
    addBreadcrumb,
    startSpan,
  };
}

export default useSentry;