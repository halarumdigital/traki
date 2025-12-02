import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  ClipboardList,
  Copy,
  ExternalLink,
  BarChart3,
  MessageSquare,
  Eye,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

interface SurveyItem {
  id?: string;
  label: string;
  type: "nps" | "text";
  required: boolean;
}

interface Survey {
  id: string;
  title: string;
  description: string | null;
  publicSlug: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
  items?: SurveyItem[];
}

interface SurveyStats {
  survey: Survey;
  totalResponses: number;
  promoters: number;
  passives: number;
  detractors: number;
  npsScore: number;
  averageScores: { itemId: string; label: string; average: number }[];
  textResponses: { itemId: string; label: string; responses: string[] }[];
}

export default function PesquisasPage() {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    active: boolean;
    items: SurveyItem[];
  }>({
    title: "",
    description: "",
    active: true,
    items: [{ label: "", type: "nps", required: true }],
  });

  // Buscar pesquisas
  const { data: surveys = [], isLoading } = useQuery<Survey[]>({
    queryKey: ["/api/nps-surveys"],
  });

  // Buscar estatísticas de uma pesquisa
  const { data: stats, isLoading: isLoadingStats, error: statsError } = useQuery<SurveyStats>({
    queryKey: ["/api/nps-surveys", selectedSurvey?.id, "stats"],
    queryFn: async () => {
      if (!selectedSurvey?.id) return null;
      const res = await fetch(`/api/nps-surveys/${selectedSurvey.id}/stats`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar estatísticas");
      return res.json();
    },
    enabled: !!selectedSurvey?.id && isStatsModalOpen,
  });

  // Criar pesquisa
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/nps-surveys", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nps-surveys"] });
      toast({
        title: "Pesquisa criada",
        description: "A pesquisa foi criada com sucesso.",
      });
      handleCloseModal();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar pesquisa",
        description: error.message || "Ocorreu um erro ao criar a pesquisa.",
        variant: "destructive",
      });
    },
  });

  // Atualizar pesquisa
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      return await apiRequest("PUT", `/api/nps-surveys/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nps-surveys"] });
      toast({
        title: "Pesquisa atualizada",
        description: "A pesquisa foi atualizada com sucesso.",
      });
      handleCloseModal();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar pesquisa",
        description: error.message || "Ocorreu um erro ao atualizar a pesquisa.",
        variant: "destructive",
      });
    },
  });

  // Deletar pesquisa
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/nps-surveys/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nps-surveys"] });
      toast({
        title: "Pesquisa deletada",
        description: "A pesquisa foi deletada com sucesso.",
      });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar pesquisa",
        description: error.message || "Ocorreu um erro ao deletar a pesquisa.",
        variant: "destructive",
      });
    },
  });

  const handleOpenModal = async (survey?: Survey) => {
    if (survey) {
      // Buscar detalhes da pesquisa com itens
      try {
        const res = await fetch(`/api/nps-surveys/${survey.id}`);
        const fullSurvey = await res.json();
        setSelectedSurvey(fullSurvey);
        setFormData({
          title: fullSurvey.title,
          description: fullSurvey.description || "",
          active: fullSurvey.active,
          items: fullSurvey.items?.length > 0
            ? fullSurvey.items
            : [{ label: "", type: "nps", required: true }],
        });
      } catch (error) {
        console.error("Erro ao buscar pesquisa:", error);
      }
    } else {
      setSelectedSurvey(null);
      setFormData({
        title: "",
        description: "",
        active: true,
        items: [{ label: "", type: "nps", required: true }],
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSurvey(null);
    setFormData({
      title: "",
      description: "",
      active: true,
      items: [{ label: "", type: "nps", required: true }],
    });
  };

  const handleSubmit = () => {
    if (!formData.title) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha o título da pesquisa.",
        variant: "destructive",
      });
      return;
    }

    // Validar itens
    const validItems = formData.items.filter(item => item.label.trim());
    if (validItems.length === 0) {
      toast({
        title: "Adicione perguntas",
        description: "A pesquisa deve ter pelo menos uma pergunta.",
        variant: "destructive",
      });
      return;
    }

    if (selectedSurvey) {
      updateMutation.mutate({ ...formData, items: validItems, id: selectedSurvey.id });
    } else {
      createMutation.mutate({ ...formData, items: validItems });
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { label: "", type: "nps", required: true }],
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (index: number, updates: Partial<SurveyItem>) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], ...updates };
    setFormData({ ...formData, items: newItems });
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/pesquisa/${slug}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copiado!",
      description: "O link foi copiado para a área de transferência.",
    });
  };

  const openStatsModal = (survey: Survey) => {
    setSelectedSurvey(survey);
    setIsStatsModalOpen(true);
  };

  const getNpsColor = (score: number) => {
    if (score >= 50) return "text-green-600";
    if (score >= 0) return "text-yellow-600";
    return "text-red-600";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando pesquisas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl">Pesquisas de Satisfação</CardTitle>
                <CardDescription>
                  Gerencie pesquisas NPS para medir a satisfação dos clientes
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => handleOpenModal()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Pesquisa
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {surveys.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma pesquisa cadastrada</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => handleOpenModal()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar primeira pesquisa
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Respostas</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surveys.map((survey) => (
                  <TableRow key={survey.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{survey.title}</p>
                        {survey.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {survey.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={survey.active ? "success" : "secondary"}>
                        {survey.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{survey.responseCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          /pesquisa/{survey.publicSlug}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyLink(survey.publicSlug)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <a
                          href={`/pesquisa/${survey.publicSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openStatsModal(survey)}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenModal(survey)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(survey.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Modal de criar/editar */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedSurvey ? "Editar Pesquisa" : "Nova Pesquisa"}
            </DialogTitle>
            <DialogDescription>
              {selectedSurvey
                ? "Edite as informações da pesquisa"
                : "Crie uma nova pesquisa de satisfação NPS"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título da Pesquisa *</Label>
              <Input
                id="title"
                placeholder="Ex: Pesquisa de Satisfação - Dezembro 2024"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descrição opcional da pesquisa"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, active: checked })
                }
              />
              <Label htmlFor="active">Pesquisa Ativa</Label>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Perguntas da Pesquisa</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Pergunta
                </Button>
              </div>

              {formData.items.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Pergunta {index + 1}
                    </span>
                    {formData.items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Input
                      placeholder="Texto da pergunta"
                      value={item.label}
                      onChange={(e) => updateItem(index, { label: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={item.type}
                        onValueChange={(value: "nps" | "text") =>
                          updateItem(index, { type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nps">
                            <div className="flex items-center">
                              <BarChart3 className="h-4 w-4 mr-2" />
                              NPS (0-10)
                            </div>
                          </SelectItem>
                          <SelectItem value="text">
                            <div className="flex items-center">
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Texto Livre
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2 mt-6">
                      <Switch
                        id={`required-${index}`}
                        checked={item.required}
                        onCheckedChange={(checked) =>
                          updateItem(index, { required: checked })
                        }
                      />
                      <Label htmlFor={`required-${index}`} className="text-sm">
                        Obrigatória
                      </Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Salvando..."
                : selectedSurvey
                ? "Salvar Alterações"
                : "Criar Pesquisa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de estatísticas */}
      <Dialog open={isStatsModalOpen} onOpenChange={setIsStatsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resultados da Pesquisa</DialogTitle>
            <DialogDescription>
              {selectedSurvey?.title}
            </DialogDescription>
          </DialogHeader>

          {isLoadingStats ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : statsError ? (
            <div className="text-center py-8 text-destructive">
              Erro ao carregar estatísticas: {statsError instanceof Error ? statsError.message : "Erro desconhecido"}
            </div>
          ) : stats ? (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                <TabsTrigger value="scores">Pontuações</TabsTrigger>
                <TabsTrigger value="comments">Comentários</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{stats.totalResponses}</p>
                        <p className="text-sm text-muted-foreground">Respostas</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <p className={`text-2xl font-bold ${getNpsColor(stats.npsScore)}`}>
                          {stats.npsScore}
                        </p>
                        <p className="text-sm text-muted-foreground">NPS Score</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{stats.promoters}</p>
                        <p className="text-sm text-muted-foreground">Promotores</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">{stats.detractors}</p>
                        <p className="text-sm text-muted-foreground">Detratores</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Distribuição NPS</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <span className="w-24 text-sm">Promotores</span>
                        <Progress
                          value={
                            stats.totalResponses > 0
                              ? (stats.promoters / stats.totalResponses) * 100
                              : 0
                          }
                          className="flex-1 [&>div]:bg-green-500"
                        />
                        <span className="w-12 text-sm text-right">
                          {stats.totalResponses > 0
                            ? Math.round((stats.promoters / stats.totalResponses) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="w-24 text-sm">Neutros</span>
                        <Progress
                          value={
                            stats.totalResponses > 0
                              ? (stats.passives / stats.totalResponses) * 100
                              : 0
                          }
                          className="flex-1 [&>div]:bg-yellow-500"
                        />
                        <span className="w-12 text-sm text-right">
                          {stats.totalResponses > 0
                            ? Math.round((stats.passives / stats.totalResponses) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="w-24 text-sm">Detratores</span>
                        <Progress
                          value={
                            stats.totalResponses > 0
                              ? (stats.detractors / stats.totalResponses) * 100
                              : 0
                          }
                          className="flex-1 [&>div]:bg-red-500"
                        />
                        <span className="w-12 text-sm text-right">
                          {stats.totalResponses > 0
                            ? Math.round((stats.detractors / stats.totalResponses) * 100)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="scores" className="space-y-4 mt-4">
                {stats.averageScores.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma pergunta NPS nesta pesquisa
                  </div>
                ) : (
                  stats.averageScores.map((item) => (
                    <Card key={item.itemId}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{item.label}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4">
                          <Progress
                            value={(item.average / 10) * 100}
                            className="flex-1"
                          />
                          <span className="text-lg font-bold">{item.average}/10</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="comments" className="space-y-4 mt-4">
                {stats.textResponses.length === 0 ||
                stats.textResponses.every((t) => t.responses.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum comentário recebido
                  </div>
                ) : (
                  stats.textResponses.map((item) =>
                    item.responses.length > 0 ? (
                      <Card key={item.itemId}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{item.label}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {item.responses.map((response, i) => (
                              <div
                                key={i}
                                className="bg-muted p-3 rounded-lg text-sm"
                              >
                                "{response}"
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ) : null
                  )
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Não foi possível carregar as estatísticas
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta pesquisa? Todas as respostas
              também serão excluídas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
