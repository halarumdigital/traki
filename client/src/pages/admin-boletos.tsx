import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  ExternalLink,
  Building2,
  Search,
  FileText,
  Loader2,
  Package,
  Users
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

interface Boleto {
  id: string;
  empresaId: string;
  empresaNome: string;
  periodo: string;
  dataEmissao: string;
  dataVencimento: string;
  valor: number;
  totalEntregas: number;
  status: "open" | "paid" | "overdue";
  codigoBarras?: string;
  linhaDigitavel?: string;
  pdfUrl?: string;
  pixCopyPaste?: string;
  pixQrCodeUrl?: string;
}

interface BoletosResponse {
  boletos: Boleto[];
  totals: {
    emAberto: number;
    atrasado: number;
    pago: number;
  };
}

interface EmpresaPendente {
  id: string;
  nome: string;
  cnpj?: string;
  logoUrl?: string;
  entregasPendentes: number;
  entregasNaoRegistradas?: number;
  alocacoesPendentes: number;
  totalPendente: number;
  periodo?: string;
}

interface EmpresasPendentesResponse {
  empresas: EmpresaPendente[];
  totalEmpresas: number;
  valorTotalPendente: number;
}

export default function AdminBoletos() {
  const [statusFiltro, setStatusFiltro] = useState<string>("all");
  const [buscaEmpresa, setBuscaEmpresa] = useState<string>("");
  const [selectedBoleto, setSelectedBoleto] = useState<Boleto | null>(null);
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaPendente | null>(null);
  const [gerarBoletoOpen, setGerarBoletoOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar empresas com pendências para geração de boleto
  const { data: empresasPendentes, isLoading: isLoadingPendentes, refetch: refetchPendentes } = useQuery<EmpresasPendentesResponse>({
    queryKey: ["/api/admin/pending-boletos"],
    queryFn: async () => {
      const response = await fetch("/api/admin/pending-boletos", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao buscar empresas pendentes");
      return response.json();
    },
  });

  // Mutation para gerar boleto
  const generateBoletoMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const response = await fetch(`/api/companies/${companyId}/generate-weekly-charge`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Erro ao gerar boleto");
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/boletos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-boletos"] });
      toast({
        title: "Boleto gerado com sucesso!",
        description: `${data.deliveriesCount || 0} entrega(s) e ${data.allocationsCount || 0} alocação(ões) incluída(s)`,
      });
      setGerarBoletoOpen(false);
      setSelectedEmpresa(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar boleto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGerarBoleto = (empresa: EmpresaPendente) => {
    setSelectedEmpresa(empresa);
    setGerarBoletoOpen(true);
  };

  const confirmGerarBoleto = () => {
    if (selectedEmpresa) {
      generateBoletoMutation.mutate(selectedEmpresa.id);
    }
  };

  // Buscar boletos semanais de todas as empresas
  const { data, isLoading, refetch } = useQuery<BoletosResponse>({
    queryKey: ["/api/admin/boletos", statusFiltro],
    queryFn: async () => {
      const response = await fetch(`/api/admin/boletos?status=${statusFiltro}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao buscar boletos");
      return response.json();
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

  const filteredBoletos = data?.boletos?.filter(b => {
    const matchStatus = statusFiltro === "all" || b.status === statusFiltro;
    const matchNome = buscaEmpresa === "" || b.empresaNome.toLowerCase().includes(buscaEmpresa.toLowerCase());
    return matchStatus && matchNome;
  }) || [];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Código copiado para a área de transferência",
    });
  };

  const totals = data?.totals || { emAberto: 0, atrasado: 0, pago: 0 };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <DollarSign className="h-6 w-6" />
              Financeiro - Boletos
            </h1>
            <p className="text-muted-foreground mt-1">
              Boletos semanais de todas as empresas
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aguardando Geração</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {empresasPendentes?.totalEmpresas || 0}
                    <span className="text-sm font-normal text-muted-foreground ml-1">empresa(s)</span>
                  </p>
                </div>
                <FileText className="h-8 w-8 text-orange-500/20" />
              </div>
            </CardContent>
          </Card>

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

        {/* Tabs para separar Pendentes e Boletos Gerados */}
        <Tabs defaultValue="pendentes" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="pendentes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Aguardando Geração
              {empresasPendentes && empresasPendentes.totalEmpresas > 0 && (
                <Badge variant="secondary" className="ml-1 bg-orange-100 text-orange-700">
                  {empresasPendentes.totalEmpresas}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="gerados" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Boletos Gerados
            </TabsTrigger>
          </TabsList>

          {/* Aba: Empresas Pendentes */}
          <TabsContent value="pendentes">
            <Card className="shadow-sm border-l-4 border-l-orange-500">
              <CardHeader className="px-6 py-4 border-b bg-orange-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <FileText className="h-5 w-5 text-orange-600" />
                      Empresas Aguardando Geração de Boleto
                    </CardTitle>
                    <CardDescription>
                      {empresasPendentes ? `${empresasPendentes.totalEmpresas} empresa(s) com entregas/alocações pendentes - Total: ${formatCurrency(empresasPendentes.valorTotalPendente)}` : "Carregando..."}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchPendentes()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
              {isLoadingPendentes ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !empresasPendentes || empresasPendentes.empresas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-1">
                    Nenhuma empresa com pendências
                  </h3>
                  <p className="text-sm text-muted-foreground/70 max-w-sm">
                    Todas as empresas pós-pagas (BOLETO) estão em dia com a geração de boletos.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-orange-50/30">
                      <TableHead className="font-semibold pl-6">Empresa</TableHead>
                      <TableHead className="font-semibold text-center">Entregas</TableHead>
                      <TableHead className="font-semibold text-center">Alocações</TableHead>
                      <TableHead className="font-semibold text-right">Valor Pendente</TableHead>
                      <TableHead className="font-semibold">Período</TableHead>
                      <TableHead className="font-semibold text-center pr-6">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empresasPendentes.empresas.map((empresa) => (
                      <TableRow key={empresa.id} className="hover:bg-orange-50/30 transition-colors">
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={empresa.logoUrl} alt={empresa.nome} />
                              <AvatarFallback className="bg-orange-100 text-orange-700 text-xs">
                                {empresa.nome.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-medium">{empresa.nome}</span>
                              {empresa.cnpj && (
                                <p className="text-xs text-muted-foreground">{empresa.cnpj}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {empresa.entregasPendentes > 0 ? (
                            <div className="flex flex-col items-center gap-1">
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                <Package className="h-3 w-3 mr-1" />
                                {empresa.entregasPendentes}
                              </Badge>
                              {empresa.entregasNaoRegistradas && empresa.entregasNaoRegistradas > 0 && (
                                <span className="text-[10px] text-amber-600">
                                  ({empresa.entregasNaoRegistradas} não reg.)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {empresa.alocacoesPendentes > 0 ? (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              <Users className="h-3 w-3 mr-1" />
                              {empresa.alocacoesPendentes}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-orange-600">
                          {formatCurrency(empresa.totalPendente)}
                        </TableCell>
                        <TableCell>
                          {empresa.periodo ? (
                            <div className="flex items-center gap-1 text-muted-foreground text-sm">
                              <CalendarIcon className="h-3 w-3" />
                              {empresa.periodo}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center pr-6">
                          <Button
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700"
                            onClick={() => handleGerarBoleto(empresa)}
                          >
                            <FileText className="mr-1 h-4 w-4" />
                            Gerar Boleto
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba: Boletos Gerados */}
          <TabsContent value="gerados">
            <Card className="shadow-sm">
              <CardHeader className="px-6 py-4 border-b bg-muted/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base font-medium">Boletos Semanais</CardTitle>
                    <CardDescription>Lista de boletos gerados por semana de todas as empresas</CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar empresa..."
                        value={buscaEmpresa}
                        onChange={(e) => setBuscaEmpresa(e.target.value)}
                        className="pl-9 w-[200px]"
                      />
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
                    <TableHead className="font-semibold pl-6">Empresa</TableHead>
                    <TableHead className="font-semibold">Período</TableHead>
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
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{boleto.empresaNome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
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
                              Ver
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
                  {buscaEmpresa
                    ? `Nenhum boleto encontrado para "${buscaEmpresa}"`
                    : statusFiltro !== "all"
                      ? `Não há boletos com status "${statusFiltro === "open" ? "em aberto" : statusFiltro === "paid" ? "pago" : "atrasado"}"`
                      : "Não há boletos gerados ainda"}
                </p>
              </div>
              )}
            </CardContent>
          </Card>
          </TabsContent>
        </Tabs>

        {/* Informações */}
        <Card className="bg-amber-50/50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">Sobre os Boletos</p>
                <p className="text-sm text-amber-700/80 mt-1">
                  Os boletos são gerados semanalmente com base nas entregas realizadas por cada empresa.
                  Boletos atrasados podem gerar juros e multas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Detalhes */}
      <Dialog open={!!selectedBoleto} onOpenChange={(open) => !open && setSelectedBoleto(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Boleto</DialogTitle>
            <DialogDescription>
              {selectedBoleto?.empresaNome} - {selectedBoleto?.periodo}
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

            {selectedBoleto?.pixCopyPaste && (
              <div className="space-y-2">
                <p className="text-sm font-medium">PIX Copia e Cola</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-muted rounded-lg text-sm break-all max-h-[80px] overflow-y-auto">
                    {selectedBoleto.pixCopyPaste}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(selectedBoleto.pixCopyPaste!)}
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

      {/* Modal de Geração de Boleto */}
      <Dialog open={gerarBoletoOpen} onOpenChange={(open) => {
        if (!open) {
          setGerarBoletoOpen(false);
          setSelectedEmpresa(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-600" />
              Gerar Boleto
            </DialogTitle>
            <DialogDescription>
              Confirme a geração do boleto para a empresa
            </DialogDescription>
          </DialogHeader>
          {selectedEmpresa && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedEmpresa.logoUrl} alt={selectedEmpresa.nome} />
                    <AvatarFallback className="bg-orange-100 text-orange-700">
                      {selectedEmpresa.nome.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{selectedEmpresa.nome}</p>
                    {selectedEmpresa.cnpj && (
                      <p className="text-sm text-muted-foreground">{selectedEmpresa.cnpj}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 p-3 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Entregas</p>
                  <p className="text-xl font-bold text-blue-600">{selectedEmpresa.entregasPendentes}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Alocações</p>
                  <p className="text-xl font-bold text-purple-600">{selectedEmpresa.alocacoesPendentes}</p>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Valor Total do Boleto</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(selectedEmpresa.totalPendente)}</p>
              </div>

              {selectedEmpresa.periodo && (
                <p className="text-sm text-muted-foreground text-center">
                  Período: <strong>{selectedEmpresa.periodo}</strong>
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setGerarBoletoOpen(false);
                setSelectedEmpresa(null);
              }}
              disabled={generateBoletoMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              onClick={confirmGerarBoleto}
              disabled={generateBoletoMutation.isPending}
            >
              {generateBoletoMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Confirmar Geração
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
