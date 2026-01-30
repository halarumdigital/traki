import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  FileText,
  RefreshCw,
  Calendar,
  Building2,
  Play,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Eye,
  Loader2,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CompanyPendingInvoice {
  companyId: string;
  companyName: string;
  cnpj: string | null;
  pendingAmount: number;
  chargesCount: number;
  hasInvoice: boolean;
  invoiceStatus?: string;
  invoiceId?: string;
}

interface PendingInvoicesResponse {
  month: number;
  year: number;
  companies: CompanyPendingInvoice[];
  summary: {
    totalCompanies: number;
    withInvoice: number;
    withoutInvoice: number;
    totalPendingAmount: number;
  };
}

export default function AdminNotasFiscais() {
  const { toast } = useToast();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [emittingCompanyId, setEmittingCompanyId] = useState<string | null>(null);

  // Buscar empresas com NFS-e pendente
  const { data: pendingData, isLoading, refetch } = useQuery<PendingInvoicesResponse>({
    queryKey: ["/api/fiscal/companies-pending", selectedMonth, selectedYear],
    queryFn: async () => {
      const response = await fetch(
        `/api/fiscal/companies-pending?month=${selectedMonth}&year=${selectedYear}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Erro ao buscar empresas pendentes");
      return response.json();
    },
  });

  // Mutation para emitir NFS-e
  const emitMutation = useMutation({
    mutationFn: async (companyId: string) => {
      setEmittingCompanyId(companyId);
      const response = await fetch("/api/fiscal/emit-monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyId,
          month: selectedMonth,
          year: selectedYear,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao emitir NFS-e");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "NFS-e emitida",
        description: data.message || "Nota fiscal emitida com sucesso.",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Erro ao emitir NFS-e",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setEmittingCompanyId(null);
    },
  });

  // Mutation para emitir todas as NFS-e pendentes
  const emitAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/fiscal/emit-all-monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao emitir NFS-e");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Emissão concluída",
        description: `${data.successful}/${data.total} notas fiscais emitidas.`,
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Erro ao emitir NFS-e",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatCNPJ = (cnpj: string | null) => {
    if (!cnpj) return "-";
    // Remove caracteres não numéricos
    const cleaned = cnpj.replace(/\D/g, "");
    if (cleaned.length !== 14) return cnpj;
    return cleaned.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5"
    );
  };

  const getStatusBadge = (company: CompanyPendingInvoice) => {
    if (!company.hasInvoice) {
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">
          <Clock className="mr-1 h-3 w-3" />
          Pendente
        </Badge>
      );
    }

    switch (company.invoiceStatus) {
      case "authorized":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
            <CheckCircle className="mr-1 h-3 w-3" />
            Emitida
          </Badge>
        );
      case "scheduled":
      case "synchronized":
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
            <Clock className="mr-1 h-3 w-3" />
            Processando
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
            <AlertCircle className="mr-1 h-3 w-3" />
            Erro
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200">
            Cancelada
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {company.invoiceStatus}
          </Badge>
        );
    }
  };

  const months = [
    { value: 1, label: "Janeiro" },
    { value: 2, label: "Fevereiro" },
    { value: 3, label: "Março" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Maio" },
    { value: 6, label: "Junho" },
    { value: 7, label: "Julho" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Setembro" },
    { value: 10, label: "Outubro" },
    { value: 11, label: "Novembro" },
    { value: 12, label: "Dezembro" },
  ];

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  const pendingCompanies = pendingData?.companies.filter(c => !c.hasInvoice) || [];
  const hasAnyPending = pendingCompanies.length > 0;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Receipt className="h-6 w-6" />
              Notas Fiscais
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie a emissão de NFS-e para as empresas
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            {hasAnyPending && (
              <Button
                size="sm"
                onClick={() => emitAllMutation.mutate()}
                disabled={emitAllMutation.isPending}
              >
                {emitAllMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Emitir Todas
              </Button>
            )}
          </div>
        </div>

        {/* Filtros de Período */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Competência:</span>
              </div>
              <div className="flex gap-2">
                <Select
                  value={String(selectedMonth)}
                  onValueChange={(v) => setSelectedMonth(parseInt(v))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(selectedYear)}
                  onValueChange={(v) => setSelectedYear(parseInt(v))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        {pendingData && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Empresas</p>
                    <p className="text-2xl font-bold">{pendingData.summary.totalCompanies}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pendentes</p>
                    <p className="text-2xl font-bold">{pendingData.summary.withoutInvoice}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Emitidas</p>
                    <p className="text-2xl font-bold">{pendingData.summary.withInvoice}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Pendente</p>
                    <p className="text-xl font-bold">{formatCurrency(pendingData.summary.totalPendingAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista de Empresas */}
        <Card className="shadow-sm">
          <CardHeader className="px-6 py-4 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-medium">Empresas com Faturamento</CardTitle>
                <CardDescription>
                  Empresas com cobranças pagas em {months.find(m => m.value === selectedMonth)?.label} de {selectedYear}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : pendingData && pendingData.companies.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold pl-6">Empresa</TableHead>
                    <TableHead className="font-semibold">CNPJ</TableHead>
                    <TableHead className="font-semibold text-center">Cobranças</TableHead>
                    <TableHead className="font-semibold text-right">Valor</TableHead>
                    <TableHead className="font-semibold text-center">Status</TableHead>
                    <TableHead className="font-semibold text-center pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingData.companies.map((company) => (
                    <TableRow
                      key={company.companyId}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{company.companyName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatCNPJ(company.cnpj)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{company.chargesCount}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(company.pendingAmount)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(company)}
                      </TableCell>
                      <TableCell className="text-center pr-6">
                        <div className="flex items-center justify-center gap-2">
                          {!company.hasInvoice ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => emitMutation.mutate(company.companyId)}
                                    disabled={emitMutation.isPending && emittingCompanyId === company.companyId}
                                  >
                                    {emitMutation.isPending && emittingCompanyId === company.companyId ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <Play className="mr-1 h-4 w-4" />
                                        Emitir
                                      </>
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Emitir NFS-e para esta empresa
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : company.invoiceStatus === "authorized" ? (
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-blue-600" asChild>
                                      <a href={`/api/fiscal/invoices/${company.invoiceId}/pdf`} target="_blank">
                                        <Eye className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ver PDF</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-green-600" asChild>
                                      <a href={`/api/fiscal/invoices/${company.invoiceId}/xml`} download>
                                        <Download className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Baixar XML</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          ) : company.invoiceStatus === "error" ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => emitMutation.mutate(company.companyId)}
                                    disabled={emitMutation.isPending && emittingCompanyId === company.companyId}
                                  >
                                    {emitMutation.isPending && emittingCompanyId === company.companyId ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <RefreshCw className="mr-1 h-4 w-4" />
                                        Retentar
                                      </>
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Tentar emitir novamente
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Aguardando...
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-1">
                  Nenhuma empresa com faturamento
                </h3>
                <p className="text-sm text-muted-foreground/70 max-w-sm">
                  Não há empresas com cobranças pagas em {months.find(m => m.value === selectedMonth)?.label} de {selectedYear}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informações */}
        <Card className="bg-blue-50/50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <FileText className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">Sobre a Emissão de NFS-e</p>
                <p className="text-sm text-blue-700/80 mt-1">
                  As notas fiscais são emitidas consolidando todas as cobranças pagas (recargas e boletos semanais)
                  do período selecionado. A emissão automática ocorre no último dia de cada mês às 23:59.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
