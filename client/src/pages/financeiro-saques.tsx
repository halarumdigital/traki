import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Clock, Search, ArrowUpFromLine, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Withdrawal {
  id: string;
  driverId: string;
  amount: number;
  fee: number;
  netAmount: number;
  pixKeyType: string;
  pixKey: string;
  status: string;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
  driverName: string;
  driverCpf: string | null;
  driverMobile: string;
}

interface WithdrawalsResponse {
  withdrawals: Withdrawal[];
  total: number;
  statusTotals: Record<string, { count: number; totalAmount: number }>;
}

export default function FinanceiroSaques() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Buscar saques
  const { data: withdrawalsData, isLoading: withdrawalsLoading, refetch: refetchWithdrawals } = useQuery<WithdrawalsResponse>({
    queryKey: ["/api/admin/withdrawals", searchTerm, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      params.append("limit", "100");

      const response = await fetch(`/api/admin/withdrawals?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao buscar saques");
      return response.json();
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700"><CheckCircle className="h-3 w-3" /> Concluído</span>;
      case "processing":
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700"><Loader2 className="h-3 w-3 animate-spin" /> Processando</span>;
      case "requested":
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700"><Clock className="h-3 w-3" /> Solicitado</span>;
      case "failed":
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 text-red-700"><XCircle className="h-3 w-3" /> Falhou</span>;
      case "cancelled":
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700"><XCircle className="h-3 w-3" /> Cancelado</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const formatPixKeyType = (type: string) => {
    const types: Record<string, string> = {
      cpf: "CPF",
      cnpj: "CNPJ",
      email: "E-mail",
      phone: "Telefone",
      evp: "Chave Aleatória",
    };
    return types[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Saques</h1>
          <p className="text-muted-foreground">Gestão de saques dos entregadores</p>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Saques</p>
                <p className="text-2xl font-bold">
                  {withdrawalsData?.total || 0}
                </p>
              </div>
              <ArrowUpFromLine className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Concluídos</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(withdrawalsData?.statusTotals?.completed?.totalAmount || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {withdrawalsData?.statusTotals?.completed?.count || 0} saques
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Processando</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(withdrawalsData?.statusTotals?.processing?.totalAmount || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {withdrawalsData?.statusTotals?.processing?.count || 0} saques
                </p>
              </div>
              <Loader2 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Falhas</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(withdrawalsData?.statusTotals?.failed?.totalAmount || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {withdrawalsData?.statusTotals?.failed?.count || 0} saques
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Saques</CardTitle>
          <CardDescription>Lista de todos os saques solicitados pelos entregadores</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou chave PIX..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="requested">Solicitado</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => refetchWithdrawals()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>

          {/* Tabela */}
          {withdrawalsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : withdrawalsData?.withdrawals?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowUpFromLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum saque encontrado</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entregador</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Chave PIX</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawalsData?.withdrawals?.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{withdrawal.driverName}</p>
                          <p className="text-xs text-muted-foreground">{withdrawal.driverMobile}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{formatDate(withdrawal.createdAt)}</p>
                          {withdrawal.processedAt && (
                            <p className="text-xs text-muted-foreground">
                              Processado: {formatDate(withdrawal.processedAt)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-green-600">{formatCurrency(withdrawal.amount)}</p>
                          {withdrawal.fee > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Taxa: {formatCurrency(withdrawal.fee)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm">{withdrawal.pixKey}</p>
                          <p className="text-xs text-muted-foreground">{formatPixKeyType(withdrawal.pixKeyType)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {getStatusBadge(withdrawal.status)}
                          {withdrawal.failureReason && (
                            <p className="text-xs text-red-600 mt-1" title={withdrawal.failureReason}>
                              {withdrawal.failureReason.substring(0, 30)}...
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
