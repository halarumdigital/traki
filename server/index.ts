// IMPORTANT: Sentry must be imported first
import "./instrument.js";
import "dotenv/config";
import * as Sentry from "@sentry/node";
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startAutoCancelJob } from "./auto-cancel-deliveries";
import { startMonthlyResetJob } from "./monthly-reset-job";
import { startScheduledDeliveriesJob } from "./scheduled-deliveries-job";
import { startViagemRemindersJob } from "./viagens-intermunicipais-reminder-job";
import { startPaymentSyncJob } from "./scheduled-payments-job";
import { startHeartbeatJob } from "./driver-heartbeat-job";

const app = express();
const httpServer = createServer(app);

// Configurar Socket.IO
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',').map(url => url.trim()) || ["http://localhost:5173"],
    credentials: true,
  },
});

// Gerenciar conexões Socket.IO
io.on("connection", (socket) => {
  console.log("🔌 Cliente conectado:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔌 Cliente desconectado:", socket.id);
  });
});

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(app, httpServer);

  // Setup Sentry error handler - must be before any other error middleware and after all controllers
  Sentry.setupExpressErrorHandler(app);

  // Custom error handler
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Add Sentry error ID to response
    const sentryId = (res as any).sentry;

    // Log error details
    console.error(`Error ${status}: ${message}`, {
      method: req.method,
      path: req.path,
      sentryId,
      error: err
    });

    res.status(status).json({
      message,
      ...(sentryId && { sentryId }) // Include Sentry ID for support
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, httpServer);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5030', 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);

    // Iniciar jobs
    startAutoCancelJob();
    startMonthlyResetJob();
    startScheduledDeliveriesJob();
    startViagemRemindersJob();
    startPaymentSyncJob(io);
    startHeartbeatJob(io); // Verificar motoristas inativos a cada 30s
  });
})();
