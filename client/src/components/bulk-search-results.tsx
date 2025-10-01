import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation } from "@tanstack/react-query";
import { type BulkSearchResult } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ExportDialog from "./export-dialog";

interface BulkSearchResultsProps {
  results: BulkSearchResult[];
  onProcessSelect: (result: BulkSearchResult) => void;
}

export default function BulkSearchResults({ results, onProcessSelect }: BulkSearchResultsProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const resultsPerPage = 10;
  const { toast } = useToast();

  const favoriteMutation = useMutation({
    mutationFn: async ({ processNumber, tribunal, processData }: { processNumber: string; tribunal: string; processData: any }) => {
      return await apiRequest("POST", "/api/favorites", {
        processNumber,
        tribunal,
        processData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      toast({
        title: "Processo favoritado",
        description: "Processo adicionado aos favoritos com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao favoritar",
        description: error?.message || "Não foi possível adicionar o processo aos favoritos",
        variant: "destructive",
      });
    },
  });

  const followMutation = useMutation({
    mutationFn: async ({ processNumber, tribunal, processData }: { processNumber: string; tribunal: string; processData: any }) => {
      return await apiRequest("POST", "/api/follows", {
        processNumber,
        tribunal,
        processData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/follows"] });
      toast({
        title: "Processo adicionado ao acompanhamento",
        description: "Você receberá atualizações sobre este processo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao acompanhar",
        description: error?.message || "Não foi possível adicionar o processo ao acompanhamento",
        variant: "destructive",
      });
    },
  });
  
  const favoriteAllMutation = useMutation({
    mutationFn: async () => {
      const successResults = results.filter(r => r.status === "success" && r.result);
      let added = 0;
      let skipped = 0;
      
      for (const result of successResults) {
        try {
          await apiRequest("POST", "/api/favorites", {
            processNumber: result.processNumber,
            tribunal: result.result!.tribunal,
            processData: result.result,
          });
          added++;
        } catch (error: any) {
          // Skip if already favorited
          if (error?.message?.includes("já está nos favoritos")) {
            skipped++;
          }
        }
      }
      
      return { added, skipped };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      toast({
        title: "Processos favoritados",
        description: `${data.added} processos adicionados aos favoritos${data.skipped > 0 ? `, ${data.skipped} já estavam` : ''}`,
      });
    },
    onError: () => {
      toast({
        title: "Erro ao favoritar",
        description: "Não foi possível adicionar os processos aos favoritos",
        variant: "destructive",
      });
    },
  });

  const followAllMutation = useMutation({
    mutationFn: async () => {
      const successResults = results.filter(r => r.status === "success" && r.result);
      let added = 0;
      let skipped = 0;
      
      for (const result of successResults) {
        try {
          await apiRequest("POST", "/api/follows", {
            processNumber: result.processNumber,
            tribunal: result.result!.tribunal,
            processData: result.result,
          });
          added++;
        } catch (error: any) {
          // Skip if already following
          if (error?.message?.includes("já está sendo acompanhado")) {
            skipped++;
          }
        }
      }
      
      return { added, skipped };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/follows"] });
      toast({
        title: "Acompanhamento ativado",
        description: `${data.added} processos adicionados ao acompanhamento${data.skipped > 0 ? `, ${data.skipped} já estavam` : ''}`,
      });
    },
    onError: () => {
      toast({
        title: "Erro no acompanhamento",
        description: "Não foi possível adicionar os processos ao acompanhamento",
        variant: "destructive",
      });
    },
  });
  
  // Categorize results
  const successResults = results.filter(r => r.status === "success");
  const errorResults = results.filter(r => r.status === "error");
  const notFoundResults = results.filter(r => r.status === "not_found");
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <i className="fas fa-check-circle text-green-600"></i>;
      case "error":
        return <i className="fas fa-exclamation-circle text-red-600"></i>;
      case "not_found":
        return <i className="fas fa-search-minus text-yellow-600"></i>;
      default:
        return <i className="fas fa-question-circle text-gray-600"></i>;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "success":
        return "default";
      case "error":
        return "destructive";
      case "not_found":
        return "secondary";
      default:
        return "outline";
    }
  };

  const renderSuccessResults = (results: BulkSearchResult[]) => {
    const totalPages = Math.ceil(results.length / resultsPerPage);
    const startIndex = (currentPage - 1) * resultsPerPage;
    const endIndex = startIndex + resultsPerPage;
    const currentResults = results.slice(startIndex, endIndex);

    return (
      <div className="space-y-4">
        {currentResults.map((result, index) => (
          <div key={result.processNumber}>
            <div 
              className="p-4 border border-border rounded-lg hover:bg-accent cursor-pointer transition-colors"
              onClick={() => onProcessSelect(result)}
              data-testid={`bulk-result-success-${index}`}
            >
              {/* Result Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 
                    className="text-lg font-semibold text-foreground mb-1"
                    data-testid={`bulk-result-process-number-${index}`}
                  >
                    {result.processNumber}
                  </h4>
                  <p 
                    className="text-sm text-muted-foreground"
                    data-testid={`bulk-result-class-${index}`}
                  >
                    {result.result?.classeProcessual} • {result.result?.tribunal}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(result.status)}
                  <Badge variant={getStatusBadgeVariant(result.status)}>
                    Encontrado
                  </Badge>
                </div>
              </div>

              {/* Process Details */}
              {result.result && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Data de Ajuizamento
                    </label>
                    <p className="text-sm text-foreground">
                      {formatDate(result.result.dataAjuizamento)}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Órgão Julgador
                    </label>
                    <p className="text-sm text-foreground">
                      {truncateText(result.result.orgaoJulgador, 30)}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Última Atualização
                    </label>
                    <p className="text-sm text-foreground">
                      {formatDate(result.result.ultimaAtualizacao)}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Grau: {result.result?.grau}</span>
                  <span>•</span>
                  <span>Formato: {result.result?.formatoProcesso}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      favoriteMutation.mutate({
                        processNumber: result.processNumber,
                        tribunal: result.result!.tribunal,
                        processData: result.result,
                      });
                    }}
                    disabled={favoriteMutation.isPending}
                    data-testid={`button-favorite-${index}`}
                  >
                    <i className="fas fa-heart mr-1"></i>
                    Favoritar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      followMutation.mutate({
                        processNumber: result.processNumber,
                        tribunal: result.result!.tribunal,
                        processData: result.result,
                      });
                    }}
                    disabled={followMutation.isPending}
                    data-testid={`button-follow-${index}`}
                  >
                    <i className="fas fa-bell mr-1"></i>
                    Acompanhar
                  </Button>
                  <Button variant="ghost" size="sm">
                    Ver Detalhes
                    <i className="fas fa-arrow-right ml-2"></i>
                  </Button>
                </div>
              </div>
            </div>
            
            {index < currentResults.length - 1 && <Separator className="my-4" />}
          </div>
        ))}

        {/* Pagination for success results */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Mostrando {startIndex + 1} a {Math.min(endIndex, results.length)} de {results.length} processos encontrados
            </p>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                data-testid="button-bulk-prev-page"
              >
                <i className="fas fa-chevron-left mr-1"></i>
                Anterior
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      data-testid={`button-bulk-page-${page}`}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                data-testid="button-bulk-next-page"
              >
                Próxima
                <i className="fas fa-chevron-right ml-1"></i>
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderErrorResults = (results: BulkSearchResult[]) => (
    <div className="space-y-3">
      {results.map((result, index) => (
        <div 
          key={result.processNumber} 
          className="p-3 border border-red-200 bg-red-50 rounded-lg"
          data-testid={`bulk-result-error-${index}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-red-900 mb-1">
                {result.processNumber}
              </h4>
              <p className="text-sm text-red-700">
                {result.error}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(result.status)}
              <Badge variant="destructive">
                Erro
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderNotFoundResults = (results: BulkSearchResult[]) => (
    <div className="space-y-3">
      {results.map((result, index) => (
        <div 
          key={result.processNumber} 
          className="p-3 border border-yellow-200 bg-yellow-50 rounded-lg"
          data-testid={`bulk-result-not-found-${index}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-yellow-900 mb-1">
                {result.processNumber}
              </h4>
              <p className="text-sm text-yellow-700">
                Processo não encontrado na base de dados do tribunal
              </p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(result.status)}
              <Badge variant="secondary">
                Não encontrado
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <Card className="mb-8" data-testid="bulk-search-results">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Resultados da Busca em Lote</CardTitle>
              <CardDescription>
                {results.length} processos processados • {successResults.length} encontrados • {notFoundResults.length} não encontrados • {errorResults.length} erros
              </CardDescription>
            </div>
            {successResults.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => favoriteAllMutation.mutate()}
                  disabled={favoriteAllMutation.isPending}
                  data-testid="button-favorite-all"
                >
                  <i className="fas fa-heart mr-2"></i>
                  {favoriteAllMutation.isPending ? "Favoritando..." : "Favoritar Todos"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => followAllMutation.mutate()}
                  disabled={followAllMutation.isPending}
                  data-testid="button-follow-all"
                >
                  <i className="fas fa-bell mr-2"></i>
                  {followAllMutation.isPending ? "Acompanhando..." : "Acompanhar Todos"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExportDialogOpen(true)}
                  data-testid="button-export-bulk-results"
                >
                  <i className="fas fa-download mr-2"></i>
                  Exportar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="success" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger 
                value="success" 
                className="flex items-center gap-2"
                data-testid="tab-success-results"
              >
                <i className="fas fa-check-circle text-green-600"></i>
                Encontrados ({successResults.length})
              </TabsTrigger>
              <TabsTrigger 
                value="not-found" 
                className="flex items-center gap-2"
                data-testid="tab-not-found-results"
              >
                <i className="fas fa-search-minus text-yellow-600"></i>
                Não encontrados ({notFoundResults.length})
              </TabsTrigger>
              <TabsTrigger 
                value="errors" 
                className="flex items-center gap-2"
                data-testid="tab-error-results"
              >
                <i className="fas fa-exclamation-circle text-red-600"></i>
                Erros ({errorResults.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="success" className="mt-4">
              {successResults.length > 0 ? (
                renderSuccessResults(successResults)
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <i className="fas fa-search text-4xl mb-4"></i>
                  <p>Nenhum processo foi encontrado com sucesso</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="not-found" className="mt-4">
              {notFoundResults.length > 0 ? (
                renderNotFoundResults(notFoundResults)
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <i className="fas fa-check-circle text-4xl mb-4"></i>
                  <p>Todos os processos foram encontrados</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="errors" className="mt-4">
              {errorResults.length > 0 ? (
                renderErrorResults(errorResults)
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <i className="fas fa-check-circle text-4xl mb-4"></i>
                  <p>Nenhum erro ocorreu durante a busca</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        data={successResults.map(r => r.result!).filter(Boolean)}
        defaultTitle="Resultados da Busca em Lote"
      />
    </>
  );
}