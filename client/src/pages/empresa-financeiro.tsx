import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  Download,
  Calendar as CalendarIcon,
  Filter,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  CreditCard,
  Copy,
  ExternalLink
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";

interface Boleto {
  id: string;
  periodo: string;
  dataEmissao: string;
  dataVencimento: string;
  valor: number;
  totalEntregas: number;
  status: "open" | "paid" | "overdue";
  codigoBarras?: string;
  linhaDigitavel?: string;
  pdfUrl?: string;
}

export default function EmpresaFinanceiro() {
  const [statusFiltro, setStatusFiltro] = useState<string>("all");
  const [selectedBoleto, setSelectedBoleto] = useState<Boleto | null>(null);
  const { toast } = useToast();

  // Por enquanto, dados mock - substituir por API quando disponível
  const { data: boletos, isLoading, refetch } = useQuery<Boleto[]>({
    queryKey: ["/api/empresa/boletos", statusFiltro],
    queryFn: async () => {
      // TODO: Implementar endpoint no backend
      // const response = await fetch(`/api/empresa/boletos?status=${statusFiltro}`, {
      //   credentials: "include",
      // });
      // if (!response.ok) throw new Error("Erro ao buscar boletos");
      // return response.json();

      // Dados mock por enquanto
      return [];
    },
    enabled: true,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Pago
          </Badge>
        );
      case "open":
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 gap-1">
            <Clock className="h-3 w-3" />
            Em Aberto
          </Badge>
        );
      case "overdue":
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 gap-1">
            <AlertCircle className="h-3 w-3" />
            Atrasado
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredBoletos = statusFiltro === "all"
    ? boletos
    : boletos?.filter(b => b.status === statusFiltro) || [];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Código copiado para a área de transferência",
    });
  };

  // Calcular totais
  const totals = {
    emAberto: boletos?.filter(b => b.status === "open").reduce((sum, b) => sum + b.valor, 0) || 0,
    atrasado: boletos?.filter(b => b.status === "overdue").reduce((sum, b) => sum + b.valor, 0) || 0,
    pago: boletos?.filter(b => b.status === "paid").reduce((sum, b) => sum + b.valor, 0) || 0,
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <DollarSign className="h-6 w-6" />
              Financeiro
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie seus boletos semanais e pagamentos
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Em Aberto</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(totals.emAberto)}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500/20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Atrasado</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.atrasado)}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500/20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pago (este mês)</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.pago)}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500/20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Boletos */}
        <Card className="shadow-sm">
          <CardHeader className="px-6 py-4 border-b bg-muted/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-medium">Boletos Semanais</CardTitle>
                <CardDescription>Lista de boletos gerados por semana</CardDescription>
              </div>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filtrar por Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Em Aberto</SelectItem>
                  <SelectItem value="overdue">Atrasados</SelectItem>
                  <SelectItem value="paid">Pagos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredBoletos && filteredBoletos.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold pl-6">Período</TableHead>
                    <TableHead className="font-semibold">Data Emissão</TableHead>
                    <TableHead className="font-semibold">Vencimento</TableHead>
                    <TableHead className="font-semibold text-center">Total Entregas</TableHead>
                    <TableHead className="font-semibold text-right">Valor</TableHead>
                    <TableHead className="font-semibold text-center">Status</TableHead>
                    <TableHead className="font-semibold text-center pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBoletos.map((boleto) => (
                    <TableRow key={boleto.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="pl-6 font-medium">
                        {boleto.periodo}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <CalendarIcon className="h-4 w-4" />
                          {boleto.dataEmissao}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          {boleto.dataVencimento}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-muted/50">
                          {boleto.totalEntregas} entregas
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(boleto.valor)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(boleto.status)}
                      </TableCell>
                      <TableCell className="text-center pr-6">
                        <div className="flex items-center justify-center gap-2">
                          {boleto.status !== "paid" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => setSelectedBoleto(boleto)}
                            >
                              <CreditCard className="mr-1 h-4 w-4" />
                              Pagar
                            </Button>
                          )}
                          {boleto.pdfUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                              asChild
                            >
                              <a href={boleto.pdfUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-1 h-4 w-4" />
                                PDF
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <DollarSign className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-1">
                  Nenhum boleto encontrado
                </h3>
                <p className="text-sm text-muted-foreground/70 max-w-sm">
                  {statusFiltro !== "all"
                    ? `Não há boletos com status "${statusFiltro === "open" ? "em aberto" : statusFiltro === "paid" ? "pago" : "atrasado"}"`
                    : "Não há boletos gerados para sua empresa ainda"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informações */}
        <Card className="bg-amber-50/50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">Sobre os Boletos</p>
                <p className="text-sm text-amber-700/80 mt-1">
                  Os boletos são gerados semanalmente com base nas entregas realizadas.
                  O pagamento deve ser feito até a data de vencimento para evitar juros e multas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Pagamento */}
      <Dialog open={!!selectedBoleto} onOpenChange={(open) => !open && setSelectedBoleto(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar Boleto</DialogTitle>
            <DialogDescription>
              Período: {selectedBoleto?.periodo}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Valor</p>
              <p className="text-2xl font-bold">{formatCurrency(selectedBoleto?.valor || 0)}</p>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Vencimento</p>
              <p className="font-medium">{selectedBoleto?.dataVencimento}</p>
            </div>

            {selectedBoleto?.linhaDigitavel && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Linha Digitável</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-muted rounded-lg text-sm break-all">
                    {selectedBoleto.linhaDigitavel}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(selectedBoleto.linhaDigitavel!)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {selectedBoleto?.codigoBarras && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Código de Barras</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-muted rounded-lg text-sm break-all">
                    {selectedBoleto.codigoBarras}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(selectedBoleto.codigoBarras!)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {selectedBoleto?.pdfUrl && (
                <Button className="flex-1" asChild>
                  <a href={selectedBoleto.pdfUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir Boleto PDF
                  </a>
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedBoleto(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
