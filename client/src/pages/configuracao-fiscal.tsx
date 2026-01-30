import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  FileText,
  Save,
  RefreshCw,
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fiscalSchema = z.object({
  nfseEnabled: z.boolean(),
  nfseAutoEmit: z.boolean(),
  nfseMunicipalServiceCode: z.string().nullable().optional(),
  nfseMunicipalServiceName: z.string().nullable().optional(),
  nfseDefaultDescription: z.string().nullable().optional(),
  nfseIssRate: z.string().nullable().optional(),
  nfseIssRetained: z.boolean().nullable().optional(),
  nfseCofinsRate: z.string().nullable().optional(),
  nfseCsllRate: z.string().nullable().optional(),
  nfseInssRate: z.string().nullable().optional(),
  nfseIrRate: z.string().nullable().optional(),
  nfsePisRate: z.string().nullable().optional(),
});

type FiscalFormData = z.infer<typeof fiscalSchema>;

interface Invoice {
  id: string;
  companyId: string;
  companyName: string;
  competenceMonth: number;
  competenceYear: number;
  value: string;
  status: string;
  invoiceNumber?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  createdAt: string;
}

export default function ConfiguracaoFiscal() {
  const { toast } = useToast();
  const [emitDialogOpen, setEmitDialogOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Buscar configurações fiscais
  const { data: fiscalSettings, isLoading: loadingSettings, refetch: refetchSettings } = useQuery({
    queryKey: ["/api/settings/fiscal"],
    queryFn: async () => {
      const response = await fetch("/api/settings/fiscal", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao buscar configurações fiscais");
      return response.json();
    },
  });

  // Buscar notas fiscais
  const { data: invoices, isLoading: loadingInvoices, refetch: refetchInvoices } = useQuery<Invoice[]>({
    queryKey: ["/api/fiscal/invoices"],
    queryFn: async () => {
      const response = await fetch("/api/fiscal/invoices", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao buscar notas fiscais");
      return response.json();
    },
  });

  // Buscar empresas para o select
  const { data: companies } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await fetch("/api/companies", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao buscar empresas");
      return response.json();
    },
  });

  const form = useForm<FiscalFormData>({
    resolver: zodResolver(fiscalSchema),
    defaultValues: {
      nfseEnabled: false,
      nfseAutoEmit: false,
      nfseMunicipalServiceCode: "",
      nfseMunicipalServiceName: "",
      nfseDefaultDescription: "",
      nfseIssRate: "0",
      nfseIssRetained: false,
      nfseCofinsRate: "0",
      nfseCsllRate: "0",
      nfseInssRate: "0",
      nfseIrRate: "0",
      nfsePisRate: "0",
    },
  });

  // Atualizar form quando dados carregarem
  useEffect(() => {
    if (fiscalSettings) {
      form.reset({
        nfseEnabled: fiscalSettings.nfseEnabled ?? false,
        nfseAutoEmit: fiscalSettings.nfseAutoEmit ?? false,
        nfseMunicipalServiceCode: fiscalSettings.nfseMunicipalServiceCode ?? "",
        nfseMunicipalServiceName: fiscalSettings.nfseMunicipalServiceName ?? "",
        nfseDefaultDescription: fiscalSettings.nfseDefaultDescription ?? "",
        nfseIssRate: fiscalSettings.nfseIssRate ?? "0",
        nfseIssRetained: fiscalSettings.nfseIssRetained ?? false,
        nfseCofinsRate: fiscalSettings.nfseCofinsRate ?? "0",
        nfseCsllRate: fiscalSettings.nfseCsllRate ?? "0",
        nfseInssRate: fiscalSettings.nfseInssRate ?? "0",
        nfseIrRate: fiscalSettings.nfseIrRate ?? "0",
        nfsePisRate: fiscalSettings.nfsePisRate ?? "0",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiscalSettings]);

  // Mutation para salvar configurações
  const saveMutation = useMutation({
    mutationFn: async (data: FiscalFormData) => {
      const response = await fetch("/api/settings/fiscal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erro ao salvar configurações");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configurações salvas",
        description: "As configurações fiscais foram atualizadas com sucesso.",
      });
      refetchSettings();
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Mutation para emitir NFS-e manual
  const emitMutation = useMutation({
    mutationFn: async (params: { companyId: string; month: number; year: number }) => {
      const response = await fetch("/api/fiscal/emit-monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(params),
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
      setEmitDialogOpen(false);
      refetchInvoices();
    },
    onError: (error) => {
      toast({
        title: "Erro ao emitir NFS-e",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FiscalFormData) => {
    saveMutation.mutate(data);
  };

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(String(value)));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "authorized":
        return <Badge className="bg-green-100 text-green-700">Emitida</Badge>;
      case "scheduled":
      case "synchronized":
        return <Badge className="bg-amber-100 text-amber-700">Pendente</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-700">Cancelada</Badge>;
      case "error":
        return <Badge className="bg-orange-100 text-orange-700">Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Configuração Fiscal
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure a emissão de Notas Fiscais de Serviço (NFS-e)
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchSettings()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Alerta informativo */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Configuração no Asaas</AlertTitle>
          <AlertDescription>
            Para emitir NFS-e, você precisa configurar os dados fiscais da sua empresa no painel do Asaas,
            incluindo certificado digital ou credenciais da prefeitura.
          </AlertDescription>
        </Alert>

        {/* Form de configuração */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações Gerais</CardTitle>
            <CardDescription>
              Habilite e configure a emissão automática de notas fiscais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Switches de habilitação */}
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="nfseEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Habilitar NFS-e</FormLabel>
                          <FormDescription>
                            Ativa a funcionalidade de emissão de notas fiscais
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nfseAutoEmit"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Emissão Automática</FormLabel>
                          <FormDescription>
                            Emite NFS-e automaticamente no último dia do mês
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                            disabled={!form.watch("nfseEnabled")}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Serviço Municipal */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Serviço Municipal</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="nfseMunicipalServiceCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código do Serviço</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex: 1.01"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Código do serviço conforme lista da prefeitura
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nfseMunicipalServiceName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Serviço</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex: Serviços de entrega"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Descrição do serviço municipal
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="nfseDefaultDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição Padrão da Nota</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descrição que aparecerá nas notas fiscais"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Alíquotas de Impostos */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Alíquotas de Impostos (%)</h3>
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                    <FormField
                      control={form.control}
                      name="nfseIssRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ISS</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              {...field}
                              value={field.value ?? "0"}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nfseIssRetained"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-end gap-2">
                          <FormControl>
                            <Switch
                              checked={field.value ?? false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="pb-2">ISS Retido</FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nfseCofinsRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>COFINS</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              {...field}
                              value={field.value ?? "0"}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nfseCsllRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CSLL</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              {...field}
                              value={field.value ?? "0"}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nfseInssRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>INSS</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              {...field}
                              value={field.value ?? "0"}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nfseIrRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IR</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              {...field}
                              value={field.value ?? "0"}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nfsePisRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PIS</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              {...field}
                              value={field.value ?? "0"}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar Configurações
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Histórico de Notas Fiscais */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Notas Fiscais Emitidas</CardTitle>
              <CardDescription>
                Histórico de NFS-e emitidas pelo sistema
              </CardDescription>
            </div>
            <Dialog open={emitDialogOpen} onOpenChange={setEmitDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Play className="mr-2 h-4 w-4" />
                  Emitir NFS-e Manual
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Emitir NFS-e Manualmente</DialogTitle>
                  <DialogDescription>
                    Selecione a empresa e o período para emitir a nota fiscal
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Empresa</label>
                    <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies?.map((company: any) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Mês</label>
                      <Select
                        value={String(selectedMonth)}
                        onValueChange={(v) => setSelectedMonth(parseInt(v))}
                      >
                        <SelectTrigger>
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
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Ano</label>
                      <Select
                        value={String(selectedYear)}
                        onValueChange={(v) => setSelectedYear(parseInt(v))}
                      >
                        <SelectTrigger>
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
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setEmitDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() =>
                      emitMutation.mutate({
                        companyId: selectedCompanyId,
                        month: selectedMonth,
                        year: selectedYear,
                      })
                    }
                    disabled={!selectedCompanyId || emitMutation.isPending}
                  >
                    {emitMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    Emitir NFS-e
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loadingInvoices ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : invoices && invoices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.companyName || "-"}
                      </TableCell>
                      <TableCell>
                        {months.find((m) => m.value === invoice.competenceMonth)?.label}{" "}
                        {invoice.competenceYear}
                      </TableCell>
                      <TableCell>
                        {invoice.invoiceNumber ? (
                          <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                            {invoice.invoiceNumber}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.value)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(invoice.status)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          {invoice.pdfUrl && (
                            <Button variant="ghost" size="sm" asChild>
                              <a
                                href={invoice.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                PDF
                              </a>
                            </Button>
                          )}
                          {invoice.xmlUrl && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={invoice.xmlUrl} download>
                                XML
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
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma nota fiscal emitida ainda
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
