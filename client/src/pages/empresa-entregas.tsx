import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Clock, User, DollarSign, Package, MapPin, Loader2, X, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Função para formatar datas no horário de Brasília (sem conversão de timezone)
const formatBrazilianDateTime = (date: string | Date) => {
  const d = new Date(date);
  return format(d, 'dd/MM/yyyy, HH:mm', { locale: ptBR });
};
import "@/styles/google-maps-fix.css";

interface Delivery {
  id: string;
  requestNumber: string;
  customerName: string | null;
  createdAt: string;
  driverName: string | null;
  status: string;
  totalPrice: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  totalDistance: string | null;  // Distância em metros
  totalTime: string | null;  // Tempo do Google Maps
  estimatedTime: string | null;  // Tempo estimado (Google Maps + 5 min)
  distance: string | null;  // Compatibilidade retroativa
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  accepted: { label: "Aceita", color: "bg-blue-100 text-blue-700" },
  arrived_pickup: { label: "Cheguei para retirada", color: "bg-purple-100 text-purple-700" },
  arrived: { label: "Motorista chegou", color: "bg-purple-100 text-purple-700" },
  in_progress: { label: "Em andamento", color: "bg-orange-100 text-orange-700" },
  completed: { label: "Completa", color: "bg-green-600 text-white" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-700" },
};

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
  cep: string | null;
  reference: string | null;
}

export default function EmpresaEntregas() {
  const { toast } = useToast();
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [newDeliveryOpen, setNewDeliveryOpen] = useState(false);

  // Form state
  const [deliveryForm, setDeliveryForm] = useState({
    // Pickup address (will be pre-filled from company)
    pickupAddress: "",
    pickupNumber: "",
    pickupNeighborhood: "",
    pickupReference: "",
    // Category
    vehicleTypeId: "",
  });

  // Delivery points (multiple stops)
  const [deliveryPoints, setDeliveryPoints] = useState([
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
    }
  ]);

  // Control which accordion item is open
  const [openAccordionItem, setOpenAccordionItem] = useState<string>("1");

  const [lookingUpCep, setLookingUpCep] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{
    distance: number;
    duration: number;
    price: number | null;
  } | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  // Refs for delivery points inputs (using Record to store multiple refs)
  const deliveryAddressInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const deliveryCepInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const autocompleteRefs = useRef<Record<number, google.maps.places.Autocomplete | null>>({});
  const autocompleteCepRefs = useRef<Record<number, google.maps.places.Autocomplete | null>>({});

  const { data: deliveries = [], isLoading } = useQuery<Delivery[]>({
    queryKey: ["/api/empresa/deliveries"],
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

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

  // Socket.IO - Conectar e escutar eventos em tempo real
  const { isConnected, on } = useSocket({
    companyId: companyData?.id,
    autoConnect: !!companyData?.id,
  });

  // Listeners de eventos Socket.IO
  useEffect(() => {
    if (!isConnected) return;

    // Evento: Motorista aceitou a entrega
    on("delivery-accepted", (data: any) => {
      console.log("🎉 Entrega aceita pelo motorista:", data);

      toast({
        title: "Entrega aceita!",
        description: `${data.driverName || "Um motorista"} aceitou a entrega #${data.requestNumber}`,
      });

      // Invalidar queries para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/deliveries"] });
    });

    // Evento: Status da entrega foi atualizado
    on("delivery-status-updated", (data: any) => {
      console.log("📦 Status da entrega atualizado:", data);

      const statusMessages: Record<string, string> = {
        arrived: "Motorista chegou no local de retirada",
        picked_up: "Motorista coletou a entrega",
        delivered: "Entrega realizada com sucesso",
        completed: "Entrega finalizada",
      };

      const message = statusMessages[data.status] || "Status atualizado";

      toast({
        title: `Entrega #${data.requestNumber}`,
        description: message,
      });

      // Invalidar queries para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/deliveries"] });
    });

    // Cleanup: remover listeners ao desmontar
    return () => {
      // Nota: o hook já faz cleanup da conexão
    };
  }, [isConnected, on, toast]);

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
      // Clear all autocompletes when modal closes
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

    // Wait for accordion to be fully rendered
    const timer = setTimeout(() => {
      const pointId = parseInt(openAccordionItem);
      const addressInput = deliveryAddressInputRefs.current[pointId];
      const cepInput = deliveryCepInputRefs.current[pointId];

      // Clean up existing autocomplete for this point before creating new ones
      if (autocompleteRefs.current[pointId]) {
        google.maps.event.clearInstanceListeners(autocompleteRefs.current[pointId]);
        delete autocompleteRefs.current[pointId];
      }
      if (autocompleteCepRefs.current[pointId]) {
        google.maps.event.clearInstanceListeners(autocompleteCepRefs.current[pointId]);
        delete autocompleteCepRefs.current[pointId];
      }

      // Setup address autocomplete
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

      // Setup CEP autocomplete
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

  // Add delivery point
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
    // Open the newly added accordion item
    setOpenAccordionItem(newId.toString());
  };

  // Remove delivery point
  const removeDeliveryPoint = (id: number) => {
    if (deliveryPoints.length > 1) {
      setDeliveryPoints(deliveryPoints.filter(p => p.id !== id));
      // Clean up refs
      delete deliveryAddressInputRefs.current[id];
      delete deliveryCepInputRefs.current[id];
      delete autocompleteRefs.current[id];
      delete autocompleteCepRefs.current[id];
    }
  };

  // Update delivery point
  const updateDeliveryPoint = (id: number, field: string, value: string) => {
    setDeliveryPoints(prev => prev.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  // Pre-fill pickup address from company data when modal opens
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

  const handleViewDetails = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setViewDialogOpen(true);
  };

  const handleCepLookup = async (pointId: number, cep: string) => {
    // Remove non-numeric characters
    const cleanCep = cep.replace(/\D/g, "");

    if (cleanCep.length !== 8) {
      return;
    }

    setLookingUpCep(true);
    try {
      // Using ViaCEP API
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

      // Update delivery point with address from ViaCEP
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
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/deliveries"] });
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

  const relaunchDeliveryMutation = useMutation({
    mutationFn: async (deliveryId: string) => {
      return await apiRequest("POST", `/api/empresa/deliveries/${deliveryId}/relaunch`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/deliveries"] });
      toast({
        title: "Entrega relançada com sucesso!",
        description: "A entrega foi relançada e está aguardando um motorista.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao relançar entrega",
        description: error.message || "Ocorreu um erro ao relançar a entrega.",
      });
    },
  });

  const calculateRoute = async () => {
    // Check if we have at least one delivery point with address
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
      // Build pickup address - use company data if available
      const pickupCity = companyData?.city || "";
      const pickupState = companyData?.state || "";
      const pickupFullAddress = `${deliveryForm.pickupAddress}, ${deliveryForm.pickupNumber || "S/N"}, ${deliveryForm.pickupNeighborhood}${pickupCity ? `, ${pickupCity}` : ""}${pickupState ? ` - ${pickupState}` : ""}, Brasil`;

      // Build full addresses for all valid delivery points with city and state
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

      // For multiple points: origin -> waypoints -> destination
      // If only one point: origin -> destination
      const origin = pickupFullAddress;
      const destination = deliveryAddresses[deliveryAddresses.length - 1];
      const waypoints = deliveryAddresses.slice(0, -1).map(address => ({
        location: address,
        stopover: true,
      }));

      // Initialize map
      if (mapRef.current) {
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: -23.5505, lng: -46.6333 },
          zoom: 12,
        });
        mapInstanceRef.current = map;

        // Get directions with waypoints
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
          suppressMarkers: true, // Desabilitar marcadores padrão para adicionar customizados
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

              // Adicionar marcadores customizados para todos os pontos
              const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

              // Marcador de retirada (A)
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

              // Marcadores dos pontos intermediários (waypoints)
              response.routes[0].legs.forEach((leg, index) => {
                if (index < response.routes[0].legs.length - 1) {
                  // Marcadores B, C, D... para waypoints
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

              // Marcador final (última entrega)
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

              // Calculate total distance and duration from all legs
              let totalDistance = 0;
              let totalDuration = 0;

              response.routes[0].legs.forEach((leg) => {
                console.log(`Leg distance: ${leg.distance?.value}m (${leg.distance?.text})`);
                totalDistance += leg.distance?.value || 0;
                totalDuration += leg.duration?.value || 0;
              });

              console.log(`Total distance from API: ${totalDistance}m (${totalDistance / 1000}km)`);

              // Arredondar distância para cima (próximo 0.5 km) para ficar consistente com Google Maps
              const exactDistanceKm = totalDistance / 1000;
              const distanceInKm = Math.ceil(exactDistanceKm * 2) / 2; // Arredonda para 0.5, 1.0, 1.5, 2.0, etc
              const durationInMinutes = Math.ceil(totalDuration / 60);

              console.log(`Distance rounded for pricing: ${distanceInKm}km (from ${exactDistanceKm}km)`);

              // Calcular preço usando a API com base na tabela city_prices
              try {
                console.log("Calculating price with:", { vehicleTypeId: deliveryForm.vehicleTypeId, distanceKm: distanceInKm, durationMinutes: durationInMinutes });
                const res = await apiRequest("POST", "/api/empresa/calculate-price", {
                  vehicleTypeId: deliveryForm.vehicleTypeId,
                  distanceKm: distanceInKm,
                  durationMinutes: durationInMinutes,
                });

                const priceResponse = await res.json();

                console.log("Price response:", priceResponse);

                setRouteInfo({
                  distance: distanceInKm,
                  duration: durationInMinutes,
                  price: parseFloat(priceResponse.totalPrice),
                });

                console.log("Route info set with price:", parseFloat(priceResponse.totalPrice));
              } catch (priceError: any) {
                console.error("Erro ao calcular preço:", priceError);
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
      console.error("Erro ao calcular rota:", error);
      toast({
        variant: "destructive",
        title: "Erro ao calcular rota",
        description: "Ocorreu um erro ao calcular a rota.",
      });
    } finally {
      setCalculatingRoute(false);
    }
  };

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

  // Function to geocode an address and get lat/lng
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
          console.error('Geocoding failed for address:', address, 'Status:', status);
          resolve(null);
        }
      });
    });
  };

  const handleSubmitDelivery = async () => {
    // Validation
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

    // Validar se o cálculo da rota foi concluído
    if (!routeInfo || !routeInfo.price || routeInfo.price <= 0 || !routeInfo.distance || routeInfo.distance <= 0 || !routeInfo.duration || routeInfo.duration <= 0) {
      toast({
        variant: "destructive",
        title: "Cálculo de rota pendente",
        description: "Por favor, aguarde o cálculo da distância e valor da entrega antes de criar.",
      });
      return;
    }

    // Build pickup address with city and state
    const pickupCity = companyData?.city || "";
    const pickupState = companyData?.state || "";
    const pickupFullAddress = `${deliveryForm.pickupAddress}, ${deliveryForm.pickupNumber || "S/N"}, ${deliveryForm.pickupNeighborhood}${pickupCity ? `, ${pickupCity}` : ""}${pickupState ? ` - ${pickupState}` : ""}, Brasil`;

    // Get all delivery points
    const validDeliveryPoints = deliveryPoints.filter(point => point.address);

    // Build all delivery addresses with city and state
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

    // Join all delivery addresses with separator (for display only)
    const allDeliveryAddresses = deliveryAddresses.map((addr, idx) =>
      `${validDeliveryPoints[idx].address}, ${validDeliveryPoints[idx].number || "S/N"} - ${validDeliveryPoints[idx].neighborhood}`
    ).join(" | ");

    // Geocode pickup address
    console.log('🔍 Geocodificando endereço de retirada:', pickupFullAddress);
    const pickupCoords = await geocodeAddress(pickupFullAddress);

    if (!pickupCoords) {
      toast({
        variant: "destructive",
        title: "Erro na geocodificação",
        description: "Não foi possível obter as coordenadas do endereço de retirada. Verifique se o endereço está completo e correto.",
      });
      return;
    }

    console.log('✅ Coordenadas de retirada:', pickupCoords);

    // Geocode first delivery address (use the most complete one)
    console.log('🔍 Geocodificando endereço de entrega:', deliveryAddresses[0]);
    const dropoffCoords = await geocodeAddress(deliveryAddresses[0]);

    if (!dropoffCoords) {
      toast({
        variant: "destructive",
        title: "Erro na geocodificação",
        description: "Não foi possível obter as coordenadas do endereço de entrega. Verifique se o endereço está completo e correto.",
      });
      return;
    }

    console.log('✅ Coordenadas de entrega:', dropoffCoords);

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Entregas</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie suas solicitações de entrega
          </p>
        </div>
        <Button onClick={handleNewDelivery}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Entrega
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Minhas Entregas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Carregando entregas...</div>
          ) : deliveries.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Você ainda não possui entregas cadastradas
              </p>
              <Button onClick={handleNewDelivery}>
                <Plus className="mr-2 h-4 w-4" />
                Solicitar Nova Entrega
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Entregador</TableHead>
                  <TableHead>Previsão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((delivery) => (
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
                        <span className="text-muted-foreground italic">
                          Aguardando motorista
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {delivery.estimatedTime ? (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {delivery.estimatedTime} min
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
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
                      <div className="flex items-center justify-end gap-2">
                        {delivery.status === 'cancelled' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => relaunchDeliveryMutation.mutate(delivery.id)}
                            disabled={relaunchDeliveryMutation.isPending}
                          >
                            {relaunchDeliveryMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            <span className="ml-1">Relançar</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(delivery)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes da Entrega */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Entrega</DialogTitle>
          </DialogHeader>
          {selectedDelivery && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Número da Entrega</label>
                  <p className="font-mono text-sm">{selectedDelivery.requestNumber}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge
                      className={
                        statusMap[selectedDelivery.status]?.color ||
                        "bg-gray-100 text-gray-700"
                      }
                    >
                      {statusMap[selectedDelivery.status]?.label ||
                        selectedDelivery.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Nome do Cliente</label>
                <p>{selectedDelivery.customerName || "-"}</p>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">
                  Endereço de Retirada
                </label>
                <p>{selectedDelivery.pickupAddress || "-"}</p>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">
                  {selectedDelivery.dropoffAddress?.includes(" | ") ? "Endereços de Entrega" : "Endereço de Entrega"}
                </label>
                {selectedDelivery.dropoffAddress?.includes(" | ") ? (
                  <div className="space-y-2">
                    {selectedDelivery.dropoffAddress.split(" | ").map((address, index) => (
                      <p key={index}>
                        <span className="font-semibold">Entrega {index + 1}:</span> {address}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p>{selectedDelivery.dropoffAddress || "-"}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Entregador</label>
                  <p>{selectedDelivery.driverName || "Aguardando"}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Distância</label>
                  <p>
                    {selectedDelivery.totalDistance
                      ? `${(parseFloat(selectedDelivery.totalDistance) / 1000).toFixed(2)} km`
                      : "-"}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Tempo Estimado</label>
                  <p>
                    {selectedDelivery.estimatedTime
                      ? `${selectedDelivery.estimatedTime} min`
                      : "-"}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Valor</label>
                  <p className="font-semibold text-green-600">
                    {selectedDelivery.totalPrice
                      ? new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(parseFloat(selectedDelivery.totalPrice))
                      : "-"}
                  </p>
                </div>
              </div>

              {/* Observações de cancelamento */}
              {selectedDelivery.cancelReason && (
                <div className="pt-4 border-t">
                  <label className="text-sm text-muted-foreground">Motivo do Cancelamento</label>
                  <div className="p-3 bg-muted rounded-md mt-2">
                    <p className="text-sm whitespace-pre-wrap">{selectedDelivery.cancelReason}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Nova Entrega */}
      <Dialog open={newDeliveryOpen} onOpenChange={setNewDeliveryOpen}>
        <DialogContent
          className="max-w-7xl max-h-[90vh] p-0"
          onInteractOutside={(e) => {
            // Prevent dialog from closing when clicking on Google Places autocomplete
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
                                // Auto-lookup when 8 digits are entered
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
