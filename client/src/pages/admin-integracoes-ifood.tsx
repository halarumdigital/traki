import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  UtensilsCrossed,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Building2,
  Package,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface IfoodIntegration {
  id: string;
  companyId: string;
  companyName: string;
  merchantId: string;
  active: boolean;
  triggerOnReadyToPickup: boolean;
  triggerOnDispatched: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  totalDeliveriesCreated: number;
  createdAt: string;
  updatedAt: string;
}

interface IfoodStats {
  totalIntegrations: number;
  activeIntegrations: number;
  totalDeliveries: number;
  lastSyncErrors: number;
}

export default function AdminIntegracoesIfood() {
  const { toast } = useToast();

  const { data: integrations, isLoading: isLoadingIntegrations } = useQuery<IfoodIntegration[]>({
    queryKey: ["/api/admin/ifood/integrations"],
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery<IfoodStats>({
    queryKey: ["/api/admin/ifood/stats"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      return apiRequest("PUT", `/api/admin/ifood/integrations/${id}/toggle`, { active });
    },
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ifood/integrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ifood/stats"] });
      toast({
        title: active ? "Integração ativada" : "Integração desativada",
        description: active
          ? "A integração com iFood foi ativada."
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

  if (isLoadingIntegrations) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-red-100">
          <UtensilsCrossed className="h-6 w-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Integrações iFood</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie as integrações iFood de todas as empresas
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total de Integrações</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {stats?.totalIntegrations || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Ativas</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">
              {stats?.activeIntegrations || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Entregas Criadas</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-blue-600">
              {stats?.totalDeliveries || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Erros de Sinc.</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-orange-600">
              {stats?.lastSyncErrors || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Integrations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Empresas Integradas</CardTitle>
          <CardDescription>
            Lista de todas as empresas com integração iFood configurada
          </CardDescription>
        </CardHeader>
        <CardContent>
          {integrations && integrations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Merchant ID</TableHead>
                  <TableHead>Gatilhos</TableHead>
                  <TableHead>Última Sinc.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Entregas</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map((integration) => (
                  <TableRow key={integration.id}>
                    <TableCell className="font-medium">
                      {integration.companyName}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {integration.merchantId.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {integration.triggerOnReadyToPickup && (
                          <Badge variant="outline" className="text-xs">Pronto</Badge>
                        )}
                        {integration.triggerOnDispatched && (
                          <Badge variant="outline" className="text-xs">Saiu</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {formatDate(integration.lastSyncAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(integration.lastSyncStatus)}
                      {integration.lastSyncError && (
                        <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={integration.lastSyncError}>
                          {integration.lastSyncError}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {integration.totalDeliveriesCreated}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={integration.active}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: integration.id, active: checked })
                        }
                        disabled={toggleMutation.isPending}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma empresa com integração iFood configurada</p>
              <p className="text-sm mt-1">
                As empresas podem configurar a integração em seu próprio painel
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
