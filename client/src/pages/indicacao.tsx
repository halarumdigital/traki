import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, MapPin, Search, CheckCircle, Clock, Award, DollarSign, ChevronDown, ChevronRight } from "lucide-react";

interface Referral {
  id: string;
  referrerId: string;
  referrerName: string;
  referrerEmail: string;
  referrerCpf: string;
  referrerCity: string;
  referrerCityId: string | null;
  referredId: string;
  referredName: string;
  referredEmail: string;
  referredCpf: string;
  referredCity: string;
  referredCityId: string | null;
  deliveriesCompleted: number;
  deliveriesRequired: number;
  commissionPaid: boolean;
  commissionAmount: string;
  status: "active" | "completed" | "cancelled";
  createdAt: string;
}

export default function IndicacaoPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [expandedReferrers, setExpandedReferrers] = useState<Set<string>>(new Set());

  const { data: referrals, isLoading } = useQuery<Referral[]>({
    queryKey: ["/api/referrals"],
  });

  const { data: cities } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/service-locations"],
  });

  const markCommissionPaidMutation = useMutation({
    mutationFn: async (referralId: string) => {
      return await apiRequest("PUT", `/api/referrals/${referralId}/mark-commission-paid`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals"] });
      toast({
        title: "Comissão marcada como paga",
        description: "A comissão foi marcada como paga com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao marcar comissão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleMarkCommissionPaid = (referralId: string) => {
    if (confirm("Tem certeza que deseja marcar esta comissão como paga?")) {
      markCommissionPaidMutation.mutate(referralId);
    }
  };

  // Filter referrals based on search and filters
  const filteredReferrals = referrals?.filter((referral) => {
    const searchLower = searchTerm.toLowerCase();

    const matchesSearch = searchTerm === "" ||
      (referral.referrerName && referral.referrerName.toLowerCase().includes(searchLower)) ||
      (referral.referrerEmail && referral.referrerEmail.toLowerCase().includes(searchLower)) ||
      (referral.referrerCpf && referral.referrerCpf.includes(searchTerm)) ||
      (referral.referredName && referral.referredName.toLowerCase().includes(searchLower)) ||
      (referral.referredEmail && referral.referredEmail.toLowerCase().includes(searchLower)) ||
      (referral.referredCpf && referral.referredCpf.includes(searchTerm));

    const matchesCity = selectedCity === "all" ||
      referral.referrerCityId === selectedCity ||
      referral.referredCityId === selectedCity;

    const matchesStatus = selectedStatus === "all" ||
      (selectedStatus === "paid" && referral.commissionPaid) ||
      (selectedStatus === "pending" && !referral.commissionPaid);

    return matchesSearch && matchesCity && matchesStatus;
  });

  const getCommissionStatusBadge = (commissionPaid: boolean) => {
    if (commissionPaid) {
      return <Badge className="bg-green-500 hover:bg-green-600 gap-1"><CheckCircle className="h-3 w-3" />Paga</Badge>;
    } else {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
    }
  };

  const calculateProgress = (completed: number, required: number) => {
    return Math.min((completed / required) * 100, 100);
  };

  const toggleExpand = (referrerId: string) => {
    setExpandedReferrers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(referrerId)) {
        newSet.delete(referrerId);
      } else {
        newSet.add(referrerId);
      }
      return newSet;
    });
  };

  // Agrupar indicações por indicador
  const groupedReferrals = filteredReferrals?.reduce((acc, referral) => {
    if (!acc[referral.referrerId]) {
      acc[referral.referrerId] = [];
    }
    acc[referral.referrerId].push(referral);
    return acc;
  }, {} as Record<string, Referral[]>);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            Indicações
          </h1>
          <p className="text-muted-foreground mt-2">
            Acompanhe as indicações de entregadores e gerencie comissões
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Busque por entregador (nome, email, CPF) ou filtre por cidade e status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger>
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Todas as cidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as cidades</SelectItem>
                {cities?.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Paga</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Referrals List */}
      <Card>
        <CardHeader>
          <CardTitle>Indicações Ativas</CardTitle>
          <CardDescription>
            {filteredReferrals?.length || 0} indicação(ões) encontrada(s)
            {groupedReferrals && ` de ${Object.keys(groupedReferrals).length} indicador(es)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <UserPlus className="h-12 w-12 mb-4 animate-pulse" />
              <p>Carregando indicações...</p>
            </div>
          ) : !filteredReferrals || filteredReferrals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="p-4 bg-muted rounded-full mb-4">
                <UserPlus className="h-12 w-12" />
              </div>
              <p className="text-lg font-medium">Nenhuma indicação encontrada</p>
              <p className="text-sm">Tente ajustar os filtros de busca</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Indicador</TableHead>
                    <TableHead className="font-semibold">Indicado</TableHead>
                    <TableHead className="font-semibold">Progresso</TableHead>
                    <TableHead className="font-semibold">Comissão</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedReferrals && Object.entries(groupedReferrals).map(([referrerId, referralGroup]) => {
                    const isExpanded = expandedReferrers.has(referrerId);
                    const hasMultiple = referralGroup.length > 1;
                    const displayReferrals = isExpanded ? referralGroup : [referralGroup[0]];

                    return displayReferrals.map((referral, index) => {
                      const progress = calculateProgress(referral.deliveriesCompleted, referral.deliveriesRequired);
                      const isFirstOfGroup = index === 0;

                      return (
                        <TableRow key={referral.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div className="flex items-start gap-2">
                              {isFirstOfGroup && hasMultiple && (
                                <button
                                  onClick={() => toggleExpand(referrerId)}
                                  className="mt-1 hover:bg-muted rounded p-1 transition-colors"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="font-medium">{referral.referrerName}</div>
                                  {isFirstOfGroup && hasMultiple && !isExpanded && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{referralGroup.length - 1}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">{referral.referrerEmail}</div>
                                <div className="text-xs text-muted-foreground">CPF: {referral.referrerCpf}</div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  {referral.referrerCity}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{referral.referredName}</div>
                            <div className="text-xs text-muted-foreground">{referral.referredEmail}</div>
                            <div className="text-xs text-muted-foreground">CPF: {referral.referredCpf}</div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {referral.referredCity}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2 min-w-[150px]">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">
                                {referral.deliveriesCompleted}/{referral.deliveriesRequired} entregas
                              </span>
                              <span className="text-muted-foreground">{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-green-600">{referral.commissionAmount}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getCommissionStatusBadge(referral.commissionPaid)}
                        </TableCell>
                        <TableCell className="text-right">
                          {!referral.commissionPaid && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleMarkCommissionPaid(referral.id)}
                              disabled={markCommissionPaidMutation.isPending}
                              className="gap-2"
                            >
                              <DollarSign className="h-4 w-4" />
                              Marcar como Paga
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    });
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
