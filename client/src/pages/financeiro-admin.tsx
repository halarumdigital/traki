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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Building2, Truck, TrendingUp, TrendingDown, RefreshCw, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function FinanceiroAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [selectedSubaccount, setSelectedSubaccount] = useState<any>(null);
  const [withdrawReason, setWithdrawReason] = useState("");

  // Buscar estatísticas
  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useQuery({
    queryKey: ["/api/financial/admin/stats"],
  });

  // Buscar subcontas
  const { data: subaccounts, isLoading: loadingSubaccounts } = useQuery({
    queryKey: ["/api/financial/admin/subaccounts"],
  });

  // Buscar transações
  const { data: transactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ["/api/financial/admin/transactions"],
  });

  // Mutation para forçar saque
  const forceWithdrawMutation = useMutation({
    mutationFn: async ({ subaccountId, reason }: { subaccountId: string; reason: string }) => {
      const res = await fetch(`/api/financial/admin/subaccounts/${subaccountId}/force-withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao forçar saque");
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Saque realizado!",
        description: "O saldo foi transferido com sucesso",
      });
      setWithdrawDialogOpen(false);
      setSelectedSubaccount(null);
      setWithdrawReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/financial/admin/subaccounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial/admin/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao realizar saque",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleForceWithdraw = () => {
    if (!selectedSubaccount) return;
    forceWithdrawMutation.mutate({
      subaccountId: selectedSubaccount.id,
      reason: withdrawReason,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('pt-BR');
  };

  const getAccountTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      company: "Empresa",
      driver: "Motorista",
      admin: "Admin",
    };
    return labels[type] || type;
  };

  const getAccountTypeIcon = (type: string) => {
    if (type === 'company') return <Building2 className="h-4 w-4" />;
    if (type === 'driver') return <Truck className="h-4 w-4" />;
    return <Wallet className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão Financeira</h1>
          <p className="text-muted-foreground">Visão geral de todas as subcontas e transações</p>
        </div>
        <Button variant="outline" onClick={() => refetchStats()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Estatísticas */}
      {loadingStats ? (
        <p>Carregando estatísticas...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Subcontas</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.subaccounts?.total || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.subaccounts?.companies || 0} empresas • {stats?.subaccounts?.drivers || 0} motoristas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Empresas</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.balances?.totalCompanyBalance || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Saldo total disponível nas empresas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Motoristas</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.balances?.totalDriverBalance || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Saldo total disponível dos motoristas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transacionado</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.transactions?.totalTransferred || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.transactions?.total || 0} transações
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="subaccounts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subaccounts">Subcontas</TabsTrigger>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
        </TabsList>

        {/* Tab de Subcontas */}
        <TabsContent value="subaccounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Subcontas</CardTitle>
              <CardDescription>Lista de todas as subcontas cadastradas</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSubaccounts ? (
                <p>Carregando subcontas...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Chave PIX</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Última Atualização</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subaccounts?.subaccounts?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Nenhuma subconta encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      subaccounts?.subaccounts?.map((subaccount: any) => (
                        <TableRow key={subaccount.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getAccountTypeIcon(subaccount.accountType)}
                              {getAccountTypeLabel(subaccount.accountType)}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{subaccount.ownerName || '-'}</TableCell>
                          <TableCell className="font-mono text-sm">{subaccount.pixKey}</TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(parseFloat(subaccount.balanceCache || 0))}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {subaccount.lastBalanceUpdate ? formatDate(subaccount.lastBalanceUpdate) : 'Nunca'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSubaccount(subaccount);
                                setWithdrawDialogOpen(true);
                              }}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Forçar Saque
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Transações */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transações</CardTitle>
              <CardDescription>Histórico completo de todas as transações</CardDescription>
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
                    {transactions?.transactions?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Nenhuma transação encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions?.transactions?.map((transaction: any) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            <Badge variant="outline">{transaction.type}</Badge>
                          </TableCell>
                          <TableCell className="max-w-md truncate">{transaction.description}</TableCell>
                          <TableCell className="text-sm">{formatDate(transaction.createdAt)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(parseFloat(transaction.amount))}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={transaction.status === 'completed' ? 'default' : 'secondary'}
                            >
                              {transaction.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Forçar Saque */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forçar Saque de Subconta</DialogTitle>
            <DialogDescription>
              Esta ação irá sacar todo o saldo disponível para a chave PIX cadastrada
            </DialogDescription>
          </DialogHeader>

          {selectedSubaccount && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">Subconta</p>
                <p className="font-medium">{selectedSubaccount.ownerName}</p>
                <p className="text-sm">Tipo: {getAccountTypeLabel(selectedSubaccount.accountType)}</p>
                <p className="text-sm">Chave PIX: {selectedSubaccount.pixKey}</p>
                <p className="text-lg font-bold">
                  Saldo: {formatCurrency(parseFloat(selectedSubaccount.balanceCache || 0))}
                </p>
              </div>

              <div>
                <Label htmlFor="reason">Motivo do Saque Forçado</Label>
                <Input
                  id="reason"
                  placeholder="Digite o motivo (opcional)"
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleForceWithdraw}
              disabled={forceWithdrawMutation.isPending}
            >
              {forceWithdrawMutation.isPending ? "Processando..." : "Confirmar Saque"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
