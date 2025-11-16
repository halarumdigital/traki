import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MessageSquare, Send, Paperclip, Search, Filter } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Função helper para construir URL completa das imagens
const getImageUrl = (path: string | null) => {
  if (!path) return null;
  // Se já for uma URL completa, retorna como está
  if (path.startsWith('http')) return path;
  // Senão, adiciona a URL base do backend
  const baseUrl = window.location.origin.replace(':5173', ':5000');
  return `${baseUrl}${path}`;
};

interface TicketSubject {
  id: string;
  name: string;
  color: string;
}

interface SupportTicket {
  id: string;
  ticketNumber: string;
  driverId: string;
  driverName: string;
  driverEmail: string | null;
  driverWhatsapp: string;
  subjectId: string;
  message: string;
  attachmentUrl: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  repliesCount: number;
  unreadByDriver: boolean;
  lastReplyAt: string | null;
  createdAt: string;
}

interface TicketReply {
  id: string;
  ticketId: string;
  authorType: "driver" | "admin";
  authorId: string;
  authorName: string;
  message: string;
  attachmentUrl: string | null;
  createdAt: string;
}

interface TicketWithDetails {
  ticket: SupportTicket;
  subject: TicketSubject;
  replies?: TicketReply[];
}

export default function TicketsSuportePage() {
  const { toast } = useToast();
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [replyMessage, setReplyMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);

  // Buscar categorias para o filtro
  const { data: subjects = [] } = useQuery<TicketSubject[]>({
    queryKey: ["/api/ticket-subjects"],
  });

  // Buscar tickets
  const { data: ticketsData = [], isLoading } = useQuery<TicketWithDetails[]>({
    queryKey: [
      "/api/support-tickets" +
      (statusFilter !== "all" || subjectFilter !== "all"
        ? "?" +
          [
            statusFilter !== "all" ? `status=${statusFilter}` : "",
            subjectFilter !== "all" ? `subjectId=${subjectFilter}` : "",
          ]
            .filter(Boolean)
            .join("&")
        : "")
    ],
  });

  // Buscar detalhes do ticket selecionado
  const { data: ticketDetails, isLoading: isLoadingDetails } = useQuery<TicketWithDetails & { replies: TicketReply[] }>({
    queryKey: [`/api/support-tickets/${selectedTicket}`],
    enabled: !!selectedTicket,
  });

  // Atualizar status do ticket
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PUT", `/api/support-tickets/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support-tickets"] });
      toast({
        title: "Status atualizado",
        description: "O status do ticket foi atualizado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message || "Ocorreu um erro ao atualizar o status.",
        variant: "destructive",
      });
    },
  });

  // Responder ticket
  const replyMutation = useMutation({
    mutationFn: async (data: { id: string; message: string; attachment?: File }) => {
      console.log("📤 [FRONTEND] Enviando resposta:", {
        id: data.id,
        message: data.message,
        attachment: data.attachment ? {
          name: data.attachment.name,
          type: data.attachment.type,
          size: data.attachment.size
        } : "Nenhum arquivo"
      });

      const formData = new FormData();
      formData.append("message", data.message);
      if (data.attachment) {
        formData.append("attachment", data.attachment);
        console.log("✅ Arquivo adicionado ao FormData");
      } else {
        console.log("ℹ️  Nenhum arquivo para enviar");
      }

      const response = await fetch(`/api/support-tickets/${data.id}/reply`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao enviar resposta");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidar lista geral de tickets
      queryClient.invalidateQueries({ queryKey: ["/api/support-tickets"] });
      // Invalidar detalhes do ticket específico para atualizar as respostas
      queryClient.invalidateQueries({ queryKey: [`/api/support-tickets/${variables.id}`] });
      toast({
        title: "Resposta enviada",
        description: "Sua resposta foi enviada com sucesso.",
      });
      setReplyMessage("");
      setAttachment(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar resposta",
        description: error.message || "Ocorreu um erro ao enviar a resposta.",
        variant: "destructive",
      });
    },
  });

  const handleSendReply = () => {
    if (!selectedTicket || !replyMessage.trim()) return;

    replyMutation.mutate({
      id: selectedTicket,
      message: replyMessage,
      attachment: attachment || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      open: { label: "Aberto", variant: "default" },
      in_progress: { label: "Em Andamento", variant: "secondary" },
      resolved: { label: "Resolvido", variant: "outline" },
      closed: { label: "Fechado", variant: "destructive" },
    };
    const config = variants[status] || variants.open;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tickets de Suporte</h1>
          <p className="text-muted-foreground">
            Gerencie os tickets de suporte dos entregadores
          </p>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tickets..."
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="open">Abertos</SelectItem>
            <SelectItem value="in_progress">Em Andamento</SelectItem>
            <SelectItem value="resolved">Resolvidos</SelectItem>
            <SelectItem value="closed">Fechados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {subjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: subject.color }}
                  />
                  {subject.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Lista de Tickets
          </CardTitle>
          <CardDescription>
            Tickets cadastrados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : ticketsData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum ticket encontrado
            </div>
          ) : (
            <div className="space-y-4">
              {ticketsData.map((item) => (
                <Card
                  key={item.ticket.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => setSelectedTicket(item.ticket.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">{item.ticket.ticketNumber}</span>
                          {getStatusBadge(item.ticket.status)}
                          {item.subject && (
                            <Badge
                              style={{
                                backgroundColor: item.subject.color,
                                color: 'white',
                                borderColor: item.subject.color
                              }}
                            >
                              {item.subject.name}
                            </Badge>
                          )}
                          {item.ticket.unreadByDriver && (
                            <Badge variant="secondary">Nova resposta</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {item.ticket.message}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>{item.ticket.driverName}</span>
                          <span>•</span>
                          <span>{item.ticket.repliesCount} respostas</span>
                          <span>•</span>
                          <span>
                            {format(new Date(item.ticket.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <Select
                        value={item.ticket.status}
                        onValueChange={(status) =>
                          updateStatusMutation.mutate({ id: item.ticket.id, status })
                        }
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Aberto</SelectItem>
                          <SelectItem value="in_progress">Em Andamento</SelectItem>
                          <SelectItem value="resolved">Resolvido</SelectItem>
                          <SelectItem value="closed">Fechado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes do Ticket */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Ticket {ticketDetails?.ticket.ticketNumber}
            </DialogTitle>
            <DialogDescription>
              {ticketDetails?.subject?.name}
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : ticketDetails ? (
            <div className="space-y-6">
              {/* Informações do Entregador */}
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Entregador</Label>
                      <p className="font-medium">{ticketDetails.ticket.driverName}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">WhatsApp</Label>
                      <p className="font-medium">{ticketDetails.ticket.driverWhatsapp}</p>
                    </div>
                    {ticketDetails.ticket.driverEmail && (
                      <div className="col-span-2">
                        <Label className="text-muted-foreground">Email</Label>
                        <p className="font-medium">{ticketDetails.ticket.driverEmail}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Mensagem Inicial */}
              <div>
                <h3 className="font-semibold mb-2">Mensagem Inicial</h3>
                <Card>
                  <CardContent className="p-4">
                    <p className="whitespace-pre-wrap">{ticketDetails.ticket.message}</p>
                    {ticketDetails.ticket.attachmentUrl && (
                      <div className="mt-4">
                        <img
                          src={getImageUrl(ticketDetails.ticket.attachmentUrl) || undefined}
                          alt="Anexo"
                          className="max-w-full h-auto rounded-lg"
                        />
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground mt-4">
                      {format(new Date(ticketDetails.ticket.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Respostas */}
              {ticketDetails.replies && ticketDetails.replies.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Respostas</h3>
                  <div className="space-y-3">
                    {ticketDetails.replies.map((reply) => (
                      <Card
                        key={reply.id}
                        className={reply.authorType === "admin" ? "bg-primary/5" : ""}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">{reply.authorName}</span>
                            <Badge variant={reply.authorType === "admin" ? "default" : "secondary"}>
                              {reply.authorType === "admin" ? "Admin" : "Entregador"}
                            </Badge>
                          </div>
                          <p className="whitespace-pre-wrap">{reply.message}</p>
                          {reply.attachmentUrl && (
                            <div className="mt-4">
                              <img
                                src={getImageUrl(reply.attachmentUrl) || undefined}
                                alt="Anexo"
                                className="max-w-full h-auto rounded-lg"
                              />
                            </div>
                          )}
                          <p className="text-sm text-muted-foreground mt-2">
                            {format(new Date(reply.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Formulário de Resposta */}
              <div>
                <h3 className="font-semibold mb-2">Enviar Resposta</h3>
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      <div>
                        <Textarea
                          placeholder="Digite sua resposta..."
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          rows={4}
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label htmlFor="attachment" className="cursor-pointer flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                            <Paperclip className="h-4 w-4" />
                            {attachment ? attachment.name : "Anexar imagem"}
                          </Label>
                          <Input
                            id="attachment"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                          />
                        </div>
                        <Button
                          onClick={handleSendReply}
                          disabled={!replyMessage.trim() || replyMutation.isPending}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Enviar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
