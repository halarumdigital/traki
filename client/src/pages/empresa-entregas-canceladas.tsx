import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Eye, User, MapPin, Truck, XCircle, Loader2, CalendarIcon, Search, X, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
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
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-6 w-6" />
            Entregas Canceladas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Filtro por Número do Pedido */}
              <div className="space-y-2">
                <Label htmlFor="search-order">Número do Pedido</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-order"
                    type="text"
                    placeholder="Buscar por nº pedido..."
                    value={searchOrderNumber}
                    onChange={(e) => setSearchOrderNumber(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Filtro por Nome do Cliente */}
              <div className="space-y-2">
                <Label htmlFor="search-customer">Nome do Cliente</Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-customer"
                    type="text"
                    placeholder="Buscar por cliente..."
                    value={searchCustomerName}
                    onChange={(e) => setSearchCustomerName(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Filtro por Nome do Motorista */}
              <div className="space-y-2">
                <Label htmlFor="search-driver">Nome do Motorista</Label>
                <div className="relative">
                  <Truck className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-driver"
                    type="text"
                    placeholder="Buscar por motorista..."
                    value={searchDriverName}
                    onChange={(e) => setSearchDriverName(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Filtro por Data - De */}
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "PPP", { locale: ptBR }) : "Selecione..."}
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
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "PPP", { locale: ptBR }) : "Selecione..."}
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
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Limpar Filtros
                </Button>
              </div>
            )}
          </div>

          {/* Contador de resultados */}
          <div className="mb-4 text-sm text-muted-foreground">
            Mostrando {startIndex + 1}-{Math.min(endIndex, filteredDeliveries.length)} de {filteredDeliveries.length} entregas filtradas ({deliveries.length} total)
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {deliveries.length === 0 ? "Nenhuma entrega cancelada" : "Nenhum resultado encontrado com os filtros aplicados"}
            </div>
          ) : (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data Criação</TableHead>
                    <TableHead>Data Cancelamento</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDeliveries.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell className="font-mono text-xs">
                      {delivery.requestNumber || delivery.id.substring(0, 8)}
                    </TableCell>
                    <TableCell>
                      {delivery.customerName || <span className="text-muted-foreground italic">-</span>}
                    </TableCell>
                    <TableCell>
                      {formatBrazilianDateTime(delivery.createdAt)}
                    </TableCell>
                    <TableCell>
                      {delivery.cancelledAt ? formatBrazilianDateTime(delivery.cancelledAt) : "-"}
                    </TableCell>
                    <TableCell>
                      {delivery.driverName ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {delivery.driverName}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {delivery.totalPrice ? (
                        <div className="font-semibold text-green-600">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(parseFloat(delivery.totalPrice))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(delivery)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRelaunchClick(delivery.id)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          disabled={relaunchMutation.isPending}
                        >
                          {relaunchMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
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
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
            </div>
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
