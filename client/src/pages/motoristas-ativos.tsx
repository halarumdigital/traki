import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { Pencil, Trash2, Plus, Eye, Ban, MessageSquare, Search, Users, UserCheck, Star, Circle, DollarSign, TrendingUp, MapPin, ArrowUpDown, ArrowUp, ArrowDown, Wallet, ArrowDownToLine, ArrowUpFromLine, CreditCard, Key } from "lucide-react";
import { useForm } from "react-hook-form";
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
  available: boolean;
  rating: number | string | null;
  serviceLocationId: string;
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

// Componente para renderizar estrelas de avaliação
const StarRating = ({ rating }: { rating: number | string | null }) => {
  if (rating === null || rating === undefined) {
    return <span className="text-muted-foreground text-sm">Sem avaliação</span>;
  }

  const ratingNum = typeof rating === 'string' ? parseFloat(rating) : rating;

  if (isNaN(ratingNum) || ratingNum === 0) {
    return <span className="text-muted-foreground text-sm">Sem avaliação</span>;
  }

  const stars = [];
  const fullStars = Math.floor(ratingNum);
  const hasHalfStar = ratingNum % 1 >= 0.5;

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
      );
    } else if (i === fullStars && hasHalfStar) {
      stars.push(
        <div key={i} className="relative">
          <Star className="h-4 w-4 text-yellow-400" />
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 absolute top-0 left-0" style={{ clipPath: 'inset(0 50% 0 0)' }} />
        </div>
      );
    } else {
      stars.push(
        <Star key={i} className="h-4 w-4 text-gray-300" />
      );
    }
  }

  return (
    <div className="flex items-center gap-1">
      {stars}
      <span className="text-sm text-muted-foreground ml-1">
        {ratingNum.toFixed(1)}
      </span>
    </div>
  );
};

export default function MotoristasAtivos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingDriver, setViewingDriver] = useState<Driver | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Driver | 'vehicleTypeName'; direction: 'asc' | 'desc' | null }>({
    key: 'name',
    direction: null
  });

  const { data: allDrivers = [], isLoading } = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
  });

  // Filtrar apenas motoristas ativos e aprovados
  const drivers = allDrivers.filter((driver) => driver.active && driver.approve);

  // 🔴 Socket.IO - Atualização em tempo real
  useEffect(() => {
    const socket: Socket = io(window.location.origin, {
      withCredentials: true,
    });

    socket.on("connect", () => {
      console.log("✅ Conectado ao Socket.IO - Motoristas Ativos");
    });

    // Escutar mudanças de status dos motoristas
    socket.on("driver-status-changed", (data: {
      driverId: string;
      driverName: string;
      available: boolean;
      timestamp: string;
    }) => {
      console.log("📡 Status do motorista mudou:", data);

      // Atualizar a lista de motoristas
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });

      // Mostrar toast de notificação
      toast({
        title: data.available ? "✅ Motorista Online" : "⭕ Motorista Offline",
        description: `${data.driverName} está ${data.available ? "disponível" : "indisponível"}`,
        duration: 3000,
      });
    });

    socket.on("disconnect", () => {
      console.log("❌ Desconectado do Socket.IO");
    });

    // Cleanup ao desmontar componente
    return () => {
      socket.close();
    };
  }, [queryClient, toast]);

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

  const { data: driverDocuments = [] } = useQuery<any>({
    queryKey: ["/api/drivers", viewingDriver?.id, "documents"],
    enabled: !!viewingDriver?.id,
    select: (data) => data?.documents || [],
  });

  const { data: driverNotes = [] } = useQuery<any[]>({
    queryKey: ["/api/drivers", viewingDriver?.id, "notes"],
    enabled: !!viewingDriver?.id,
  });

  const { data: driverTrips = [] } = useQuery<any[]>({
    queryKey: ["/api/drivers", viewingDriver?.id, "trips"],
    enabled: !!viewingDriver?.id,
  });

  const { data: driverFinancial } = useQuery<{
    subaccount: any;
    pixKey: string | null;
    pixKeyType: string | null;
    balance: number;
    withdrawals: any[];
    splits: any[];
    totals: {
      totalWithdrawals: number;
      totalSplits: number;
    };
  }>({
    queryKey: ["/api/drivers", viewingDriver?.id, "financial"],
    enabled: !!viewingDriver?.id,
  });

  const [financialView, setFinancialView] = useState<"saques" | "repasses">("repasses");
  const [newComment, setNewComment] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Filtrar modelos baseado na marca selecionada
  const filteredModels = allModels.filter(
    (model: any) => model.brandId === selectedBrandId
  );

  // Função para ordenar colunas
  const handleSort = (key: keyof Driver | 'vehicleTypeName') => {
    let direction: 'asc' | 'desc' | null = 'asc';

    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        direction = null;
      }
    }

    setSortConfig({ key, direction });
  };

  // Função para renderizar o ícone de ordenação
  const getSortIcon = (columnKey: keyof Driver | 'vehicleTypeName') => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-4 w-4" />;
    }

    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="h-4 w-4" />;
    } else if (sortConfig.direction === 'desc') {
      return <ArrowDown className="h-4 w-4" />;
    }

    return <ArrowUpDown className="h-4 w-4" />;
  };

  // Filtrar motoristas pela busca
  const searchedDrivers = drivers.filter((driver) => {
    if (!searchTerm.trim()) return true;

    const search = searchTerm.toLowerCase();
    const name = driver.name?.toLowerCase() || "";
    const email = driver.email?.toLowerCase() || "";
    const cpf = driver.cpf?.toLowerCase() || "";

    return name.includes(search) || email.includes(search) || cpf.includes(search);
  });

  // Aplicar ordenação
  const filteredDrivers = [...searchedDrivers].sort((a, b) => {
    if (!sortConfig.direction) return 0;

    const key = sortConfig.key;
    let aValue: any;
    let bValue: any;

    // Para o status, queremos online (true) primeiro em ordem ascendente
    if (key === 'available') {
      aValue = a.available ? 1 : 0;
      bValue = b.available ? 1 : 0;
    } else if (key === 'rating') {
      // Para avaliação, converter para número
      aValue = typeof a.rating === 'string' ? parseFloat(a.rating) : (a.rating || 0);
      bValue = typeof b.rating === 'string' ? parseFloat(b.rating) : (b.rating || 0);
    } else {
      aValue = a[key as keyof Driver] || "";
      bValue = b[key as keyof Driver] || "";
    }

    // Ordenação
    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Estatísticas
  const totalApproved = drivers.length;
  const totalOnline = drivers.filter((driver) => driver.available).length;

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

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao criar motorista");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({
        title: "Sucesso",
        description: "Motorista criado com sucesso",
      });
      setIsDialogOpen(false);
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

  const addNoteMutation = useMutation({
    mutationFn: async ({ driverId, note }: { driverId: string; note: string }) => {
      const response = await fetch(`/api/drivers/${driverId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, noteType: "general" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao adicionar comentário");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", viewingDriver?.id, "notes"] });
      toast({
        title: "Sucesso",
        description: "Comentário adicionado com sucesso",
      });
      setNewComment("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const blockMutation = useMutation({
    mutationFn: async ({ driverId, reason }: { driverId: string; reason: string }) => {
      const response = await fetch(`/api/drivers/${driverId}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao bloquear motorista");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", viewingDriver?.id, "notes"] });
      toast({
        title: "Sucesso",
        description: "Motorista bloqueado com sucesso",
      });
      setShowBlockDialog(false);
      setBlockReason("");
      setViewDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (driver?: Driver) => {
    if (driver) {
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
    } else {
      setEditingDriver(null);
      reset({
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
      });
      setSelectedBrandId("");
    }
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
    } else {
      createMutation.mutate(data);
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

  const handleViewDriver = (driver: Driver) => {
    setViewingDriver(driver);
    setViewDialogOpen(true);
  };

  const handleCloseViewDialog = () => {
    setViewDialogOpen(false);
    setViewingDriver(null);
    setNewComment("");
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !viewingDriver) return;
    addNoteMutation.mutate({ driverId: viewingDriver.id, note: newComment.trim() });
  };

  const handleBlockDriver = () => {
    if (!viewingDriver) return;
    blockMutation.mutate({ driverId: viewingDriver.id, reason: blockReason });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Motoristas Aprovados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalApproved}</div>
            <p className="text-xs text-muted-foreground">
              Motoristas ativos e aprovados no sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Motoristas Online</CardTitle>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <UserCheck className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalOnline}</div>
            <p className="text-xs text-muted-foreground">
              Motoristas disponíveis • Atualização em tempo real
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Motoristas Ativos</CardTitle>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Motorista
          </Button>
        </CardHeader>
        <CardContent>
          {/* Campo de busca */}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por nome, email ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : drivers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum motorista ativo encontrado.
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum motorista encontrado com os critérios de busca.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      Nome
                      {getSortIcon('name')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={() => handleSort('cpf')}
                    >
                      CPF
                      {getSortIcon('cpf')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={() => handleSort('mobile')}
                    >
                      WhatsApp
                      {getSortIcon('mobile')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={() => handleSort('email')}
                    >
                      Email
                      {getSortIcon('email')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={() => handleSort('vehicleTypeName')}
                    >
                      Categoria
                      {getSortIcon('vehicleTypeName')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={() => handleSort('carNumber')}
                    >
                      Placa
                      {getSortIcon('carNumber')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={() => handleSort('rating')}
                    >
                      Avaliação
                      {getSortIcon('rating')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={() => handleSort('available')}
                    >
                      Status
                      {getSortIcon('available')}
                    </button>
                  </TableHead>
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
                    <TableCell>
                      <StarRating rating={driver.rating} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Circle
                          className={`h-2 w-2 ${driver.available ? 'fill-green-500 text-green-500 animate-pulse' : 'fill-gray-400 text-gray-400'}`}
                        />
                        <span className={`text-sm font-medium ${driver.available ? 'text-green-600' : 'text-gray-500'}`}>
                          {driver.available ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDriver(driver)}
                          title="Visualizar cadastro"
                        >
                          <Eye className="h-4 w-4 text-blue-600" />
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

      {/* Dialog para criar/editar motorista */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDriver ? "Editar Motorista" : "Novo Motorista"}
            </DialogTitle>
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
                    <Label htmlFor="password">Senha {!editingDriver && "*"}</Label>
                    <Input
                      id="password"
                      type="password"
                      {...register("password", {
                        required: !editingDriver ? "Senha é obrigatória" : false
                      })}
                      placeholder={editingDriver ? "Deixe em branco para manter" : "Digite a senha"}
                    />
                    {errors.password && (
                      <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
                    )}
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
                    {errors.serviceLocationId && (
                      <p className="text-sm text-red-500 mt-1">Cidade é obrigatória</p>
                    )}
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
                        setSelectedBrandId(value); // Atualizar selectedBrandId
                        setValue("modelId", ""); // Limpar modelo quando marca mudar
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
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Salvando..."
                  : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de visualização do motorista */}
      <Dialog open={viewDialogOpen} onOpenChange={handleCloseViewDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualizar Cadastro do Motorista</DialogTitle>
          </DialogHeader>
          {viewingDriver && (
            <Tabs defaultValue="cadastro" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
                <TabsTrigger value="corridas">Corridas</TabsTrigger>
                <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
              </TabsList>

              <TabsContent value="cadastro" className="space-y-6 mt-4">
                {/* Dados Pessoais */}
                <div className="border-b pb-4">
                <h3 className="font-semibold mb-3 text-lg">Dados Pessoais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Nome Completo</Label>
                    <p className="font-medium">{viewingDriver.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">CPF</Label>
                    <p className="font-medium">{viewingDriver.cpf || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{viewingDriver.email || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">WhatsApp</Label>
                    <p className="font-medium">{viewingDriver.mobile}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Cidade</Label>
                    <p className="font-medium">
                      {serviceLocations.find((l: any) => l.id === viewingDriver.serviceLocationId)?.name || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dados do Veículo */}
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-3 text-lg">Dados do Veículo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Categoria</Label>
                    <p className="font-medium">{viewingDriver.vehicleTypeName || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Marca</Label>
                    <p className="font-medium">
                      {brands.find((b) => b.id === viewingDriver.brandId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Modelo</Label>
                    <p className="font-medium">
                      {allModels.find((m: any) => m.id === viewingDriver.modelId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Placa</Label>
                    <p className="font-medium">{viewingDriver.carNumber || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Cor</Label>
                    <p className="font-medium">{viewingDriver.carColor || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Ano</Label>
                    <p className="font-medium">{viewingDriver.carYear || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Documentos */}
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-3 text-lg">Documentos Enviados</h3>
                {driverDocuments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhum documento enviado ainda
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {driverDocuments.map((doc: any) => (
                      <div key={doc.id} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-2">{doc.documentTypeName}</h4>
                        <div className="aspect-video bg-gray-100 rounded-md overflow-hidden mb-2">
                          <img
                            src={doc.documentUrl}
                            alt={doc.documentTypeName}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3Ctext fill='%23999' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3EImagem não disponível%3C/text%3E%3C/svg%3E";
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              doc.status === "approved"
                                ? "bg-green-100 text-green-700"
                                : doc.status === "rejected"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {doc.status === "approved"
                              ? "Aprovado"
                              : doc.status === "rejected"
                              ? "Rejeitado"
                              : "Pendente"}
                          </span>
                          <a
                            href={doc.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Ver em tamanho real
                          </a>
                        </div>
                        {doc.rejectionReason && (
                          <p className="text-xs text-red-600 mt-2">
                            Motivo da rejeição: {doc.rejectionReason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comentários/Notas */}
              <div>
                <h3 className="font-semibold mb-3 text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Comentários Administrativos
                </h3>

                {/* Adicionar novo comentário */}
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <Label htmlFor="newComment" className="mb-2">Adicionar Comentário</Label>
                  <div className="flex gap-2 mt-2">
                    <Textarea
                      id="newComment"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Digite seu comentário aqui..."
                      className="flex-1"
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || addNoteMutation.isPending}
                    className="mt-2"
                    size="sm"
                  >
                    {addNoteMutation.isPending ? "Adicionando..." : "Adicionar Comentário"}
                  </Button>
                </div>

                {/* Lista de comentários */}
                {driverNotes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhum comentário ainda
                  </p>
                ) : (
                  <div className="space-y-3">
                    {driverNotes.map((note: any) => (
                      <div
                        key={note.id}
                        className={`border rounded-lg p-3 ${
                          note.noteType === "block"
                            ? "border-red-300 bg-red-50"
                            : note.noteType === "unblock"
                            ? "border-green-300 bg-green-50"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-medium text-sm">{note.userName}</span>
                            <span
                              className={`ml-2 text-xs px-2 py-1 rounded ${
                                note.noteType === "block"
                                  ? "bg-red-600 text-white"
                                  : note.noteType === "unblock"
                                  ? "bg-green-600 text-white"
                                  : note.noteType === "warning"
                                  ? "bg-yellow-600 text-white"
                                  : "bg-gray-600 text-white"
                              }`}
                            >
                              {note.noteType === "block"
                                ? "Bloqueio"
                                : note.noteType === "unblock"
                                ? "Desbloqueio"
                                : note.noteType === "warning"
                                ? "Aviso"
                                : "Comentário"}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(note.createdAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <p className="text-sm">{note.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="corridas" className="space-y-6 mt-4">
                {/* Estatísticas de Corridas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total de Corridas</CardTitle>
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{driverTrips.length}</div>
                      <p className="text-xs text-muted-foreground">
                        Corridas realizadas
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Valor Ganho</CardTitle>
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          driverTrips.reduce((sum: number, trip: any) => sum + (parseFloat(trip.driverEarnings || 0)), 0)
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Total ganho com corridas
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Comissão do App</CardTitle>
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          driverTrips.reduce((sum: number, trip: any) => sum + (parseFloat(trip.appCommission || 0)), 0)
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Comissão total do aplicativo
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Lista de Corridas */}
                <div className="border rounded-lg">
                  <div className="p-4 border-b bg-muted/50">
                    <h3 className="font-semibold text-lg">Histórico de Corridas</h3>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {driverTrips.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Nenhuma corrida realizada ainda
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead>Destino</TableHead>
                            <TableHead>Distância</TableHead>
                            <TableHead>Valor Total</TableHead>
                            <TableHead>Ganho Motorista</TableHead>
                            <TableHead>Comissão App</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {driverTrips.map((trip: any) => (
                            <TableRow key={trip.id}>
                              <TableCell className="font-medium">
                                {new Date(trip.createdAt).toLocaleDateString('pt-BR')}
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate" title={trip.pickupAddress}>
                                {trip.pickupAddress || "-"}
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate" title={trip.dropoffAddress}>
                                {trip.dropoffAddress || "-"}
                              </TableCell>
                              <TableCell>
                                {trip.distance ? `${(trip.distance / 1000).toFixed(1)} km` : "-"}
                              </TableCell>
                              <TableCell>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                  parseFloat(trip.totalPrice || 0)
                                )}
                              </TableCell>
                              <TableCell className="text-green-600">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                  parseFloat(trip.driverEarnings || 0)
                                )}
                              </TableCell>
                              <TableCell className="text-blue-600">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                  parseFloat(trip.appCommission || 0)
                                )}
                              </TableCell>
                              <TableCell>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  trip.status === 'completed' ? 'bg-green-100 text-green-700' :
                                  trip.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {trip.status === 'completed' ? 'Concluída' :
                                   trip.status === 'cancelled' ? 'Cancelada' :
                                   trip.status}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="financeiro" className="space-y-6 mt-4">
                {/* Informações da Subconta */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Subconta</CardTitle>
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm">
                        {driverFinancial?.subaccount ? (
                          <span className="text-green-600 font-medium">✓ Ativa</span>
                        ) : (
                          <span className="text-yellow-600 font-medium">✗ Não criada</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {driverFinancial?.subaccount?.id || "ID não disponível"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Chave PIX</CardTitle>
                      <Key className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm font-medium truncate" title={driverFinancial?.pixKey || "-"}>
                        {driverFinancial?.pixKey || "-"}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Tipo: {driverFinancial?.pixKeyType || "-"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Saldo na Conta</CardTitle>
                      <Wallet className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          (driverFinancial?.balance || 0) / 100
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Saldo disponível para saque
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Seletor Saques/Repasses */}
                <div className="flex items-center gap-4 border-b pb-4">
                  <span className="text-sm font-medium">Visualizar:</span>
                  <div className="flex gap-2">
                    <Button
                      variant={financialView === "repasses" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFinancialView("repasses")}
                      className="gap-2"
                    >
                      <ArrowDownToLine className="h-4 w-4" />
                      Repasses
                    </Button>
                    <Button
                      variant={financialView === "saques" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFinancialView("saques")}
                      className="gap-2"
                    >
                      <ArrowUpFromLine className="h-4 w-4" />
                      Saques
                    </Button>
                  </div>
                </div>

                {/* Lista de Saques */}
                {financialView === "saques" && (
                  <div className="border rounded-lg">
                    <div className="p-4 border-b bg-muted/50">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <ArrowUpFromLine className="h-5 w-5" />
                        Histórico de Saques
                      </h3>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {!driverFinancial?.withdrawals || driverFinancial.withdrawals.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                          Nenhum saque realizado ainda
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Data/Hora</TableHead>
                              <TableHead>Valor</TableHead>
                              <TableHead>Chave PIX</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {driverFinancial.withdrawals.map((withdrawal: any) => (
                              <TableRow key={withdrawal.id}>
                                <TableCell className="font-medium">
                                  {new Date(withdrawal.createdAt).toLocaleString('pt-BR')}
                                </TableCell>
                                <TableCell className="text-red-600 font-medium">
                                  - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                    parseFloat(withdrawal.amount || 0)
                                  )}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate" title={driverFinancial?.pixKey || "-"}>
                                  {driverFinancial?.pixKey || "-"}
                                </TableCell>
                                <TableCell>
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    withdrawal.status === 'completed' ? 'bg-green-100 text-green-700' :
                                    withdrawal.status === 'failed' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {withdrawal.status === 'completed' ? 'Concluído' :
                                     withdrawal.status === 'failed' ? 'Falhou' :
                                     'Pendente'}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                    {driverFinancial?.withdrawals && driverFinancial.withdrawals.length > 0 && (
                      <div className="p-4 border-t bg-muted/50">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Total de saques: {driverFinancial.withdrawals.length}
                          </span>
                          <span className="font-semibold text-red-600">
                            Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                              driverFinancial.totals?.totalWithdrawals || 0
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Lista de Repasses (Splits) */}
                {financialView === "repasses" && (
                  <div className="border rounded-lg">
                    <div className="p-4 border-b bg-muted/50">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <ArrowDownToLine className="h-5 w-5" />
                        Histórico de Repasses
                      </h3>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {!driverFinancial?.splits || driverFinancial.splits.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                          Nenhum repasse recebido ainda
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Data/Hora</TableHead>
                              <TableHead>Valor</TableHead>
                              <TableHead>Nº Entrega</TableHead>
                              <TableHead>Descrição</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {driverFinancial.splits.map((split: any) => (
                              <TableRow key={split.id}>
                                <TableCell className="font-medium">
                                  {new Date(split.createdAt).toLocaleString('pt-BR')}
                                </TableCell>
                                <TableCell className="text-green-600 font-medium">
                                  + {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                    parseFloat(split.amount || 0)
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                    #{split.entregaNumero || "-"}
                                  </span>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate" title={split.description}>
                                  {split.description || "-"}
                                </TableCell>
                                <TableCell>
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    split.status === 'completed' ? 'bg-green-100 text-green-700' :
                                    split.status === 'failed' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {split.status === 'completed' ? 'Concluído' :
                                     split.status === 'failed' ? 'Falhou' :
                                     'Pendente'}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                    {driverFinancial?.splits && driverFinancial.splits.length > 0 && (
                      <div className="p-4 border-t bg-muted/50">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Total de repasses: {driverFinancial.splits.length}
                          </span>
                          <span className="font-semibold text-green-600">
                            Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                              driverFinancial.totals?.totalSplits || 0
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => setShowBlockDialog(true)}
              disabled={!viewingDriver?.active}
            >
              <Ban className="mr-2 h-4 w-4" />
              Bloquear Motorista
            </Button>
            <Button variant="outline" onClick={handleCloseViewDialog}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de bloqueio */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear Motorista</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja bloquear o motorista "{viewingDriver?.name}"? Ele não poderá mais fazer login no aplicativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Label htmlFor="blockReason">Motivo do bloqueio</Label>
            <Textarea
              id="blockReason"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Descreva o motivo do bloqueio..."
              rows={3}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBlockReason("")}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlockDriver}
              className="bg-red-600 hover:bg-red-700"
              disabled={blockMutation.isPending}
            >
              {blockMutation.isPending ? "Bloqueando..." : "Bloquear"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
