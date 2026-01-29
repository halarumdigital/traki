import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, RefreshCw, Clock, Banknote } from "lucide-react";

interface PlatformWalletData {
  wallet: {
    id: string;
    availableBalance: number;
    blockedBalance: number;
    status: string;
  };
  pending: {
    driverAmount: number;
    commissionAmount: number;
    deliveriesCount: number;
  };
}

export default function Financeiro() {
  // Buscar wallet da plataforma
  const { data: platformData, isLoading: platformLoading, refetch: refetchPlatform } = useQuery<PlatformWalletData>({
    queryKey: ["/api/admin/platform-wallet"],
    queryFn: async () => {
      const response = await fetch("/api/admin/platform-wallet", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao buscar wallet da plataforma");
      return response.json();
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Carteira</h1>
          <p className="text-muted-foreground">Gestão financeira da plataforma</p>
        </div>
        <Button variant="outline" onClick={() => refetchPlatform()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Wallet da Plataforma */}
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Carteira da Plataforma
          </CardTitle>
          <CardDescription>Saldo disponível e valores pendentes</CardDescription>
        </CardHeader>
        <CardContent>
          {platformLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {/* Saldo Disponível */}
              <div className="bg-white rounded-lg p-4 border shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Saldo Disponível</span>
                  <Wallet className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(platformData?.wallet.availableBalance || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Comissões recebidas</p>
              </div>

              {/* Saldo Bloqueado */}
              <div className="bg-white rounded-lg p-4 border shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Saldo Bloqueado</span>
                  <Wallet className="h-4 w-4 text-orange-500" />
                </div>
                <p className="text-2xl font-bold text-orange-500">
                  {formatCurrency(platformData?.wallet.blockedBalance || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Em processamento</p>
              </div>

              {/* Pendente de Liberação */}
              <div className="bg-white rounded-lg p-4 border shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Aguardando Pagamento</span>
                  <Clock className="h-4 w-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency((platformData?.pending.driverAmount || 0) + (platformData?.pending.commissionAmount || 0))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {platformData?.pending.deliveriesCount || 0} entregas aguardando boleto
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
