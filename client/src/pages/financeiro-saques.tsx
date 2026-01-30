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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, Clock, Search, ArrowUpFromLine, CheckCircle, XCircle, Loader2, Receipt, ExternalLink, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Withdrawal {
  id: string;
  driverId: string;
  amount: number;
  fee: number;
  netAmount: number;
  pixKeyType: string;
  pixKey: string;
  asaasTransferId: string | null;
  status: string;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
  driverName: string;
  driverCpf: string | null;
  driverMobile: string;
}

interface TransferReceipt {
  transferId: string;
  status: string;
  value?: number;
  netValue?: number;
  transferFee?: number;
  effectiveDate?: string;
  endToEndIdentifier?: string;
  transactionReceiptUrl?: string | null;
  pixAddressKey?: string;
  pixAddressKeyType?: string;
  dateCreated?: string;
  failReason?: string;
  message?: string;
}

interface WithdrawalsResponse {
  withdrawals: Withdrawal[];
  total: number;
  statusTotals: Record<string, { count: number; totalAmount: number }>;
}

export default function FinanceiroSaques() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<TransferReceipt | null>(null);
  const { toast } = useToast();

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

  const fetchReceipt = async (withdrawal: Withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setReceiptDialogOpen(true);
    setReceiptLoading(true);
    setReceiptData(null);

    try {
      const response = await fetch(`/api/admin/withdrawals/${withdrawal.id}/receipt`, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao buscar comprovante");
      }

      const data = await response.json();
      setReceiptData(data);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao buscar comprovante",
        variant: "destructive",
      });
      setReceiptDialogOpen(false);
    } finally {
      setReceiptLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência`,
    });
  };

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
                    <TableHead className="text-center">Comprovante</TableHead>
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
                      <TableCell className="text-center">
                        {withdrawal.asaasTransferId ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchReceipt(withdrawal)}
                            title="Ver comprovante"
                          >
                            <Receipt className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Comprovante */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Comprovante de Saque
            </DialogTitle>
            <DialogDescription>
              {selectedWithdrawal?.driverName} - {formatCurrency(selectedWithdrawal?.amount || 0)}
            </DialogDescription>
          </DialogHeader>

          {receiptLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : receiptData ? (
            <div className="space-y-4">
              {/* Status da Transferência */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Status</span>
                <span className={`text-sm font-semibold ${
                  receiptData.status === "DONE" ? "text-green-600" :
                  receiptData.status === "FAILED" ? "text-red-600" :
                  receiptData.status === "CANCELLED" ? "text-gray-600" :
                  "text-blue-600"
                }`}>
                  {receiptData.status === "DONE" ? "Concluído" :
                   receiptData.status === "FAILED" ? "Falhou" :
                   receiptData.status === "CANCELLED" ? "Cancelado" :
                   receiptData.status === "PENDING" ? "Pendente" :
                   receiptData.status === "BANK_PROCESSING" ? "Processando" :
                   receiptData.status}
                </span>
              </div>

              {/* Informações da Transferência */}
              <div className="space-y-2">
                {receiptData.transferId && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">ID Transferência</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{receiptData.transferId.substring(0, 20)}...</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(receiptData.transferId, "ID da transferência")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {receiptData.endToEndIdentifier && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">ID End-to-End (PIX)</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{receiptData.endToEndIdentifier.substring(0, 15)}...</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(receiptData.endToEndIdentifier!, "ID End-to-End")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {receiptData.value && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Valor</span>
                    <span className="font-medium">{formatCurrency(receiptData.value)}</span>
                  </div>
                )}

                {receiptData.transferFee !== undefined && receiptData.transferFee > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Taxa</span>
                    <span className="font-medium text-red-600">-{formatCurrency(receiptData.transferFee)}</span>
                  </div>
                )}

                {receiptData.netValue && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Valor Líquido</span>
                    <span className="font-medium text-green-600">{formatCurrency(receiptData.netValue)}</span>
                  </div>
                )}

                {receiptData.effectiveDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Data Efetiva</span>
                    <span>{new Date(receiptData.effectiveDate).toLocaleString('pt-BR')}</span>
                  </div>
                )}

                {receiptData.pixAddressKey && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Chave PIX</span>
                    <span className="font-mono text-xs">{receiptData.pixAddressKey}</span>
                  </div>
                )}

                {receiptData.failReason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-800">Motivo da Falha:</p>
                    <p className="text-sm text-red-600">{receiptData.failReason}</p>
                  </div>
                )}

                {receiptData.message && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">{receiptData.message}</p>
                  </div>
                )}
              </div>

              {/* Botão para Ver Comprovante Completo */}
              {receiptData.transactionReceiptUrl && (
                <Button
                  className="w-full"
                  onClick={() => window.open(receiptData.transactionReceiptUrl!, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Comprovante Completo
                </Button>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
