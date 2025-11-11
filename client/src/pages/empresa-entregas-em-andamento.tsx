import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, User, MapPin, Truck, Loader2, CalendarIcon, Search, X, ChevronLeft, ChevronRight, Plus, XCircle } from "lucide-react";
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

interface CancellationType {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

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
  arrived_pickup: { label: "Cheguei para retirada", color: "bg-cyan-100 text-cyan-700" },
  in_progress: { label: "Em Andamento", color: "bg-purple-100 text-purple-700" },
  completed: { label: "Concluído", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700" },
};

const ITEMS_PER_PAGE = 50;

export default function EmpresaEntregasEmAndamento() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deliveryToCancel, setDeliveryToCancel] = useState<Delivery | null>(null);
  const [cancelTypeId, setCancelTypeId] = useState("");

  // Filtros
  const [searchOrderNumber, setSearchOrderNumber] = useState("");
  const [searchCustomerName, setSearchCustomerName] = useState("");
  const [searchDriverName, setSearchDriverName] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);

  const { data: deliveries = [], isLoading } = useQuery<Delivery[]>({
    queryKey: ["/api/empresa/deliveries/in-progress"],
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  // Buscar tipos de cancelamento
  const { data: cancellationTypes = [], isLoading: isLoadingTypes } = useQuery<CancellationType[]>({
    queryKey: ["/api/company-cancellation-types"],
    staleTime: 0, // Sempre considerar os dados desatualizados
    refetchOnMount: true, // Sempre buscar ao montar o componente
    refetchOnWindowFocus: true, // Buscar quando a janela recebe foco
  });

  // Mutation para cancelar entrega
  const cancelMutation = useMutation({
    mutationFn: async ({ id, cancelReason }: { id: string; cancelReason: string }) => {
      const response = await fetch(`/api/empresa/deliveries/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelReason }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao cancelar entrega");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Entrega cancelada",
        description: "A entrega foi cancelada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/deliveries/in-progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/deliveries/cancelled"] });
      setCancelDialogOpen(false);
      setCancelTypeId("");
      setDeliveryToCancel(null);
      // Redireciona para a página de entregas canceladas
      setLocation("/empresa/entregas/canceladas");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cancelar",
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

  const handleCancelClick = (delivery: Delivery) => {
    setDeliveryToCancel(delivery);
    setCancelDialogOpen(true);
    // Forçar recarregamento dos tipos de cancelamento
    queryClient.invalidateQueries({ queryKey: ["/api/company-cancellation-types"] });
  };

  const handleConfirmCancel = () => {
    if (!deliveryToCancel) return;

    if (!cancelTypeId) {
      toast({
        title: "Tipo obrigatório",
        description: "Por favor, selecione o tipo de cancelamento.",
        variant: "destructive",
      });
      return;
    }

    // Encontrar o nome do tipo de cancelamento selecionado
    const selectedType = cancellationTypes.find(t => t.id === cancelTypeId);
    const cancelReason = selectedType?.name || '';

    cancelMutation.mutate({ id: deliveryToCancel.id, cancelReason });
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
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-6 w-6" />
              Entregas em Andamento
            </CardTitle>
            <Link href="/empresa/entregas">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Entrega
              </Button>
            </Link>
          </div>
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
              {deliveries.length === 0 ? "Nenhuma entrega em andamento no momento" : "Nenhum resultado encontrado com os filtros aplicados"}
            </div>
          ) : (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
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
                          onClick={() => handleCancelClick(delivery)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="h-4 w-4" />
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de cancelamento */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Entrega</DialogTitle>
          </DialogHeader>
          {deliveryToCancel && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm font-medium text-amber-900">
                  Você tem certeza que deseja cancelar a entrega <span className="font-mono font-bold">{deliveryToCancel.requestNumber}</span>?
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Você não terá custo pois ela ainda não foi aceita.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cancel-type">Tipo de Cancelamento *</Label>
                {isLoadingTypes ? (
                  <div className="flex items-center justify-center p-4 border rounded-md">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Carregando tipos...</span>
                  </div>
                ) : cancellationTypes.length === 0 ? (
                  <div className="p-4 border rounded-md bg-yellow-50 border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      Nenhum tipo de cancelamento cadastrado. Configure os tipos em "Tipos de cancelamento empresa" no menu.
                    </p>
                  </div>
                ) : (
                  <Select value={cancelTypeId} onValueChange={setCancelTypeId}>
                    <SelectTrigger id="cancel-type">
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cancellationTypes
                        .filter(type => type.active)
                        .map(type => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelDialogOpen(false);
                setCancelTypeId("");
                setDeliveryToCancel(null);
              }}
              disabled={cancelMutation.isPending}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Confirmar Cancelamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
