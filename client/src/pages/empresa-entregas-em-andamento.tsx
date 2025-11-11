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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, User, MapPin, Truck, Loader2, CalendarIcon, Search, X, ChevronLeft, ChevronRight, Plus, XCircle, Clock, Package, RefreshCw, Ban } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  cancellationFeePercentage: string | null;
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
  accepted: { label: "Aceito", color: "bg-blue-100 text-blue-700" },
  arrived_pickup: { label: "Cheguei para retirada", color: "bg-cyan-100 text-cyan-700" },
  in_progress: { label: "Em Andamento", color: "bg-purple-100 text-purple-700" },
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
  const [deliveryForm, setDeliveryForm] = useState({
    pickupAddress: "",
    pickupNumber: "",
    pickupNeighborhood: "",
    pickupReference: "",
    vehicleTypeId: "",
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/deliveries/in-progress"] });
      toast({
        title: "Entrega criada com sucesso!",
        description: "A entrega foi registrada e está aguardando um motorista.",
      });
      setNewDeliveryOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar entrega",
        description: error.message || "Ocorreu um erro ao criar a entrega.",
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
                });

                const priceResponse = await res.json();

                setRouteInfo({
                  distance: distanceInKm,
                  duration: durationInMinutes,
                  price: parseFloat(priceResponse.totalPrice),
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

    const allDeliveryAddresses = deliveryAddresses.map((addr, idx) =>
      `${validDeliveryPoints[idx].address}, ${validDeliveryPoints[idx].number || "S/N"} - ${validDeliveryPoints[idx].neighborhood}`
    ).join(" | ");

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
      });
      setDeliveryPoints([{
        id: 1,
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
      hasDeliveryPoint &&
      deliveryForm.vehicleTypeId &&
      window.google?.maps
    ) {
      calculateRoute();
    }
  }, [deliveryForm.vehicleTypeId, deliveryPoints]);

  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-6 w-6" />
              Entregas em Andamento
            </CardTitle>
            <Button className="gap-2" onClick={handleNewDelivery}>
              <Plus className="h-4 w-4" />
              Nova Entrega
            </Button>
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
                  {deliveryAccepted ? (
                    <>
                      A entrega já foi aceita pelo entregador{" "}
                      <span className="font-semibold">{deliveryToCancel.driverName || "o entregador"}</span>.{" "}
                      {renderCancellationFeeDescription()}
                    </>
                  ) : (
                    "Você não terá custo pois ela ainda não foi aceita."
                  )}
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

      {/* Modal de Nova Entrega */}
      <Dialog open={newDeliveryOpen} onOpenChange={setNewDeliveryOpen}>
        <DialogContent
          className="max-w-7xl max-h-[90vh] p-0"
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('.pac-container')) {
              e.preventDefault();
            }
          }}
        >
          <div className="grid grid-cols-[400px_1fr] h-[90vh]">
            {/* Left Side - Form */}
            <div className="border-r overflow-y-auto p-6 space-y-6">
              <div>
                <DialogHeader>
                  <DialogTitle>Nova Entrega</DialogTitle>
                </DialogHeader>
              </div>

              {/* Endereço de Retirada */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Endereço de Retirada</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="pickupAddress" className="text-xs">Endereço</Label>
                    <Input
                      id="pickupAddress"
                      value={deliveryForm.pickupAddress}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, pickupAddress: e.target.value })
                      }
                      placeholder="Rua, Avenida..."
                      className="h-9"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="pickupNumber" className="text-xs">Número</Label>
                      <Input
                        id="pickupNumber"
                        value={deliveryForm.pickupNumber}
                        onChange={(e) =>
                          setDeliveryForm({ ...deliveryForm, pickupNumber: e.target.value })
                        }
                        placeholder="123"
                        className="h-9"
                      />
                    </div>

                    <div>
                      <Label htmlFor="pickupNeighborhood" className="text-xs">Bairro</Label>
                      <Input
                        id="pickupNeighborhood"
                        value={deliveryForm.pickupNeighborhood}
                        onChange={(e) =>
                          setDeliveryForm({ ...deliveryForm, pickupNeighborhood: e.target.value })
                        }
                        placeholder="Centro"
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="pickupReference" className="text-xs">Referência</Label>
                    <Input
                      id="pickupReference"
                      value={deliveryForm.pickupReference}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, pickupReference: e.target.value })
                      }
                      placeholder="Próximo ao..."
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Endereços de Entrega */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <h3 className="font-semibold">Endereços de Entrega</h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addDeliveryPoint}
                    className="h-7"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                <Accordion
                  type="single"
                  collapsible
                  value={openAccordionItem}
                  onValueChange={setOpenAccordionItem}
                >
                  {deliveryPoints.map((point, index) => (
                    <AccordionItem key={point.id} value={point.id.toString()} className="border rounded-lg px-3 mb-2">
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center justify-between w-full pr-2">
                          <span className="text-sm font-medium">
                            Ponto {index + 1}
                            {point.address && ` - ${point.address.substring(0, 30)}${point.address.length > 30 ? '...' : ''}`}
                          </span>
                          {deliveryPoints.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeDeliveryPoint(point.id);
                              }}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pb-4">
                        <div>
                          <Label htmlFor={`customerName-${point.id}`} className="text-xs">Nome do Cliente</Label>
                          <Input
                            id={`customerName-${point.id}`}
                            value={point.customerName}
                            onChange={(e) => updateDeliveryPoint(point.id, "customerName", e.target.value)}
                            placeholder="Nome completo do cliente"
                            className="h-9"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`customerWhatsapp-${point.id}`} className="text-xs">WhatsApp (opcional)</Label>
                          <Input
                            id={`customerWhatsapp-${point.id}`}
                            value={point.customerWhatsapp}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              updateDeliveryPoint(point.id, "customerWhatsapp", value);
                            }}
                            placeholder="11999999999"
                            maxLength={11}
                            className="h-9"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`deliveryCep-${point.id}`} className="text-xs">CEP</Label>
                          <div className="flex gap-2">
                            <Input
                              ref={(el) => deliveryCepInputRefs.current[point.id] = el}
                              id={`deliveryCep-${point.id}`}
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
                              className="h-9"
                            />
                            {lookingUpCep && (
                              <div className="flex items-center">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label htmlFor={`deliveryAddress-${point.id}`} className="text-xs">Endereço</Label>
                          <Input
                            ref={(el) => deliveryAddressInputRefs.current[point.id] = el}
                            id={`deliveryAddress-${point.id}`}
                            value={point.address}
                            onChange={(e) => updateDeliveryPoint(point.id, "address", e.target.value)}
                            placeholder="Rua, Avenida..."
                            className="h-9"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor={`deliveryNumber-${point.id}`} className="text-xs">Número</Label>
                            <Input
                              id={`deliveryNumber-${point.id}`}
                              value={point.number}
                              onChange={(e) => updateDeliveryPoint(point.id, "number", e.target.value)}
                              placeholder="123"
                              className="h-9"
                            />
                          </div>

                          <div>
                            <Label htmlFor={`deliveryNeighborhood-${point.id}`} className="text-xs">Bairro</Label>
                            <Input
                              id={`deliveryNeighborhood-${point.id}`}
                              value={point.neighborhood}
                              onChange={(e) => updateDeliveryPoint(point.id, "neighborhood", e.target.value)}
                              placeholder="Centro"
                              className="h-9"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor={`deliveryReference-${point.id}`} className="text-xs">Referência</Label>
                          <Input
                            id={`deliveryReference-${point.id}`}
                            value={point.reference}
                            onChange={(e) => updateDeliveryPoint(point.id, "reference", e.target.value)}
                            placeholder="Próximo ao..."
                            className="h-9"
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              {/* Categoria do Veículo */}
              {deliveryPoints.some(point => point.address) && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Categoria do Veículo</h3>
                  <div>
                    <Label htmlFor="vehicleType" className="text-xs">Selecione a categoria</Label>
                    <Select
                      value={deliveryForm.vehicleTypeId}
                      onValueChange={(value) =>
                        setDeliveryForm({ ...deliveryForm, vehicleTypeId: value })
                      }
                    >
                      <SelectTrigger id="vehicleType" className="h-9">
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

              {/* Botões de Ação */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setNewDeliveryOpen(false)}
                  disabled={createDeliveryMutation.isPending}
                  className="flex-1 h-9"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmitDelivery}
                  disabled={createDeliveryMutation.isPending}
                  className="flex-1 h-9"
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

            {/* Right Side - Map */}
            <div className="relative flex flex-col">
              {/* Route Info Header */}
              {routeInfo && (
                <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Duração</p>
                        <p className="font-semibold">{routeInfo.duration}m</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Distância</p>
                        <p className="font-semibold">{routeInfo.distance.toFixed(1)} km</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Valor Total</p>
                        <p className="font-semibold text-green-600">
                          {routeInfo.price
                            ? new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(routeInfo.price)
                            : "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Map */}
              <div className="flex-1 relative">
                {deliveryForm.vehicleTypeId ? (
                  <>
                    <div
                      ref={mapRef}
                      className="absolute inset-0 w-full h-full"
                    />
                    {calculatingRoute && (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">Calculando rota...</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                    <div className="text-center text-muted-foreground">
                      <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Preencha os endereços e selecione a categoria</p>
                      <p className="text-xs">para visualizar a rota no mapa</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
