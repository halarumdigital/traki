import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface SurveyItem {
  id: string;
  label: string;
  type: "nps" | "text";
  required: boolean;
}

interface PublicSurvey {
  id: string;
  title: string;
  description: string | null;
  items: SurveyItem[];
}

interface Answer {
  itemId: string;
  scoreValue?: number;
  textValue?: string;
}

export default function PesquisaPublicaPage() {
  const { slug } = useParams<{ slug: string }>();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [respondentName, setRespondentName] = useState("");
  const [respondentEmail, setRespondentEmail] = useState("");
  const [respondentPhone, setRespondentPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Buscar pesquisa
  const { data: survey, isLoading, error, isError } = useQuery<PublicSurvey>({
    queryKey: ["/api/pesquisa", slug],
    queryFn: async () => {
      const res = await fetch(`/api/pesquisa/${slug}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao buscar pesquisa");
      }
      return res.json();
    },
  });

  // Enviar respostas
  const submitMutation = useMutation({
    mutationFn: async () => {
      const answersArray = Object.values(answers);
      const res = await fetch(`/api/pesquisa/${slug}/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          respondentName: respondentName || undefined,
          respondentEmail: respondentEmail || undefined,
          respondentPhone: respondentPhone || undefined,
          answers: answersArray,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao enviar respostas");
      }

      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const setNpsAnswer = (itemId: string, score: number) => {
    setAnswers({
      ...answers,
      [itemId]: { itemId, scoreValue: score },
    });
  };

  const setTextAnswer = (itemId: string, text: string) => {
    setAnswers({
      ...answers,
      [itemId]: { itemId, textValue: text },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validar respostas obrigatórias
    if (survey) {
      for (const item of survey.items) {
        if (item.required) {
          const answer = answers[item.id];
          if (!answer) {
            alert(`Por favor, responda a pergunta: "${item.label}"`);
            return;
          }
          if (item.type === "nps" && answer.scoreValue === undefined) {
            alert(`Por favor, selecione uma nota para: "${item.label}"`);
            return;
          }
          if (item.type === "text" && !answer.textValue?.trim()) {
            alert(`Por favor, preencha a resposta para: "${item.label}"`);
            return;
          }
        }
      }
    }

    submitMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando pesquisa...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Pesquisa não disponível
              </h2>
              <p className="text-muted-foreground">
                {error instanceof Error
                  ? error.message
                  : "Esta pesquisa não está mais disponível."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Obrigado pela sua resposta!
              </h2>
              <p className="text-muted-foreground">
                Sua opinião é muito importante para nós.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!survey) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{survey.title}</CardTitle>
            {survey.description && (
              <CardDescription className="text-base mt-2">
                {survey.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Informações do respondente (opcional) */}
              <div className="space-y-4 border-b pb-6">
                <h3 className="font-medium text-muted-foreground">
                  Suas informações (opcional)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      placeholder="Seu nome"
                      value={respondentName}
                      onChange={(e) => setRespondentName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={respondentEmail}
                      onChange={(e) => setRespondentEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      placeholder="(00) 00000-0000"
                      value={respondentPhone}
                      onChange={(e) => setRespondentPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Perguntas */}
              <div className="space-y-8">
                {survey.items.map((item, index) => (
                  <div key={item.id} className="space-y-4">
                    <div className="flex items-start gap-2">
                      <span className="font-medium text-primary">
                        {index + 1}.
                      </span>
                      <Label className="text-base font-medium">
                        {item.label}
                        {item.required && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </Label>
                    </div>

                    {item.type === "nps" ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground px-2">
                          <span>Nada provável</span>
                          <span>Muito provável</span>
                        </div>
                        <div className="flex justify-between gap-1 sm:gap-2">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
                            const isSelected =
                              answers[item.id]?.scoreValue === score;
                            const getScoreColor = () => {
                              if (score <= 6) return "bg-red-100 hover:bg-red-200 border-red-300";
                              if (score <= 8) return "bg-yellow-100 hover:bg-yellow-200 border-yellow-300";
                              return "bg-green-100 hover:bg-green-200 border-green-300";
                            };
                            const getSelectedColor = () => {
                              if (score <= 6) return "bg-red-500 text-white";
                              if (score <= 8) return "bg-yellow-500 text-white";
                              return "bg-green-500 text-white";
                            };

                            return (
                              <button
                                key={score}
                                type="button"
                                onClick={() => setNpsAnswer(item.id, score)}
                                className={cn(
                                  "w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 font-medium text-sm sm:text-base transition-all",
                                  isSelected
                                    ? getSelectedColor()
                                    : getScoreColor()
                                )}
                              >
                                {score}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <Textarea
                        placeholder="Digite sua resposta..."
                        value={answers[item.id]?.textValue || ""}
                        onChange={(e) => setTextAnswer(item.id, e.target.value)}
                        rows={4}
                      />
                    )}
                  </div>
                ))}
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Respostas
                  </>
                )}
              </Button>

              {submitMutation.isError && (
                <p className="text-destructive text-center text-sm">
                  {submitMutation.error instanceof Error
                    ? submitMutation.error.message
                    : "Erro ao enviar respostas. Tente novamente."}
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-muted-foreground text-sm mt-4">
          Suas respostas são anônimas e serão usadas para melhorar nossos
          serviços.
        </p>
      </div>
    </div>
  );
}
