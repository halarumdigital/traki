import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, MapPin, Loader2, DollarSign, Navigation, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Libraries } from "@react-google-maps/api";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!companyInfo?.street || !companyInfo?.city) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Seu endereço não está configurado. Por favor, atualize seus dados cadastrais para usar a precificação.
        </AlertDescription>
      </Alert>
    );
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Erro ao carregar o Google Maps. Por favor, tente novamente mais tarde.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Calculator className="h-8 w-8" />
          Precificação
        </h1>
        <p className="text-muted-foreground mt-2">
          Calcule o valor aproximado de uma entrega para qualquer bairro da sua cidade
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card de origem */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-600" />
              Origem (Seu Endereço)
            </CardTitle>
            <CardDescription>
              Endereço cadastrado da sua empresa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{companyInfo.name}</p>
              <p className="text-sm text-muted-foreground">
                {companyInfo.street}, {companyInfo.number}
              </p>
              <p className="text-sm text-muted-foreground">
                {companyInfo.neighborhood} - {companyInfo.city}/{companyInfo.state}
              </p>
              {companyInfo.cep && (
                <p className="text-sm text-muted-foreground">
                  CEP: {companyInfo.cep}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card de destino */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-red-600" />
              Destino
            </CardTitle>
            <CardDescription>
              Informe o bairro ou endereço de destino
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="destination">Bairro ou Endereço de Destino</Label>
              <Input
                ref={inputRef}
                id="destination"
                placeholder={`Ex: Centro, ${companyInfo.city}`}
                value={destinationNeighborhood}
                onChange={(e) => setDestinationNeighborhood(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Digite o nome do bairro ou endereço completo
              </p>
            </div>

            <Button
              onClick={calculatePrice}
              disabled={isCalculating || !destinationNeighborhood || !isLoaded}
              className="w-full"
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

      {/* Resultado do cálculo */}
      {priceEstimate && (
        <Card className="border-2 border-primary">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Estimativa de Preço
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Distância</p>
                <p className="text-2xl font-bold text-blue-600">{priceEstimate.distanceKm} km</p>
              </div>

              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Tempo</p>
                <p className="text-2xl font-bold">{priceEstimate.estimatedDuration}</p>
              </div>

              <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Valor</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(priceEstimate.totalPrice)}
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p><strong>De:</strong> {priceEstimate.originAddress}</p>
                  <p><strong>Para:</strong> {priceEstimate.destinationAddress}</p>
                  <p className="mt-2">
                    Cálculo: Tarifa base ({formatCurrency(priceEstimate.basePrice)}) +
                    ({priceEstimate.distanceKm} km x {formatCurrency(priceEstimate.pricePerKm)}/km)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mapa */}
      {isLoaded && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Mapa da Rota
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={mapCenter}
              zoom={13}
            >
              {directions && (
                <DirectionsRenderer
                  directions={directions}
                  options={{
                    suppressMarkers: false,
                    polylineOptions: {
                      strokeColor: "#3b82f6",
                      strokeWeight: 4,
                    },
                  }}
                />
              )}
            </GoogleMap>
          </CardContent>
        </Card>
      )}
    </div>
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (apiKeyError || !apiKeyData?.apiKey) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Chave da API do Google Maps não configurada. Entre em contato com o administrador.
        </AlertDescription>
      </Alert>
    );
  }

  return <PrecificacaoContent apiKey={apiKeyData.apiKey} />;
}
