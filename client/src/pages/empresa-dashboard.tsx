import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Clock, CheckCircle2, XCircle, Wallet, CreditCard } from "lucide-react";
import { useLocation } from "wouter";

interface CompanyStats {
  totalTrips: number;
  pendingTrips: number;
  completedTrips: number;
  cancelledTrips: number;
}

export default function EmpresaDashboard() {
  const [, setLocation] = useLocation();

  const { data: companyInfo } = useQuery({
    queryKey: ["/api/empresa/auth/me"],
  });

  // Buscar saldo da empresa
  const { data: balanceData, refetch: refetchBalance } = useQuery({
    queryKey: ["/api/financial/company/balance"],
    queryFn: async () => {
      const response = await fetch("/api/financial/company/balance", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao buscar saldo");
      return response.json();
    },
    refetchInterval: 60000, // Atualizar a cada minuto
  });

  // TODO: Fetch real stats from API
  const stats: CompanyStats = {
    totalTrips: 0,
    pendingTrips: 0,
    completedTrips: 0,
    cancelledTrips: 0,
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleRecharge = () => {
    setLocation("/empresa/carteira");
  };

  return (
    <div className="space-y-6">
      {/* Barra de Saldo */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm text-muted-foreground">Saldo Disponível</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {balanceData ? formatCurrency(balanceData.balance) : "R$ 0,00"}
                </p>
              </div>
            </div>
            <Button
              onClick={handleRecharge}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Recarregar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Bem-vindo, {companyInfo?.name || "Empresa"}!
        </h1>
        <p className="text-muted-foreground mt-2">
          Gerencie suas corridas e acompanhe o status das solicitações
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Corridas</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTrips}</div>
            <p className="text-xs text-muted-foreground">
              Todas as corridas solicitadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingTrips}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando motorista
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedTrips}</div>
            <p className="text-xs text-muted-foreground">
              Corridas finalizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Canceladas</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cancelledTrips}</div>
            <p className="text-xs text-muted-foreground">
              Corridas canceladas
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Começar</CardTitle>
          <CardDescription>
            Use o menu lateral para navegar pelas funcionalidades
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            • <strong>Dashboard:</strong> Visualize estatísticas das suas corridas
          </p>
          <p className="text-sm text-muted-foreground">
            • <strong>Nova Corrida:</strong> Solicite uma nova corrida para sua empresa
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
