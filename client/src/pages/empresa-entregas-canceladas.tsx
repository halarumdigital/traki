import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Eye,
  User,
  MapPin,
  Truck,
  XCircle,
  Loader2,
  CalendarIcon,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Package,
  XCircle as XCircleIcon
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";

interface Delivery {
  id: string;
  requestNumber: string;
  customerName: string | null;
  createdAt: string;
  cancelledAt: string | null;
  driverName: string | null;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  totalPrice: string | null;
  vehicleTypeName: string;
  cancelReason: string | null;
  totalDistance: string | null;
  totalTime: string | null;
  acceptedAt: string | null;
  arrivedAt: string | null;
  tripStartedAt: string | null;
  completedAt: string | null;
  needsReturn: boolean | null;
}

// Função helper para formatar datas no horário de Brasília
// As datas vêm do banco de dados já em horário de Brasília
const formatBrazilianDateTime = (date: string | Date) => {
  const d = new Date(date);
  return format(d, 'dd/MM/yyyy, HH:mm', { locale: ptBR });
};

const ITEMS_PER_PAGE = 50;

export default function EmpresaEntregasCanceladas() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Filtros
  const [searchOrderNumber, setSearchOrderNumber] = useState("");
  const [searchCustomerName, setSearchCustomerName] = useState("");
  const [searchDriverName, setSearchDriverName] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);

  const { data: deliveries = [], isLoading } = useQuery<Delivery[]>({
    queryKey: ["/api/empresa/deliveries/cancelled"],
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  // Mutation para relançar entrega
  const relaunchMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/empresa/deliveries/${id}/relaunch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao relançar entrega");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Entrega relançada",
        description: "A entrega foi relançada com sucesso e está aguardando um motorista.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/deliveries/cancelled"] });
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/deliveries/in-progress"] });
      // Redireciona para a página de entregas em andamento
      setLocation("/empresa/entregas/em-andamento");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao relançar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filtrar entregas
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((delivery) => {
      // Filtro por número do pedido
      if (searchOrderNumber && !delivery.requestNumber?.toLowerCase().includes(searchOrderNumber.toLowerCase())) {
        return false;
      }

      // Filtro por nome do cliente
      if (searchCustomerName && !delivery.customerName?.toLowerCase().includes(searchCustomerName.toLowerCase())) {
        return false;
      }

      // Filtro por nome do motorista
      if (searchDriverName && !delivery.driverName?.toLowerCase().includes(searchDriverName.toLowerCase())) {
        return false;
      }

      // Filtro por data (usando createdAt) - compara strings de data para evitar problemas de timezone
      if (dateFrom || dateTo) {
        const deliveryDate = new Date(delivery.createdAt);
        // Formata a data de entrega como string YYYY-MM-DD no timezone de Brasília
        const deliveryDateStr = deliveryDate.toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const [day, month, year] = deliveryDateStr.split('/');
        const deliveryDateFormatted = `${year}-${month}-${day}`;

        if (dateFrom) {
          const fromDateFormatted = format(dateFrom, 'yyyy-MM-dd');
          if (deliveryDateFormatted < fromDateFormatted) {
            return false;
          }
        }

        if (dateTo) {
          const toDateFormatted = format(dateTo, 'yyyy-MM-dd');
          if (deliveryDateFormatted > toDateFormatted) {
            return false;
          }
        }
      }

      return true;
    });
  }, [deliveries, searchOrderNumber, searchCustomerName, searchDriverName, dateFrom, dateTo]);

  // Resetar para página 1 quando os filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [searchOrderNumber, searchCustomerName, searchDriverName, dateFrom, dateTo]);

  // Calcular dados paginados
  const totalPages = Math.ceil(filteredDeliveries.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedDeliveries = filteredDeliveries.slice(startIndex, endIndex);

  const handleViewDetails = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setDetailsOpen(true);
  };

  const handleRelaunchClick = (id: string) => {
    relaunchMutation.mutate(id);
  };

  const clearFilters = () => {
    setSearchOrderNumber("");
    setSearchCustomerName("");
    setSearchDriverName("");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <XCircleIcon className="h-6 w-6 text-slate-500" />
          Entregas Canceladas
        </h1>
        <p className="text-slate-500">Lista de entregas que foram canceladas.</p>
      </div>

      {/* Filtros */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Filtro por Número do Pedido */}
            <div className="space-y-1.5">
              <Label htmlFor="search-order" className="text-xs font-medium text-slate-600">Número do Pedido</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="search-order"
                  type="text"
                  placeholder="Buscar..."
                  value={searchOrderNumber}
                  onChange={(e) => setSearchOrderNumber(e.target.value)}
                  className="pl-9 bg-slate-50 border-slate-200 h-9 text-sm"
                />
              </div>
            </div>

            {/* Filtro por Nome do Cliente */}
            <div className="space-y-1.5">
              <Label htmlFor="search-customer" className="text-xs font-medium text-slate-600">Nome do Cliente</Label>
              <div className="relative">
                <User className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="search-customer"
                  type="text"
                  placeholder="Buscar..."
                  value={searchCustomerName}
                  onChange={(e) => setSearchCustomerName(e.target.value)}
                  className="pl-9 bg-slate-50 border-slate-200 h-9 text-sm"
                />
              </div>
            </div>

            {/* Filtro por Nome do Motorista */}
            <div className="space-y-1.5">
              <Label htmlFor="search-driver" className="text-xs font-medium text-slate-600">Motorista</Label>
              <div className="relative">
                <Truck className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="search-driver"
                  type="text"
                  placeholder="Buscar..."
                  value={searchDriverName}
                  onChange={(e) => setSearchDriverName(e.target.value)}
                  className="pl-9 bg-slate-50 border-slate-200 h-9 text-sm"
                />
              </div>
            </div>

            {/* Filtro por Data - De */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-9 text-sm bg-slate-50 border-slate-200",
                      !dateFrom && "text-slate-400"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Selecione..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Filtro por Data - Até */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-9 text-sm bg-slate-50 border-slate-200",
                      !dateTo && "text-slate-400"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Selecione..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Botão Limpar Filtros */}
          {(searchOrderNumber || searchCustomerName || searchDriverName || dateFrom || dateTo) && (
            <div className="flex justify-end mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="gap-2 h-8 text-xs"
              >
                <X className="h-3 w-3" />
                Limpar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Entregas */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="px-6 py-4 border-b border-slate-100 flex flex-row items-center justify-between bg-white rounded-t-lg">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">Histórico de Cancelamentos</CardTitle>
            <CardDescription>
              Mostrando {filteredDeliveries.length > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, filteredDeliveries.length)} de {filteredDeliveries.length} entregas filtradas ({deliveries.length} total)
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Package className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhuma entrega cancelada</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                {deliveries.length === 0
                  ? "Não há entregas canceladas no momento."
                  : "Nenhum resultado encontrado com os filtros aplicados."}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[220px] font-semibold text-slate-600">Nº Pedido</TableHead>
                    <TableHead className="font-semibold text-slate-600">Cliente</TableHead>
                    <TableHead className="font-semibold text-slate-600">Data Criação</TableHead>
                    <TableHead className="font-semibold text-slate-600">Data Cancelamento</TableHead>
                    <TableHead className="font-semibold text-slate-600">Motorista</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-right">Valor</TableHead>
                    <TableHead className="w-[100px] text-center font-semibold text-slate-600">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDeliveries.map((delivery) => (
                    <TableRow key={delivery.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-mono text-xs text-slate-500 font-medium">
                        {delivery.requestNumber || delivery.id.substring(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{delivery.customerName || "-"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-900">{formatBrazilianDateTime(delivery.createdAt)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-900">{delivery.cancelledAt ? formatBrazilianDateTime(delivery.cancelledAt) : "-"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-500">{delivery.driverName || "-"}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {delivery.totalPrice
                          ? new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(parseFloat(delivery.totalPrice))
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetails(delivery)}
                            className="h-8 w-8 text-slate-500 hover:text-blue-600"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRelaunchClick(delivery.id)}
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            disabled={relaunchMutation.isPending}
                          >
                            {relaunchMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Controles de paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                  <div className="text-sm text-slate-500">
                    Página {currentPage} de {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="h-8 text-xs"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="h-8 text-xs"
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog de detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Entrega Cancelada</DialogTitle>
          </DialogHeader>
          {selectedDelivery && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nº do Pedido</p>
                  <p className="font-semibold font-mono">{selectedDelivery.requestNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className="bg-red-100 text-red-700">Cancelado</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-semibold">{selectedDelivery.customerName || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Categoria</p>
                  <p className="font-semibold">{selectedDelivery.vehicleTypeName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Distância</p>
                  <p className="font-semibold">
                    {selectedDelivery.totalDistance
                      ? `${(parseFloat(selectedDelivery.totalDistance) / 1000).toFixed(1)} km`
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tempo Estimado</p>
                  <p className="font-semibold">
                    {selectedDelivery.totalTime
                      ? `${selectedDelivery.totalTime} min`
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data Cancelamento</p>
                  <p className="font-semibold">
                    {selectedDelivery.cancelledAt ? formatBrazilianDateTime(selectedDelivery.cancelledAt) : "-"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Endereço de Retirada</p>
                    <p className="font-medium">{selectedDelivery.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="w-full">
                    <p className="text-sm text-muted-foreground mb-2">
                      {selectedDelivery.dropoffAddress.includes(" | ")
                        ? "Endereços de Entrega (Múltiplos Pontos)"
                        : "Endereço de Entrega"}
                    </p>
                    {selectedDelivery.dropoffAddress.includes(" | ") ? (
                      <div className="space-y-3">
                        {selectedDelivery.dropoffAddress.split(" | ").map((address, index) => {
                          let customerName = null;
                          let whatsapp = null;
                          let reference = null;
                          let addressText = address;

                          // Extrair WhatsApp: [WhatsApp: xxx]
                          const whatsappMatch = addressText.match(/\[WhatsApp:\s*([^\]]+)\]/i);
                          if (whatsappMatch) {
                            whatsapp = whatsappMatch[1].trim();
                            addressText = addressText.replace(/\[WhatsApp:\s*[^\]]+\]\s*/i, '').trim();
                          }

                          // Extrair Ref: [Ref: xxx]
                          const refMatch = addressText.match(/\[Ref:\s*([^\]]+)\]/i);
                          if (refMatch) {
                            reference = refMatch[1].trim();
                            addressText = addressText.replace(/\[Ref:\s*[^\]]+\]\s*/i, '').trim();
                          }

                          // Extrair nome do cliente: [nome]
                          const nameMatch = addressText.match(/^\[([^\]]+)\]/);
                          if (nameMatch) {
                            customerName = nameMatch[1].trim();
                            addressText = addressText.replace(/^\[([^\]]+)\]\s*/, '').trim();
                          }

                          return (
                            <div key={index} className="flex items-start gap-3">
                              <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-red-600 text-white text-sm font-bold">
                                {index + 1}
                              </span>
                              <div className="flex-1">
                                {customerName && (
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <User className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                    <span className="font-semibold text-blue-600 text-sm">{customerName}</span>
                                  </div>
                                )}
                                {whatsapp && (
                                  <div className="flex items-center gap-1.5 text-sm text-gray-700 mb-1">
                                    <span className="flex-shrink-0">📱</span>
                                    <span>WhatsApp: {whatsapp}</span>
                                  </div>
                                )}
                                {reference && (
                                  <div className="flex items-center gap-1.5 text-sm text-gray-700 mb-1">
                                    <span className="flex-shrink-0 text-gray-400">○</span>
                                    <span>Ref: {reference}</span>
                                  </div>
                                )}
                                <div className="text-sm text-gray-900">{addressText}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      (() => {
                        let customerName = null;
                        let whatsapp = null;
                        let reference = null;
                        let addressText = selectedDelivery.dropoffAddress;

                        // Extrair WhatsApp: [WhatsApp: xxx]
                        const whatsappMatch = addressText.match(/\[WhatsApp:\s*([^\]]+)\]/i);
                        if (whatsappMatch) {
                          whatsapp = whatsappMatch[1].trim();
                          addressText = addressText.replace(/\[WhatsApp:\s*[^\]]+\]\s*/i, '').trim();
                        }

                        // Extrair Ref: [Ref: xxx]
                        const refMatch = addressText.match(/\[Ref:\s*([^\]]+)\]/i);
                        if (refMatch) {
                          reference = refMatch[1].trim();
                          addressText = addressText.replace(/\[Ref:\s*[^\]]+\]\s*/i, '').trim();
                        }

                        // Extrair nome do cliente: [nome]
                        const nameMatch = addressText.match(/^\[([^\]]+)\]/);
                        if (nameMatch) {
                          customerName = nameMatch[1].trim();
                          addressText = addressText.replace(/^\[([^\]]+)\]\s*/, '').trim();
                        }

                        return (
                          <div className="space-y-2">
                            {customerName && (
                              <div className="flex items-center gap-1.5">
                                <User className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                <span className="font-semibold text-blue-600 text-sm">{customerName}</span>
                              </div>
                            )}
                            {whatsapp && (
                              <div className="flex items-center gap-1.5 text-sm text-gray-700">
                                <span className="flex-shrink-0">📱</span>
                                <span>WhatsApp: {whatsapp}</span>
                              </div>
                            )}
                            {reference && (
                              <div className="flex items-center gap-1.5 text-sm text-gray-700">
                                <span className="flex-shrink-0 text-gray-400">○</span>
                                <span>Ref: {reference}</span>
                              </div>
                            )}
                            <div className="text-sm text-gray-900 font-medium">{addressText}</div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              </div>

              {/* Indicador de volta */}
              {selectedDelivery.needsReturn && (
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <RefreshCw className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-amber-900">Entrega com Volta</p>
                      <p className="text-xs text-amber-700">Motorista precisa retornar ao ponto de origem após a entrega</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedDelivery.totalPrice && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold text-green-600">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(parseFloat(selectedDelivery.totalPrice))}
                  </p>
                </div>
              )}

              {/* Observações de cancelamento */}
              {selectedDelivery.cancelReason && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Observações do Cancelamento</p>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{selectedDelivery.cancelReason}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
