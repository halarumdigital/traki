import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Download,
  Calendar as CalendarIcon,
  Filter,
  Search,
  Eye,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NotaFiscal {
  id: string;
  numero: string;
  competencia: string;
  dataEmissao: string;
  valor: number;
  status: "emitida" | "pendente" | "cancelada";
  xmlUrl?: string;
  pdfUrl?: string;
}

export default function EmpresaNotasFiscais() {
  const [anoFiltro, setAnoFiltro] = useState<string>(new Date().getFullYear().toString());
  const [searchTerm, setSearchTerm] = useState("");

  // Por enquanto, dados mock - substituir por API quando disponível
  const { data: notasFiscais, isLoading, refetch } = useQuery<NotaFiscal[]>({
    queryKey: ["/api/empresa/notas-fiscais", anoFiltro],
    queryFn: async () => {
      // TODO: Implementar endpoint no backend
      // const response = await fetch(`/api/empresa/notas-fiscais?ano=${anoFiltro}`, {
      //   credentials: "include",
      // });
      // if (!response.ok) throw new Error("Erro ao buscar notas fiscais");
      // return response.json();

      // Dados mock por enquanto
      return [];
    },
    enabled: true,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "emitida":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
            Emitida
          </Badge>
        );
      case "pendente":
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">
            Pendente
          </Badge>
        );
      case "cancelada":
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
            Cancelada
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredNotas = notasFiscais?.filter(nota =>
    nota.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    nota.competencia.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const anos = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Notas Fiscais
            </h1>
            <p className="text-muted-foreground mt-1">
              Consulte e baixe suas notas fiscais mensais
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número ou competência..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={anoFiltro} onValueChange={setAnoFiltro}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {anos.map(ano => (
                    <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Notas Fiscais */}
        <Card className="shadow-sm">
          <CardHeader className="px-6 py-4 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-medium">Histórico de Notas</CardTitle>
                <CardDescription>Lista de notas fiscais emitidas por competência</CardDescription>
              </div>
              <Badge variant="outline" className="text-muted-foreground">
                {filteredNotas.length} nota(s)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredNotas.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold pl-6">Competência</TableHead>
                    <TableHead className="font-semibold">Data de Emissão</TableHead>
                    <TableHead className="font-semibold">Número</TableHead>
                    <TableHead className="font-semibold text-right">Valor</TableHead>
                    <TableHead className="font-semibold text-center">Status</TableHead>
                    <TableHead className="font-semibold text-center pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotas.map((nota) => (
                    <TableRow key={nota.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="pl-6 font-medium">
                        {nota.competencia}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <CalendarIcon className="h-4 w-4" />
                          {nota.dataEmissao}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded border">
                          {nota.numero}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(nota.valor)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(nota.status)}
                      </TableCell>
                      <TableCell className="text-center pr-6">
                        <div className="flex items-center justify-center gap-2">
                          {nota.pdfUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              asChild
                            >
                              <a href={nota.pdfUrl} target="_blank" rel="noopener noreferrer">
                                <Eye className="mr-1 h-4 w-4" />
                                PDF
                              </a>
                            </Button>
                          )}
                          {nota.xmlUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              asChild
                            >
                              <a href={nota.xmlUrl} download>
                                <Download className="mr-1 h-4 w-4" />
                                XML
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-1">
                  Nenhuma nota fiscal encontrada
                </h3>
                <p className="text-sm text-muted-foreground/70 max-w-sm">
                  {searchTerm
                    ? `Não encontramos notas fiscais para "${searchTerm}"`
                    : `Não há notas fiscais emitidas para o ano de ${anoFiltro}`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informações */}
        <Card className="bg-blue-50/50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <FileText className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">Sobre as Notas Fiscais</p>
                <p className="text-sm text-blue-700/80 mt-1">
                  As notas fiscais são emitidas mensalmente após o fechamento do período.
                  Você receberá uma notificação por e-mail quando uma nova nota estiver disponível.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
