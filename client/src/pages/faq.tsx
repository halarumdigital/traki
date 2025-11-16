import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, HelpCircle, Building2, Truck } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
  target: "driver" | "company";
  displayOrder: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function FaqPage() {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<Faq | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    category: "",
    target: "driver" as "driver" | "company",
    displayOrder: 0,
    active: true,
  });

  // Buscar FAQs
  const { data: faqs = [], isLoading } = useQuery<Faq[]>({
    queryKey: ["/api/faqs"],
  });

  // Criar FAQ
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/faqs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faqs"] });
      toast({
        title: "FAQ criado",
        description: "O FAQ foi criado com sucesso.",
      });
      handleCloseModal();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar FAQ",
        description: error.message || "Ocorreu um erro ao criar o FAQ.",
        variant: "destructive",
      });
    },
  });

  // Atualizar FAQ
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      return await apiRequest("PUT", `/api/faqs/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faqs"] });
      toast({
        title: "FAQ atualizado",
        description: "O FAQ foi atualizado com sucesso.",
      });
      handleCloseModal();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar FAQ",
        description: error.message || "Ocorreu um erro ao atualizar o FAQ.",
        variant: "destructive",
      });
    },
  });

  // Deletar FAQ
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/faqs/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faqs"] });
      toast({
        title: "FAQ deletado",
        description: "O FAQ foi deletado com sucesso.",
      });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar FAQ",
        description: error.message || "Ocorreu um erro ao deletar o FAQ.",
        variant: "destructive",
      });
    },
  });

  const handleOpenModal = (faq?: Faq) => {
    if (faq) {
      setSelectedFaq(faq);
      setFormData({
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        target: faq.target,
        displayOrder: faq.displayOrder || 0,
        active: faq.active,
      });
    } else {
      setSelectedFaq(null);
      setFormData({
        question: "",
        answer: "",
        category: "",
        target: "driver",
        displayOrder: 0,
        active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFaq(null);
    setFormData({
      question: "",
      answer: "",
      category: "",
      target: "driver",
      displayOrder: 0,
      active: true,
    });
  };

  const handleSubmit = () => {
    if (!formData.question || !formData.answer || !formData.category) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (selectedFaq) {
      updateMutation.mutate({ ...formData, id: selectedFaq.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Agrupar FAQs por categoria
  const groupedFaqs = faqs.reduce((acc, faq) => {
    if (!acc[faq.category]) {
      acc[faq.category] = [];
    }
    acc[faq.category].push(faq);
    return acc;
  }, {} as Record<string, Faq[]>);

  // Ordenar categorias
  const sortedCategories = Object.keys(groupedFaqs).sort();

  // Obter todas as categorias únicas para o select
  const categories = [...new Set(faqs.map(f => f.category))];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando FAQs...</p>
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
              <HelpCircle className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl">FAQ - Perguntas Frequentes</CardTitle>
                <CardDescription>
                  Gerencie as perguntas frequentes para motoristas e empresas
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => handleOpenModal()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo FAQ
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sortedCategories.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum FAQ cadastrado</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => handleOpenModal()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro FAQ
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {sortedCategories.map(category => (
                <div key={category}>
                  <h3 className="text-lg font-semibold mb-4 border-b pb-2">
                    {category}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pergunta</TableHead>
                        <TableHead>Resposta</TableHead>
                        <TableHead>Público</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedFaqs[category].map((faq) => (
                        <TableRow key={faq.id}>
                          <TableCell className="font-medium max-w-xs">
                            <p className="line-clamp-2">{faq.question}</p>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <p className="line-clamp-2">{faq.answer}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={faq.target === "driver" ? "default" : "secondary"}>
                              {faq.target === "driver" ? (
                                <><Truck className="h-3 w-3 mr-1" /> Entregador</>
                              ) : (
                                <><Building2 className="h-3 w-3 mr-1" /> Empresa</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={faq.active ? "success" : "secondary"}>
                              {faq.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenModal(faq)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteId(faq.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de criar/editar */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedFaq ? "Editar FAQ" : "Novo FAQ"}
            </DialogTitle>
            <DialogDescription>
              {selectedFaq
                ? "Edite as informações do FAQ"
                : "Preencha as informações para criar um novo FAQ"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="question">Pergunta *</Label>
              <Textarea
                id="question"
                placeholder="Digite a pergunta"
                value={formData.question}
                onChange={(e) =>
                  setFormData({ ...formData, question: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="answer">Resposta *</Label>
              <Textarea
                id="answer"
                placeholder="Digite a resposta"
                value={formData.answer}
                onChange={(e) =>
                  setFormData({ ...formData, answer: e.target.value })
                }
                rows={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria *</Label>
                {categories.length > 0 ? (
                  <div className="flex gap-2">
                    <Select
                      value={categories.includes(formData.category) ? formData.category : "new"}
                      onValueChange={(value) => {
                        if (value === "new") {
                          setFormData({ ...formData, category: "" });
                        } else {
                          setFormData({ ...formData, category: value });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione ou digite nova" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Nova categoria...</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(!categories.includes(formData.category)) && (
                      <Input
                        placeholder="Digite a nova categoria"
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({ ...formData, category: e.target.value })
                        }
                      />
                    )}
                  </div>
                ) : (
                  <Input
                    id="category"
                    placeholder="Digite a categoria"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="target">Público Alvo *</Label>
                <Select
                  value={formData.target}
                  onValueChange={(value: "driver" | "company") =>
                    setFormData({ ...formData, target: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="driver">
                      <div className="flex items-center">
                        <Truck className="h-4 w-4 mr-2" />
                        Entregador
                      </div>
                    </SelectItem>
                    <SelectItem value="company">
                      <div className="flex items-center">
                        <Building2 className="h-4 w-4 mr-2" />
                        Empresa
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="displayOrder">Ordem de Exibição</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  placeholder="0"
                  value={formData.displayOrder}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      displayOrder: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="flex items-center space-x-2 mt-8">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, active: checked })
                  }
                />
                <Label htmlFor="active">FAQ Ativo</Label>
              </div>
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
                : selectedFaq
                ? "Salvar Alterações"
                : "Criar FAQ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este FAQ? Esta ação não pode ser desfeita.
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