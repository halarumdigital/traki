import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator, MapPin, Loader2, DollarSign, Navigation, Info, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GoogleMap, useJsApiLoader, DirectionsRenderer, Libraries } from "@react-google-maps/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const libraries: Libraries = ["places"];

interface CompanyInfo {
  id: string;
  name: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
}

interface PriceEstimate {
  distanceKm: number;
  basePrice: number;
  pricePerKm: number;
  totalPrice: number;
  estimatedDuration: string;
  originAddress: string;
  destinationAddress: string;
}

const containerStyle = {
  width: "100%",
  height: "400px",
  borderRadius: "0.5rem",
};

function PrecificacaoContent({ apiKey }: { apiKey: string }) {
  const { toast } = useToast();
  const [destinationNeighborhood, setDestinationNeighborhood] = useState("");
  const [priceEstimate, setPriceEstimate] = useState<PriceEstimate | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: -15.7801, lng: -47.9292 });
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Buscar informações da empresa
  const { data: companyInfo, isLoading: isLoadingCompany } = useQuery<CompanyInfo>({
    queryKey: ["/api/empresa/auth/me"],
  });

  // Carregar Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    id: "google-map-script-pricing",
    libraries,
  });

  // Inicializar autocomplete quando a API estiver carregada
  useEffect(() => {
    if (isLoaded && inputRef.current && companyInfo?.city && !autocompleteRef.current) {
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        types: ["geocode"],
        componentRestrictions: { country: "br" },
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address) {
          setDestinationNeighborhood(place.formatted_address);
        }
      });

      autocompleteRef.current = autocomplete;
    }
  }, [isLoaded, companyInfo?.city]);

  // Atualizar centro do mapa quando tiver dados da empresa
  useEffect(() => {
    if (isLoaded && companyInfo?.city && companyInfo?.state) {
      const geocoder = new google.maps.Geocoder();
      const address = `${companyInfo.city}, ${companyInfo.state}, Brasil`;

      geocoder.geocode({ address }, (results, status) => {
        if (status === "OK" && results?.[0]?.geometry?.location) {
          setMapCenter({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng(),
          });
        }
      });
    }
  }, [isLoaded, companyInfo?.city, companyInfo?.state]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calculatePrice = useCallback(async () => {
    if (!companyInfo || !destinationNeighborhood) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, informe o bairro de destino",
      });
      return;
    }

    if (!isLoaded) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Google Maps ainda carregando...",
      });
      return;
    }

    setIsCalculating(true);
    setPriceEstimate(null);
    setDirections(null);

    try {
      // Montar endereço de origem da empresa
      const originAddress = `${companyInfo.street}, ${companyInfo.number}, ${companyInfo.neighborhood}, ${companyInfo.city}, ${companyInfo.state}, Brasil`;

      // Montar endereço de destino
      const destinationAddress = destinationNeighborhood.includes(companyInfo.city)
        ? destinationNeighborhood
        : `${destinationNeighborhood}, ${companyInfo.city}, ${companyInfo.state}, Brasil`;

      // Usar DirectionsService para calcular a rota
      const directionsService = new google.maps.DirectionsService();

      const result = await directionsService.route({
        origin: originAddress,
        destination: destinationAddress,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      if (result.routes.length > 0) {
        const route = result.routes[0];
        const leg = route.legs[0];

        // Distância em km (já adiciona 1 km de buffer)
        const distanceKm = ((leg.distance?.value || 0) / 1000) + 1;

        // Buscar configuração de preço da cidade
        const priceResponse = await fetch(`/api/empresa/price-estimate?distance=${distanceKm}`, {
          credentials: "include",
        });

        if (!priceResponse.ok) {
          throw new Error("Erro ao buscar configuração de preço");
        }

        const priceData = await priceResponse.json();

        // Tempo estimado - adicionar 5 minutos
        const durationText = leg.duration?.text || "N/A";
        let adjustedDuration = durationText;
        if (leg.duration?.value) {
          const totalMinutes = Math.ceil(leg.duration.value / 60) + 5;
          if (totalMinutes >= 60) {
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            adjustedDuration = mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
          } else {
            adjustedDuration = `${totalMinutes} min`;
          }
        }

        // Arredondar preço para cima
        const roundedPrice = Math.ceil(priceData.totalPrice);

        setDirections(result);
        setPriceEstimate({
          distanceKm: Math.round(distanceKm * 100) / 100,
          basePrice: priceData.basePrice,
          pricePerKm: priceData.pricePerKm,
          totalPrice: roundedPrice,
          estimatedDuration: adjustedDuration,
          originAddress: leg.start_address || originAddress,
          destinationAddress: leg.end_address || destinationAddress,
        });
      }
    } catch (error: any) {
      console.error("Erro ao calcular preço:", error);
      toast({
        variant: "destructive",
        title: "Erro ao calcular",
        description: error.message || "Não foi possível calcular o preço. Verifique o endereço informado.",
      });
    } finally {
      setIsCalculating(false);
    }
  }, [companyInfo, destinationNeighborhood, isLoaded, toast]);

  if (isLoadingCompany) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!companyInfo?.street || !companyInfo?.city) {
    return (
      <Alert variant="destructive" className="max-w-2xl">
        <Info className="h-4 w-4" />
        <AlertTitle>Endereço não configurado</AlertTitle>
        <AlertDescription>
          Seu endereço não está configurado. Por favor, atualize seus dados cadastrais para usar a precificação.
        </AlertDescription>
      </Alert>
    );
  }

  if (loadError) {
    return (
      <Alert variant="destructive" className="max-w-2xl">
        <Info className="h-4 w-4" />
        <AlertTitle>Erro ao carregar mapa</AlertTitle>
        <AlertDescription>
          Erro ao carregar o Google Maps. Por favor, tente novamente mais tarde.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Calculator className="h-6 w-6 text-slate-500" />
            Precificação
          </h1>
          <p className="text-slate-500">
            Calcule o valor aproximado de uma entrega para qualquer bairro da sua cidade
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          {/* Left Column - Information & Inputs */}
          <div className="space-y-6">
            {/* Inputs Container */}
            <div className="grid grid-cols-1 gap-4">
              {/* Card de origem */}
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium flex items-center gap-2 text-green-600">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Origem (Seu Endereço)
                  </CardTitle>
                  <CardDescription>Endereço cadastrado da sua empresa</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-50 p-4 rounded-md border border-slate-200 text-sm text-slate-700 font-medium">
                    <p>{companyInfo.name}</p>
                    <p className="text-slate-500 font-normal">
                      {companyInfo.street}, {companyInfo.number}
                    </p>
                    <p className="text-slate-500 font-normal">
                      {companyInfo.neighborhood} - {companyInfo.city}/{companyInfo.state}
                    </p>
                    {companyInfo.cep && (
                      <p className="text-slate-500 font-normal">
                        CEP: {companyInfo.cep}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Card de destino */}
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium flex items-center gap-2 text-red-500">
                    <Navigation className="w-4 h-4" />
                    Destino
                  </CardTitle>
                  <CardDescription>Informe o bairro ou endereço de destino</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="destination" className="text-xs font-medium text-slate-500">Bairro ou Endereço de Destino</Label>
                    <Input
                      ref={inputRef}
                      id="destination"
                      placeholder="Digite o nome do bairro ou endereço completo"
                      value={destinationNeighborhood}
                      onChange={(e) => setDestinationNeighborhood(e.target.value)}
                      className="bg-white"
                    />
                  </div>

                  <Button
                    onClick={calculatePrice}
                    disabled={isCalculating || !destinationNeighborhood || !isLoaded}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isCalculating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Calculando...
                      </>
                    ) : (
                      <>
                        <Calculator className="mr-2 h-4 w-4" />
                        Calcular Preço
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Estimate Section - Shows below inputs in left column */}
            {priceEstimate && (
              <Card className="shadow-sm border-slate-200 border-l-4 border-l-blue-500 bg-blue-50/10">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                    Estimativa de Preço
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                    <div className="flex flex-col items-center justify-center p-4 bg-blue-50 rounded-lg">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Distância</span>
                      <span className="text-xl font-bold text-blue-700 flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {priceEstimate.distanceKm} km
                      </span>
                    </div>

                    <div className="flex flex-col items-center justify-center p-4 bg-slate-100 rounded-lg">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Tempo</span>
                      <span className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {priceEstimate.estimatedDuration}
                      </span>
                    </div>

                    <div className="flex flex-col items-center justify-center p-4 bg-green-50 rounded-lg border border-green-100">
                      <span className="text-xs font-medium text-green-600 uppercase tracking-wider mb-1">Valor</span>
                      <span className="text-2xl font-bold text-green-600">
                        {formatCurrency(priceEstimate.totalPrice)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 p-3 bg-slate-50 rounded-md border border-slate-200 text-xs text-slate-500 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Info className="h-3 w-3" />
                      <span className="font-semibold">Detalhes do Cálculo:</span>
                    </div>
                    <p>De: {priceEstimate.originAddress}</p>
                    <p>Para: {priceEstimate.destinationAddress}</p>
                    <p className="mt-1 font-mono">
                      Cálculo: Tarifa base ({formatCurrency(priceEstimate.basePrice)}) + ({priceEstimate.distanceKm} km x {formatCurrency(priceEstimate.pricePerKm)}/km)
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Map */}
          {directions ? (
            <div className="h-full min-h-[500px] lg:min-h-full">
              <Card className="shadow-sm border-slate-200 overflow-hidden h-full flex flex-col">
                <CardHeader className="pb-4 border-b border-slate-100 bg-white shrink-0">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-500" />
                    Mapa da Rota
                  </CardTitle>
                </CardHeader>
                <div className="relative w-full flex-1 min-h-[400px]">
                  {isLoaded && (
                    <GoogleMap
                      mapContainerStyle={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
                      center={mapCenter}
                      zoom={13}
                      options={{
                        disableDefaultUI: false,
                        zoomControl: true,
                        mapTypeControl: true,
                        streetViewControl: false,
                        fullscreenControl: true,
                      }}
                    >
                      <DirectionsRenderer
                        directions={directions}
                        options={{
                          suppressMarkers: false,
                          polylineOptions: {
                            strokeColor: "#2563eb",
                            strokeWeight: 5,
                          },
                        }}
                      />
                    </GoogleMap>
                  )}
                </div>
              </Card>
            </div>
          ) : (
            <div className="h-full min-h-[300px] lg:min-h-full flex items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50">
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MapPin className="h-6 w-6 text-slate-300" />
                </div>
                <h3 className="text-sm font-medium text-slate-900">Mapa Indisponível</h3>
                <p className="text-xs text-slate-500 mt-1">Calcule uma rota para visualizar o mapa</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

export default function EmpresaPrecificacao() {
  // Buscar API key do Google Maps
  const { data: apiKeyData, isLoading: isLoadingApiKey, error: apiKeyError } = useQuery<{ apiKey: string }>({
    queryKey: ["/api/settings/google-maps-key"],
    queryFn: async () => {
      const response = await fetch("/api/settings/google-maps-key", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("API key não configurada");
      }
      return response.json();
    },
  });

  if (isLoadingApiKey) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (apiKeyError || !apiKeyData?.apiKey) {
    return (
      <Alert variant="destructive" className="max-w-2xl">
        <Info className="h-4 w-4" />
        <AlertTitle>Configuração necessária</AlertTitle>
        <AlertDescription>
          Chave da API do Google Maps não configurada. Entre em contato com o administrador.
        </AlertDescription>
      </Alert>
    );
  }

  return <PrecificacaoContent apiKey={apiKeyData.apiKey} />;
}
