import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Eye, User, MapPin, Truck, CheckCircle2, Loader2, CalendarIcon, Search, X, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo, useEffect } from "react";
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
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  totalPrice: string | null;
  vehicleTypeName: string;
  totalDistance: string | null;
  totalTime: string | null;
  acceptedAt: string | null;
  arrivedAt: string | null;
  tripStartedAt: string | null;
  completedAt: string | null;
  driverId: string | null;
  driverName: string | null;
  driverRating: string | null;
  driverRatingCount: number | null;
  needsReturn: boolean | null;
  companyRated: boolean | null;
}

// Função helper para formatar datas no horário de Brasília
// As datas vêm do banco de dados já em horário de Brasília
const formatBrazilianDateTime = (date: string | Date) => {
  const d = new Date(date);
  return format(d, 'dd/MM/yyyy, HH:mm', { locale: ptBR });
};

// Componente para exibir estrelas de avaliação
const RatingStars = ({ rating, count }: { rating: string | null; count: number | null }) => {
  if (!rating || rating === "0" || !count) {
    return <span className="text-xs text-muted-foreground">Sem avaliação</span>;
  }

  const ratingValue = parseFloat(rating);
  const fullStars = Math.floor(ratingValue);
  const hasHalfStar = ratingValue % 1 >= 0.5;

  return (
    <div className="flex">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3 w-3",
            i < fullStars
              ? "fill-yellow-400 text-yellow-400"
              : i === fullStars && hasHalfStar
              ? "fill-yellow-400/50 text-yellow-400"
              : "text-gray-300"
          )}
        />
      ))}
    </div>
  );
};

const ITEMS_PER_PAGE = 50;

export default function EmpresaEntregasConcluidas() {
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

  // Avaliação
  const [ratingOpen, setRatingOpen] = useState(false);
  const [deliveryToRate, setDeliveryToRate] = useState<Delivery | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");

  const { toast } = useToast();

  const { data: deliveries = [], isLoading } = useQuery<Delivery[]>({
    queryKey: ["/api/empresa/deliveries/completed"],
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  // Mutation para enviar avaliação
  const ratingMutation = useMutation({
    mutationFn: async ({ requestId, rating, comment }: { requestId: string; rating: number; comment?: string }) => {
      const response = await apiRequest(
        "POST",
        `/api/empresa/deliveries/${requestId}/rate`,
        { rating, comment }
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Avaliação enviada",
        description: "Obrigado por avaliar o motorista!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/deliveries/completed"] });
      setRatingOpen(false);
      setRating(0);
      setComment("");
      setDeliveryToRate(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar avaliação",
        description: error.message || "Tente novamente mais tarde",
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

  const handleOpenRating = (delivery: Delivery) => {
    setDeliveryToRate(delivery);
    setRating(0);
    setComment("");
    setRatingOpen(true);
  };

  const handleSubmitRating = () => {
    if (!deliveryToRate || rating === 0) {
      toast({
        title: "Erro",
        description: "Selecione uma avaliação de 1 a 5 estrelas",
        variant: "destructive",
      });
      return;
    }

    ratingMutation.mutate({
      requestId: deliveryToRate.id,
      rating,
      comment: comment.trim() || undefined,
    });
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
          <CheckCircle2 className="h-6 w-6 text-slate-500" />
          Entregas Concluídas
        </h1>
        <p className="text-slate-500">Histórico completo de entregas finalizadas.</p>
      </div>

      {/* Filtros */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Filtro por Número do Pedido */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">Número do Pedido</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar por nº pedido..."
                  value={searchOrderNumber}
                  onChange={(e) => setSearchOrderNumber(e.target.value)}
                  className="pl-9 bg-slate-50"
                />
              </div>
            </div>

            {/* Filtro por Nome do Cliente */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">Nome do Cliente</label>
              <div className="relative">
                <User className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar por cliente..."
                  value={searchCustomerName}
                  onChange={(e) => setSearchCustomerName(e.target.value)}
                  className="pl-9 bg-slate-50"
                />
              </div>
            </div>

            {/* Filtro por Nome do Motorista */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">Nome do Motorista</label>
              <div className="relative">
                <Truck className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar por motorista..."
                  value={searchDriverName}
                  onChange={(e) => setSearchDriverName(e.target.value)}
                  className="pl-9 bg-slate-50"
                />
              </div>
            </div>

            {/* Filtro por Data - De */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">Data Inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-slate-50",
                      !dateFrom && "text-muted-foreground"
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
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">Data Final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-slate-50",
                      !dateTo && "text-muted-foreground"
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
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="h-8"
              >
                <X className="mr-2 h-3 w-3" />
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
            <CardTitle className="text-base font-medium">Histórico de Entregas</CardTitle>
            <CardDescription>
              Mostrando {filteredDeliveries.length > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, filteredDeliveries.length)} de {filteredDeliveries.length} entregas filtradas ({deliveries.length} total)
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-1">
                Nenhuma entrega concluída
              </h3>
              <p className="text-sm text-slate-400 max-w-sm">
                {deliveries.length === 0 ? "Suas entregas concluídas aparecerão aqui" : "Nenhum resultado encontrado com os filtros aplicados"}
              </p>
            </div>
          ) : (
            <div>
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[220px] font-semibold text-slate-600">Nº Pedido</TableHead>
                    <TableHead className="font-semibold text-slate-600">Cliente</TableHead>
                    <TableHead className="font-semibold text-slate-600">Motorista</TableHead>
                    <TableHead className="font-semibold text-slate-600">Data Conclusão</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-right">Valor</TableHead>
                    <TableHead className="font-semibold text-slate-600 w-[150px]">Avaliação</TableHead>
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
                      {delivery.customerName && (
                        <div className="font-medium text-slate-900">{delivery.customerName}</div>
                      )}
                      <div className="text-xs text-slate-500 truncate max-w-[200px]" title={delivery.dropoffAddress}>
                        {(() => {
                          // Pegar apenas o primeiro endereço se houver múltiplos
                          let address = delivery.dropoffAddress.split(" | ")[0];
                          // Remover [nome do cliente], [WhatsApp: xxx], [Ref: xxx]
                          address = address.replace(/\[WhatsApp:\s*[^\]]+\]\s*/gi, '');
                          address = address.replace(/\[Ref:\s*[^\]]+\]\s*/gi, '');
                          address = address.replace(/^\[[^\]]+\]\s*/, '');
                          // Pegar apenas rua e número (antes da primeira vírgula após o número)
                          const parts = address.trim().split(',');
                          if (parts.length >= 2) {
                            return `${parts[0].trim()}, ${parts[1].trim()}`;
                          }
                          return parts[0].trim();
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {delivery.driverName ? (
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                            <User className="h-4 w-4 text-slate-500" />
                          </div>
                          <div>
                            <div className="font-medium text-sm text-slate-900">{delivery.driverName}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                              <span className="text-xs text-slate-500 font-medium">
                                {delivery.driverRating ? parseFloat(delivery.driverRating).toFixed(1) : "-"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-900">
                        {delivery.completedAt ? formatBrazilianDateTime(delivery.completedAt) : "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {delivery.totalPrice ? (
                        new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(parseFloat(delivery.totalPrice))
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {delivery.driverId ? (
                        delivery.companyRated ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 gap-1 pl-1.5 pr-2.5">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Avaliado
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenRating(delivery)}
                            className="h-8 gap-1.5 text-slate-600"
                          >
                            <Star className="h-3.5 w-3.5" />
                            Avaliar
                          </Button>
                        )
                      ) : (
                        <span className="text-slate-400 text-xs">Sem motorista</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-blue-600"
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
              <div className="flex items-center justify-between p-4 border-t border-slate-100">
                <div className="text-sm text-slate-500">
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

      {/* Dialog de avaliação */}
      <Dialog open={ratingOpen} onOpenChange={setRatingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Avaliar Motorista</DialogTitle>
          </DialogHeader>
          {deliveryToRate && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Motorista</p>
                <p className="font-semibold">{deliveryToRate.driverName}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Pedido</p>
                <p className="font-mono text-sm">{deliveryToRate.requestNumber}</p>
              </div>

              <div className="space-y-2">
                <Label>Sua Avaliação</Label>
                <div className="flex gap-2 justify-center py-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star
                        className={cn(
                          "h-10 w-10 transition-colors",
                          (hoverRating >= star || rating >= star)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        )}
                      />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className="text-center text-sm text-muted-foreground">
                    {rating === 1 && "Muito ruim"}
                    {rating === 2 && "Ruim"}
                    {rating === 3 && "Regular"}
                    {rating === 4 && "Bom"}
                    {rating === 5 && "Excelente"}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="comment">Comentário (opcional)</Label>
                <Textarea
                  id="comment"
                  placeholder="Deixe um comentário sobre o motorista..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setRatingOpen(false)}
                  disabled={ratingMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmitRating}
                  disabled={ratingMutation.isPending || rating === 0}
                >
                  {ratingMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar Avaliação"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Entrega Concluída</DialogTitle>
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
                  <Badge className="bg-green-100 text-green-700">Concluída</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-semibold">{selectedDelivery.customerName || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Motorista</p>
                  <p className="font-semibold">{selectedDelivery.driverName || "-"}</p>
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
                  <p className="text-sm text-muted-foreground">Data Conclusão</p>
                  <p className="font-semibold">
                    {selectedDelivery.completedAt ? formatBrazilianDateTime(selectedDelivery.completedAt) : "-"}
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
                    <CheckCircle2 className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-amber-900">Entrega com Volta</p>
                      <p className="text-xs text-amber-700">Motorista retornou ao ponto de origem após a entrega</p>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
