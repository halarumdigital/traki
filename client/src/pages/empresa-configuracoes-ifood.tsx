import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  UtensilsCrossed,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plug,
  Trash2,
  MapPin,
  RefreshCw,
  Info,
  ExternalLink,
  Clock,
  Package
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface IfoodCredentials {
  id: string;
  merchantId: string;
  clientId: string;
  active: boolean;
  triggerOnReadyToPickup: boolean;
  triggerOnDispatched: boolean;
  pickupAddress: string | null;
  pickupLat: string | null;
  pickupLng: string | null;
  defaultVehicleTypeId: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  totalDeliveriesCreated: number;
  createdAt: string;
  updatedAt: string;
}

interface IfoodConfig {
  configured: boolean;
  credentials: IfoodCredentials | null;
}

interface IfoodStats {
  configured: boolean;
  active?: boolean;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
  totalDeliveriesCreated?: number;
  stats?: {
    total_deliveries: number;
    completed: number;
    cancelled: number;
    in_progress: number;
  };
}

interface VehicleType {
  id: string;
  name: string;
  icon: string | null;
}

interface CompanyInfo {
  id: string;
  name: string;
  email: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
  reference?: string;
}

export default function EmpresaConfiguracoesIfood() {
  const { toast } = useToast();

  // Form state
  const [merchantId, setMerchantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [triggerOnReadyToPickup, setTriggerOnReadyToPickup] = useState(true);
  const [triggerOnDispatched, setTriggerOnDispatched] = useState(false);
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [defaultVehicleTypeId, setDefaultVehicleTypeId] = useState("");
  const [active, setActive] = useState(true);

  // Queries
  const { data: config, isLoading: isLoadingConfig } = useQuery<IfoodConfig>({
    queryKey: ["/api/empresa/ifood/credentials"],
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery<IfoodStats>({
    queryKey: ["/api/empresa/ifood/stats"],
  });

  const { data: vehicleTypes } = useQuery<VehicleType[]>({
    queryKey: ["/api/vehicle-types"],
  });

  const { data: companyInfo } = useQuery<CompanyInfo>({
    queryKey: ["/api/empresa/auth/me"],
  });

  // Build company address from company data
  const companyAddress = companyInfo
    ? [
        companyInfo.street,
        companyInfo.number,
        companyInfo.neighborhood,
        companyInfo.city && companyInfo.state
          ? `${companyInfo.city}/${companyInfo.state}`
          : companyInfo.city || companyInfo.state,
        companyInfo.cep,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  // Preencher formulário com dados existentes
  useEffect(() => {
    if (config?.credentials) {
      setMerchantId(config.credentials.merchantId || "");
      setClientId(config.credentials.clientId || "");
      setTriggerOnReadyToPickup(config.credentials.triggerOnReadyToPickup ?? true);
      setTriggerOnDispatched(config.credentials.triggerOnDispatched ?? false);
      // Use saved coordinates if available
      setPickupLat(config.credentials.pickupLat ? parseFloat(config.credentials.pickupLat) : null);
      setPickupLng(config.credentials.pickupLng ? parseFloat(config.credentials.pickupLng) : null);
      setDefaultVehicleTypeId(config.credentials.defaultVehicleTypeId || "");
      setActive(config.credentials.active ?? true);
    }
  }, [config]);

  // Auto-populate pickup address from company data
  useEffect(() => {
    if (companyAddress) {
      setPickupAddress(companyAddress);
    }
  }, [companyAddress]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/empresa/ifood/credentials", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/ifood/credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/ifood/stats"] });
      toast({
        title: "Configuração salva",
        description: "As credenciais do iFood foram salvas com sucesso.",
      });
      setClientSecret(""); // Limpa o secret após salvar
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar as configurações.",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/empresa/ifood/test-connection", {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/ifood/credentials"] });
      toast({
        title: "Conexão estabelecida",
        description: data.message || "Conexão com iFood testada com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Falha na conexão",
        description: error.message || "Não foi possível conectar ao iFood.",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (active: boolean) => {
      return apiRequest("PUT", "/api/empresa/ifood/toggle", { active });
    },
    onSuccess: (_, active) => {
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/ifood/credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/ifood/stats"] });
      toast({
        title: active ? "Integração ativada" : "Integração desativada",
        description: active
          ? "A integração com iFood está ativa."
          : "A integração com iFood foi pausada.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível alterar o status.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/empresa/ifood/credentials", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/ifood/credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/ifood/stats"] });
      toast({
        title: "Integração removida",
        description: "As credenciais do iFood foram removidas.",
      });
      // Limpar formulário
      setMerchantId("");
      setClientId("");
      setClientSecret("");
      setPickupAddress("");
      setPickupLat(null);
      setPickupLng(null);
      setDefaultVehicleTypeId("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao remover",
        description: error.message || "Não foi possível remover a integração.",
      });
    },
  });

  const handleSave = () => {
    if (!merchantId || !clientId) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Merchant ID e Client ID são obrigatórios.",
      });
      return;
    }

    if (!config?.configured && !clientSecret) {
      toast({
        variant: "destructive",
        title: "Campo obrigatório",
        description: "Client Secret é obrigatório para nova configuração.",
      });
      return;
    }

    if (!pickupAddress) {
      toast({
        variant: "destructive",
        title: "Endereço incompleto",
        description: "Complete o cadastro da sua empresa com endereço.",
      });
      return;
    }

    if (!pickupLat || !pickupLng) {
      toast({
        variant: "destructive",
        title: "Coordenadas obrigatórias",
        description: "Informe a latitude e longitude do seu estabelecimento.",
      });
      return;
    }

    if (!defaultVehicleTypeId) {
      toast({
        variant: "destructive",
        title: "Veículo obrigatório",
        description: "Selecione o tipo de veículo padrão para entregas.",
      });
      return;
    }

    saveMutation.mutate({
      merchantId,
      clientId,
      clientSecret: clientSecret || undefined,
      triggerOnReadyToPickup,
      triggerOnDispatched,
      pickupAddress,
      pickupLat,
      pickupLng,
      defaultVehicleTypeId,
      active,
    });
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("pt-BR");
  };

  const getStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500">Sincronizado</Badge>;
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
      case "no_events":
        return <Badge variant="secondary">Sem eventos</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  if (isLoadingConfig) {
    return (
      <div className="container mx-auto py-6 px-4 lg:px-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-100">
            <UtensilsCrossed className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Integração iFood</h1>
            <p className="text-muted-foreground text-sm">
              Receba pedidos do iFood automaticamente no seu app de entregas
            </p>
          </div>
        </div>
        {config?.configured && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Integração</span>
            <Switch
              checked={config.credentials?.active ?? false}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={toggleMutation.isPending}
            />
            <span className="text-sm font-medium">
              {config.credentials?.active ? "Ativa" : "Pausada"}
            </span>
          </div>
        )}
      </div>

      {/* Status Cards */}
      {config?.configured && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total de Entregas</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {stats?.totalDeliveriesCreated || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Concluídas</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-green-600">
                {stats?.stats?.completed || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Em Andamento</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-blue-600">
                {stats?.stats?.in_progress || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Última Sinc.</span>
              </div>
              <p className="text-sm font-medium mt-1">
                {formatDate(stats?.lastSyncAt)}
              </p>
              <div className="mt-1">
                {getStatusBadge(stats?.lastSyncStatus)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Info Alert */}
      {!config?.configured && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Como funciona?</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              A integração com o iFood permite que pedidos sejam automaticamente
              transformados em entregas no seu aplicativo quando o status mudar para
              "Pronto para coleta" ou "Saiu para entrega".
            </p>
            <p>
              Para configurar, você precisa obter as credenciais no{" "}
              <a
                href="https://developer.ifood.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                Portal Developer do iFood <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Credenciais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5" />
              Credenciais da API
            </CardTitle>
            <CardDescription>
              Obtenha essas informações no Portal Developer do iFood
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="merchantId">Merchant ID *</Label>
              <Input
                id="merchantId"
                placeholder="820af392-002c-47b1-bfae-d7ef31743c99"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                ID da sua loja no iFood (encontre em iFood Parceiros)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID *</Label>
              <Input
                id="clientId"
                placeholder="seu-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientSecret">
                Client Secret {config?.configured ? "(deixe vazio para manter)" : "*"}
              </Label>
              <Input
                id="clientSecret"
                type="password"
                placeholder={config?.configured ? "••••••••••••" : "seu-client-secret"}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </div>

            {config?.configured && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
              >
                {testMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="mr-2 h-4 w-4" />
                )}
                Testar Conexão
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Configurações */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações de Gatilho</CardTitle>
            <CardDescription>
              Defina quando a entrega deve ser criada no seu app
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Pronto para Coleta (READY_TO_PICKUP)</Label>
                <p className="text-xs text-muted-foreground">
                  Cria a entrega quando o pedido estiver pronto
                </p>
              </div>
              <Switch
                checked={triggerOnReadyToPickup}
                onCheckedChange={setTriggerOnReadyToPickup}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Saiu para Entrega (DISPATCHED)</Label>
                <p className="text-xs text-muted-foreground">
                  Cria a entrega quando o pedido sair para entrega
                </p>
              </div>
              <Switch
                checked={triggerOnDispatched}
                onCheckedChange={setTriggerOnDispatched}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicleType">Tipo de Veículo Padrão *</Label>
              <Select
                value={defaultVehicleTypeId}
                onValueChange={setDefaultVehicleTypeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o veículo" />
                </SelectTrigger>
                <SelectContent>
                  {vehicleTypes?.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tipo de veículo usado para entregas do iFood
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Endereço de Coleta */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Endereço de Coleta (Seu Estabelecimento)
            </CardTitle>
            <CardDescription>
              Local onde o entregador irá coletar os pedidos do iFood
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Endereço da Empresa</Label>
              <div className="p-3 bg-muted rounded-md">
                {pickupAddress ? (
                  <p className="text-sm">{pickupAddress}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum endereço cadastrado. Complete o cadastro da sua empresa primeiro.
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Este endereço vem do cadastro da sua empresa
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Coordenadas geográficas</AlertTitle>
              <AlertDescription>
                Informe as coordenadas (latitude/longitude) do seu estabelecimento.
                Você pode obtê-las no Google Maps: clique com botão direito no local e copie as coordenadas.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pickupLat">Latitude *</Label>
                <Input
                  id="pickupLat"
                  type="number"
                  step="any"
                  placeholder="-23.550520"
                  value={pickupLat ?? ""}
                  onChange={(e) => setPickupLat(e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickupLng">Longitude *</Label>
                <Input
                  id="pickupLng"
                  type="number"
                  step="any"
                  placeholder="-46.633308"
                  value={pickupLng ?? ""}
                  onChange={(e) => setPickupLng(e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        {config?.configured && (
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Tem certeza que deseja remover a integração com o iFood?")) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Remover Integração
          </Button>
        )}
        <div className="flex-1" />
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="min-w-[150px]"
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {config?.configured ? "Atualizar" : "Salvar Configuração"}
        </Button>
      </div>
    </div>
  );
}
