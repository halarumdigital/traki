import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Wallet,
  CreditCard,
  TrendingUp,
  Truck,
  DollarSign,
  Users,
  Calendar,
  Star,
  RefreshCw,
  MapPin
} from "lucide-react";
import { useLocation } from "wouter";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CompanyInfo {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
}

interface DashboardStats {
  deliveries: {
    inProgress: number;
    completed: number;
    cancelled: number;
    total: number;
  };
  today: {
    inProgress: number;
    completed: number;
    cancelled: number;
  };
  intermunicipal: {
    inProgress: number;
    completed: number;
    cancelled: number;
  };
  metrics: {
    avgDeliveryTimeMinutes: number;
    weeklySpent: number;
  };
  recentDeliveries: Array<{
    id: string;
    requestNumber: string;
    customerName: string;
    createdAt: string;
    totalPrice: number;
    driverName: string | null;
    status: string;
  }>;
  dailyDeliveries: Array<{
    date: string;
    day_name: string;
    completed: string;
    cancelled: string;
    total: string;
  }>;
  hourlyVolume: Array<{
    hour: number;
    volume: string;
  }>;
  topDrivers: Array<{
    id: string;
    name: string;
    rating: string;
    deliveryCount: string;
    completedCount: string;
  }>;
}

export default function EmpresaDashboard() {
  const [, setLocation] = useLocation();

  const { data: companyInfo } = useQuery<CompanyInfo>({
    queryKey: ["/api/empresa/auth/me"],
  });

  // Buscar saldo da empresa
  const { data: balanceData, refetch: refetchBalance, isLoading: isLoadingBalance } = useQuery({
    queryKey: ["/api/financial/company/balance"],
    queryFn: async () => {
      const response = await fetch("/api/financial/company/balance", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao buscar saldo");
      return response.json();
    },
    refetchInterval: 60000,
  });

  // Buscar estatísticas do dashboard
  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = useQuery<DashboardStats>({
    queryKey: ["/api/empresa/dashboard/stats"],
    queryFn: async () => {
      const response = await fetch("/api/empresa/dashboard/stats", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao buscar estatísticas");
      return response.json();
    },
    refetchInterval: 30000,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleRecharge = () => {
    setLocation("/empresa/carteira");
  };

  const handleRefresh = () => {
    refetchBalance();
    refetchStats();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-700 border-green-200">Concluída</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-700 border-red-200">Cancelada</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Em andamento</Badge>;
      case "accepted":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Aceita</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Pendente</Badge>;
    }
  };

  // Preparar dados para o gráfico
  const chartData = stats?.dailyDeliveries?.map(d => ({
    date: d.date,
    entregas: parseInt(d.total) || 0,
  })) || [];

  // Preparar dados para gráfico de horários
  const hourlyData = stats?.hourlyVolume?.map(h => ({
    hour: `${h.hour}:00`,
    volume: parseInt(h.volume) || 0,
  })) || [];

  // Calcular percentual para progress bar dos motoristas
  const maxDeliveries = stats?.topDrivers?.length
    ? Math.max(...stats.topDrivers.map(d => parseInt(d.deliveryCount)))
    : 0;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 pb-8">
        {/* Header com título e ações */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Bem-vindo, {companyInfo?.name || "Empresa"}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Acompanhe o desempenho das suas entregas em tempo real.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Badge variant="outline" className="px-3 py-1 text-sm bg-green-50 text-green-700 border-green-200">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
              Sistema Operacional
            </Badge>
          </div>
        </div>

        {/* Barra de Saldo */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="h-6 w-6 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Disponível</p>
                  {isLoadingBalance ? (
                    <Skeleton className="h-8 w-32" />
                  ) : (
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {balanceData ? formatCurrency(balanceData.balance) : "R$ 0,00"}
                    </p>
                  )}
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

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Entregas Hoje</CardTitle>
              <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {(stats?.today.inProgress || 0) + (stats?.today.completed || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center">
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                    <span className="text-green-600 font-medium">{stats?.today.completed || 0}</span>
                    <span className="ml-1">concluídas</span>
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Em Andamento</CardTitle>
              <Truck className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.deliveries.inProgress || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-amber-600 font-medium">{stats?.today.inProgress || 0}</span> iniciadas hoje
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-indigo-500 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tempo Médio</CardTitle>
              <Clock className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.metrics.avgDeliveryTimeMinutes || 0} min</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    média dos últimos 7 dias
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Gasto Semanal</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatCurrency(stats?.metrics.weeklySpent || 0)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    últimos 7 dias
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          {/* Gráfico de Volume Diário */}
          <Card className="lg:col-span-4 shadow-sm">
            <CardHeader>
              <CardTitle>Volume de Entregas</CardTitle>
              <CardDescription>Quantidade de entregas realizadas nos últimos 7 dias</CardDescription>
            </CardHeader>
            <CardContent className="pl-0">
              {isLoadingStats ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Bar
                      dataKey="entregas"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhuma entrega nos últimos 7 dias
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico de Horários de Pico */}
          <Card className="lg:col-span-3 shadow-sm">
            <CardHeader>
              <CardTitle>Horários de Pico</CardTitle>
              <CardDescription>Volume de entregas por faixa horária</CardDescription>
            </CardHeader>
            <CardContent className="pl-0">
              {isLoadingStats ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : hourlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hourlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="hour"
                      stroke="#64748b"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      interval={3}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Bar
                      dataKey="volume"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Dados de horários não disponíveis
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Seção inferior - Listas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Estatísticas Gerais */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Resumo Geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Concluídas</span>
                    </div>
                    <span className="text-xl font-bold text-green-600">{stats?.deliveries.completed || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950">
                    <div className="flex items-center gap-3">
                      <Truck className="h-5 w-5 text-amber-600" />
                      <span className="font-medium">Em Andamento</span>
                    </div>
                    <span className="text-xl font-bold text-amber-600">{stats?.deliveries.inProgress || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950">
                    <div className="flex items-center gap-3">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium">Canceladas</span>
                    </div>
                    <span className="text-xl font-bold text-red-600">{stats?.deliveries.cancelled || 0}</span>
                  </div>
                  {(stats?.intermunicipal.completed || 0) + (stats?.intermunicipal.inProgress || 0) > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-indigo-600" />
                        <span className="font-medium">Intermunicipais</span>
                      </div>
                      <span className="text-xl font-bold text-indigo-600">
                        {(stats?.intermunicipal.completed || 0) + (stats?.intermunicipal.inProgress || 0)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Últimas Entregas */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Últimas Entregas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="space-y-3">
                  {[1,2,3,4,5].map(i => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : stats?.recentDeliveries?.length ? (
                <div className="space-y-3">
                  {stats.recentDeliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setLocation("/empresa/entregas/em-andamento")}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{delivery.customerName || "Cliente"}</p>
                        <p className="text-xs text-muted-foreground">{delivery.createdAt}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-green-600">
                          {formatCurrency(delivery.totalPrice || 0)}
                        </span>
                        {getStatusBadge(delivery.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma entrega recente
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Motoristas */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Motoristas Mais Utilizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="space-y-4">
                  {[1,2,3,4,5].map(i => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : stats?.topDrivers?.length ? (
                <div className="space-y-4">
                  {stats.topDrivers.map((driver, index) => (
                    <div key={driver.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 bg-primary/10 text-primary border">
                            <AvatarFallback className="text-xs font-semibold">
                              {driver.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium truncate max-w-[120px]">{driver.name}</p>
                            <p className="text-xs text-muted-foreground">{driver.deliveryCount} entregas</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-bold text-amber-700">
                            {parseFloat(driver.rating || "0").toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <Progress
                        value={maxDeliveries > 0 ? (parseInt(driver.deliveryCount) / maxDeliveries) * 100 : 0}
                        className="h-1.5"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum motorista utilizado ainda
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}
