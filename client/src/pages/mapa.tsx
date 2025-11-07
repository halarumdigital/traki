import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Libraries } from "@react-google-maps/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Circle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Definir libraries fora do componente para evitar re-criação
const libraries: Libraries = ["places"];

interface Cidade {
  id: string;
  name: string;
  state: string;
  latitude: string | null;
  longitude: string | null;
  active: boolean;
}

interface Motorista {
  id: string;
  name: string;
  email: string;
  phone: string;
  available: boolean;
  approve: boolean;
  active: boolean;
  currentLatitude: number | null;
  currentLongitude: number | null;
  cityId: string | null;
  // Status de entrega (assumindo que existe um campo para isso)
  onDelivery?: boolean;
}

interface Configuracao {
  googleMapsApiKey: string | null;
}

const containerStyle = {
  width: "100%",
  height: "calc(100vh - 200px)",
};

// Cores dos pins
const getPinColor = (motorista: Motorista) => {
  if (motorista.onDelivery) return "#ef4444"; // vermelho - em entrega
  if (motorista.available) return "#22c55e"; // verde - online
  return "#9ca3af"; // cinza - offline
};

const getStatusLabel = (motorista: Motorista) => {
  if (motorista.onDelivery) return "Em Entrega";
  if (motorista.available) return "Online";
  return "Offline";
};

const getStatusVariant = (motorista: Motorista): "default" | "secondary" | "destructive" => {
  if (motorista.onDelivery) return "destructive";
  if (motorista.available) return "default";
  return "secondary";
};

// Componente interno do mapa que só é renderizado quando a API key está disponível
function MapaContent({ apiKey }: { apiKey: string }) {
  const [selectedCityId, setSelectedCityId] = useState<string>("all");
  const [selectedMotorista, setSelectedMotorista] = useState<Motorista | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: -15.7801, lng: -47.9292 }); // Brasília default

  // Buscar cidades
  const { data: cidades = [], isLoading: isLoadingCidades, error: errorCidades } = useQuery<Cidade[]>({
    queryKey: ["/api/service-locations"],
  });

  // Debug: Log das cidades carregadas
  useEffect(() => {
    console.log("🗺️ Cidades carregadas:", cidades);
    console.log("🗺️ Total de cidades:", cidades.length);
    if (errorCidades) {
      console.error("❌ Erro ao carregar cidades:", errorCidades);
    }
  }, [cidades, errorCidades]);

  // Buscar motoristas
  const { data: allMotoristas = [], isLoading: isLoadingMotoristas } = useQuery<Motorista[]>({
    queryKey: ["/api/drivers"],
  });

  // Filtrar motoristas por cidade selecionada
  const motoristas = useMemo(() => {
    if (!selectedCityId || selectedCityId === "all") return allMotoristas;
    return allMotoristas.filter((m) => m.cityId === selectedCityId);
  }, [allMotoristas, selectedCityId]);

  // Carregar Google Maps API - agora com API key fixa
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    id: "google-map-script",
    libraries,
  });

  // Handler para mudança de cidade
  const handleCityChange = useCallback((cityId: string) => {
    setSelectedCityId(cityId);
    setSelectedMotorista(null);

    if (cityId && cityId !== "all") {
      const cidade = cidades.find((c) => c.id === cityId);
      if (cidade && cidade.latitude && cidade.longitude) {
        // Converte string para number
        const lat = parseFloat(cidade.latitude);
        const lng = parseFloat(cidade.longitude);

        if (!isNaN(lat) && !isNaN(lng)) {
          setMapCenter({ lat, lng });
        }
      }
    } else {
      // Voltar para o centro padrão (Brasília)
      setMapCenter({ lat: -15.7801, lng: -47.9292 });
    }
  }, [cidades]);

  // Criar SVG customizado para o pin
  const createMarkerIcon = (color: string) => {
    return {
      path: "M12 0C7.58 0 4 3.58 4 8c0 5.5 8 13 8 13s8-7.5 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z",
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
      scale: 2,
    };
  };

  if (loadError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mapa de Motoristas</h1>
            <p className="text-muted-foreground">Visualize a localização dos motoristas em tempo real</p>
          </div>
        </div>

        <Alert variant="destructive">
          <AlertDescription>
            Erro ao carregar Google Maps. Verifique se a API Key está correta nas configurações.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mapa de Motoristas</h1>
          <p className="text-muted-foreground">Visualize a localização dos motoristas em tempo real</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filtrar por Cidade</CardTitle>
              <CardDescription>Selecione uma cidade para visualizar os motoristas</CardDescription>
            </div>

            {/* Legenda de cores */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Circle className="h-4 w-4 fill-green-500 text-green-500" />
                <span className="text-sm text-muted-foreground">Online</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="h-4 w-4 fill-gray-400 text-gray-400" />
                <span className="text-sm text-muted-foreground">Offline</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="h-4 w-4 fill-red-500 text-red-500" />
                <span className="text-sm text-muted-foreground">Em Entrega</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Select value={selectedCityId} onValueChange={handleCityChange} disabled={isLoadingCidades}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder={isLoadingCidades ? "Carregando cidades..." : "Todas as cidades"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as cidades</SelectItem>
                  {cidades && cidades.length > 0 ? (
                    cidades.map((cidade) => (
                      <SelectItem key={cidade.id} value={cidade.id}>
                        {cidade.name} - {cidade.state}
                      </SelectItem>
                    ))
                  ) : (
                    !isLoadingCidades && (
                      <div className="py-2 px-4 text-sm text-muted-foreground">
                        Nenhuma cidade cadastrada
                      </div>
                    )
                  )}
                </SelectContent>
              </Select>

              {isLoadingMotoristas && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando motoristas...
                </div>
              )}

              {!isLoadingMotoristas && (
                <div className="text-sm text-muted-foreground">
                  {motoristas.length} motorista{motoristas.length !== 1 ? "s" : ""} encontrado{motoristas.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={containerStyle}
                center={mapCenter}
                zoom={selectedCityId && selectedCityId !== "all" ? 12 : 6}
                options={{
                  zoomControl: true,
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: true,
                }}
              >
                {motoristas
                  .filter((m) => m.currentLatitude && m.currentLongitude)
                  .map((motorista) => (
                    <Marker
                      key={motorista.id}
                      position={{
                        lat: motorista.currentLatitude!,
                        lng: motorista.currentLongitude!,
                      }}
                      icon={createMarkerIcon(getPinColor(motorista))}
                      onClick={() => setSelectedMotorista(motorista)}
                      title={motorista.name}
                    />
                  ))}

                {selectedMotorista && (
                  <InfoWindow
                    position={{
                      lat: selectedMotorista.currentLatitude!,
                      lng: selectedMotorista.currentLongitude!,
                    }}
                    onCloseClick={() => setSelectedMotorista(null)}
                  >
                    <div className="p-2 space-y-2">
                      <div className="font-semibold text-base">{selectedMotorista.name}</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusVariant(selectedMotorista)}>
                            {getStatusLabel(selectedMotorista)}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground">{selectedMotorista.phone}</div>
                        <div className="text-muted-foreground">{selectedMotorista.email}</div>
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            ) : (
              <div className="flex items-center justify-center h-[calc(100vh-200px)] bg-muted rounded-lg">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Carregando mapa...</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente principal que verifica a API key antes de renderizar o mapa
export default function Mapa() {
  // Buscar configurações do Google Maps
  const { data: config, isLoading } = useQuery<Configuracao>({
    queryKey: ["/api/settings"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mapa de Motoristas</h1>
            <p className="text-muted-foreground">Visualize a localização dos motoristas em tempo real</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Carregando configurações...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!config?.googleMapsApiKey) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mapa de Motoristas</h1>
            <p className="text-muted-foreground">Visualize a localização dos motoristas em tempo real</p>
          </div>
        </div>

        <Alert>
          <MapPin className="h-4 w-4" />
          <AlertDescription>
            Google Maps API Key não configurada. Por favor, configure nas{" "}
            <a href="/configuracoes" className="font-medium underline">
              Configurações
            </a>
            .
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Renderizar o mapa com a API key disponível
  return <MapaContent apiKey={config.googleMapsApiKey} />;
}
