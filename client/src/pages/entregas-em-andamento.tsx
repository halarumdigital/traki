import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Eye, User, MapPin, Truck, Loader2, CalendarIcon, Search, X, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Delivery {
  id: string;
  requestNumber: string;
  customerName: string | null;
  createdAt: string;
  driverName: string | null;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  totalPrice: string | null;
  vehicleTypeName: string;
  companyName: string;
  cancelReason: string | null;
  totalDistance: string | null;
  totalTime: string | null;
  acceptedAt: string | null;
  arrivedAt: string | null;
  tripStartedAt: string | null;
  completedAt: string | null;
}

// Função helper para formatar datas no horário de Brasília
// As datas vêm do banco de dados já em horário de Brasília
const formatBrazilianDateTime = (date: string | Date) => {
  const d = new Date(date);
  return format(d, 'dd/MM/yyyy, HH:mm', { locale: ptBR });
};

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  accepted: { label: "Aceito", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "Em Andamento", color: "bg-purple-100 text-purple-700" },
  completed: { label: "Concluído", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700" },
};

const ITEMS_PER_PAGE = 50;

export default function EntregasEmAndamento() {
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelObservations, setCancelObservations] = useState("");
  const { toast } = useToast();

  // Filtros
  const [searchCompany, setSearchCompany] = useState("");
  const [searchOrderNumber, setSearchOrderNumber] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);

  const { data: deliveries = [], isLoading } = useQuery<Delivery[]>({
    queryKey: ["/api/admin/deliveries/in-progress"],
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  // Mutation para cancelar entrega
  const cancelDeliveryMutation = useMutation({
    mutationFn: async ({ deliveryId, observations }: { deliveryId: string; observations: string }) => {
      return await apiRequest("POST", `/api/admin/deliveries/${deliveryId}/cancel`, { cancelReason: observations });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deliveries/in-progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deliveries/cancelled"] });
      toast({
        title: "Entrega cancelada",
        description: "A entrega foi cancelada com sucesso.",
      });
      setCancelObservations("");
      setDetailsOpen(false);
      setCancelDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cancelar",
        description: error.message || "Não foi possível cancelar a entrega.",
        variant: "destructive",
      });
    },
  });

  // Filtrar entregas
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((delivery) => {
      // Filtro por empresa
      if (searchCompany && !delivery.companyName?.toLowerCase().includes(searchCompany.toLowerCase())) {
        return false;
      }

      // Filtro por número do pedido
      if (searchOrderNumber && !delivery.requestNumber?.toLowerCase().includes(searchOrderNumber.toLowerCase())) {
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
  }, [deliveries, searchCompany, searchOrderNumber, dateFrom, dateTo]);

  // Resetar para página 1 quando os filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [searchCompany, searchOrderNumber, dateFrom, dateTo]);

  // Calcular dados paginados
  const totalPages = Math.ceil(filteredDeliveries.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedDeliveries = filteredDeliveries.slice(startIndex, endIndex);

  const handleViewDetails = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setDetailsOpen(true);
  };

  const clearFilters = () => {
    setSearchCompany("");
    setSearchOrderNumber("");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-6 w-6" />
            Entregas em Andamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Filtro por Empresa */}
              <div className="space-y-2">
                <Label htmlFor="search-company">Empresa</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-company"
                    type="text"
                    placeholder="Buscar por empresa..."
                    value={searchCompany}
                    onChange={(e) => setSearchCompany(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

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
            {(searchCompany || searchOrderNumber || dateFrom || dateTo) && (
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
              {deliveries.length === 0 ? "Nenhuma entrega em andamento no momento" : "Nenhum resultado encontrado com os filtros aplicados"}
            </div>
          ) : (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Status</TableHead>
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
                    <TableCell>{delivery.companyName}</TableCell>
                    <TableCell>
                      {formatBrazilianDateTime(delivery.createdAt)}
                    </TableCell>
                    <TableCell>
                      {delivery.driverName ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {delivery.driverName}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Aguardando</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          statusMap[delivery.status]?.color ||
                          "bg-gray-100 text-gray-700"
                        }
                      >
                        {statusMap[delivery.status]?.label || delivery.status}
                      </Badge>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(delivery)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
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
            <DialogTitle>Detalhes da Entrega</DialogTitle>
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
                  <Badge className={statusMap[selectedDelivery.status]?.color}>
                    {statusMap[selectedDelivery.status]?.label || selectedDelivery.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-semibold">{selectedDelivery.customerName || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Empresa</p>
                  <p className="font-semibold">{selectedDelivery.companyName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Motorista</p>
                  <p className="font-semibold">{selectedDelivery.driverName || "Aguardando"}</p>
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
                  <div>
                    <p className="text-sm text-muted-foreground">Endereço de Entrega</p>
                    <p className="font-medium">{selectedDelivery.dropoffAddress}</p>
                  </div>
                </div>
              </div>

              {/* Histórico de Status */}
              {(selectedDelivery.acceptedAt || selectedDelivery.arrivedAt || selectedDelivery.tripStartedAt || selectedDelivery.completedAt) && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-semibold mb-3">Histórico de Status</p>
                  <div className="space-y-2">
                    {selectedDelivery.acceptedAt && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Aceito pelo motorista:</span>
                        <span className="font-medium">{formatBrazilianDateTime(selectedDelivery.acceptedAt)}</span>
                      </div>
                    )}
                    {selectedDelivery.arrivedAt && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Chegou no local de retirada:</span>
                        <span className="font-medium">{formatBrazilianDateTime(selectedDelivery.arrivedAt)}</span>
                      </div>
                    )}
                    {selectedDelivery.tripStartedAt && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Iniciou a viagem:</span>
                        <span className="font-medium">{formatBrazilianDateTime(selectedDelivery.tripStartedAt)}</span>
                      </div>
                    )}
                    {selectedDelivery.completedAt && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Entrega concluída:</span>
                        <span className="font-medium">{formatBrazilianDateTime(selectedDelivery.completedAt)}</span>
                      </div>
                    )}
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

              {/* Observações de cancelamento (se existirem) */}
              {selectedDelivery.cancelReason && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Observações do Cancelamento</p>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{selectedDelivery.cancelReason}</p>
                  </div>
                </div>
              )}

              {/* Botão de cancelar entrega (somente admin) */}
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={() => setCancelDialogOpen(true)}
                  className="w-full gap-2"
                  disabled={cancelDeliveryMutation.isPending}
                >
                  <XCircle className="h-4 w-4" />
                  {cancelDeliveryMutation.isPending ? "Cancelando..." : "Cancelar Entrega"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AlertDialog de confirmação de cancelamento */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={(open) => {
        setCancelDialogOpen(open);
        if (!open) {
          setCancelObservations("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Cancelamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta entrega? Esta ação não pode ser desfeita.
              {selectedDelivery?.driverName && (
                <span className="block mt-2 font-semibold">
                  O motorista {selectedDelivery.driverName} será notificado automaticamente.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Campo de observações */}
          <div className="space-y-2">
            <Label htmlFor="cancel-observations">Observações</Label>
            <Textarea
              id="cancel-observations"
              placeholder="Motivo do cancelamento ou observações adicionais..."
              value={cancelObservations}
              onChange={(e) => setCancelObservations(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter entrega</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedDelivery) {
                  cancelDeliveryMutation.mutate({
                    deliveryId: selectedDelivery.id,
                    observations: cancelObservations,
                  });
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Sim, cancelar entrega
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
