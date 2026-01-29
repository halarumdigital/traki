import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlusCircle, Package, Trash2, Calendar, MapPin, Clock, Ruler, Eye, Phone, Building2, User, Loader2, Route, Filter, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import "@/styles/google-maps-fix.css";

// Declaração do tipo Google Maps
declare global {
  interface Window {
    google: typeof google;
  }
}

type EntregaIntermunicipal = {
  id: string;
  rotaId: string;
  rotaNome: string;
  numeroPedido: string;
  dataAgendada: string;
  enderecoColetaCompleto: string;
  enderecoEntregaCompleto: string;
  destinatarioNome: string;
  destinatarioTelefone: string;
  quantidadePacotes: number;
  pesoTotalKg: string;
  valorTotal: string;
  status: string;
  viagemId?: string;
  motoristaName?: string;
  createdAt: string;
};

type RotaIntermunicipal = {
  id: string;
  nomeRota: string;
  cidadeOrigemNome: string;
  cidadeDestinoNome: string;
  distanciaKm: string;
  tempoMedioMinutos: number;
  ativa: boolean;
  diasSemana: number[]; // Dias da semana disponíveis (1=Seg, 2=Ter, ..., 7=Dom)
};

type CityPrice = {
  id: string;
  rotaIntermunicipalId: string;
  rotaIntermunicipalNome: string;
  vehicleTypeName: string;
  basePrice: string;
  pricePerDistance: string;
  stopPrice: string;
  active: boolean;
};

type Parada = {
  id: string;
  ordem: number;
  destinatarioNome: string;
  destinatarioTelefone: string;
  enderecoCompleto: string;
  observacoes: string | null;
};

type EntregaDetalhes = EntregaIntermunicipal & {
  paradas: Parada[];
  viagem: {
    id: string;
    dataViagem: string;
    viagemStatus: string;
    horarioSaidaPlanejado: string;
    horarioSaidaReal: string | null;
  } | null;
  entregador: {
    id: string;
    name: string;
    phone: string;
  } | null;
};

// Schema para cada endereço de entrega
const enderecoEntregaSchema = z.object({
  logradouro: z.string().min(3, "Logradouro é obrigatório"),
  numero: z.string().min(1, "Número é obrigatório"),
  bairro: z.string().min(2, "Bairro é obrigatório"),
  cidade: z.string().min(2, "Cidade é obrigatória"),
  cep: z.string().min(8, "CEP é obrigatório"),
  pontoReferencia: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  destinatarioNome: z.string().min(3, "Nome do destinatário é obrigatório"),
  destinatarioTelefone: z.string().min(10, "Telefone do destinatário é obrigatório"),
});

const entregaSchema = z.object({
  rotaId: z.string().min(1, "Rota é obrigatória"),
  precoId: z.string().min(1, "Configuração de preço é obrigatória"),
  dataAgendada: z.string().min(1, "Data é obrigatória"),

  // Endereço de coleta (campos separados - preenchido automaticamente)
  enderecoColetaLogradouro: z.string().min(1, "Logradouro é obrigatório"),
  enderecoColetaNumero: z.string().min(1, "Número é obrigatório"),
  enderecoColetaBairro: z.string().min(1, "Bairro é obrigatório"),
  enderecoColetaCidade: z.string().optional(),
  enderecoColetaCep: z.string().optional(),
  enderecoColetaPontoReferencia: z.string().optional(),
  enderecoColetaLatitude: z.string().optional(),
  enderecoColetaLongitude: z.string().optional(),

  // Array de endereços de entrega
  enderecosEntrega: z.array(enderecoEntregaSchema).min(1, "Pelo menos um endereço de entrega é obrigatório"),

  // Informações do pacote
  quantidadePacotes: z.coerce.number().min(1, "Quantidade deve ser maior que zero"),
  descricaoConteudo: z.string().optional(),
  observacoes: z.string().optional(),
});

type EntregaForm = z.infer<typeof entregaSchema>;

const statusColors: Record<string, string> = {
  aguardando_motorista: "secondary",
  motorista_aceito: "default",
  em_coleta: "default",
  coletado: "default",
  em_transito: "default",
  em_entrega: "default",
  entregue: "default",
  cancelada: "destructive",
};

const statusLabels: Record<string, string> = {
  aguardando_motorista: "Aguardando Motorista",
  motorista_aceito: "Motorista Aceitou",
  em_coleta: "Em Coleta",
  coletado: "Coletado",
  em_transito: "Em Trânsito",
  em_entrega: "Em Entrega",
  entregue: "Entregue",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

// Helpers para dias da semana
const diasSemanaNomes: Record<number, string> = {
  1: "segunda-feira",
  2: "terça-feira",
  3: "quarta-feira",
  4: "quinta-feira",
  5: "sexta-feira",
  6: "sábado",
  7: "domingo",
};

function getDiasSemanaTexto(diasSemana: number[]): string {
  if (!diasSemana || diasSemana.length === 0) return "";
  if (diasSemana.length === 7) return "todos os dias";
  if (diasSemana.length === 1) return `toda ${diasSemanaNomes[diasSemana[0]]}`;

  const nomes = diasSemana.map(d => diasSemanaNomes[d]);
  if (nomes.length === 2) {
    return `toda ${nomes[0]} e ${nomes[1]}`;
  }

  const ultimos = nomes.slice(-1)[0];
  const primeiros = nomes.slice(0, -1).join(", ");
  return `toda ${primeiros} e ${ultimos}`;
}

export default function EntregasIntermunicipais() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRota, setSelectedRota] = useState<string>("");
  const [accordionValue, setAccordionValue] = useState<string>("0");
  const [selectedEntregaId, setSelectedEntregaId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("todas");
  const enderecoInputsRef = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const autocompletesRef = useRef<{ [key: number]: google.maps.places.Autocomplete | null }>({});

  // Buscar dados da empresa logada
  const { data: empresa } = useQuery<any>({
    queryKey: ["/api/empresa/auth/me"],
  });

  // Buscar configuração do Google Maps
  const { data: googleMapsConfig } = useQuery<any>({
    queryKey: ["/api/config/google-maps"],
  });

  // Buscar entregas (auto-refresh a cada 5 segundos)
  const { data: entregas = [], isLoading } = useQuery<EntregaIntermunicipal[]>({
    queryKey: ["/api/entregas-intermunicipais"],
    refetchInterval: 5000, // Atualiza a cada 5 segundos
  });

  // Filtrar entregas baseado no status selecionado
  const entregasFiltradas = entregas.filter((entrega) => {
    if (statusFilter === "todas") return true;
    if (statusFilter === "aguardando_motorista") return entrega.status === "aguardando_motorista";
    // Concluídas = status "concluida"
    if (statusFilter === "concluidas") return entrega.status === "concluida";
    if (statusFilter === "canceladas") return entrega.status === "cancelada";
    return true;
  });

  // Contadores por status
  const contadores = {
    todas: entregas.length,
    aguardando_motorista: entregas.filter(e => e.status === "aguardando_motorista").length,
    concluidas: entregas.filter(e => e.status === "concluida").length,
    canceladas: entregas.filter(e => e.status === "cancelada").length,
  };

  // Buscar detalhes da entrega selecionada
  const { data: entregaDetalhes, isLoading: loadingDetalhes } = useQuery<EntregaDetalhes>({
    queryKey: ["/api/entregas-intermunicipais", selectedEntregaId],
    enabled: !!selectedEntregaId,
  });

  // Buscar rotas ativas
  const { data: rotas = [] } = useQuery<RotaIntermunicipal[]>({
    queryKey: ["/api/rotas-intermunicipais"],
    select: (data) => data.filter((r) => r.ativa),
  });

  // Buscar preços para rota selecionada
  const { data: precos = [] } = useQuery<CityPrice[]>({
    queryKey: ["/api/city-prices"],
    select: (data) => {
      console.log("🔍 Filtrando preços:", {
        selectedRota,
        totalPrecos: data.length,
        precosFiltrados: data.filter((p) => p.active && p.rotaIntermunicipalId === selectedRota).length,
        todosPrecos: data.map(p => ({ id: p.rotaIntermunicipalId, nome: p.rotaIntermunicipalNome, ativo: p.active }))
      });
      return data.filter((p) => p.active && p.rotaIntermunicipalId === selectedRota);
    },
    enabled: !!selectedRota,
  });

  // Selecionar automaticamente se houver apenas 1 categoria
  useEffect(() => {
    if (precos.length === 1 && !form.watch("precoId")) {
      console.log("✅ Auto-selecionando única categoria:", precos[0].vehicleTypeName);
      form.setValue("precoId", precos[0].id);
    }
  }, [precos]);

  // Mutation para criar entrega
  const createMutation = useMutation({
    mutationFn: async (data: EntregaForm) => {
      return await apiRequest("POST", "/api/entregas-intermunicipais", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entregas-intermunicipais"] });
      toast({ title: "Sucesso!", description: "Entrega agendada com sucesso" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao agendar entrega",
        variant: "destructive"
      });
    },
  });

  // Mutation para cancelar entrega
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/entregas-intermunicipais/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entregas-intermunicipais"] });
      toast({ title: "Sucesso!", description: "Entrega cancelada com sucesso" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao cancelar entrega",
        variant: "destructive"
      });
    },
  });

  // Mutation para relançar entrega cancelada
  const relaunchMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/entregas-intermunicipais/${id}/relaunch`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entregas-intermunicipais"] });
      toast({ title: "Sucesso!", description: "Entrega relançada com sucesso" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao relançar entrega",
        variant: "destructive"
      });
    },
  });

  const form = useForm<EntregaForm>({
    resolver: zodResolver(entregaSchema),
    defaultValues: {
      rotaId: "",
      precoId: "",
      dataAgendada: "",
      enderecoColetaLogradouro: "",
      enderecoColetaNumero: "",
      enderecoColetaBairro: "",
      enderecoColetaCidade: "",
      enderecoColetaCep: "",
      enderecoColetaPontoReferencia: "",
      enderecosEntrega: [{
        logradouro: "",
        numero: "",
        bairro: "",
        cidade: "",
        cep: "",
        pontoReferencia: "",
        destinatarioNome: "",
        destinatarioTelefone: "",
      }],
      quantidadePacotes: 1,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "enderecosEntrega",
  });

  const rotaId = form.watch("rotaId");

  const handleOpenDialog = () => {
    // Preencher endereço de coleta com dados da empresa (campos separados)
    form.reset({
      rotaId: "",
      precoId: "",
      dataAgendada: "",
      enderecoColetaLogradouro: empresa?.street || "",
      enderecoColetaNumero: empresa?.number || "",
      enderecoColetaBairro: empresa?.neighborhood || "",
      enderecoColetaCidade: empresa?.city || "",
      enderecoColetaCep: empresa?.cep || "",
      enderecoColetaPontoReferencia: empresa?.reference || "",
      enderecosEntrega: [{
        logradouro: "",
        numero: "",
        bairro: "",
        cidade: "",
        cep: "",
        pontoReferencia: "",
        destinatarioNome: "",
        destinatarioTelefone: "",
      }],
      quantidadePacotes: 1,
    });
    setSelectedRota("");
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    form.reset();
    setSelectedRota("");
  };

  const onSubmit = async (data: EntregaForm) => {
    // Montar endereço completo de coleta a partir dos campos separados
    const enderecoColetaCompleto = `${data.enderecoColetaLogradouro}, ${data.enderecoColetaNumero}, ${data.enderecoColetaBairro}${data.enderecoColetaCidade ? `, ${data.enderecoColetaCidade}` : ''}${data.enderecoColetaCep ? `, CEP: ${data.enderecoColetaCep}` : ''}${data.enderecoColetaPontoReferencia ? ` - Ref: ${data.enderecoColetaPontoReferencia}` : ''}`;

    // Processar todos os endereços de entrega com endereço completo
    const enderecosEntrega = data.enderecosEntrega.map((endereco) => ({
      ...endereco,
      enderecoCompleto: `${endereco.logradouro}, ${endereco.numero}, ${endereco.bairro}, ${endereco.cidade}, CEP: ${endereco.cep}${endereco.pontoReferencia ? ` - Ref: ${endereco.pontoReferencia}` : ''}`,
    }));

    // Criar UMA entrega com MÚLTIPLOS endereços
    const payload = {
      rotaId: data.rotaId,
      precoId: data.precoId,
      dataAgendada: data.dataAgendada,
      enderecoColetaLogradouro: data.enderecoColetaLogradouro,
      enderecoColetaNumero: data.enderecoColetaNumero,
      enderecoColetaBairro: data.enderecoColetaBairro,
      enderecoColetaCidade: data.enderecoColetaCidade,
      enderecoColetaCep: data.enderecoColetaCep,
      enderecoColetaPontoReferencia: data.enderecoColetaPontoReferencia,
      enderecoColetaLatitude: data.enderecoColetaLatitude,
      enderecoColetaLongitude: data.enderecoColetaLongitude,
      enderecoColetaCompleto,
      enderecosEntrega, // Array com todos os endereços
      quantidadePacotes: data.quantidadePacotes,
      descricaoConteudo: data.descricaoConteudo,
      observacoes: data.observacoes,
    };

    try {
      await apiRequest("POST", "/api/entregas-intermunicipais", payload);
      queryClient.invalidateQueries({ queryKey: ["/api/entregas-intermunicipais"] });

      const numParadas = data.enderecosEntrega.length;
      toast({
        title: "Sucesso!",
        description: numParadas > 1
          ? `Entrega agendada com ${numParadas} paradas`
          : "Entrega agendada com sucesso"
      });
      setIsDialogOpen(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao agendar entrega",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string, status: string, viagemId?: string) => {
    if (viagemId) {
      toast({
        title: "Atenção",
        description: "Esta entrega já foi aceita por um motorista. Entre em contato com o suporte para cancelamento.",
        variant: "destructive",
      });
      return;
    }

    if (confirm("Tem certeza que deseja cancelar esta entrega?")) {
      deleteMutation.mutate(id);
    }
  };

  // Load Google Maps script
  useEffect(() => {
    if (!googleMapsConfig?.apiKey) return;

    const scriptId = "google-maps-script";
    if (document.getElementById(scriptId)) return;

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsConfig.apiKey}&libraries=places,geometry`;
    script.async = true;
    document.head.appendChild(script);
  }, [googleMapsConfig]);

  // Função para inicializar autocomplete para um endereço específico
  const initializeAutocomplete = useCallback((index: number) => {
    const inputElement = enderecoInputsRef.current[index];

    if (!window.google?.maps?.places || !inputElement) {
      return;
    }

    // Limpar autocomplete anterior para este índice
    if (autocompletesRef.current[index]) {
      google.maps.event.clearInstanceListeners(autocompletesRef.current[index]!);
    }

    // Criar novo autocomplete
    const autocomplete = new google.maps.places.Autocomplete(inputElement, {
      componentRestrictions: { country: "br" },
      fields: ["address_components", "formatted_address", "geometry"],
      types: ["address"],
    });

    autocompletesRef.current[index] = autocomplete;

    // Listener para quando o usuário seleciona um endereço
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.address_components) return;

      let street = "";
      let number = "";
      let neighborhood = "";
      let postalCode = "";
      let city = "";

      place.address_components.forEach((component) => {
        const types = component.types;
        if (types.includes("route")) street = component.long_name;
        if (types.includes("street_number")) number = component.long_name;
        if (types.includes("sublocality") || types.includes("sublocality_level_1"))
          neighborhood = component.long_name;
        if (types.includes("postal_code")) postalCode = component.long_name;
        if (types.includes("administrative_area_level_2")) city = component.long_name;
      });

      // Atualizar o formulário com os dados do endereço específico
      form.setValue(`enderecosEntrega.${index}.logradouro`, street);
      form.setValue(`enderecosEntrega.${index}.numero`, number);
      form.setValue(`enderecosEntrega.${index}.bairro`, neighborhood);
      form.setValue(`enderecosEntrega.${index}.cidade`, city);
      form.setValue(`enderecosEntrega.${index}.cep`, postalCode);
    });
  }, [form]);

  // Setup Google Places Autocomplete para todos os campos
  useEffect(() => {
    if (!window.google?.maps?.places || !isDialogOpen) {
      // Limpar todos os autocompletes quando o modal fecha
      if (!isDialogOpen) {
        Object.values(autocompletesRef.current).forEach((autocomplete) => {
          if (autocomplete) {
            google.maps.event.clearInstanceListeners(autocomplete);
          }
        });
        autocompletesRef.current = {};
        enderecoInputsRef.current = {};
      }
      return;
    }

    // Inicializar autocomplete para cada campo que existe
    const timer = setTimeout(() => {
      fields.forEach((_, index) => {
        if (enderecoInputsRef.current[index]) {
          initializeAutocomplete(index);
        }
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [isDialogOpen, fields, initializeAutocomplete]);

  // Inicializar autocomplete quando o accordion abre um novo item
  useEffect(() => {
    if (!window.google?.maps?.places || !isDialogOpen || accordionValue === "") {
      return;
    }

    const index = parseInt(accordionValue, 10);
    if (isNaN(index)) return;

    // Aguardar o accordion terminar de abrir e o input estar disponível
    const timer = setTimeout(() => {
      const inputElement = enderecoInputsRef.current[index];
      if (inputElement && !autocompletesRef.current[index]) {
        initializeAutocomplete(index);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [accordionValue, isDialogOpen, initializeAutocomplete]);

  // Atualizar selectedRota quando rotaId mudar
  if (rotaId && rotaId !== selectedRota) {
    console.log("🔄 Atualizando selectedRota:", { de: selectedRota, para: rotaId });
    setSelectedRota(rotaId);
  }

  const rotaSelecionada = rotas.find((r) => r.id === rotaId);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <MapPin className="h-6 w-6 text-slate-500" />
            Entregas Intermunicipais
          </h1>
          <p className="text-slate-500">Gerencie entregas entre cidades e rotas longas.</p>
        </div>
        <Button onClick={handleOpenDialog} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          Nova Entrega Intermunicipal
        </Button>
      </div>

      {/* Lista de Entregas */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="px-6 py-4 border-b border-slate-100 bg-white rounded-t-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">Entregas Intermunicipais</CardTitle>
              <CardDescription>
                Mostrando {entregasFiltradas.length} de {entregas.length} entregas
              </CardDescription>
            </div>

            {/* Filtro de Status */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas ({contadores.todas})</SelectItem>
                  <SelectItem value="aguardando_motorista">Aguardando Motorista ({contadores.aguardando_motorista})</SelectItem>
                  <SelectItem value="concluidas">Concluídas ({contadores.concluidas})</SelectItem>
                  <SelectItem value="canceladas">Canceladas ({contadores.canceladas})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : entregasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Package className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">
                {statusFilter === "todas"
                  ? "Nenhuma entrega agendada"
                  : `Nenhuma entrega ${statusFilter === "aguardando_motorista" ? "aguardando motorista" : statusFilter === "concluidas" ? "concluída" : "cancelada"}`}
              </h3>
              <p className="text-sm text-slate-500 max-w-sm">
                {statusFilter === "todas"
                  ? 'Clique em "Nova Entrega" para agendar uma entrega intermunicipal.'
                  : "Tente alterar o filtro para ver outras entregas."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[180px] font-semibold text-slate-600">ID</TableHead>
                  <TableHead className="font-semibold text-slate-600">Cliente</TableHead>
                  <TableHead className="font-semibold text-slate-600">Rota</TableHead>
                  <TableHead className="font-semibold text-slate-600">Motorista</TableHead>
                  <TableHead className="font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="font-semibold text-slate-600">Data</TableHead>
                  <TableHead className="font-semibold text-slate-600 text-right">Valor</TableHead>
                  <TableHead className="w-[80px] text-center font-semibold text-slate-600">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entregasFiltradas.map((entrega) => (
                  <TableRow key={entrega.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-mono text-xs text-slate-500 font-medium">{entrega.numeroPedido}</TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">{entrega.destinatarioNome}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-slate-700">
                        <MapPin className="h-3 w-3 text-blue-500" />
                        {entrega.rotaNome}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entrega.motoristaName ? (
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                            <User className="h-4 w-4 text-slate-500" />
                          </div>
                          <div>
                            <div className="font-medium text-sm text-slate-900">{entrega.motoristaName}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-sm">Aguardando</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "font-medium border",
                          entrega.status === "aguardando_motorista" && "bg-amber-50 text-amber-700 border-amber-200",
                          entrega.status === "entregue" && "bg-green-50 text-green-700 border-green-200",
                          entrega.status === "concluida" && "bg-green-50 text-green-700 border-green-200",
                          entrega.status === "em_transito" && "bg-blue-50 text-blue-700 border-blue-200",
                          entrega.status === "cancelada" && "bg-red-50 text-red-700 border-red-200"
                        )}
                      >
                        {statusLabels[entrega.status] || entrega.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-900">
                        {format(new Date(entrega.dataAgendada), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-medium",
                      entrega.status === "cancelada" ? "text-slate-400" : "text-green-600"
                    )}>
                      R$ {entrega.status === "cancelada" ? "0,00" : parseFloat(entrega.valorTotal).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {entrega.status === "cancelada" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => relaunchMutation.mutate(entrega.id)}
                            disabled={relaunchMutation.isPending}
                            title="Relançar entrega"
                            className="h-8 w-8 text-slate-500 hover:text-green-600"
                          >
                            {relaunchMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedEntregaId(entrega.id)}
                          title="Ver detalhes"
                          className="h-8 w-8 text-slate-500 hover:text-blue-600"
                        >
                          <Eye className="h-4 w-4" />
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

      {/* Dialog para nova entrega */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => {
            // Não fechar o modal quando clicar no dropdown do Google Autocomplete
            const target = e.target as HTMLElement;
            if (target.closest('.pac-container')) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Agendar Nova Entrega Intermunicipal</DialogTitle>
            <DialogDescription>
              Preencha os dados da entrega entre cidades
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Seleção de Rota e Data */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="rotaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rota</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a rota" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {rotas.map((rota) => (
                            <SelectItem key={rota.id} value={rota.id}>
                              {rota.nomeRota}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dataAgendada"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data da Entrega</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP", { locale: ptBR })
                              ) : (
                                <span>Selecione a data</span>
                              )}
                              <Calendar className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => {
                              field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                            }}
                            disabled={(date) => {
                              // Desabilitar datas passadas
                              const hoje = new Date();
                              hoje.setHours(0, 0, 0, 0);
                              if (date < hoje) return true;

                              // Se tem rota selecionada, desabilitar dias que não estão no diasSemana
                              if (rotaSelecionada?.diasSemana) {
                                // getDay() retorna 0=Dom, 1=Seg, ..., 6=Sab
                                // Converter para 1=Seg, 2=Ter, ..., 7=Dom
                                const diaSemana = date.getDay() === 0 ? 7 : date.getDay();
                                return !rotaSelecionada.diasSemana.includes(diaSemana);
                              }

                              return false;
                            }}
                            locale={ptBR}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {rotaSelecionada?.diasSemana && (
                        <FormDescription>
                          Rota disponível {getDiasSemanaTexto(rotaSelecionada.diasSemana)}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Informações da rota selecionada */}
              {rotaSelecionada && (
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="mb-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        {rotaSelecionada.cidadeOrigemNome} → {rotaSelecionada.cidadeDestinoNome}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Distância</p>
                        <p className="font-semibold">{parseFloat(rotaSelecionada.distanciaKm).toFixed(1)} km</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Tempo médio</p>
                        <p className="font-semibold">{rotaSelecionada.tempoMedioMinutos} min</p>
                      </div>
                    </div>

                    {(() => {
                      const precoSelecionado = precos.find(p => p.id === form.watch("precoId"));
                      if (precoSelecionado) {
                        const basePrice = parseFloat(precoSelecionado.basePrice);
                        const pricePerDistance = parseFloat(precoSelecionado.pricePerDistance);
                        const distancia = parseFloat(rotaSelecionada.distanciaKm);
                        const valorTotal = basePrice + (pricePerDistance * distancia);

                        return (
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Valor Total</p>
                              <p className="font-semibold text-green-600">
                                {new Intl.NumberFormat("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                }).format(valorTotal)}
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              )}

              {/* Categoria/Preço */}
              {selectedRota && (
                precos.length > 0 ? (
                  <FormField
                    control={form.control}
                    name="precoId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria do Veículo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {precos.map((preco) => (
                              <SelectItem key={preco.id} value={preco.id}>
                                {preco.vehicleTypeName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          O valor final será calculado automaticamente
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
                    <p className="text-sm text-orange-800">
                      ⚠️ Rota indisponível no momento, contate o suporte para maiores informações.
                    </p>
                  </div>
                )
              )}

              {/* Endereço de Coleta */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Endereço de Retirada
                </h3>
                <p className="text-sm text-muted-foreground">
                  Endereço da sua empresa (preenchido automaticamente)
                </p>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="enderecoColetaLogradouro"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Endereço</FormLabel>
                        <FormControl>
                          <Input
                            className="bg-muted"
                            readOnly
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="enderecoColetaNumero"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input
                            className="bg-muted"
                            readOnly
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="enderecoColetaBairro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input
                            className="bg-muted"
                            readOnly
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="enderecoColetaPontoReferencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Referência</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="(vazio)"
                            className="bg-muted"
                            readOnly
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Endereços de Entrega */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Endereços de Entrega</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      append({
                        logradouro: "",
                        numero: "",
                        bairro: "",
                        cidade: "",
                        cep: "",
                        pontoReferencia: "",
                        destinatarioNome: "",
                        destinatarioTelefone: "",
                      });
                      // Abrir o accordion do novo endereço
                      setAccordionValue(`${fields.length}`);
                    }}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Adicionar Endereço
                  </Button>
                </div>

                <Accordion type="single" collapsible value={accordionValue} onValueChange={setAccordionValue}>
                  {fields.map((field, index) => (
                    <AccordionItem key={field.id} value={`${index}`}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                          <span className="font-medium">
                            {form.watch(`enderecosEntrega.${index}.logradouro`) || `Endereço ${index + 1}`}
                          </span>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                remove(index);
                                // Se remover o endereço atual, abrir o primeiro
                                if (accordionValue === `${index}`) {
                                  setAccordionValue("0");
                                }
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-4">
                          {/* Endereço */}
                          <div className="grid grid-cols-3 gap-4">
                            <FormField
                              control={form.control}
                              name={`enderecosEntrega.${index}.logradouro`}
                              render={({ field }) => (
                                <FormItem className="col-span-2">
                                  <FormLabel>Logradouro</FormLabel>
                                  <input
                                    type="text"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Rua, Avenida, etc..."
                                    value={field.value}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={(el) => {
                                      enderecoInputsRef.current[index] = el;
                                      // Inicializar autocomplete quando o elemento estiver pronto
                                      if (el && window.google?.maps?.places && !autocompletesRef.current[index]) {
                                        setTimeout(() => initializeAutocomplete(index), 100);
                                      }
                                    }}
                                  />
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`enderecosEntrega.${index}.numero`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Número</FormLabel>
                                  <FormControl>
                                    <Input placeholder="123" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`enderecosEntrega.${index}.bairro`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Bairro</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Nome do bairro" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`enderecosEntrega.${index}.cidade`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Cidade</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Nome da cidade" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`enderecosEntrega.${index}.cep`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>CEP</FormLabel>
                                  <FormControl>
                                    <Input placeholder="00000-000" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`enderecosEntrega.${index}.pontoReferencia`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Ponto de Referência (Opcional)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Ex: Próximo ao mercado" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Dados do Destinatário */}
                          <div className="pt-4 border-t">
                            <h4 className="text-sm font-semibold mb-4">Dados do Destinatário</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name={`enderecosEntrega.${index}.destinatarioNome`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Nome</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Nome completo" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={`enderecosEntrega.${index}.destinatarioTelefone`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Telefone</FormLabel>
                                    <FormControl>
                                      <Input placeholder="(00) 00000-0000" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              {/* Informações do Pacote */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Informações do Pacote</h3>

                <FormField
                  control={form.control}
                  name="quantidadePacotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade de Pacotes</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="descricaoConteudo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição do Conteúdo (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Eletrônicos, roupas, documentos..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="observacoes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Informações adicionais sobre a entrega..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending
                    ? "Agendando..."
                    : "Agendar Entrega"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE DETALHES DA ENTREGA */}
      <Dialog open={!!selectedEntregaId} onOpenChange={(open) => !open && setSelectedEntregaId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Entrega</DialogTitle>
            <DialogDescription>
              Informações completas sobre a entrega intermunicipal
            </DialogDescription>
          </DialogHeader>

          {loadingDetalhes ? (
            <div className="text-center py-10">Carregando detalhes...</div>
          ) : entregaDetalhes ? (
            <div className="space-y-6">
              {/* INFORMAÇÕES PRINCIPAIS */}
              <div className="border-b pb-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Número do Pedido</label>
                  <p className="text-2xl font-bold">{entregaDetalhes.numeroPedido}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="mt-2">
                      <Badge variant={statusColors[entregaDetalhes.status] as any} className="text-base px-3 py-1">
                        {statusLabels[entregaDetalhes.status]}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Rota</label>
                    <p className="flex items-center gap-2 mt-2 text-base font-semibold">
                      <MapPin className="h-5 w-5 text-blue-600" />
                      {entregaDetalhes.rotaNome}
                    </p>
                  </div>
                </div>
              </div>

              {/* INFORMAÇÕES SECUNDÁRIAS */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Data Agendada</label>
                  <p className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {format(new Date(entregaDetalhes.dataAgendada), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Valor Total</label>
                  <p className={cn(
                    "text-lg font-semibold",
                    entregaDetalhes.status === "cancelada" ? "text-slate-400" : "text-green-600"
                  )}>
                    R$ {entregaDetalhes.status === "cancelada" ? "0,00" : parseFloat(entregaDetalhes.valorTotal).toFixed(2)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Pacotes/Peso</label>
                  <p className="mt-1">
                    {entregaDetalhes.quantidadePacotes} pacote(s) / {entregaDetalhes.pesoTotalKg} kg
                  </p>
                </div>
              </div>

              {/* INFORMAÇÕES DO MOTORISTA */}
              {entregaDetalhes.entregador && (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Motorista
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Nome</label>
                      <p className="mt-1">{entregaDetalhes.entregador.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Telefone</label>
                      <p className="flex items-center gap-2 mt-1">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {entregaDetalhes.entregador.phone}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ENDEREÇO DE COLETA */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  Endereço de Coleta
                </h3>
                <p className="text-sm">{entregaDetalhes.enderecoColetaCompleto}</p>
              </div>

              {/* PARADAS DE ENTREGA */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-5 w-5 text-green-600" />
                  Paradas de Entrega ({entregaDetalhes.paradas.length})
                </h3>
                <div className="space-y-4">
                  {entregaDetalhes.paradas.sort((a, b) => a.ordem - b.ordem).map((parada) => (
                    <div key={parada.id} className="border-l-4 border-green-500 pl-4 py-2 bg-muted/30 rounded-r">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold">Parada {parada.ordem} - {parada.destinatarioNome}</p>
                          <p className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Phone className="h-3 w-3" />
                            {parada.destinatarioTelefone}
                          </p>
                        </div>
                      </div>
                      <p className="flex items-start gap-2 text-sm mt-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        {parada.enderecoCompleto}
                      </p>
                      {parada.observacoes && (
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          Obs: {parada.observacoes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
