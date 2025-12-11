import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/hooks/useSocket";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet,
  Plus,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Copy,
  Check,
  FileText,
  Calendar as CalendarIcon,
  CreditCard
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Carteira() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [selectedPresetAmount, setSelectedPresetAmount] = useState<string>("");
  const [qrCodeData, setQrCodeData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // Valores pré-definidos
  const presetAmounts = [50, 100, 150, 200];

  // Buscar dados da empresa para o companyId
  const { data: companyData } = useQuery<any>({
    queryKey: ["/api/empresa/auth/me"],
  });

  // Socket.IO - Conectar para receber atualizações em tempo real
  const { isConnected, on } = useSocket({
    companyId: companyData?.id,
    autoConnect: !!companyData?.id,
  });

  // Listener de pagamento confirmado em tempo real
  useEffect(() => {
    if (!isConnected || !companyData?.id) return;

    const handlePaymentConfirmed = (data: any) => {
      console.log("💰 Pagamento confirmado em tempo real:", data);

      // Atualizar saldo e transações
      queryClient.invalidateQueries({ queryKey: ["/api/financial/company/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial/company/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial/company/charges"] });

      // Fechar modal de QR Code se estiver aberto
      setQrCodeData(null);
      setRechargeDialogOpen(false);

      // Notificar usuário
      toast({
        title: "Pagamento Confirmado!",
        description: `Recarga de R$ ${data.value?.toFixed(2)} confirmada. Novo saldo: R$ ${data.newBalance?.toFixed(2)}`,
      });
    };

    on(`payment:confirmed:${companyData.id}`, handlePaymentConfirmed);

    return () => {
      // Cleanup será feito pelo hook useSocket
    };
  }, [isConnected, companyData?.id, on, queryClient, toast]);

  // Buscar saldo (atualiza a cada 30 segundos como fallback)
  const { data: balanceData, isLoading: loadingBalance, refetch: refetchBalance } = useQuery({
    queryKey: ["/api/financial/company/balance"],
    queryFn: async () => {
      const response = await fetch("/api/financial/company/balance", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao buscar saldo");
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Buscar transações (atualiza a cada 30 segundos como fallback)
  const { data: transactionsData, isLoading: loadingTransactions } = useQuery({
    queryKey: ["/api/financial/company/transactions"],
    queryFn: async () => {
      const response = await fetch("/api/financial/company/transactions", {
        credentials: "include",
      });
      if (!response.ok) return { transactions: [] };
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Mutation para criar recarga
  const rechargeMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch("/api/financial/company/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao criar recarga");
      }

      return res.json();
    },
    onSuccess: (data) => {
      setQrCodeData(data);
      toast({
        title: "QR Code gerado!",
        description: "Escaneie o QR Code para realizar o pagamento",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/financial/company/charges"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar recarga",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRecharge = () => {
    const amount = parseFloat(rechargeAmount || selectedPresetAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Valor inválido",
        description: "Selecione ou digite um valor maior que zero",
        variant: "destructive",
      });
      return;
    }
    rechargeMutation.mutate(amount);
  };

  const handlePresetAmountSelect = (value: string) => {
    setSelectedPresetAmount(value);
    setRechargeAmount(value);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copiado!", description: "Código PIX copiado para área de transferência" });
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('pt-BR');
  };

  const getTransactionType = (type: string) => {
    if (type.includes('recarga') || type.includes('pagamento') || type === 'balance_unblock' || type === 'payment_confirmed') {
      return 'credit';
    }
    return 'debit';
  };

  const formatTransactionType = (type: string) => {
    const typeLabels: Record<string, string> = {
      'recarga_criada': 'Recarga Criada',
      'pagamento_confirmado': 'Pagamento Confirmado',
      'charge_created': 'Recarga Criada',
      'payment_confirmed': 'Pagamento Confirmado',
      'transfer_delivery': 'Transferência Entrega',
      'transfer_cancellation': 'Estorno',
      'withdrawal': 'Saque',
      'balance_block': 'Bloqueio de Saldo',
      'balance_unblock': 'Desbloqueio de Saldo',
    };
    return typeLabels[type] || type;
  };

  // Filtrar transações por data
  const filteredTransactions = transactionsData?.transactions?.filter((transaction: any) => {
    if (!startDate && !endDate) return true;

    const transactionDate = new Date(transaction.createdAt);

    if (startDate && endDate) {
      return transactionDate >= startDate && transactionDate <= new Date(endDate.getTime() + 86400000);
    }
    if (startDate) {
      return transactionDate >= startDate;
    }
    if (endDate) {
      return transactionDate <= new Date(endDate.getTime() + 86400000);
    }
    return true;
  }) || [];

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Wallet className="h-6 w-6" />
              Carteira
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie seu saldo e transações</p>
          </div>
          <Button
            onClick={() => setRechargeDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Recarga
          </Button>
        </div>

        {/* Card de Saldo */}
        <Card className="bg-slate-50/50 border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <FileText className="h-4 w-4" />
                    Saldo Disponível
                  </div>
                  <p className="text-xs text-slate-500">Atualize para ver o saldo em tempo real</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-400 hover:text-slate-600"
                  onClick={() => refetchBalance()}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <div>
                {loadingBalance ? (
                  <Skeleton className="h-10 w-48" />
                ) : (
                  <>
                    <span className="text-4xl font-bold text-slate-900">
                      {formatCurrency(balanceData?.balance || 0)}
                    </span>
                    <p className="text-xs text-slate-400 mt-2">
                      Última atualização: {balanceData?.lastUpdate ? formatDate(balanceData.lastUpdate) : 'Agora'}
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Histórico de Transações */}
        <Card className="shadow-sm">
          <CardHeader className="px-6 py-4 border-b bg-muted/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-base font-medium">Histórico de Transações</CardTitle>
                <CardDescription>Últimas movimentações da sua conta</CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-[150px] justify-start text-left font-normal ${!startDate && "text-muted-foreground"}`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : <span>Data Inicial</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>

                <span className="text-slate-400">-</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-[150px] justify-start text-left font-normal ${!endDate && "text-muted-foreground"}`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : <span>Data Final</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>

                {(startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStartDate(undefined);
                      setEndDate(undefined);
                    }}
                  >
                    Limpar
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingTransactions ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Wallet className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-1">
                  Nenhuma transação encontrada
                </h3>
                <p className="text-sm text-muted-foreground/70 max-w-sm">
                  {startDate || endDate
                    ? "Não há transações no período selecionado"
                    : "Suas transações aparecerão aqui"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-semibold pl-6">Tipo</TableHead>
                    <TableHead className="font-semibold w-[40%]">Descrição</TableHead>
                    <TableHead className="font-semibold">Data</TableHead>
                    <TableHead className="font-semibold text-right">Valor</TableHead>
                    <TableHead className="font-semibold text-center pr-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction: any) => (
                    <TableRow key={transaction.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2">
                          {getTransactionType(transaction.type) === 'debit' ? (
                            <ArrowUpRight className="h-4 w-4 text-red-500" />
                          ) : (
                            <ArrowDownLeft className="h-4 w-4 text-green-500" />
                          )}
                          <span className="text-sm font-medium">{formatTransactionType(transaction.type)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground truncate max-w-[400px]" title={transaction.description}>
                          {transaction.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-mono text-muted-foreground">{formatDate(transaction.createdAt)}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={getTransactionType(transaction.type) === 'credit' ? 'text-green-600' : ''}>
                          {formatCurrency(parseFloat(transaction.amount))}
                        </span>
                      </TableCell>
                      <TableCell className="text-center pr-6">
                        <Badge
                          className={`
                            font-medium border px-2.5 py-0.5
                            ${transaction.status === 'completed' ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600' : ''}
                            ${transaction.status === 'pending' ? 'bg-slate-200 text-slate-600 hover:bg-slate-300 border-slate-300' : ''}
                            ${transaction.status === 'failed' ? 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' : ''}
                          `}
                        >
                          {transaction.status === 'completed' ? 'Concluído' : transaction.status === 'pending' ? 'Pendente' : 'Falhou'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Recarga */}
      <Dialog open={rechargeDialogOpen} onOpenChange={setRechargeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Nova Recarga via PIX
            </DialogTitle>
            <DialogDescription>
              {qrCodeData ? "Escaneie o QR Code para pagar" : "Digite o valor que deseja adicionar ao saldo"}
            </DialogDescription>
          </DialogHeader>

          {!qrCodeData ? (
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium">Valores Sugeridos</Label>
                <ToggleGroup
                  type="single"
                  value={selectedPresetAmount}
                  onValueChange={handlePresetAmountSelect}
                  className="justify-start mt-3 flex-wrap"
                >
                  {presetAmounts.map((amount) => (
                    <ToggleGroupItem
                      key={amount}
                      value={amount.toString()}
                      className="px-6 data-[state=on]:bg-blue-600 data-[state=on]:text-white"
                    >
                      R$ {amount}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <div>
                <Label htmlFor="amount" className="text-sm font-medium">Ou digite outro valor (R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  className="mt-2"
                  value={rechargeAmount}
                  onChange={(e) => {
                    setRechargeAmount(e.target.value);
                    setSelectedPresetAmount("");
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4 p-4 bg-muted/30 rounded-lg">
                <img src={qrCodeData.qrCode} alt="QR Code PIX" className="w-52 h-52 rounded-lg shadow-sm" />
                <p className="text-lg font-bold">
                  {formatCurrency(qrCodeData.value / 100)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Código PIX Copia e Cola</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={qrCodeData.brCode}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(qrCodeData.brCode)}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {!qrCodeData ? (
              <>
                <Button variant="outline" onClick={() => setRechargeDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleRecharge}
                  disabled={rechargeMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {rechargeMutation.isPending ? "Gerando..." : "Gerar QR Code"}
                </Button>
              </>
            ) : (
              <Button
                className="w-full"
                onClick={() => {
                  setQrCodeData(null);
                  setRechargeAmount("");
                  setSelectedPresetAmount("");
                  setRechargeDialogOpen(false);
                }}
              >
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
