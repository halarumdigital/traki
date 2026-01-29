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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, User, MapPin, Truck, Loader2, CalendarIcon, Search, X, ChevronLeft, ChevronRight, Plus, XCircle, Clock, Package, RefreshCw, Ban, Star, AlertTriangle, Wallet, AlertCircle } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import "@/styles/google-maps-fix.css";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";

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
  driverAvatar: string | null;
  driverRating: string | null;
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
  cancellationFeePercentage: string | null;
  needsReturn: boolean | null;
  isLater: boolean | null;
  scheduledAt: string | null;
}

interface VehicleType {
  id: string;
  name: string;
  icon: string | null;
}

interface Company {
  id: string;
  name: string;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  reference: string | null;
}

interface DeliveryPoint {
  id: number;
  customerName: string;
  customerWhatsapp: string;
  cep: string;
  address: string;
  number: string;
  neighborhood: string;
  reference: string;
  city: string;
  state: string;
}

type CancellationPreviewState = {
  accepted: boolean;
  driverName?: string | null;
  amount?: number | null;
  appliedPercentage?: number | null;
  configuredPercentage?: number | null;
  isLoading?: boolean;
  error?: string | null;
};

// Função helper para formatar datas no horário de Brasília
// As datas vêm do banco de dados já em horário de Brasília
const formatBrazilianDateTime = (date: string | Date) => {
  const d = new Date(date);
  return format(d, 'dd/MM/yyyy, HH:mm', { locale: ptBR });
};

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  scheduled: { label: "Agendada", color: "bg-orange-100 text-orange-700" },
  accepted: { label: "Aceito", color: "bg-blue-100 text-blue-700" },
  arrived_pickup: { label: "Cheguei para retirada", color: "bg-cyan-100 text-cyan-700" },
  in_progress: { label: "Em Andamento", color: "bg-purple-100 text-purple-700" },
  delivered_awaiting_return: { label: "Entregue, aguardando retorno", color: "bg-teal-100 text-teal-700" },
  returning: { label: "Retornando ao ponto de origem", color: "bg-indigo-100 text-indigo-700" },
  completed: { label: "Concluído", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700" },
};

const ITEMS_PER_PAGE = 50;
const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const formatCurrency = (value: number) => brlFormatter.format(value);

export default function EmpresaEntregasEmAndamento() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deliveryToCancel, setDeliveryToCancel] = useState<Delivery | null>(null);
  const [cancelTypeId, setCancelTypeId] = useState("");
  const [cancellationPreview, setCancellationPreview] = useState<CancellationPreviewState | null>(null);

  // Novo modal de entrega
  const [newDeliveryOpen, setNewDeliveryOpen] = useState(false);
  const [insufficientBalanceOpen, setInsufficientBalanceOpen] = useState(false);
  const [balanceErrorDetails, setBalanceErrorDetails] = useState<{ available: string; required: string } | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    pickupAddress: "",
    pickupNumber: "",
    pickupNeighborhood: "",
    pickupReference: "",
    vehicleTypeId: "",
    needsReturn: false,
    isScheduled: false,
    scheduledDate: null as Date | null,
    scheduledTime: "",
  });
  const [deliveryPoints, setDeliveryPoints] = useState<DeliveryPoint[]>([
    {
      id: 1,
      customerName: "",
      customerWhatsapp: "",
      cep: "",
      address: "",
      number: "",
      neighborhood: "",
      reference: "",
      city: "",
      state: "",
    },
  ]);
  const [openAccordionItem, setOpenAccordionItem] = useState("1");
  const [lookingUpCep, setLookingUpCep] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{
    distance: number;
    duration: number;
    price: number | null;
  } | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const deliveryAddressInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const deliveryCepInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const autocompleteRefs = useRef<Record<number, google.maps.places.Autocomplete | null>>({});
  const autocompleteCepRefs = useRef<Record<number, google.maps.places.Autocomplete | null>>({});

  // Queries adicionais para o modal de nova entrega
  const { data: vehicleTypes = [] } = useQuery<VehicleType[]>({
    queryKey: ["/api/vehicle-types"],
  });

  const { data: companyData } = useQuery<Company>({
    queryKey: ["/api/empresa/auth/me"],
    select: (data: any) => data,
  });

  const { data: googleMapsConfig } = useQuery({
    queryKey: ["/api/settings/google-maps-key"],
    staleTime: Infinity,
  });

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

  const deliveryAccepted = Boolean(deliveryToCancel?.driverName || deliveryToCancel?.acceptedAt);

  const renderCancellationFeeDescription = () => {
    if (!deliveryAccepted) {
      return "Você não terá custo pois ela ainda não foi aceita.";
    }

    if (!cancellationPreview || cancellationPreview.isLoading) {
      return "Calculando taxa de cancelamento...";
    }

    if (typeof cancellationPreview.amount === "number") {
      return (
        <>
          O cancelamento irá gerar a cobrança de{' '}
          <span className="font-semibold">{formatCurrency(cancellationPreview.amount)}</span>
          {typeof cancellationPreview.appliedPercentage === "number" && (
            <>
              {' '}
              ({cancellationPreview.appliedPercentage.toFixed(2)}% do valor da entrega)
            </>
          )}
          .
        </>
      );
    }

    if (cancellationPreview.error) {
      return cancellationPreview.error;
    }

    return "Não foi possível calcular o valor da taxa de cancelamento.";
  };

  useEffect(() => {
    if (!deliveryToCancel) {
      setCancellationPreview(null);
      return;
    }

    const accepted = Boolean(deliveryToCancel.driverName || deliveryToCancel.acceptedAt);
    if (!accepted) {
      setCancellationPreview({ accepted: false });
      return;
    }

    let isActive = true;
    setCancellationPreview({
      accepted: true,
      driverName: deliveryToCancel.driverName,
      amount: null,
      appliedPercentage: null,
      configuredPercentage: null,
      isLoading: true,
      error: null,
    });

    (async () => {
      try {
        const response = await fetch(
          `/api/empresa/deliveries/${deliveryToCancel.id}/cancellation-fee-preview`,
          { credentials: "include" }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Erro ao calcular taxa de cancelamento");
        }

        if (!isActive) return;

        setCancellationPreview({
          accepted: true,
          driverName: deliveryToCancel.driverName,
          amount:
            data.cancellationFee !== null && data.cancellationFee !== undefined
              ? parseFloat(data.cancellationFee)
              : null,
          appliedPercentage:
            data.cancellationFeePercentage !== null && data.cancellationFeePercentage !== undefined
              ? Number(data.cancellationFeePercentage)
              : null,
          configuredPercentage:
            data.cancellationFeeConfiguredPercentage !== null &&
            data.cancellationFeeConfiguredPercentage !== undefined
              ? Number(data.cancellationFeeConfiguredPercentage)
              : null,
          isLoading: false,
          error: null,
        });
      } catch (error: any) {
        if (!isActive) return;

        setCancellationPreview({
          accepted: true,
          driverName: deliveryToCancel.driverName,
          amount: null,
          appliedPercentage: null,
          configuredPercentage: null,
          isLoading: false,
          error: error.message || "Erro ao calcular taxa de cancelamento.",
        });
      }
    })();

    return () => {
      isActive = false;
    };
  }, [deliveryToCancel?.id, deliveryToCancel?.driverName, deliveryToCancel?.acceptedAt]);

  // Funções para o modal de nova entrega
  const handleNewDelivery = () => {
    if (companyData) {
      setDeliveryForm((prev) => ({
        ...prev,
        pickupAddress: companyData.street || "",
        pickupNumber: companyData.number || "",
        pickupNeighborhood: companyData.neighborhood || "",
        pickupReference: companyData.reference || "",
      }));
    }
    setNewDeliveryOpen(true);
  };

  const addDeliveryPoint = () => {
    const newId = Math.max(...deliveryPoints.map(p => p.id)) + 1;
    setDeliveryPoints([...deliveryPoints, {
      id: newId,
      customerName: "",
      customerWhatsapp: "",
      cep: "",
      address: "",
      number: "",
      neighborhood: "",
      reference: "",
      city: "",
      state: "",
    }]);
    setOpenAccordionItem(newId.toString());
  };

  const removeDeliveryPoint = (id: number) => {
    if (deliveryPoints.length > 1) {
      setDeliveryPoints(deliveryPoints.filter(p => p.id !== id));
      delete deliveryAddressInputRefs.current[id];
      delete deliveryCepInputRefs.current[id];
      delete autocompleteRefs.current[id];
      delete autocompleteCepRefs.current[id];
    }
  };

  const updateDeliveryPoint = (id: number, field: string, value: string) => {
    setDeliveryPoints(prev => prev.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const handleCepLookup = async (pointId: number, cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");

    if (cleanCep.length !== 8) {
      return;
    }

    setLookingUpCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast({
          variant: "destructive",
          title: "CEP não encontrado",
          description: "Por favor, verifique o CEP digitado.",
        });
        return;
      }

      setDeliveryPoints(prev => prev.map(p =>
        p.id === pointId
          ? {
              ...p,
              address: data.logradouro || "",
              neighborhood: data.bairro || "",
              city: data.localidade || "",
              state: data.uf || "",
              cep: cleanCep,
            }
          : p
      ));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao buscar CEP",
        description: "Não foi possível buscar o endereço. Tente novamente.",
      });
    } finally {
      setLookingUpCep(false);
    }
  };

  const createDeliveryMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/empresa/deliveries", data);
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/deliveries/in-progress"] });

      if (response.isScheduled && response.scheduledAt) {
        const scheduledDate = new Date(response.scheduledAt);
        toast({
          title: "Entrega agendada com sucesso!",
          description: `A entrega foi agendada para ${format(scheduledDate, "PPP 'às' HH:mm", { locale: ptBR })}. Os motoristas serão notificados na data/hora programada.`,
        });
      } else {
        toast({
          title: "Entrega criada com sucesso!",
          description: "A entrega foi registrada e está aguardando um motorista.",
        });
      }

      setNewDeliveryOpen(false);
      // Resetar formulário
      setDeliveryForm({
        pickupAddress: "",
        pickupNumber: "",
        pickupNeighborhood: "",
        pickupReference: "",
        vehicleTypeId: "",
        needsReturn: false,
        isScheduled: false,
        scheduledDate: null,
        scheduledTime: "",
      });
      setDeliveryPoints([{
        id: 1,
        customerName: "",
        customerWhatsapp: "",
        cep: "",
        address: "",
        number: "",
        neighborhood: "",
        reference: "",
        city: "",
        state: "",
      }]);
      setRouteInfo(null);
    },
    onError: (error: any) => {
      const errorMessage = error?.message || String(error) || "";

      // Se for erro de saldo insuficiente, abre o modal
      if (errorMessage.includes("402") || errorMessage.toLowerCase().includes("saldo")) {
        const availableMatch = errorMessage.match(/Disponível: R\$ ([\d.,]+)/);
        const requiredMatch = errorMessage.match(/Necessário: R\$ ([\d.,]+)/);

        setNewDeliveryOpen(false);
        setBalanceErrorDetails({
          available: availableMatch ? availableMatch[1] : "0,00",
          required: requiredMatch ? requiredMatch[1] : "0,00",
        });
        setInsufficientBalanceOpen(true);
        return;
      }

      toast({
        variant: "destructive",
        title: "Erro ao criar entrega",
        description: "Ocorreu um erro ao criar a entrega.",
      });
    },
  });

  const calculateRoute = async () => {
    const validDeliveryPoints = deliveryPoints.filter(point => point.address);

    if (!deliveryForm.pickupAddress || validDeliveryPoints.length === 0 || !deliveryForm.vehicleTypeId) {
      return;
    }

    if (!window.google?.maps) {
      toast({
        variant: "destructive",
        title: "Google Maps não carregado",
        description: "Aguarde o carregamento do Google Maps.",
      });
      return;
    }

    setCalculatingRoute(true);

    try {
      const pickupCity = companyData?.city || "";
      const pickupState = companyData?.state || "";
      const pickupFullAddress = `${deliveryForm.pickupAddress}, ${deliveryForm.pickupNumber || "S/N"}, ${deliveryForm.pickupNeighborhood}${pickupCity ? `, ${pickupCity}` : ""}${pickupState ? ` - ${pickupState}` : ""}, Brasil`;

      const deliveryAddresses = validDeliveryPoints.map(point => {
        const addressParts = [
          point.address,
          point.number || "S/N",
          point.neighborhood,
        ];

        if (point.city) addressParts.push(point.city);
        if (point.state) addressParts.push(point.state);
        addressParts.push("Brasil");

        return addressParts.filter(Boolean).join(", ");
      });

      const origin = pickupFullAddress;
      const destination = deliveryAddresses[deliveryAddresses.length - 1];
      const waypoints = deliveryAddresses.slice(0, -1).map(address => ({
        location: address,
        stopover: true,
      }));

      if (mapRef.current) {
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: -23.5505, lng: -46.6333 },
          zoom: 12,
        });
        mapInstanceRef.current = map;

        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
          suppressMarkers: true,
        });
        directionsRenderer.setMap(map);

        directionsService.route(
          {
            origin: origin,
            destination: destination,
            waypoints: waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          async (response, status) => {
            if (status === "OK" && response) {
              directionsRenderer.setDirections(response);

              const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

              new google.maps.Marker({
                position: response.routes[0].legs[0].start_location,
                map: map,
                label: {
                  text: "A",
                  color: "white",
                  fontWeight: "bold",
                },
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 12,
                  fillColor: "#4285F4",
                  fillOpacity: 1,
                  strokeColor: "white",
                  strokeWeight: 2,
                },
                title: "Retirada",
              });

              response.routes[0].legs.forEach((leg, index) => {
                if (index < response.routes[0].legs.length - 1) {
                  new google.maps.Marker({
                    position: leg.end_location,
                    map: map,
                    label: {
                      text: labels[index + 1],
                      color: "white",
                      fontWeight: "bold",
                    },
                    icon: {
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 12,
                      fillColor: "#EA4335",
                      fillOpacity: 1,
                      strokeColor: "white",
                      strokeWeight: 2,
                    },
                    title: `Entrega ${index + 1}`,
                  });
                }
              });

              const lastLegIndex = response.routes[0].legs.length - 1;
              new google.maps.Marker({
                position: response.routes[0].legs[lastLegIndex].end_location,
                map: map,
                label: {
                  text: labels[lastLegIndex + 1],
                  color: "white",
                  fontWeight: "bold",
                },
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 12,
                  fillColor: "#EA4335",
                  fillOpacity: 1,
                  strokeColor: "white",
                  strokeWeight: 2,
                },
                title: `Entrega ${lastLegIndex + 1}`,
              });

              let totalDistance = 0;
              let totalDuration = 0;

              response.routes[0].legs.forEach((leg) => {
                totalDistance += leg.distance?.value || 0;
                totalDuration += leg.duration?.value || 0;
              });

              const exactDistanceKm = totalDistance / 1000;
              const distanceInKm = Math.ceil(exactDistanceKm * 2) / 2;
              const durationInMinutes = Math.ceil(totalDuration / 60);

              try {
                const res = await apiRequest("POST", "/api/empresa/calculate-price", {
                  vehicleTypeId: deliveryForm.vehicleTypeId,
                  distanceKm: distanceInKm,
                  durationMinutes: durationInMinutes,
                  needsReturn: deliveryForm.needsReturn,
                });

                const priceResponse = await res.json();

                const calculatedPrice = parseFloat(priceResponse.totalPrice);

                console.log(`🎯 Rota calculada com ${response.routes[0].legs.length} paradas:`);
                console.log(`  📏 Distância total: ${distanceInKm.toFixed(2)} km`);
                console.log(`  ⏱️  Tempo total: ${durationInMinutes} min`);
                console.log(`  💰 Preço calculado: R$ ${calculatedPrice.toFixed(2)}`);

                setRouteInfo({
                  distance: distanceInKm,
                  duration: durationInMinutes,
                  price: calculatedPrice,
                });
              } catch (priceError: any) {
                toast({
                  variant: "destructive",
                  title: "Erro ao calcular preço",
                  description: priceError.message || "Não foi possível calcular o preço. Verifique se há configuração de preço para esta categoria.",
                });
                setRouteInfo(null);
              }
            } else {
              let errorMessage = "Não foi possível calcular a rota.";

              if (status === "NOT_FOUND") {
                errorMessage = "Um ou mais endereços não foram encontrados. Verifique se todos os campos estão preenchidos corretamente, incluindo CEP, endereço, número e bairro.";
              } else if (status === "ZERO_RESULTS") {
                errorMessage = "Não foi possível encontrar uma rota entre os endereços fornecidos.";
              } else if (status === "MAX_WAYPOINTS_EXCEEDED") {
                errorMessage = "Número máximo de pontos de entrega excedido. Reduza a quantidade de pontos.";
              } else if (status === "INVALID_REQUEST") {
                errorMessage = "Os endereços fornecidos são inválidos. Verifique os dados informados.";
              }

              toast({
                variant: "destructive",
                title: "Erro ao calcular rota",
                description: errorMessage,
              });
            }
          }
        );
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao calcular rota",
        description: "Ocorreu um erro ao calcular a rota.",
      });
    } finally {
      setCalculatingRoute(false);
    }
  };

  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    if (!window.google?.maps) {
      return null;
    }

    return new Promise((resolve) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address, region: 'br' }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location;
          resolve({
            lat: location.lat(),
            lng: location.lng(),
          });
        } else {
          resolve(null);
        }
      });
    });
  };

  const handleSubmitDelivery = async () => {
    const hasDeliveryPoint = deliveryPoints.some(point => point.address);

    if (!deliveryForm.pickupAddress || !hasDeliveryPoint) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Por favor, preencha os endereços de retirada e pelo menos um ponto de entrega.",
      });
      return;
    }

    if (!deliveryForm.vehicleTypeId) {
      toast({
        variant: "destructive",
        title: "Categoria obrigatória",
        description: "Por favor, selecione a categoria do veículo.",
      });
      return;
    }

    if (!window.google?.maps) {
      toast({
        variant: "destructive",
        title: "Google Maps não carregado",
        description: "Aguarde o carregamento do Google Maps.",
      });
      return;
    }

    if (!routeInfo || !routeInfo.price || routeInfo.price <= 0 || !routeInfo.distance || routeInfo.distance <= 0 || !routeInfo.duration || routeInfo.duration <= 0) {
      toast({
        variant: "destructive",
        title: "Cálculo de rota pendente",
        description: "Por favor, aguarde o cálculo da distância e valor da entrega antes de criar.",
      });
      return;
    }

    // Validação de agendamento
    if (deliveryForm.isScheduled) {
      if (!deliveryForm.scheduledDate) {
        toast({
          variant: "destructive",
          title: "Data obrigatória",
          description: "Por favor, selecione a data do agendamento.",
        });
        return;
      }
      if (!deliveryForm.scheduledTime) {
        toast({
          variant: "destructive",
          title: "Hora obrigatória",
          description: "Por favor, selecione a hora do agendamento.",
        });
        return;
      }

      // Validar se a data/hora é futura
      const [hours, minutes] = deliveryForm.scheduledTime.split(":").map(Number);
      const scheduledDateTime = new Date(deliveryForm.scheduledDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      if (scheduledDateTime <= new Date()) {
        toast({
          variant: "destructive",
          title: "Data/hora inválida",
          description: "A data e hora do agendamento deve ser futura.",
        });
        return;
      }
    }

    const pickupCity = companyData?.city || "";
    const pickupState = companyData?.state || "";
    const pickupFullAddress = `${deliveryForm.pickupAddress}, ${deliveryForm.pickupNumber || "S/N"}, ${deliveryForm.pickupNeighborhood}${pickupCity ? `, ${pickupCity}` : ""}${pickupState ? ` - ${pickupState}` : ""}, Brasil`;

    const validDeliveryPoints = deliveryPoints.filter(point => point.address);

    const deliveryAddresses = validDeliveryPoints.map(point => {
      const addressParts = [
        point.address,
        point.number || "S/N",
        point.neighborhood,
      ];

      if (point.city) addressParts.push(point.city);
      if (point.state) addressParts.push(point.state);
      addressParts.push("Brasil");

      return addressParts.filter(Boolean).join(", ");
    });

    const allDeliveryAddresses = deliveryAddresses.map((addr, idx) => {
      const point = validDeliveryPoints[idx];
      const addressPart = `${point.address}, ${point.number || "S/N"} - ${point.neighborhood}`;
      
      // Construir a string com nome, WhatsApp e referência no formato esperado pelo backend
      let formattedAddress = "";
      
      // Incluir nome do cliente se fornecido
      if (point.customerName) {
        formattedAddress += `[${point.customerName}] `;
      }
      
      // Incluir WhatsApp se fornecido
      if (point.customerWhatsapp) {
        formattedAddress += `[WhatsApp: ${point.customerWhatsapp}] `;
      }
      
      // Incluir Referência se fornecida
      if (point.reference) {
        formattedAddress += `[Ref: ${point.reference}] `;
      }
      
      // Adicionar o endereço
      formattedAddress += addressPart;
      
      return formattedAddress;
    }).join(" | ");

    const pickupCoords = await geocodeAddress(pickupFullAddress);

    if (!pickupCoords) {
      toast({
        variant: "destructive",
        title: "Erro na geocodificação",
        description: "Não foi possível obter as coordenadas do endereço de retirada. Verifique se o endereço está completo e correto.",
      });
      return;
    }

    const dropoffCoords = await geocodeAddress(deliveryAddresses[0]);

    if (!dropoffCoords) {
      toast({
        variant: "destructive",
        title: "Erro na geocodificação",
        description: "Não foi possível obter as coordenadas do endereço de entrega. Verifique se o endereço está completo e correto.",
      });
      return;
    }

    // Preparar dados de agendamento
    let scheduledAt = null;
    if (deliveryForm.isScheduled && deliveryForm.scheduledDate && deliveryForm.scheduledTime) {
      // Formatar como string sem conversão de timezone
      // O backend vai salvar diretamente no banco como hora local (São Paulo)
      const year = deliveryForm.scheduledDate.getFullYear();
      const month = String(deliveryForm.scheduledDate.getMonth() + 1).padStart(2, '0');
      const day = String(deliveryForm.scheduledDate.getDate()).padStart(2, '0');
      const [hours, minutes] = deliveryForm.scheduledTime.split(":");

      // Formato: YYYY-MM-DD HH:MM:SS (será salvo diretamente no banco)
      scheduledAt = `${year}-${month}-${day} ${hours}:${minutes}:00`;
    }

    createDeliveryMutation.mutate({
      pickupAddress: {
        address: pickupFullAddress,
        lat: pickupCoords.lat,
        lng: pickupCoords.lng,
      },
      dropoffAddress: {
        address: allDeliveryAddresses,
        lat: dropoffCoords.lat,
        lng: dropoffCoords.lng,
      },
      vehicleTypeId: deliveryForm.vehicleTypeId,
      serviceLocationId: null,
      estimatedAmount: routeInfo?.price || null,
      distance: routeInfo?.distance?.toString() || null,
      estimatedTime: routeInfo?.duration?.toString() || null,
      customerName: validDeliveryPoints[0]?.customerName || null,
      customerWhatsapp: validDeliveryPoints[0]?.customerWhatsapp || null,
      deliveryReference: validDeliveryPoints[0]?.reference || null,
      needsReturn: deliveryForm.needsReturn,
      scheduledAt: scheduledAt,
    });
  };

  // Load Google Maps script
  useEffect(() => {
    if (!googleMapsConfig?.apiKey) return;

    const scriptId = "google-maps-script";
    if (document.getElementById(scriptId)) return;

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsConfig.apiKey}&libraries=places,geometry`;
    script.async = true;
    document.head.appendChild(script);
  }, [googleMapsConfig]);

  // Setup Google Places Autocomplete for delivery points
  useEffect(() => {
    if (!window.google?.maps?.places || !newDeliveryOpen || !openAccordionItem) {
      if (!newDeliveryOpen) {
        Object.values(autocompleteRefs.current).forEach(autocomplete => {
          if (autocomplete) {
            google.maps.event.clearInstanceListeners(autocomplete);
          }
        });
        Object.values(autocompleteCepRefs.current).forEach(autocomplete => {
          if (autocomplete) {
            google.maps.event.clearInstanceListeners(autocomplete);
          }
        });
        autocompleteRefs.current = {};
        autocompleteCepRefs.current = {};
      }
      return;
    }

    const timer = setTimeout(() => {
      const pointId = parseInt(openAccordionItem);
      const addressInput = deliveryAddressInputRefs.current[pointId];
      const cepInput = deliveryCepInputRefs.current[pointId];

      if (autocompleteRefs.current[pointId]) {
        google.maps.event.clearInstanceListeners(autocompleteRefs.current[pointId]);
        delete autocompleteRefs.current[pointId];
      }
      if (autocompleteCepRefs.current[pointId]) {
        google.maps.event.clearInstanceListeners(autocompleteCepRefs.current[pointId]);
        delete autocompleteCepRefs.current[pointId];
      }

      if (addressInput) {
        const autocomplete = new google.maps.places.Autocomplete(addressInput, {
          componentRestrictions: { country: "br" },
          fields: ["address_components", "formatted_address", "geometry"],
          types: ["address"],
        });

        autocompleteRefs.current[pointId] = autocomplete;

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.address_components) return;

          let street = "";
          let number = "";
          let neighborhood = "";
          let postalCode = "";
          let city = "";
          let state = "";

          place.address_components.forEach((component) => {
            const types = component.types;
            if (types.includes("route")) street = component.long_name;
            if (types.includes("street_number")) number = component.long_name;
            if (types.includes("sublocality") || types.includes("sublocality_level_1")) neighborhood = component.long_name;
            if (types.includes("postal_code")) postalCode = component.long_name;
            if (types.includes("administrative_area_level_2")) city = component.long_name;
            if (types.includes("administrative_area_level_1")) state = component.short_name;
          });

          setDeliveryPoints(prev => prev.map(p =>
            p.id === pointId
              ? { ...p, address: street, number, neighborhood, cep: postalCode, city, state }
              : p
          ));
        });
      }

      if (cepInput) {
        const autocompleteCep = new google.maps.places.Autocomplete(cepInput, {
          componentRestrictions: { country: "br" },
          fields: ["address_components", "formatted_address", "geometry"],
          types: ["address"],
        });

        autocompleteCepRefs.current[pointId] = autocompleteCep;

        autocompleteCep.addListener("place_changed", () => {
          const place = autocompleteCep.getPlace();
          if (!place.address_components) return;

          let street = "";
          let number = "";
          let neighborhood = "";
          let postalCode = "";
          let city = "";
          let state = "";

          place.address_components.forEach((component) => {
            const types = component.types;
            if (types.includes("route")) street = component.long_name;
            if (types.includes("street_number")) number = component.long_name;
            if (types.includes("sublocality") || types.includes("sublocality_level_1")) neighborhood = component.long_name;
            if (types.includes("postal_code")) postalCode = component.long_name;
            if (types.includes("administrative_area_level_2")) city = component.long_name;
            if (types.includes("administrative_area_level_1")) state = component.short_name;
          });

          setDeliveryPoints(prev => prev.map(p =>
            p.id === pointId
              ? { ...p, address: street, number, neighborhood, cep: postalCode, city, state }
                : p
          ));
        });
      }
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [newDeliveryOpen, openAccordionItem]);

  // Reset form when modal closes
  useEffect(() => {
    if (!newDeliveryOpen) {
      setDeliveryForm({
        pickupAddress: "",
        pickupNumber: "",
        pickupNeighborhood: "",
        pickupReference: "",
        vehicleTypeId: "",
        needsReturn: false,
      });
      setDeliveryPoints([{
        id: 1,
        customerName: "",
        customerWhatsapp: "",
        cep: "",
        address: "",
        number: "",
        neighborhood: "",
        reference: "",
        city: "",
        state: "",
      }]);
      setOpenAccordionItem("1");
      setRouteInfo(null);
      mapInstanceRef.current = null;
    }
  }, [newDeliveryOpen]);

  // Calculate route when addresses and vehicle type are filled
  useEffect(() => {
    const hasDeliveryPoint = deliveryPoints.some(point => point.address);

    if (
      deliveryForm.pickupAddress &&
      deliveryForm.pickupNumber &&
      deliveryForm.pickupNeighborhood &&
      hasDeliveryPoint &&
      deliveryForm.vehicleTypeId &&
      window.google?.maps
    ) {
      calculateRoute();
    }
  }, [
    deliveryForm.vehicleTypeId,
    deliveryForm.pickupAddress,
    deliveryForm.pickupNumber,
    deliveryForm.pickupNeighborhood,
    deliveryForm.needsReturn,
    deliveryPoints,
  ]);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Clock className="h-6 w-6 text-slate-500" />
            Entregas em Andamento
          </h1>
          <p className="text-slate-500">Gerencie todas as entregas ativas em tempo real.</p>
        </div>

        <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" onClick={handleNewDelivery}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Entrega
        </Button>
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
            <CardTitle className="text-base font-medium">Lista de Entregas</CardTitle>
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
              <Clock className="h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-1">
                Nenhuma entrega em andamento
              </h3>
              <p className="text-sm text-slate-400 max-w-sm">
                {deliveries.length === 0 ? "Não há entregas ativas no momento" : "Nenhum resultado encontrado com os filtros aplicados"}
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
                    <TableHead className="font-semibold text-slate-600">Status</TableHead>
                    <TableHead className="font-semibold text-slate-600">Início / Previsão</TableHead>
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
                          <Avatar className="h-9 w-9 border border-slate-200 bg-white">
                            <AvatarImage src={delivery.driverAvatar || undefined} />
                            <AvatarFallback>{delivery.driverName.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm text-slate-900">{delivery.driverName}</div>
                            {delivery.driverRating && (
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                <span className="text-xs text-slate-500 font-medium">{parseFloat(delivery.driverRating).toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Aguardando...</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "font-medium border",
                            statusMap[delivery.status]?.color || "bg-gray-100 text-gray-700"
                          )}
                        >
                          {statusMap[delivery.status]?.label || delivery.status}
                        </Badge>
                        {delivery.status === "scheduled" && delivery.scheduledAt && (
                          <div className="text-xs text-orange-600 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(delivery.scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-900">
                        {formatBrazilianDateTime(delivery.createdAt)}
                      </div>
                      {delivery.totalTime && (
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          Chegada aprox: {delivery.totalTime} min
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {delivery.totalPrice ? formatCurrency(parseFloat(delivery.totalPrice)) : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-blue-600"
                          onClick={() => handleViewDetails(delivery)}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-red-600"
                          onClick={() => handleCancelClick(delivery)}
                          title="Cancelar entrega"
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
                  {selectedDelivery.status === "scheduled" && selectedDelivery.scheduledAt && (
                    <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(selectedDelivery.scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
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
                {deliveryAccepted ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <p className="text-sm font-medium text-amber-900">
                        Atenção: Taxa de cancelamento
                      </p>
                    </div>
                    <p className="text-sm text-amber-700">
                      O entregador aceitou a entrega e já está em deslocamento. Para cancelar a entrega será cobrada a taxa de{" "}
                      {cancellationPreview?.isLoading ? (
                        <span className="italic">calculando...</span>
                      ) : cancellationPreview?.amount !== null && cancellationPreview?.amount !== undefined ? (
                        <>
                          <span className="font-semibold">{formatCurrency(cancellationPreview.amount)}</span>
                          {cancellationPreview.appliedPercentage && (
                            <> ({cancellationPreview.appliedPercentage}% do valor da entrega)</>
                          )}
                        </>
                      ) : (
                        <span className="font-semibold">taxa configurada</span>
                      )}
                      .
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-medium text-amber-900">
                    Tem certeza que deseja cancelar a entrega <span className="font-mono font-bold">{deliveryToCancel.requestNumber}</span>?
                  </p>
                )}
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

      {/* Modal de Nova Entrega */}
      <Dialog open={newDeliveryOpen} onOpenChange={setNewDeliveryOpen}>
        <DialogContent
          className="max-w-5xl h-[90vh] p-0 overflow-hidden flex flex-col"
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('.pac-container')) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>Nova Entrega</DialogTitle>
            <p className="text-sm text-slate-500">Preencha os dados da entrega para solicitar um motorista.</p>
          </DialogHeader>

          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
            {/* Left Column - Form */}
            <div className="overflow-y-auto p-6 space-y-8 bg-white border-r">

              {/* Pickup Address */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600 font-medium">
                  <MapPin className="h-4 w-4" />
                  <h3 className="text-sm uppercase tracking-wide">Endereço de Retirada</h3>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="pickupAddress" className="text-xs text-slate-500">Endereço</Label>
                    <Input
                      id="pickupAddress"
                      value={deliveryForm.pickupAddress}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, pickupAddress: e.target.value })
                      }
                      placeholder="Rua, Avenida..."
                      className="bg-slate-50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="pickupNumber" className="text-xs text-slate-500">Número</Label>
                      <Input
                        id="pickupNumber"
                        value={deliveryForm.pickupNumber}
                        onChange={(e) =>
                          setDeliveryForm({ ...deliveryForm, pickupNumber: e.target.value })
                        }
                        placeholder="123"
                        className="bg-slate-50"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pickupNeighborhood" className="text-xs text-slate-500">Bairro</Label>
                      <Input
                        id="pickupNeighborhood"
                        value={deliveryForm.pickupNeighborhood}
                        onChange={(e) =>
                          setDeliveryForm({ ...deliveryForm, pickupNeighborhood: e.target.value })
                        }
                        placeholder="Centro"
                        className="bg-slate-50"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="pickupReference" className="text-xs text-slate-500">Referência</Label>
                    <Input
                      id="pickupReference"
                      value={deliveryForm.pickupReference}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, pickupReference: e.target.value })
                      }
                      placeholder="Próximo ao..."
                      className="bg-slate-50"
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Delivery Address */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-green-600 font-medium">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <h3 className="text-sm uppercase tracking-wide">Endereços de Entrega</h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addDeliveryPoint}
                    className="h-7 w-7 p-0 rounded-full border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Point Cards */}
                {deliveryPoints.map((point, index) => (
                  <div key={point.id} className="border rounded-lg p-4 bg-slate-50/50 space-y-3 relative group">
                    {deliveryPoints.length > 1 && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDeliveryPoint(point.id)}
                          className="h-6 w-6 text-slate-400 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase">Ponto {index + 1}</span>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Nome do Cliente</Label>
                      <Input
                        value={point.customerName}
                        onChange={(e) => updateDeliveryPoint(point.id, "customerName", e.target.value)}
                        placeholder="Nome completo do cliente"
                        className="bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">WhatsApp (opcional)</Label>
                      <Input
                        value={point.customerWhatsapp}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          updateDeliveryPoint(point.id, "customerWhatsapp", value);
                        }}
                        placeholder="11999999999"
                        maxLength={11}
                        className="bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">CEP</Label>
                      <div className="flex gap-2">
                        <Input
                          ref={(el) => deliveryCepInputRefs.current[point.id] = el}
                          value={point.cep}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateDeliveryPoint(point.id, "cep", value);
                            if (value.replace(/\D/g, "").length === 8) {
                              handleCepLookup(point.id, value);
                            }
                          }}
                          placeholder="00000-000"
                          maxLength={9}
                          className="bg-white"
                        />
                        {lookingUpCep && (
                          <div className="flex items-center">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Endereço</Label>
                      <Input
                        ref={(el) => deliveryAddressInputRefs.current[point.id] = el}
                        value={point.address}
                        onChange={(e) => updateDeliveryPoint(point.id, "address", e.target.value)}
                        placeholder="Rua, Avenida..."
                        className="bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Número</Label>
                        <Input
                          value={point.number}
                          onChange={(e) => updateDeliveryPoint(point.id, "number", e.target.value)}
                          placeholder="123"
                          className="bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Bairro</Label>
                        <Input
                          value={point.neighborhood}
                          onChange={(e) => updateDeliveryPoint(point.id, "neighborhood", e.target.value)}
                          placeholder="Centro"
                          className="bg-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Referência</Label>
                      <Input
                        value={point.reference}
                        onChange={(e) => updateDeliveryPoint(point.id, "reference", e.target.value)}
                        placeholder="Próximo ao..."
                        className="bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Categoria do Veículo */}
              {deliveryPoints.some(point => point.address) && (
                <div className="space-y-3">
                  <h3 className="font-medium text-slate-700">Categoria do Veículo</h3>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Selecione a categoria</Label>
                    <Select
                      value={deliveryForm.vehicleTypeId}
                      onValueChange={(value) =>
                        setDeliveryForm({ ...deliveryForm, vehicleTypeId: value })
                      }
                    >
                      <SelectTrigger className="bg-slate-50">
                        <SelectValue placeholder="Escolha a categoria..." />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicleTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Options */}
              <div className="space-y-4 pt-2">
                <div className="bg-red-50 border border-red-100 p-4 rounded-lg flex items-start gap-3">
                  <Checkbox
                    id="needsReturn"
                    checked={deliveryForm.needsReturn}
                    onCheckedChange={(checked) => {
                      setDeliveryForm({ ...deliveryForm, needsReturn: checked as boolean });
                    }}
                    className="mt-1 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600 border-red-300"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="needsReturn" className="font-semibold text-red-900 flex items-center gap-2 cursor-pointer">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      Motorista precisa voltar após a entrega?
                    </Label>
                    <p className="text-xs text-red-700">Marque esta opção se o motorista precisar retornar ao ponto de retirada (ex: devolver maquininha, assinar documento).</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 px-1">
                  <Checkbox
                    id="isScheduled"
                    checked={deliveryForm.isScheduled}
                    onCheckedChange={(checked) => {
                      setDeliveryForm({
                        ...deliveryForm,
                        isScheduled: checked as boolean,
                        scheduledDate: checked ? deliveryForm.scheduledDate : null,
                        scheduledTime: checked ? deliveryForm.scheduledTime : "",
                      });
                    }}
                  />
                  <Label htmlFor="isScheduled" className="cursor-pointer font-medium text-slate-700">Agendar entrega?</Label>
                </div>

                {deliveryForm.isScheduled && (
                  <div className="space-y-3 pl-6 border-l-2 border-blue-200 ml-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Data do Agendamento</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal bg-slate-50",
                              !deliveryForm.scheduledDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {deliveryForm.scheduledDate ? (
                              format(deliveryForm.scheduledDate, "PPP", { locale: ptBR })
                            ) : (
                              <span>Selecione a data</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={deliveryForm.scheduledDate || undefined}
                            onSelect={(date) =>
                              setDeliveryForm({ ...deliveryForm, scheduledDate: date || null })
                            }
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Hora do Agendamento</Label>
                      <Input
                        type="time"
                        value={deliveryForm.scheduledTime}
                        onChange={(e) =>
                          setDeliveryForm({ ...deliveryForm, scheduledTime: e.target.value })
                        }
                        className="bg-slate-50"
                      />
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Right Column - Map */}
            <div className="bg-slate-100 flex flex-col relative overflow-hidden">
              {/* Route Info Header */}
              {routeInfo && (
                <div className="p-4 border-b bg-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Duração</p>
                        <p className="font-semibold text-slate-900">{routeInfo.duration}m</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Distância</p>
                        <p className="font-semibold text-slate-900">{routeInfo.distance.toFixed(1)} km</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Map Area */}
              <div className="flex-1 relative">
                {deliveryForm.vehicleTypeId ? (
                  <>
                    <div
                      ref={mapRef}
                      className="absolute inset-0 w-full h-full"
                    />
                    {calculatingRoute && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 z-10">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                          <span className="text-sm text-slate-600">Calculando rota...</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-8">
                    <div className="absolute inset-0 opacity-10"
                         style={{
                           backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                           backgroundSize: '20px 20px'
                         }}>
                    </div>

                    <div className="text-center space-y-4 max-w-sm relative z-10">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-6">
                        <MapPin className="h-8 w-8 text-slate-300" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-900">Visualização da Rota</h3>
                      <p className="text-sm text-slate-500">Preencha os endereços de retirada e entrega para visualizar o trajeto estimado no mapa.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t p-4 bg-slate-50 shrink-0 flex justify-between sm:justify-between items-center w-full">
            <Button
              variant="outline"
              onClick={() => setNewDeliveryOpen(false)}
              disabled={createDeliveryMutation.isPending}
              className="border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </Button>
            <div className="flex items-center gap-4">
              <div className="text-right mr-4 hidden sm:block">
                <span className="text-xs text-slate-500 block">Total Estimado</span>
                <span className="font-bold text-lg text-slate-900">
                  {routeInfo?.price
                    ? new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(routeInfo.price)
                    : "R$ 0,00"}
                </span>
              </div>
              <Button
                onClick={handleSubmitDelivery}
                disabled={createDeliveryMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]"
              >
                {createDeliveryMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Criar Entrega"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Saldo Insuficiente */}
      <AlertDialog open={insufficientBalanceOpen} onOpenChange={setInsufficientBalanceOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader className="text-center sm:text-center">
            <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <Wallet className="h-8 w-8 text-orange-600" />
            </div>
            <AlertDialogTitle className="text-xl">Saldo Insuficiente</AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-4">
              <p className="text-muted-foreground">
                Seu saldo atual não é suficiente para realizar esta entrega.
              </p>

              {balanceErrorDetails && (
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Saldo disponível:</span>
                    <span className="font-semibold text-red-600">R$ {balanceErrorDetails.available}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Valor necessário:</span>
                    <span className="font-semibold">R$ {balanceErrorDetails.required}</span>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                <p className="text-sm text-blue-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  Recarga mínima: <strong>R$ 50,00</strong>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col gap-2 mt-4">
            <AlertDialogAction
              onClick={() => {
                setInsufficientBalanceOpen(false);
                window.location.href = "/empresa/carteira";
              }}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Recarregar Agora
            </AlertDialogAction>
            <AlertDialogCancel className="w-full mt-0">
              Voltar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
