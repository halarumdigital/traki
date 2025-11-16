import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Eye, MapPin, CheckCircle2, Loader2, CalendarIcon, Search, X, ChevronLeft, ChevronRight, RefreshCw, Star, User, Phone, Info } from "lucide-react";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  companyName: string;
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

export default function EntregasConcluidas() {
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Filtros
  const [searchCompany, setSearchCompany] = useState("");
  const [searchOrderNumber, setSearchOrderNumber] = useState("");
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
    queryKey: ["/api/admin/deliveries/completed"],
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  // Mutation para enviar avaliação
  const ratingMutation = useMutation({
    mutationFn: async ({ requestId, rating, comment }: { requestId: string; rating: number; comment?: string }) => {
      const response = await apiRequest(`/api/admin/deliveries/${requestId}/rate`, {
        method: "POST",
        body: JSON.stringify({ rating, comment }),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Avaliação enviada",
        description: "Obrigado por avaliar o motorista!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deliveries/completed"] });
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
            <CheckCircle2 className="h-6 w-6" />
            Entregas Concluídas
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
              {deliveries.length === 0 ? "Nenhuma entrega concluída" : "Nenhum resultado encontrado com os filtros aplicados"}
            </div>
          ) : (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Data Conclusão</TableHead>
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
                      {delivery.driverName ? (
                        <div className="space-y-1">
                          <div className="font-medium">{delivery.driverName}</div>
                          <RatingStars rating={delivery.driverRating} count={delivery.driverRatingCount} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {delivery.completedAt ? formatBrazilianDateTime(delivery.completedAt) : "-"}
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
                  <p className="text-sm text-muted-foreground">Empresa</p>
                  <p className="font-semibold">{selectedDelivery.companyName}</p>
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
                      <div className="space-y-2">
                        {selectedDelivery.dropoffAddress.split(" | ").map((address, index) => {
                          // Extrair informações no formato [Nome] [WhatsApp: ...] [Ref: ...] Endereço
                          let remainingAddress = address;

                          // Extrair nome do cliente
                          const customerNameMatch = remainingAddress.match(/^\[([^\]]+)\]\s*/);
                          const customerName = customerNameMatch ? customerNameMatch[1] : null;
                          if (customerName) {
                            remainingAddress = remainingAddress.replace(/^\[([^\]]+)\]\s*/, '');
                          }

                          // Extrair WhatsApp
                          const whatsappMatch = remainingAddress.match(/^\[WhatsApp:\s*([^\]]+)\]\s*/);
                          const whatsapp = whatsappMatch ? whatsappMatch[1] : null;
                          if (whatsapp) {
                            remainingAddress = remainingAddress.replace(/^\[WhatsApp:\s*([^\]]+)\]\s*/, '');
                          }

                          // Extrair Referência
                          const referenceMatch = remainingAddress.match(/^\[Ref:\s*([^\]]+)\]\s*/);
                          const reference = referenceMatch ? referenceMatch[1] : null;
                          if (reference) {
                            remainingAddress = remainingAddress.replace(/^\[Ref:\s*([^\]]+)\]\s*/, '');
                          }

                          return (
                            <div key={index} className="flex items-start gap-2 p-3 bg-muted/30 rounded border">
                              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold">
                                {index + 1}
                              </span>
                              <div className="flex-1 space-y-1">
                                {customerName && (
                                  <p className="text-sm font-semibold text-primary">
                                    <User className="h-3 w-3 inline mr-1" />
                                    {customerName}
                                  </p>
                                )}
                                {whatsapp && (
                                  <p className="text-xs text-muted-foreground">
                                    <Phone className="h-3 w-3 inline mr-1" />
                                    WhatsApp: {whatsapp}
                                  </p>
                                )}
                                {reference && (
                                  <p className="text-xs text-muted-foreground">
                                    <Info className="h-3 w-3 inline mr-1" />
                                    Ref: {reference}
                                  </p>
                                )}
                                <p className="font-medium text-sm">{remainingAddress}</p>
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

              {/* Histórico de Status do Entregador */}
              <div className="pt-4 border-t">
                <p className="text-sm font-semibold mb-3">Status do Entregador</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Aceito pelo motorista:</span>
                    <span className="font-medium">
                      {selectedDelivery.acceptedAt ? formatBrazilianDateTime(selectedDelivery.acceptedAt) : <span className="text-amber-600">Aguardando</span>}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Chegou no local de retirada:</span>
                    <span className="font-medium">
                      {selectedDelivery.arrivedAt ? formatBrazilianDateTime(selectedDelivery.arrivedAt) : <span className="text-amber-600">Aguardando</span>}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Retirou o pedido (iniciou viagem):</span>
                    <span className="font-medium">
                      {selectedDelivery.tripStartedAt ? formatBrazilianDateTime(selectedDelivery.tripStartedAt) : <span className="text-amber-600">Aguardando</span>}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Entrega concluída:</span>
                    <span className="font-medium">
                      {selectedDelivery.completedAt ? formatBrazilianDateTime(selectedDelivery.completedAt) : <span className="text-amber-600">Aguardando</span>}
                    </span>
                  </div>
                </div>
              </div>

              {/* Indicador de volta */}
              {selectedDelivery.needsReturn && (
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Entrega com Volta</p>
                      <p className="text-xs text-green-700">Motorista retornou ao ponto de origem após a entrega</p>
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
