import * as Sentry from "@sentry/react";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

function ErrorFallback({ error, resetError }: { error: unknown; resetError: () => void }) {
  const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
  const errorStack = error instanceof Error ? error.stack : undefined;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Ops! Algo deu errado
          </h2>
          <p className="text-gray-600 mb-4">
            Ocorreu um erro inesperado. Nossa equipe foi notificada e está trabalhando para resolver o problema.
          </p>
          {import.meta.env.DEV && (
            <details className="text-left mb-4">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                Detalhes do erro (desenvolvimento)
              </summary>
              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                {errorMessage}
                {errorStack}
              </pre>
            </details>
          )}
          <div className="space-y-2">
            <Button onClick={resetError} className="w-full">
              Tentar Novamente
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = "/dashboard"}
              className="w-full"
            >
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ErrorBoundary = Sentry.withErrorBoundary(
  ({ children }: ErrorBoundaryProps) => children,
  {
    fallback: ErrorFallback,
    showDialog: false,
    onError: (error, errorInfo) => {
      console.error("Error caught by ErrorBoundary:", error, errorInfo);
    },
  }
);

export default ErrorBoundary;