import { Button } from "@/components/ui/button";
import { useSentry } from "@/hooks/use-sentry";

export function TestSentry() {
  const { captureException, captureMessage, addBreadcrumb } = useSentry();

  const testError = () => {
    addBreadcrumb({
      message: "Test error button clicked",
      category: "test",
      level: "warning",
    });

    try {
      throw new Error("Teste de erro do Sentry - Frontend React");
    } catch (error) {
      captureException(error, {
        component: "TestSentry",
        action: "testError",
        timestamp: new Date().toISOString(),
      });
      console.error("Erro capturado e enviado ao Sentry:", error);
    }
  };

  const testMessage = () => {
    captureMessage("Teste de mensagem do Sentry - Frontend React", "info", {
      component: "TestSentry",
      action: "testMessage",
      timestamp: new Date().toISOString(),
    });
    console.log("Mensagem enviada ao Sentry");
  };

  const testCrash = () => {
    addBreadcrumb({
      message: "Test crash button clicked - this will crash the app",
      category: "test",
      level: "error",
    });
    // This will trigger the Error Boundary
    throw new Error("Teste de crash do aplicativo - Error Boundary");
  };

  // Only show in development mode
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 p-4 bg-background/95 backdrop-blur rounded-lg shadow-lg border">
      <p className="text-sm font-semibold mb-2">Testes Sentry (Dev Only)</p>
      <div className="flex flex-col gap-2">
        <Button onClick={testError} variant="outline" size="sm">
          Testar Erro Capturado
        </Button>
        <Button onClick={testMessage} variant="outline" size="sm">
          Testar Mensagem
        </Button>
        <Button onClick={testCrash} variant="destructive" size="sm">
          Testar Crash (Error Boundary)
        </Button>
      </div>
    </div>
  );
}

export default TestSentry;