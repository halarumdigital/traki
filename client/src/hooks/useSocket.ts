import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface UseSocketOptions {
  companyId?: string;
  driverId?: string;
  autoConnect?: boolean;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  emit: (event: string, data: any) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
}

/**
 * Hook para gerenciar conexão Socket.IO
 *
 * @example
 * // Em um componente da empresa
 * const { socket, isConnected, on } = useSocket({ companyId: "123" });
 *
 * useEffect(() => {
 *   on("delivery-accepted", (data) => {
 *     console.log("Entrega aceita:", data);
 *   });
 * }, [on]);
 */
export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { companyId, driverId, autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    // Conectar ao servidor Socket.IO
    // Em desenvolvimento, usa http://localhost:5010
    // Em produção, usa a mesma origem do frontend
    const serverUrl = import.meta.env.PROD
      ? window.location.origin
      : "http://localhost:5010";

    console.log("🔌 Conectando ao Socket.IO:", serverUrl);

    const socket = io(serverUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    // Event listeners
    socket.on("connect", () => {
      console.log("✅ Conectado ao Socket.IO:", socket.id);
      setIsConnected(true);

      // Entrar na sala específica
      if (companyId) {
        socket.emit("join-company", companyId);
        console.log(`📍 Entrou na sala: company-${companyId}`);
      }

      if (driverId) {
        socket.emit("join-driver", driverId);
        console.log(`📍 Entrou na sala: driver-${driverId}`);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Desconectado do Socket.IO:", reason);
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Erro de conexão Socket.IO:", error);
      setIsConnected(false);
    });

    // Cleanup ao desmontar
    return () => {
      console.log("🔌 Desconectando Socket.IO");
      socket.disconnect();
    };
  }, [autoConnect, companyId, driverId]);

  const emit = (event: string, data: any) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    } else {
      console.warn("Socket não está conectado");
    }
  };

  const on = (event: string, callback: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  };

  const off = (event: string, callback?: (...args: any[]) => void) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(event, callback);
      } else {
        socketRef.current.off(event);
      }
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    emit,
    on,
    off,
  };
}
