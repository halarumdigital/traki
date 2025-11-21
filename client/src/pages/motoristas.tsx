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
import { Pencil, Trash2, Plus } from "lucide-react";
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
  pixKey?: string;
  pixKeyType?: string;
};

export default function Motoristas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");

  const { data: drivers = [], isLoading } = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
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

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Motoristas</CardTitle>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Motorista
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : drivers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum motorista cadastrado. Clique em "Adicionar Motorista" para começar.
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
                {drivers.map((driver) => (
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

              {/* Dados PIX */}
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-3">Dados PIX (Woovi)</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Cadastre uma chave PIX para receber pagamentos das entregas
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pixKeyType">Tipo de Chave PIX</Label>
                    <Select
                      value={watch("pixKeyType")}
                      onValueChange={(value) => setValue("pixKeyType", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EMAIL">Email</SelectItem>
                        <SelectItem value="CPF">CPF</SelectItem>
                        <SelectItem value="CNPJ">CNPJ</SelectItem>
                        <SelectItem value="PHONE">Telefone</SelectItem>
                        <SelectItem value="EVP">Chave Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="pixKey">Chave PIX</Label>
                    <Input
                      id="pixKey"
                      {...register("pixKey")}
                      placeholder="Digite a chave PIX"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Esta chave será usada para receber pagamentos das entregas
                    </p>
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
