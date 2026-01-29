import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
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
import { Pencil, Trash2, Plus, Eye, Star, Search, DollarSign, TrendingUp, MapPin, Wallet, ArrowDownToLine, ArrowUpFromLine, CreditCard, Key, Upload, X, Building2, MoreVertical, FileText, Loader2, Copy, ExternalLink, CheckCircle, CalendarIcon, LogIn } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCompanySchema, type Company, type ServiceLocation } from "@shared/schema";
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
  const [cityFilter, setCityFilter] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Estados para modal de boleto manual
  const [boletoDialogOpen, setBoletoDialogOpen] = useState(false);
  const [boletoCompany, setBoletoCompany] = useState<Company | null>(null);
  const [boletoDateFrom, setBoletoDateFrom] = useState<Date | undefined>(undefined);
  const [boletoDateTo, setBoletoDateTo] = useState<Date | undefined>(undefined);
  const [boletoResult, setBoletoResult] = useState<{
    success: boolean;
    message: string;
    chargeId?: string;
    deliveriesCount?: number;
    totalAmount?: number;
    charge?: {
      id: string;
      amount: string;
      dueDate: string;
      boletoUrl: string | null;
      boletoBarcode: string | null;
      pixCopyPaste: string | null;
    };
  } | null>(null);

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: cities = [] } = useQuery<ServiceLocation[]>({
    queryKey: ["/api/cities"],
  });

  const { data: companyTrips = [] } = useQuery<any[]>({
    queryKey: ["/api/companies", viewingCompany?.id, "trips"],
    enabled: !!viewingCompany?.id,
  });

  const { data: companyWallet } = useQuery<{
    wallet: {
      id: string;
      availableBalance: string;
      blockedBalance: string;
      status: string;
    };
    charges: Array<{
      id: string;
      amount: string;
      paymentMethod: string;
      status: string;
      chargeType: string;
      createdAt: string;
      paidAt: string | null;
      dueDate: string | null;
      periodStart: string | null;
      periodEnd: string | null;
      boletoUrl: string | null;
      boletoBarcode: string | null;
      boletoDigitableLine: string | null;
      pixCopyPaste: string | null;
      deliveriesCount: number;
    }>;
    transactions: Array<{
      id: string;
      type: string;
      amount: string;
      description: string;
      createdAt: string;
    }>;
    totals: {
      totalRecharges: number;
      chargesCount: number;
      confirmedCount: number;
    };
  }>({
    queryKey: ["/api/companies", viewingCompany?.id, "wallet"],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${viewingCompany?.id}/wallet`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Erro ao buscar dados da wallet");
      }
      return response.json();
    },
    enabled: !!viewingCompany?.id,
  });

  // Query para entregas pendentes (quando abre modal de boleto)
  const { data: pendingDeliveries, isLoading: isLoadingPending, refetch: refetchPending } = useQuery<{
    count: number;
    totalAmount: number;
    completedNotRegistered?: number;
    debug?: {
      recentDeliveries: Array<{
        id: string;
        requestNumber: string;
        status: string;
        isCompleted: boolean | null;
        completedAt: string | null;
      }>;
    };
    deliveries: Array<{
      id: string;
      requestId: string | null;
      totalAmount: string;
      createdAt: string;
    }>;
  }>({
    queryKey: ["/api/companies", boletoCompany?.id, "pending-deliveries", boletoDateFrom?.toISOString(), boletoDateTo?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (boletoDateFrom) {
        params.append("dateFrom", boletoDateFrom.toISOString());
      }
      if (boletoDateTo) {
        params.append("dateTo", boletoDateTo.toISOString());
      }
      const queryString = params.toString();
      const url = `/api/companies/${boletoCompany?.id}/pending-deliveries${queryString ? `?${queryString}` : ""}`;
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Erro ao buscar entregas pendentes");
      }
      return response.json();
    },
    enabled: !!boletoCompany?.id && boletoDialogOpen,
  });

  // Mutation para gerar boleto manual
  const generateBoletoMutation = useMutation({
    mutationFn: async ({ companyId, dateFrom, dateTo }: { companyId: string; dateFrom?: Date; dateTo?: Date }) => {
      const response = await fetch(`/api/companies/${companyId}/generate-weekly-charge`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateFrom: dateFrom?.toISOString(),
          dateTo: dateTo?.toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Erro ao gerar boleto");
      }
      return data;
    },
    onSuccess: (data) => {
      setBoletoResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      if (data.deliveriesCount > 0) {
        toast({
          title: "Boleto gerado com sucesso!",
          description: `${data.deliveriesCount} entrega(s) incluída(s) no total de R$ ${data.totalAmount?.toFixed(2)}`,
        });
      }
    },
    onError: (error: Error) => {
      setBoletoResult({
        success: false,
        message: error.message,
      });
      toast({
        variant: "destructive",
        title: "Erro ao gerar boleto",
        description: error.message,
      });
    },
  });

  const [financialView, setFinancialView] = useState<"recargas" | "boletos" | "pagamentos">("recargas");

  // Cidades únicas para o filtro (agrupadas por nome, ignorando maiúsculas/minúsculas)
  const uniqueCities = Array.from(
    companies.reduce((map, c) => {
      if (c.city) {
        const key = c.city.toLowerCase();
        if (!map.has(key)) map.set(key, c.city);
      }
      return map;
    }, new Map<string, string>()).values()
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  // Filtrar empresas pela busca e cidade
  const filteredCompanies = companies.filter((company) => {
    if (cityFilter && (company.city || "").toLowerCase() !== cityFilter.toLowerCase()) return false;
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
      paymentType: "PRE_PAGO",
      pixKey: null,
      pixKeyType: null,
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
      setLogoFile(null);
      setLogoPreview(null);
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
      setLogoFile(null);
      setLogoPreview(null);
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

  const uploadLogoMutation = useMutation({
    mutationFn: async ({ companyId, file }: { companyId: string; file: File }) => {
      const formData = new FormData();
      formData.append("logo", file);

      const response = await fetch(`/api/companies/${companyId}/logo`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao fazer upload do logo");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Sucesso",
        description: "Logo atualizado com sucesso",
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

  const deleteLogoMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const response = await fetch(`/api/companies/${companyId}/logo`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao remover logo");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Sucesso",
        description: "Logo removido com sucesso",
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

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo
      if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
        toast({
          title: "Erro",
          description: "Formato inválido. Use JPEG, PNG, GIF ou WebP",
          variant: "destructive",
        });
        return;
      }
      // Validar tamanho (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Erro",
          description: "Arquivo muito grande. Máximo 5MB",
          variant: "destructive",
        });
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  };

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
      // Buscar cidade correspondente na lista (case-insensitive)
      const matchingCity = cities.find(
        (c) => c.name.toLowerCase() === (company.city || "").toLowerCase()
      );
      setValue("city", matchingCity ? matchingCity.name : company.city);
      setValue("state", matchingCity ? matchingCity.state : company.state);
      setValue("reference", company.reference);
      setValue("active", company.active);
      setValue("paymentType", company.paymentType || "PRE_PAGO");
      setValue("pixKey", company.pixKey);
      setValue("pixKeyType", company.pixKeyType);
      // Inicializar preview do logo existente
      setLogoPreview(company.logoUrl || null);
      setLogoFile(null);
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
        paymentType: "PRE_PAGO",
        pixKey: null,
        pixKeyType: null,
      });
      // Limpar logo
      setLogoPreview(null);
      setLogoFile(null);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCompany(null);
    reset();
    setLogoFile(null);
    setLogoPreview(null);
  };

  const onSubmit = async (data: FormData) => {
    try {
      setIsUploadingLogo(true);

      if (editingCompany) {
        // Atualizar empresa
        await updateMutation.mutateAsync({ id: editingCompany.id, data });

        // Upload do logo se houver arquivo novo
        if (logoFile) {
          await uploadLogoMutation.mutateAsync({ companyId: editingCompany.id, file: logoFile });
        }
      } else {
        // Criar empresa
        const newCompany = await createMutation.mutateAsync(data);

        // Upload do logo se houver arquivo
        if (logoFile && newCompany?.id) {
          await uploadLogoMutation.mutateAsync({ companyId: newCompany.id, file: logoFile });
        }
      }
    } catch {
      // Erros já tratados nas mutations
    } finally {
      setIsUploadingLogo(false);
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

  // Funções para modal de boleto manual
  const handleOpenBoletoDialog = (company: Company) => {
    setBoletoCompany(company);
    setBoletoResult(null);

    // Calcular datas automaticamente: De = último domingo, Até = próximo domingo
    // Exemplo: Se hoje é quinta 29/01, deve mostrar de 25/01 (domingo) até 01/02 (domingo)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado

    // Último domingo (se hoje for domingo, pega o domingo atual)
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - dayOfWeek);
    lastSunday.setHours(0, 0, 0, 0);

    // Próximo domingo (7 dias após o último domingo)
    const nextSunday = new Date(lastSunday);
    nextSunday.setDate(lastSunday.getDate() + 7);
    nextSunday.setHours(23, 59, 59, 999);

    setBoletoDateFrom(lastSunday);
    setBoletoDateTo(nextSunday);
    setBoletoDialogOpen(true);
  };

  const handleCloseBoletoDialog = () => {
    setBoletoDialogOpen(false);
    setBoletoCompany(null);
    setBoletoResult(null);
    setBoletoDateFrom(undefined);
    setBoletoDateTo(undefined);
  };

  const handleGenerateBoleto = () => {
    if (boletoCompany) {
      generateBoletoMutation.mutate({
        companyId: boletoCompany.id,
        dateFrom: boletoDateFrom,
        dateTo: boletoDateTo,
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência`,
    });
  };

  const handleImpersonate = async (company: Company) => {
    try {
      const response = await fetch(`/api/admin/impersonate/${company.id}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao gerar token");
      }

      const data = await response.json();

      // Abrir nova aba com a URL de impersonate
      window.open(`/api/impersonate/${data.token}`, "_blank");

      toast({
        title: "Nova aba aberta",
        description: `Logando como ${company.name}...`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao logar como empresa",
      });
    }
  };

  return (
    <div className="w-full py-8 px-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Empresas</CardTitle>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Empresa
          </Button>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="mb-6 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CNPJ ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-full md:w-64">
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Todas as cidades</option>
                {uniqueCities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : companies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma empresa cadastrada. Clique em "Adicionar Empresa" para começar.
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Logo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Avaliação</TableHead>
                  <TableHead className="text-center">Pagamento</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <Avatar className="h-10 w-10 rounded-lg">
                        <AvatarImage src={company.logoUrl || undefined} alt={company.name} className="object-cover" />
                        <AvatarFallback className="rounded-lg bg-gray-100">
                          <Building2 className="h-5 w-5 text-gray-400" />
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>{company.cnpj || "-"}</TableCell>
                    <TableCell>{company.email || "-"}</TableCell>
                    <TableCell>{company.phone || "-"}</TableCell>
                    <TableCell>{company.city || "-"}</TableCell>
                    <TableCell>
                      <StarRating rating={company.rating} />
                    </TableCell>
                    <TableCell className="text-center">
                      {company.paymentType === "BOLETO" ? (
                        <span className="text-blue-600 text-xs px-2 py-1 rounded bg-blue-50">Boleto</span>
                      ) : (
                        <span className="text-green-600 text-xs px-2 py-1 rounded bg-green-50">Pré Pago</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {company.active ? (
                        <span className="text-green-600">Ativo</span>
                      ) : (
                        <span className="text-red-600">Inativo</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
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
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" title="Mais opções">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleImpersonate(company)}
                              className="cursor-pointer"
                            >
                              <LogIn className="mr-2 h-4 w-4 text-green-600" />
                              Logar como Empresa
                            </DropdownMenuItem>
                            {company.paymentType === "BOLETO" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleOpenBoletoDialog(company)}
                                  className="cursor-pointer"
                                >
                                  <FileText className="mr-2 h-4 w-4 text-blue-600" />
                                  Gerar Boleto Manual
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(company)}
                              className="cursor-pointer text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
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

                  {/* Logo da Empresa */}
                  <div className="md:col-span-2">
                    <Label>Logo da Empresa</Label>
                    <div className="mt-2 flex items-center gap-4">
                      {logoPreview ? (
                        <div className="relative">
                          <Avatar className="h-20 w-20 rounded-lg">
                            <AvatarImage src={logoPreview} alt="Logo da empresa" className="object-cover" />
                            <AvatarFallback className="rounded-lg">
                              <Building2 className="h-8 w-8" />
                            </AvatarFallback>
                          </Avatar>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                            onClick={handleRemoveLogo}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="h-20 w-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                          <Building2 className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={handleLogoChange}
                          className="hidden"
                          id="logo-upload"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => logoInputRef.current?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {logoPreview ? "Alterar Logo" : "Selecionar Logo"}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          JPEG, PNG, GIF ou WebP. Máximo 5MB.
                        </p>
                      </div>
                    </div>
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
                <h3 className="font-semibold mb-3">Dados PIX</h3>
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
                    <select
                      id="city"
                      {...register("city")}
                      onChange={(e) => {
                        const selectedCity = cities.find(c => c.name === e.target.value);
                        if (selectedCity) {
                          setValue("city", selectedCity.name);
                          setValue("state", selectedCity.state);
                        } else {
                          setValue("city", e.target.value);
                        }
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Selecione uma cidade</option>
                      {editingCompany?.city && !cities.some(c => c.name.toLowerCase() === editingCompany.city!.toLowerCase()) && (
                        <option value={editingCompany.city}>
                          {editingCompany.city} {editingCompany.state ? `- ${editingCompany.state}` : ""}
                        </option>
                      )}
                      {cities
                        .filter(city => city.active)
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(city => (
                          <option key={city.id} value={city.name}>
                            {city.name} - {city.state}
                          </option>
                        ))
                      }
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="state">Estado</Label>
                    <Input
                      id="state"
                      {...register("state")}
                      placeholder="UF"
                      maxLength={2}
                      readOnly
                      className="bg-muted"
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

              {/* Tipo de Pagamento */}
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-3">Tipo de Pagamento</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="paymentType">Forma de Pagamento</Label>
                    <select
                      id="paymentType"
                      {...register("paymentType")}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="PRE_PAGO">Pré Pago</option>
                      <option value="BOLETO">Boleto</option>
                    </select>
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
                disabled={createMutation.isPending || updateMutation.isPending || isUploadingLogo}
              >
                {createMutation.isPending || updateMutation.isPending || isUploadingLogo
                  ? "Salvando..."
                  : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de visualização da empresa */}
      <Dialog open={viewDialogOpen} onOpenChange={handleCloseViewDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualizar Cadastro da Empresa</DialogTitle>
          </DialogHeader>
          {viewingCompany && (
            <Tabs defaultValue="cadastro" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
                <TabsTrigger value="corridas">Corridas</TabsTrigger>
                <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
              </TabsList>

              <TabsContent value="cadastro" className="space-y-6 mt-4">
                {/* Dados da Empresa */}
                <div className="border-b pb-4">
                  <h3 className="font-semibold mb-3 text-lg">Dados da Empresa</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Logo da Empresa */}
                    <div className="md:col-span-2 flex items-center gap-4 mb-2">
                      <Avatar className="h-20 w-20 rounded-lg">
                        <AvatarImage src={viewingCompany.logoUrl || undefined} alt={viewingCompany.name} className="object-cover" />
                        <AvatarFallback className="rounded-lg bg-gray-100">
                          <Building2 className="h-8 w-8 text-gray-400" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <Label className="text-muted-foreground">Logo</Label>
                        <p className="text-sm text-muted-foreground">
                          {viewingCompany.logoUrl ? "Logo cadastrado" : "Sem logo"}
                        </p>
                      </div>
                    </div>
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
                      <Label className="text-muted-foreground">Tipo de Pagamento</Label>
                      <p className="font-medium">
                        {viewingCompany.paymentType === "BOLETO" ? (
                          <span className="text-blue-600">Boleto</span>
                        ) : (
                          <span className="text-green-600">Pré Pago</span>
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

            <TabsContent value="financeiro" className="space-y-6 mt-4">
              {/* Informações do Wallet */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
                    <Wallet className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        parseFloat(companyWallet?.wallet?.availableBalance || "0")
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Disponível para uso
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Saldo Bloqueado</CardTitle>
                    <CreditCard className="h-4 w-4 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-500">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        parseFloat(companyWallet?.wallet?.blockedBalance || "0")
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Em processamento
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Recarregado</CardTitle>
                    <ArrowDownToLine className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        companyWallet?.totals?.totalRecharges || 0
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {companyWallet?.totals?.confirmedCount || 0} de {companyWallet?.totals?.chargesCount || 0} confirmadas
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Seletor Recargas/Boletos/Transações */}
              <div className="flex items-center gap-4 border-b pb-4">
                <span className="text-sm font-medium">Visualizar:</span>
                <div className="flex gap-2">
                  <Button
                    variant={financialView === "recargas" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFinancialView("recargas")}
                    className="gap-2"
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                    Recargas
                  </Button>
                  <Button
                    variant={financialView === "boletos" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFinancialView("boletos")}
                    className="gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Boletos
                  </Button>
                  <Button
                    variant={financialView === "pagamentos" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFinancialView("pagamentos")}
                    className="gap-2"
                  >
                    <ArrowUpFromLine className="h-4 w-4" />
                    Transações
                  </Button>
                </div>
              </div>

              {/* Lista de Recargas */}
              {financialView === "recargas" && (
                <div className="border rounded-lg">
                  <div className="p-4 border-b bg-muted/50">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <ArrowDownToLine className="h-5 w-5" />
                      Histórico de Recargas
                    </h3>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {!companyWallet?.charges || companyWallet.charges.filter(c => c.chargeType === 'recharge').length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Nenhuma recarga realizada ainda
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data/Hora</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {companyWallet.charges.filter(c => c.chargeType === 'recharge').map((charge) => (
                            <TableRow key={charge.id}>
                              <TableCell className="font-medium">
                                {new Date(charge.createdAt).toLocaleString('pt-BR')}
                              </TableCell>
                              <TableCell className="text-green-600 font-medium">
                                + {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                  parseFloat(charge.amount || "0")
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-xs px-2 py-1 rounded bg-gray-100">
                                  {charge.paymentMethod === 'pix' ? 'PIX' :
                                   charge.paymentMethod === 'boleto' ? 'Boleto' :
                                   charge.paymentMethod}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  charge.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                  charge.status === 'failed' || charge.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {charge.status === 'confirmed' ? 'Confirmada' :
                                   charge.status === 'failed' ? 'Falhou' :
                                   charge.status === 'cancelled' ? 'Cancelada' :
                                   'Pendente'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                  {companyWallet?.charges && companyWallet.charges.filter(c => c.chargeType === 'recharge').length > 0 && (
                    <div className="p-4 border-t bg-muted/50">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Total de recargas: {companyWallet.charges.filter(c => c.chargeType === 'recharge').length}
                        </span>
                        <span className="font-semibold text-green-600">
                          Confirmado: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                            companyWallet.totals?.totalRecharges || 0
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Lista de Boletos Semanais */}
              {financialView === "boletos" && (
                <div className="border rounded-lg">
                  <div className="p-4 border-b bg-muted/50">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Boletos Semanais
                    </h3>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {!companyWallet?.charges || companyWallet.charges.filter(c => c.chargeType === 'weekly').length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Nenhum boleto semanal gerado ainda
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Período</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Entregas</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {companyWallet.charges.filter(c => c.chargeType === 'weekly').map((charge) => (
                            <TableRow key={charge.id}>
                              <TableCell className="font-medium">
                                {charge.periodStart && charge.periodEnd ? (
                                  `${new Date(charge.periodStart).toLocaleDateString('pt-BR')} a ${new Date(charge.periodEnd).toLocaleDateString('pt-BR')}`
                                ) : (
                                  new Date(charge.createdAt).toLocaleDateString('pt-BR')
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                  parseFloat(charge.amount || "0")
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-xs px-2 py-1 rounded bg-gray-100">
                                  {charge.deliveriesCount || 0} entregas
                                </span>
                              </TableCell>
                              <TableCell>
                                {charge.dueDate ? new Date(charge.dueDate).toLocaleDateString('pt-BR') : '-'}
                              </TableCell>
                              <TableCell>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  charge.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                  charge.status === 'overdue' ? 'bg-red-100 text-red-700' :
                                  charge.status === 'failed' || charge.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {charge.status === 'confirmed' ? 'Pago' :
                                   charge.status === 'overdue' ? 'Vencido' :
                                   charge.status === 'failed' ? 'Falhou' :
                                   charge.status === 'cancelled' ? 'Cancelado' :
                                   'Aguardando'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {charge.boletoUrl && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => window.open(charge.boletoUrl!, '_blank')}
                                      title="Abrir Boleto"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {charge.boletoDigitableLine && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(charge.boletoDigitableLine!, 'Linha digitável')}
                                      title="Copiar Linha Digitável"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {charge.pixCopyPaste && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(charge.pixCopyPaste!, 'PIX Copia e Cola')}
                                      title="Copiar PIX"
                                      className="text-green-600"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                  {companyWallet?.charges && companyWallet.charges.filter(c => c.chargeType === 'weekly').length > 0 && (
                    <div className="p-4 border-t bg-muted/50">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Total de boletos: {companyWallet.charges.filter(c => c.chargeType === 'weekly').length}
                        </span>
                        <span className="font-semibold">
                          Em aberto: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                            companyWallet.charges
                              .filter(c => c.chargeType === 'weekly' && c.status !== 'confirmed')
                              .reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0)
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Lista de Transações */}
              {financialView === "pagamentos" && (
                <div className="border rounded-lg">
                  <div className="p-4 border-b bg-muted/50">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <ArrowUpFromLine className="h-5 w-5" />
                      Histórico de Transações
                    </h3>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {!companyWallet?.transactions || companyWallet.transactions.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Nenhuma transação realizada ainda
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data/Hora</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Descrição</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {companyWallet.transactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell className="font-medium">
                                {new Date(transaction.createdAt).toLocaleString('pt-BR')}
                              </TableCell>
                              <TableCell>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  transaction.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {transaction.type === 'credit' ? 'Crédito' : 'Débito'}
                                </span>
                              </TableCell>
                              <TableCell className={transaction.type === 'credit' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                {transaction.type === 'credit' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                  parseFloat(transaction.amount || "0")
                                )}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate" title={transaction.description}>
                                {transaction.description || "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              )}
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

      {/* Dialog de geração de boleto manual */}
      <Dialog open={boletoDialogOpen} onOpenChange={handleCloseBoletoDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Gerar Boleto Manual
            </DialogTitle>
          </DialogHeader>

          {!boletoResult ? (
            // Estado inicial - mostrar entregas pendentes
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>{boletoCompany?.name}</strong>
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Modalidade: Pós-pago (Boleto Semanal)
                </p>
              </div>

              {/* Filtros de data */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !boletoDateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {boletoDateFrom ? format(boletoDateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={boletoDateFrom}
                        onSelect={setBoletoDateFrom}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !boletoDateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {boletoDateTo ? format(boletoDateTo, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={boletoDateTo}
                        onSelect={setBoletoDateTo}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {isLoadingPending ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingDeliveries?.count === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="font-medium">Nenhuma entrega pendente</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Todas as entregas já foram cobradas ou não há entregas no período.
                  </p>
                  {pendingDeliveries?.completedNotRegistered && pendingDeliveries.completedNotRegistered > 0 && (
                    <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-left">
                      <p className="text-sm text-yellow-800">
                        <strong>Atenção:</strong> Há {pendingDeliveries.completedNotRegistered} entrega(s) concluída(s)
                        da última semana que ainda não foram registradas no sistema financeiro.
                        Isso pode indicar que o split não foi processado ao concluir as entregas.
                      </p>
                    </div>
                  )}
                  {/* Debug info - always show */}
                  <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3 text-left">
                    <p className="text-xs font-medium text-gray-700 mb-2">Debug - Entregas desta empresa:</p>
                    {pendingDeliveries?.debug?.recentDeliveries && pendingDeliveries.debug.recentDeliveries.length > 0 ? (
                      <>
                        <div className="space-y-1">
                          {pendingDeliveries.debug.recentDeliveries.slice(0, 5).map((d) => (
                            <div key={d.id} className="text-xs flex items-center justify-between gap-2">
                              <span className="font-mono">#{d.requestNumber}</span>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded ${
                                  d.status === 'completed' ? 'bg-green-100 text-green-700' :
                                  d.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                  d.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {d.status === 'completed' ? 'Concluída' :
                                   d.status === 'cancelled' ? 'Cancelada' :
                                   d.status === 'in_progress' ? 'Em andamento' :
                                   'Pendente'}
                                </span>
                                {d.isCompleted && !d.completedAt && (
                                  <span className="text-orange-600 text-[10px]">⚠️ Sem data</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">
                          Apenas entregas "Concluídas" são incluídas no boleto.
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Nenhuma entrega encontrada na tabela <code>requests</code> para esta empresa.
                      </p>
                    )}
                    <div className="mt-2 pt-2 border-t border-gray-200 text-[10px] text-gray-400 space-y-1">
                      <p>Entregas não registradas (concluídas sem split): <strong>{pendingDeliveries?.completedNotRegistered || 0}</strong></p>
                      <p>Entregas em deliveryFinancials: <strong>{pendingDeliveries?.count || 0}</strong></p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Entregas pendentes:</span>
                      <span className="font-semibold">{pendingDeliveries?.count || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Valor total:</span>
                      <span className="font-semibold text-green-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          pendingDeliveries?.totalAmount || 0
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      O boleto será gerado com vencimento em <strong>2 dias</strong>.
                      As entregas pendentes serão incluídas na cobrança.
                    </p>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={handleCloseBoletoDialog}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleGenerateBoleto}
                  disabled={generateBoletoMutation.isPending || isLoadingPending || pendingDeliveries?.count === 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {generateBoletoMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Gerar Boleto
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            // Resultado após gerar
            <div className="space-y-4">
              {boletoResult.success && boletoResult.deliveriesCount && boletoResult.deliveriesCount > 0 ? (
                <>
                  <div className="text-center py-4">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <p className="font-medium text-lg">Boleto gerado com sucesso!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {boletoResult.deliveriesCount} entrega(s) incluída(s)
                    </p>
                  </div>

                  <div className="bg-muted rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Valor total:</span>
                      <span className="font-bold text-lg text-green-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          boletoResult.totalAmount || 0
                        )}
                      </span>
                    </div>
                    {boletoResult.charge?.dueDate && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Vencimento:</span>
                        <span className="font-medium">
                          {new Date(boletoResult.charge.dueDate).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Ações do boleto */}
                  <div className="space-y-2">
                    {boletoResult.charge?.boletoUrl && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => window.open(boletoResult.charge!.boletoUrl!, '_blank')}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir Boleto
                      </Button>
                    )}
                    {boletoResult.charge?.boletoBarcode && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => copyToClipboard(boletoResult.charge!.boletoBarcode!, 'Código de barras')}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar Código de Barras
                      </Button>
                    )}
                    {boletoResult.charge?.pixCopyPaste && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => copyToClipboard(boletoResult.charge!.pixCopyPaste!, 'PIX Copia e Cola')}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar PIX Copia e Cola
                      </Button>
                    )}
                  </div>
                </>
              ) : boletoResult.success && boletoResult.deliveriesCount === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="font-medium">Nenhuma entrega pendente</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Não há entregas para incluir no boleto.
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <X className="h-6 w-6 text-red-600" />
                  </div>
                  <p className="font-medium text-red-600">Erro ao gerar boleto</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {boletoResult.message}
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button onClick={handleCloseBoletoDialog}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
