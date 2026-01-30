/**
 * Módulo de integração com iFood
 * Exporta cliente, worker e tipos
 */

// Cliente HTTP
export {
  authenticate,
  getValidToken,
  pollEvents,
  getOrderDetails,
  acknowledgeEvents,
  assignDriver,
  goingToOrigin,
  arrivedAtOrigin,
  dispatch,
  arrivedAtDestination,
  verifyDeliveryCode,
  confirmDelivery,
  clearTokenCache,
  clearAllTokenCache,
} from "./client";

// Worker de polling
export {
  startIFoodWorker,
  stopIFoodWorker,
  isIFoodWorkerRunning,
  manualPoll,
} from "./worker";

// Callbacks (notificações de status para iFood)
export {
  onDeliveryAccepted,
  onArrivedAtPickup,
  onPickedUp,
  onArrivedAtDestination,
  onDeliveryCompleted,
  notifyIfoodStatusChange,
} from "./callbacks";

// Tipos
export * from "./types";
