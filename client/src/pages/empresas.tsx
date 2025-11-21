import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Pencil, Trash2, Plus, Eye, Star, Search, DollarSign, TrendingUp, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCompanySchema, type Company } from "@shared/schema";
import type { z } from "zod";

type FormData = z.infer<typeof insertCompanySchema>;

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

export default function Empresas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingCompany, setViewingCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: companyTrips = [] } = useQuery<any[]>({
    queryKey: ["/api/companies", viewingCompany?.id, "trips"],
    enabled: !!viewingCompany?.id,
  });

  // Filtrar empresas pela busca
  const filteredCompanies = companies.filter((company) => {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    const name = company.name?.toLowerCase() || "";
    const email = company.email?.toLowerCase() || "";
    const cnpj = company.cnpj?.toLowerCase() || "";
    return name.includes(search) || email.includes(search) || cnpj.includes(search);
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(insertCompanySchema),
    defaultValues: {
      name: "",
      cnpj: null,
      email: null,
      phone: null,
      responsibleName: null,
      responsibleWhatsapp: null,
      responsibleEmail: null,
      street: null,
      number: null,
      complement: null,
      neighborhood: null,
      cep: null,
      city: null,
      state: null,
      reference: null,
      active: true,
    },
  });

  const activeValue = watch("active");

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao criar empresa");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Sucesso",
        description: "Empresa criada com sucesso",
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
      const response = await fetch(`/api/companies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar empresa");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Sucesso",
        description: "Empresa atualizada com sucesso",
      });
      setIsDialogOpen(false);
      setEditingCompany(null);
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
      const response = await fetch(`/api/companies/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao excluir empresa");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Sucesso",
        description: "Empresa excluída com sucesso",
      });
      setDeleteDialogOpen(false);
      setCompanyToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (company?: Company) => {
    if (company) {
      setEditingCompany(company);
      setValue("name", company.name);
      setValue("cnpj", company.cnpj);
      setValue("email", company.email);
      setValue("phone", company.phone);
      setValue("responsibleName", company.responsibleName);
      setValue("responsibleWhatsapp", company.responsibleWhatsapp);
      setValue("responsibleEmail", company.responsibleEmail);
      setValue("street", company.street);
      setValue("number", company.number);
      setValue("complement", company.complement);
      setValue("neighborhood", company.neighborhood);
      setValue("cep", company.cep);
      setValue("city", company.city);
      setValue("state", company.state);
      setValue("reference", company.reference);
      setValue("active", company.active);
    } else {
      setEditingCompany(null);
      reset({
        name: "",
        cnpj: null,
        email: null,
        phone: null,
        responsibleName: null,
        responsibleWhatsapp: null,
        responsibleEmail: null,
        street: null,
        number: null,
        complement: null,
        neighborhood: null,
        cep: null,
        city: null,
        state: null,
        reference: null,
        active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCompany(null);
    reset();
  };

  const onSubmit = (data: FormData) => {
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeleteClick = (company: Company) => {
    setCompanyToDelete(company);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (companyToDelete) {
      deleteMutation.mutate(companyToDelete.id);
    }
  };

  const handleViewCompany = (company: Company) => {
    setViewingCompany(company);
    setViewDialogOpen(true);
  };

  const handleCloseViewDialog = () => {
    setViewDialogOpen(false);
    setViewingCompany(null);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Empresas</CardTitle>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Empresa
          </Button>
        </CardHeader>
        <CardContent>
          {/* Campo de busca */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CNPJ ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : companies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma empresa cadastrada. Clique em "Adicionar Empresa" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Avaliação</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>{company.cnpj || "-"}</TableCell>
                    <TableCell>{company.email || "-"}</TableCell>
                    <TableCell>{company.phone || "-"}</TableCell>
                    <TableCell>{company.city || "-"}</TableCell>
                    <TableCell>
                      <StarRating rating={company.rating} />
                    </TableCell>
                    <TableCell className="text-center">
                      {company.active ? (
                        <span className="text-green-600">Ativo</span>
                      ) : (
                        <span className="text-red-600">Inativo</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewCompany(company)}
                          title="Visualizar cadastro"
                        >
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(company)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(company)}
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

      {/* Dialog para criar/editar empresa */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? "Editar Empresa" : "Nova Empresa"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              {/* Dados da Empresa */}
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-3">Dados da Empresa</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      {...register("name")}
                      placeholder="Nome da empresa"
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      {...register("cnpj")}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                    {errors.cnpj && (
                      <p className="text-sm text-red-500 mt-1">{errors.cnpj.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register("email")}
                      placeholder="empresa@email.com"
                    />
                    {errors.email && (
                      <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      {...register("phone")}
                      placeholder="(00) 00000-0000"
                    />
                    {errors.phone && (
                      <p className="text-sm text-red-500 mt-1">{errors.phone.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="password">Senha de Acesso</Label>
                    <Input
                      id="password"
                      type="password"
                      {...register("password")}
                      placeholder="Senha para login no painel"
                    />
                    {errors.password && (
                      <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {editingCompany ? "Deixe em branco para manter a senha atual" : "Defina uma senha para a empresa acessar o painel"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Responsável */}
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-3">Responsável</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="responsibleName">Nome do Responsável</Label>
                    <Input
                      id="responsibleName"
                      {...register("responsibleName")}
                      placeholder="Nome completo"
                    />
                    {errors.responsibleName && (
                      <p className="text-sm text-red-500 mt-1">{errors.responsibleName.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="responsibleWhatsapp">WhatsApp do Responsável</Label>
                    <Input
                      id="responsibleWhatsapp"
                      {...register("responsibleWhatsapp")}
                      placeholder="(00) 00000-0000"
                    />
                    {errors.responsibleWhatsapp && (
                      <p className="text-sm text-red-500 mt-1">{errors.responsibleWhatsapp.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="responsibleEmail">Email do Responsável</Label>
                    <Input
                      id="responsibleEmail"
                      type="email"
                      {...register("responsibleEmail")}
                      placeholder="responsavel@email.com"
                    />
                    {errors.responsibleEmail && (
                      <p className="text-sm text-red-500 mt-1">{errors.responsibleEmail.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dados PIX */}
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-3">Dados PIX (Woovi)</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Cadastre uma chave PIX para receber pagamentos e gerenciar saldo da empresa
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pixKeyType">Tipo de Chave PIX</Label>
                    <select
                      id="pixKeyType"
                      {...register("pixKeyType")}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Selecione o tipo</option>
                      <option value="EMAIL">Email</option>
                      <option value="CPF">CPF</option>
                      <option value="CNPJ">CNPJ</option>
                      <option value="PHONE">Telefone</option>
                      <option value="EVP">Chave Aleatória</option>
                    </select>
                    {errors.pixKeyType && (
                      <p className="text-sm text-red-500 mt-1">{errors.pixKeyType.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="pixKey">Chave PIX</Label>
                    <Input
                      id="pixKey"
                      {...register("pixKey")}
                      placeholder="Digite a chave PIX"
                    />
                    {errors.pixKey && (
                      <p className="text-sm text-red-500 mt-1">{errors.pixKey.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Esta chave será usada para recarga de saldo via PIX
                    </p>
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-3">Endereço</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cep">CEP</Label>
                    <Input
                      id="cep"
                      {...register("cep")}
                      placeholder="00000-000"
                      maxLength={10}
                    />
                  </div>

                  <div>
                    <Label htmlFor="street">Rua</Label>
                    <Input
                      id="street"
                      {...register("street")}
                      placeholder="Nome da rua"
                    />
                  </div>

                  <div>
                    <Label htmlFor="number">Número</Label>
                    <Input
                      id="number"
                      {...register("number")}
                      placeholder="Número"
                    />
                  </div>

                  <div>
                    <Label htmlFor="complement">Complemento</Label>
                    <Input
                      id="complement"
                      {...register("complement")}
                      placeholder="Apto, sala, etc."
                    />
                  </div>

                  <div>
                    <Label htmlFor="neighborhood">Bairro</Label>
                    <Input
                      id="neighborhood"
                      {...register("neighborhood")}
                      placeholder="Nome do bairro"
                    />
                  </div>

                  <div>
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      {...register("city")}
                      placeholder="Nome da cidade"
                    />
                  </div>

                  <div>
                    <Label htmlFor="state">Estado</Label>
                    <Input
                      id="state"
                      {...register("state")}
                      placeholder="UF"
                      maxLength={2}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="reference">Referência</Label>
                    <Input
                      id="reference"
                      {...register("reference")}
                      placeholder="Ponto de referência"
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="active"
                  checked={activeValue}
                  onCheckedChange={(checked) => setValue("active", checked as boolean)}
                />
                <Label htmlFor="active" className="cursor-pointer">
                  Ativo
                </Label>
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

      {/* Dialog de visualização da empresa */}
      <Dialog open={viewDialogOpen} onOpenChange={handleCloseViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualizar Cadastro da Empresa</DialogTitle>
          </DialogHeader>
          {viewingCompany && (
            <Tabs defaultValue="cadastro" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
                <TabsTrigger value="corridas">Corridas</TabsTrigger>
              </TabsList>

              <TabsContent value="cadastro" className="space-y-6 mt-4">
                {/* Dados da Empresa */}
                <div className="border-b pb-4">
                  <h3 className="font-semibold mb-3 text-lg">Dados da Empresa</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Nome</Label>
                      <p className="font-medium">{viewingCompany.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">CNPJ</Label>
                      <p className="font-medium">{viewingCompany.cnpj || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-medium">{viewingCompany.email || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Telefone</Label>
                      <p className="font-medium">{viewingCompany.phone || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <p className="font-medium">
                        {viewingCompany.active ? (
                          <span className="text-green-600">Ativo</span>
                        ) : (
                          <span className="text-red-600">Inativo</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Avaliação</Label>
                      <div className="mt-1">
                        <StarRating rating={viewingCompany.rating} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Responsável */}
                <div className="border-b pb-4">
                  <h3 className="font-semibold mb-3 text-lg">Responsável</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Nome do Responsável</Label>
                      <p className="font-medium">{viewingCompany.responsibleName || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">WhatsApp do Responsável</Label>
                      <p className="font-medium">{viewingCompany.responsibleWhatsapp || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email do Responsável</Label>
                      <p className="font-medium">{viewingCompany.responsibleEmail || "-"}</p>
                    </div>
                  </div>
                </div>

                {/* Endereço */}
                <div>
                  <h3 className="font-semibold mb-3 text-lg">Endereço</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">CEP</Label>
                      <p className="font-medium">{viewingCompany.cep || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Rua</Label>
                      <p className="font-medium">{viewingCompany.street || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Número</Label>
                      <p className="font-medium">{viewingCompany.number || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Complemento</Label>
                      <p className="font-medium">{viewingCompany.complement || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Bairro</Label>
                      <p className="font-medium">{viewingCompany.neighborhood || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Cidade</Label>
                      <p className="font-medium">{viewingCompany.city || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Estado</Label>
                      <p className="font-medium">{viewingCompany.state || "-"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-muted-foreground">Referência</Label>
                      <p className="font-medium">{viewingCompany.reference || "-"}</p>
                    </div>
                  </div>
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
                    <div className="text-2xl font-bold">{companyTrips.length}</div>
                    <p className="text-xs text-muted-foreground">
                      Corridas realizadas
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        companyTrips.reduce((sum: number, trip: any) => sum + (parseFloat(trip.totalPrice || 0)), 0)
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Valor total das corridas
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
                        companyTrips.reduce((sum: number, trip: any) => sum + (parseFloat(trip.appCommission || 0)), 0)
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
                  {companyTrips.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhuma corrida realizada ainda
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Motorista</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Destino</TableHead>
                          <TableHead>Distância</TableHead>
                          <TableHead>Valor Total</TableHead>
                          <TableHead>Comissão App</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companyTrips.map((trip: any) => (
                          <TableRow key={trip.id}>
                            <TableCell className="font-medium">
                              {new Date(trip.createdAt).toLocaleDateString('pt-BR')}
                            </TableCell>
                            <TableCell>{trip.driverName || "-"}</TableCell>
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
          </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseViewDialog}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa "{companyToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCompanyToDelete(null)}>
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
