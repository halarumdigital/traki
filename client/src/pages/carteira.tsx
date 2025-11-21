import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Wallet, Plus, RefreshCw, TrendingUp, TrendingDown, Clock, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Assumir que temos o companyId da sessão
const COMPANY_ID = "current-company-id"; // Isso virá da sessão/auth

export default function Carteira() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [qrCodeData, setQrCodeData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Buscar saldo
  const { data: balanceData, isLoading: loadingBalance, refetch: refetchBalance } = useQuery({
    queryKey: [`/api/financial/company/${COMPANY_ID}/balance`],
  });

  // Buscar transações
  const { data: transactionsData, isLoading: loadingTransactions } = useQuery({
    queryKey: [`/api/financial/company/${COMPANY_ID}/transactions`],
  });

  // Buscar cobranças PIX
  const { data: chargesData } = useQuery({
    queryKey: [`/api/financial/company/${COMPANY_ID}/charges`],
  });

  // Mutation para criar recarga
  const rechargeMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch("/api/financial/company/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: COMPANY_ID,
          amount,
        }),
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
      queryClient.invalidateQueries({ queryKey: [`/api/financial/company/${COMPANY_ID}/charges`] });
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
    const amount = parseFloat(rechargeAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Valor inválido",
        description: "Digite um valor maior que zero",
        variant: "destructive",
      });
      return;
    }
    rechargeMutation.mutate(amount);
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

  const getTransactionIcon = (type: string) => {
    if (type.includes('charge') || type === 'balance_unblock') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (type.includes('transfer') || type === 'balance_block') return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Clock className="h-4 w-4" />;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Carteira</h1>
          <p className="text-muted-foreground">Gerencie seu saldo e transações</p>
        </div>
        <Button onClick={() => setRechargeDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Recarga
        </Button>
      </div>

      {/* Saldo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Saldo Disponível
              </CardTitle>
              <CardDescription>Atualize para ver o saldo em tempo real</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchBalance()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingBalance ? (
            <p>Carregando...</p>
          ) : (
            <div>
              <p className="text-4xl font-bold">{formatCurrency(balanceData?.balance || 0)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Última atualização: {balanceData?.lastUpdate ? formatDate(balanceData.lastUpdate) : 'Nunca'}
              </p>
              {balanceData?.pixKey && (
                <p className="text-sm text-muted-foreground mt-1">
                  Chave PIX: {balanceData.pixKey}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transações */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Transações</CardTitle>
          <CardDescription>Últimas movimentações da sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTransactions ? (
            <p>Carregando transações...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionsData?.transactions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhuma transação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  transactionsData?.transactions?.map((transaction: any) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(transaction.type)}
                          {transaction.type}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{transaction.description}</TableCell>
                      <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(parseFloat(transaction.amount))}
                      </TableCell>
                      <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Recarga */}
      <Dialog open={rechargeDialogOpen} onOpenChange={setRechargeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Recarga via PIX</DialogTitle>
            <DialogDescription>
              {qrCodeData ? "Escaneie o QR Code para pagar" : "Digite o valor que deseja adicionar ao saldo"}
            </DialogDescription>
          </DialogHeader>

          {!qrCodeData ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4">
                <img src={qrCodeData.qrCode} alt="QR Code PIX" className="w-64 h-64 border rounded" />
                <div className="w-full">
                  <Label>Código PIX Copia e Cola</Label>
                  <div className="flex gap-2 mt-1">
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
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Valor: <span className="font-bold">{formatCurrency(qrCodeData.value / 100)}</span>
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {!qrCodeData ? (
              <>
                <Button variant="outline" onClick={() => setRechargeDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleRecharge} disabled={rechargeMutation.isPending}>
                  {rechargeMutation.isPending ? "Gerando..." : "Gerar QR Code"}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  setQrCodeData(null);
                  setRechargeAmount("");
                  setRechargeDialogOpen(false);
                }}
              >
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
