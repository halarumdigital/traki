import * as Sentry from "@sentry/node";
import { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    userEmail?: string;
    userName?: string;
    isAdmin?: boolean;
    companyId?: string;
    companyName?: string;
    driverId?: string;
    driverName?: string;
  }
}

/**
 * Middleware to set user context in Sentry
 */
export function sentryUserContext(req: Request, _res: Response, next: NextFunction) {
  if (req.session) {
    if (req.session.userId) {
      // Admin user context
      Sentry.setUser({
        id: req.session.userId,
        email: req.session.userEmail,
        username: req.session.userName,
        segment: req.session.isAdmin ? "admin" : "user",
      });
    } else if (req.session.companyId) {
      // Company user context
      Sentry.setUser({
        id: `company_${req.session.companyId}`,
        username: req.session.companyName,
        segment: "company",
      });
    } else if (req.session.driverId) {
      // Driver user context
      Sentry.setUser({
        id: `driver_${req.session.driverId}`,
        username: req.session.driverName,
        segment: "driver",
      });
    }
  }

  // Add breadcrumb for API calls
  Sentry.addBreadcrumb({
    category: "api",
    message: `${req.method} ${req.path}`,
    level: "info",
    data: {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
    },
  });

  next();
}

/**
 * Middleware to capture specific API errors with more context
 */
export function sentryEnhancedError(error: Error, req: Request, res: Response, next: NextFunction) {
  // Add request context to error
  Sentry.withScope((scope) => {
    scope.setContext("request", {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query,
      body: req.body,
      user: req.session,
    });

    // Set error level based on status code
    const status = (error as any).status || (error as any).statusCode || 500;
    if (status >= 500) {
      scope.setLevel("error");
    } else if (status >= 400) {
      scope.setLevel("warning");
    } else {
      scope.setLevel("info");
    }

    // Capture the error
    Sentry.captureException(error);
  });

  next(error);
}