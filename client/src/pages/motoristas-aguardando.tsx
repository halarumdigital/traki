import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, CheckCircle, XCircle, Users, Clock, Search, Eye, FileText, X, AlertTriangle, Shield, RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import type { VehicleType, Brand, VehicleModel } from "@shared/schema";

type Driver = {
  id: string;
  name: string;
  cpf: string | null;
  email: string | null;
  mobile: string;
  password?: string;
  vehicleTypeId: string | null;
  vehicleTypeName?: string;
  brandId: string | null;
  modelId: string | null;
  carNumber: string | null;
  carColor: string | null;
  carYear: string | null;
  active: boolean;
  approve: boolean;
  serviceLocationId: string;
  hasCriminalRecords?: boolean;
  criminalRecords?: Array<{
    tipo: string;
    assunto: string;
    tribunalTipo: string;
  }>;
  criminalCheckDate?: string;
};

type FormData = {
  name: string;
  cpf: string;
  email: string;
  mobile: string;
  password: string;
  vehicleTypeId: string;
  brandId: string;
  modelId: string;
  carNumber: string;
  carColor: string;
  carYear: string;
  serviceLocationId: string;
};

type DriverDocument = {
  id: string;
  driverId: string;
  documentTypeId: string;
  documentTypeName?: string;
  documentUrl: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  createdAt: string;
};

type ServiceLocation = {
  id: string;
  name: string;
};

export default function MotoristasAguardando() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  // Estados para o modal de visualização de detalhes
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [driverDocuments, setDriverDocuments] = useState<DriverDocument[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: allDrivers = [], isLoading } = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
  });

  // Filtrar apenas motoristas aguardando aprovação (approve = false)
  const drivers = allDrivers.filter((driver) => !driver.approve);

  // Estatísticas
  const totalMotoristas = allDrivers.length;
  const totalAguardando = drivers.length;

  // Filtrar motoristas pela busca
  const filteredDrivers = drivers.filter((driver) => {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    const name = driver.name?.toLowerCase() || "";
    const email = driver.email?.toLowerCase() || "";
    const cpf = driver.cpf?.toLowerCase() || "";
    return name.includes(search) || email.includes(search) || cpf.includes(search);
  });

  const { data: vehicleTypes = [] } = useQuery<VehicleType[]>({
    queryKey: ["/api/vehicle-types"],
  });

  const { data: brands = [] } = useQuery<Brand[]>({
    queryKey: ["/api/brands"],
  });

  const { data: allModels = [] } = useQuery<VehicleModel[]>({
    queryKey: ["/api/vehicle-models"],
  });

  const { data: serviceLocations = [] } = useQuery<any[]>({
    queryKey: ["/api/service-locations"],
  });

  // Filtrar modelos baseado na marca selecionada
  const filteredModels = allModels.filter(
    (model: any) => model.brandId === selectedBrandId
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      cpf: "",
      email: "",
      mobile: "",
      password: "",
      vehicleTypeId: "",
      brandId: "",
      modelId: "",
      carNumber: "",
      carColor: "",
      carYear: "",
      serviceLocationId: "",
    },
  });

  const brandIdValue = watch("brandId");

  useEffect(() => {
    setSelectedBrandId(brandIdValue);
    // Limpar modelo quando marca mudar
    if (brandIdValue !== selectedBrandId) {
      setValue("modelId", "");
    }
  }, [brandIdValue, selectedBrandId, setValue]);

  // Função para carregar documentos do motorista
  const loadDriverDocuments = async (driverId: string) => {
    try {
      const response = await fetch(`/api/drivers/${driverId}/documents`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error("Erro ao carregar documentos");
      }
      const data = await response.json();
      console.log("Documentos carregados:", data);
      setDriverDocuments(data.documents || []);
    } catch (error) {
      console.error("Erro ao carregar documentos:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar documentos do motorista",
        variant: "destructive",
      });
    }
  };

  // Mutation para aprovar documento
  const approveDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/drivers/documents/${documentId}/approve`, {
        method: "POST",
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao aprovar documento");
      }
      return response.json();
    },
    onSuccess: () => {
      if (selectedDriver) {
        loadDriverDocuments(selectedDriver.id);
      }
      toast({
        title: "Sucesso",
        description: "Documento aprovado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para rejeitar documento
  const rejectDocumentMutation = useMutation({
    mutationFn: async ({ documentId, reason }: { documentId: string; reason: string }) => {
      const response = await fetch(`/api/drivers/documents/${documentId}/reject`, {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: reason }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao rejeitar documento");
      }
      return response.json();
    },
    onSuccess: () => {
      if (selectedDriver) {
        loadDriverDocuments(selectedDriver.id);
      }
      setRejectingDocId(null);
      setRejectionReason("");
      toast({
        title: "Sucesso",
        description: "Documento rejeitado",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const response = await fetch(`/api/drivers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar motorista");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({
        title: "Sucesso",
        description: "Motorista atualizado com sucesso",
      });
      setIsDialogOpen(false);
      setEditingDriver(null);
      reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/drivers/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao excluir motorista");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({
        title: "Sucesso",
        description: "Motorista excluído com sucesso",
      });
      setDeleteDialogOpen(false);
      setDriverToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/drivers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve: true, active: true }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao aprovar motorista");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({
        title: "Sucesso",
        description: "Motorista aprovado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/drivers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve: false, active: false }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao rejeitar motorista");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({
        title: "Sucesso",
        description: "Motorista rejeitado",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para consultar processos criminais
  const checkCriminalMutation = useMutation({
    mutationFn: async (driverId: string) => {
      const response = await fetch(`/api/drivers/${driverId}/check-criminal`, {
        method: "POST",
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao consultar processos criminais");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });

      // Atualizar o selectedDriver com os dados da consulta
      if (selectedDriver) {
        setSelectedDriver({
          ...selectedDriver,
          hasCriminalRecords: data.hasCriminalRecords,
          criminalRecords: data.criminalRecords,
          criminalCheckDate: data.checkDate,
        });
      }

      if (data.hasCriminalRecords) {
        toast({
          title: "Atenção",
          description: `Encontrados ${data.criminalRecords.length} processo(s) criminal(is)`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Consulta Concluída",
          description: "Nenhum processo criminal encontrado",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (driver: Driver) => {
    setEditingDriver(driver);
    setValue("name", driver.name);
    setValue("cpf", driver.cpf || "");
    setValue("email", driver.email || "");
    setValue("mobile", driver.mobile);
    setValue("vehicleTypeId", driver.vehicleTypeId || "");
    setValue("brandId", driver.brandId || "");
    setValue("modelId", driver.modelId || "");
    setValue("carNumber", driver.carNumber || "");
    setValue("carColor", driver.carColor || "");
    setValue("carYear", driver.carYear || "");
    setValue("serviceLocationId", driver.serviceLocationId || "");
    setSelectedBrandId(driver.brandId || "");
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingDriver(null);
    reset();
    setSelectedBrandId("");
  };

  const onSubmit = (data: FormData) => {
    if (editingDriver) {
      updateMutation.mutate({ id: editingDriver.id, data });
    }
  };

  const handleDeleteClick = (driver: Driver) => {
    setDriverToDelete(driver);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (driverToDelete) {
      deleteMutation.mutate(driverToDelete.id);
    }
  };

  const handleApprove = (driverId: string) => {
    approveMutation.mutate(driverId);
  };

  const handleReject = (driverId: string) => {
    rejectMutation.mutate(driverId);
  };

  const handleViewDetails = async (driver: Driver) => {
    setSelectedDriver(driver);
    setViewDetailsOpen(true);
    await loadDriverDocuments(driver.id);
  };

  const handleCloseViewDetails = () => {
    setViewDetailsOpen(false);
    setSelectedDriver(null);
    setDriverDocuments([]);
    setSelectedImage(null);
    setRejectingDocId(null);
    setRejectionReason("");
  };

  const handleApproveDocument = (documentId: string) => {
    approveDocumentMutation.mutate(documentId);
  };

  const handleStartRejectDocument = (documentId: string) => {
    setRejectingDocId(documentId);
    setRejectionReason("");
  };

  const handleConfirmRejectDocument = () => {
    if (!rejectingDocId || !rejectionReason.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe o motivo da rejeição",
        variant: "destructive",
      });
      return;
    }
    rejectDocumentMutation.mutate({
      documentId: rejectingDocId,
      reason: rejectionReason,
    });
  };

  // Buscar nome da cidade
  const getCityName = (cityId: string) => {
    const city = serviceLocations.find((loc: any) => loc.id === cityId);
    return city?.name || "-";
  };

  // Buscar nome da marca
  const getBrandName = (brandId: string | null) => {
    if (!brandId) return "-";
    const brand = brands.find((b) => b.id === brandId);
    return brand?.name || "-";
  };

  // Buscar nome do modelo
  const getModelName = (modelId: string | null) => {
    if (!modelId) return "-";
    const model = allModels.find((m: any) => m.id === modelId);
    return model?.name || "-";
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Motoristas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMotoristas}</div>
            <p className="text-xs text-muted-foreground">
              Todos os motoristas no sistema
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Aguardando</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{totalAguardando}</div>
            <p className="text-xs text-muted-foreground">
              Motoristas aguardando aprovação
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Motoristas Aguardando Aprovação</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Campo de busca */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : filteredDrivers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum motorista aguardando aprovação.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">{driver.name}</TableCell>
                    <TableCell>{driver.cpf || "-"}</TableCell>
                    <TableCell>{driver.mobile}</TableCell>
                    <TableCell>{driver.email || "-"}</TableCell>
                    <TableCell>{driver.vehicleTypeName || "-"}</TableCell>
                    <TableCell>{driver.carNumber || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(driver)}
                          title="Ver detalhes e documentos"
                        >
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApprove(driver.id)}
                          title="Aprovar motorista"
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReject(driver.id)}
                          title="Rejeitar motorista"
                        >
                          <XCircle className="h-4 w-4 text-red-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(driver)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(driver)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
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

      {/* Dialog para editar motorista */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Motorista</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              {/* Dados Pessoais */}
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-3">Dados Pessoais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome Completo *</Label>
                    <Input
                      id="name"
                      {...register("name", { required: "Nome é obrigatório" })}
                      placeholder="Nome completo"
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      {...register("cpf")}
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register("email")}
                      placeholder="email@exemplo.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="mobile">WhatsApp *</Label>
                    <Input
                      id="mobile"
                      {...register("mobile", { required: "WhatsApp é obrigatório" })}
                      placeholder="(00) 00000-0000"
                    />
                    {errors.mobile && (
                      <p className="text-sm text-red-500 mt-1">{errors.mobile.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      {...register("password")}
                      placeholder="Deixe em branco para manter"
                    />
                  </div>

                  <div>
                    <Label htmlFor="serviceLocationId">Cidade *</Label>
                    <Select
                      value={watch("serviceLocationId")}
                      onValueChange={(value) => setValue("serviceLocationId", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a cidade" />
                      </SelectTrigger>
                      <SelectContent>
                        {serviceLocations.map((location: any) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Dados do Veículo */}
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-3">Dados do Veículo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vehicleTypeId">Categoria</Label>
                    <Select
                      value={watch("vehicleTypeId")}
                      onValueChange={(value) => setValue("vehicleTypeId", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
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

                  <div>
                    <Label htmlFor="brandId">Marca</Label>
                    <Select
                      value={watch("brandId")}
                      onValueChange={(value) => {
                        setValue("brandId", value);
                        setValue("modelId", "");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a marca" />
                      </SelectTrigger>
                      <SelectContent>
                        {brands.map((brand) => (
                          <SelectItem key={brand.id} value={brand.id}>
                            {brand.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="modelId">Modelo</Label>
                    <Select
                      value={watch("modelId")}
                      onValueChange={(value) => setValue("modelId", value)}
                      disabled={!selectedBrandId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedBrandId ? "Selecione o modelo" : "Selecione a marca primeiro"} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredModels.map((model: any) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="carNumber">Placa</Label>
                    <Input
                      id="carNumber"
                      {...register("carNumber")}
                      placeholder="ABC-1234"
                      maxLength={8}
                    />
                  </div>

                  <div>
                    <Label htmlFor="carColor">Cor</Label>
                    <Input
                      id="carColor"
                      {...register("carColor")}
                      placeholder="Ex: Preto, Branco, Prata"
                    />
                  </div>

                  <div>
                    <Label htmlFor="carYear">Ano</Label>
                    <Input
                      id="carYear"
                      {...register("carYear")}
                      placeholder="2024"
                      maxLength={4}
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de visualização de detalhes do motorista */}
      <Dialog open={viewDetailsOpen} onOpenChange={handleCloseViewDetails}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Motorista</DialogTitle>
          </DialogHeader>

          {selectedDriver && (
            <div className="space-y-6">
              {/* Dados Pessoais */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Dados Pessoais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Nome</label>
                    <p className="font-medium">{selectedDriver.name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">CPF</label>
                    <p className="font-medium">{selectedDriver.cpf || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Email</label>
                    <p className="font-medium">{selectedDriver.email || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">WhatsApp</label>
                    <p className="font-medium">{selectedDriver.mobile}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Cidade</label>
                    <p className="font-medium">{getCityName(selectedDriver.serviceLocationId)}</p>
                  </div>
                </div>
              </div>

              {/* Dados do Veículo */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-4">Dados do Veículo</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Categoria</label>
                    <p className="font-medium">{selectedDriver.vehicleTypeName || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Marca</label>
                    <p className="font-medium">{getBrandName(selectedDriver.brandId)}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Modelo</label>
                    <p className="font-medium">{getModelName(selectedDriver.modelId)}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Placa</label>
                    <p className="font-medium">{selectedDriver.carNumber || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Cor</label>
                    <p className="font-medium">{selectedDriver.carColor || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Ano</label>
                    <p className="font-medium">{selectedDriver.carYear || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Antecedentes Criminais */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Antecedentes Criminais
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => checkCriminalMutation.mutate(selectedDriver.id)}
                    disabled={checkCriminalMutation.isPending || !selectedDriver.cpf}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${checkCriminalMutation.isPending ? "animate-spin" : ""}`} />
                    {checkCriminalMutation.isPending ? "Consultando..." : "Consultar CPF"}
                  </Button>
                </div>

                {!selectedDriver.cpf ? (
                  <p className="text-center text-amber-600 py-4">
                    CPF não cadastrado. Não é possível consultar antecedentes.
                  </p>
                ) : !selectedDriver.criminalCheckDate ? (
                  <p className="text-center text-muted-foreground py-4">
                    Consulta de antecedentes não realizada. Clique em "Consultar CPF" para verificar.
                  </p>
                ) : selectedDriver.hasCriminalRecords ? (
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-red-700 mb-2">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-semibold">
                          Atenção: {selectedDriver.criminalRecords?.length} processo(s) criminal(is) encontrado(s)
                        </span>
                      </div>
                      <p className="text-sm text-red-600">
                        Última consulta: {new Date(selectedDriver.criminalCheckDate).toLocaleString("pt-BR")}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {selectedDriver.criminalRecords?.map((record, index) => (
                        <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-red-600 font-medium">Tipo</label>
                              <p className="text-sm font-medium text-red-800">{record.tipo}</p>
                            </div>
                            <div>
                              <label className="text-xs text-red-600 font-medium">Assunto</label>
                              <p className="text-sm font-medium text-red-800">{record.assunto}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-semibold">Nada consta</span>
                    </div>
                    <p className="text-sm text-green-600 mt-1">
                      Nenhum processo criminal encontrado. Última consulta: {new Date(selectedDriver.criminalCheckDate).toLocaleString("pt-BR")}
                    </p>
                  </div>
                )}
              </div>

              {/* Documentos */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documentos ({driverDocuments.length})
                </h3>

                {driverDocuments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum documento enviado
                  </p>
                ) : (
                  <div className="space-y-4">
                    {driverDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">{doc.documentTypeName || "Documento"}</p>
                              {doc.status === "approved" && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                  Aprovado
                                </span>
                              )}
                              {doc.status === "rejected" && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                                  Rejeitado
                                </span>
                              )}
                              {doc.status === "pending" && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                                  Pendente
                                </span>
                              )}
                              {doc.isExpired && (
                                <span className="text-xs bg-red-600 text-white px-2 py-1 rounded font-bold">
                                  DOCUMENTO VENCIDO
                                </span>
                              )}
                            </div>
                            {doc.expirationDate && (
                              <p className={`text-sm mt-1 ${doc.isExpired ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                Validade: {new Date(doc.expirationDate).toLocaleDateString("pt-BR")}
                              </p>
                            )}
                            {doc.rejectionReason && (
                              <p className="text-sm text-red-600 mt-1">
                                Motivo da rejeição: {doc.rejectionReason}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedImage(doc.documentUrl)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver
                            </Button>
                            {doc.status !== "approved" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600 hover:text-green-700"
                                onClick={() => handleApproveDocument(doc.id)}
                                disabled={approveDocumentMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Aprovar
                              </Button>
                            )}
                            {doc.status !== "rejected" && rejectingDocId !== doc.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleStartRejectDocument(doc.id)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Negar
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Campo de rejeição */}
                        {rejectingDocId === doc.id && (
                          <div className="space-y-2 border-t pt-3">
                            <Label>Motivo da Rejeição *</Label>
                            <Textarea
                              placeholder="Descreva o motivo da rejeição do documento..."
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={handleConfirmRejectDocument}
                                disabled={rejectDocumentMutation.isPending || !rejectionReason.trim()}
                              >
                                Confirmar Rejeição
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setRejectingDocId(null);
                                  setRejectionReason("");
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Preview da imagem em miniatura */}
                        <div className="mt-2">
                          <img
                            src={doc.documentUrl}
                            alt={doc.documentTypeName || "Documento"}
                            className="max-w-xs h-32 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setSelectedImage(doc.documentUrl)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ações principais */}
              <div className="flex gap-3 justify-end border-t pt-4">
                <Button
                  variant="outline"
                  onClick={handleCloseViewDetails}
                >
                  Fechar
                </Button>
                <Button
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    handleApprove(selectedDriver.id);
                    handleCloseViewDetails();
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aprovar Motorista
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleReject(selectedDriver.id);
                    handleCloseViewDetails();
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejeitar Motorista
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para visualizar imagem em tamanho completo */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Visualização do Documento</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="relative">
              <img
                src={selectedImage}
                alt="Documento"
                className="w-full h-auto rounded"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-white/90 hover:bg-white"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o motorista "{driverToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDriverToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
