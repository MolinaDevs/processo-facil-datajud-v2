import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type ProcessResult } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import ExportDialog from "./export-dialog";

interface AdvancedSearchResultsProps {
  results: ProcessResult[];
  onProcessSelect: (result: ProcessResult) => void;
}

export default function AdvancedSearchResults({ 
  results, 
  onProcessSelect 
}: AdvancedSearchResultsProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const resultsPerPage = 5;
  const totalPages = Math.ceil(results.length / resultsPerPage);
  
  const startIndex = (currentPage - 1) * resultsPerPage;
  const endIndex = startIndex + resultsPerPage;
  const currentResults = results.slice(startIndex, endIndex);

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

  return (
    <>
      <Card className="mb-8" data-testid="advanced-search-results">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Resultados da Busca Avançada</CardTitle>
              <CardDescription>
                Encontrados {results.length} processo(s) • Página {currentPage} de {totalPages}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportDialogOpen(true)}
              data-testid="button-export-advanced-results"
            >
              <i className="fas fa-download mr-2"></i>
              Exportar Resultados
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {currentResults.map((result, index) => (
              <div key={result.numeroProcesso || index}>
                <div 
                  className="p-4 border border-border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => onProcessSelect(result)}
                  data-testid={`result-item-${index}`}
                >
                  {/* Process Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 
                        className="text-lg font-semibold text-foreground mb-1"
                        data-testid={`result-process-number-${index}`}
                      >
                        {result.numeroProcesso}
                      </h4>
                      <p 
                        className="text-sm text-muted-foreground"
                        data-testid={`result-process-class-${index}`}
                      >
                        {result.classeProcessual} • {result.tribunal}
                      </p>
                    </div>
                    <Badge 
                      variant="secondary"
                      data-testid={`result-tribunal-badge-${index}`}
                    >
                      {result.tribunal}
                    </Badge>
                  </div>

                  {/* Process Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Data de Ajuizamento
                      </label>
                      <p 
                        className="text-sm text-foreground"
                        data-testid={`result-filing-date-${index}`}
                      >
                        {formatDate(result.dataAjuizamento)}
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Órgão Julgador
                      </label>
                      <p 
                        className="text-sm text-foreground"
                        data-testid={`result-court-${index}`}
                      >
                        {truncateText(result.orgaoJulgador, 30)}
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Última Atualização
                      </label>
                      <p 
                        className="text-sm text-foreground"
                        data-testid={`result-last-update-${index}`}
                      >
                        {formatDate(result.ultimaAtualizacao)}
                      </p>
                    </div>
                  </div>

                  {/* Subjects */}
                  {result.assuntos && result.assuntos.length > 0 && (
                    <div className="mb-3">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                        Assuntos
                      </label>
                      <div className="flex flex-wrap gap-1" data-testid={`result-subjects-${index}`}>
                        {result.assuntos.slice(0, 3).map((subject, subIndex) => (
                          <Badge 
                            key={subject.codigo || subIndex} 
                            variant="outline" 
                            className="text-xs"
                            data-testid={`result-subject-${index}-${subIndex}`}
                          >
                            {truncateText(subject.nome, 25)}
                          </Badge>
                        ))}
                        {result.assuntos.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{result.assuntos.length - 3} mais
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Movements Preview */}
                  {result.movimentos && result.movimentos.length > 0 && (
                    <div className="mb-3">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                        Últimas Movimentações
                      </label>
                      <div className="space-y-1" data-testid={`result-movements-${index}`}>
                        {result.movimentos.slice(0, 2).map((movement, movIndex) => (
                          <div 
                            key={movIndex} 
                            className="flex items-center justify-between text-xs"
                            data-testid={`result-movement-${index}-${movIndex}`}
                          >
                            <span className="text-foreground font-medium">
                              {truncateText(movement.nome, 40)}
                            </span>
                            <span className="text-muted-foreground">
                              {formatDate(movement.dataHora)}
                            </span>
                          </div>
                        ))}
                        {result.movimentos.length > 2 && (
                          <p className="text-xs text-muted-foreground">
                            +{result.movimentos.length - 2} movimentações
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <i className="fas fa-calendar-alt"></i>
                      <span>Grau: {result.grau}</span>
                      <span>•</span>
                      <span>Formato: {result.formatoProcesso}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      data-testid={`button-view-details-${index}`}
                    >
                      Ver Detalhes
                      <i className="fas fa-arrow-right ml-2"></i>
                    </Button>
                  </div>
                </div>
                
                {index < currentResults.length - 1 && <Separator className="my-4" />}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1} a {Math.min(endIndex, results.length)} de {results.length} resultados
              </p>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  data-testid="button-prev-page"
                >
                  <i className="fas fa-chevron-left mr-1"></i>
                  Anterior
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      data-testid={`button-page-${page}`}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  data-testid="button-next-page"
                >
                  Próxima
                  <i className="fas fa-chevron-right ml-1"></i>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        data={results}
        defaultTitle="Resultados da Busca Avançada"
      />
    </>
  );
}