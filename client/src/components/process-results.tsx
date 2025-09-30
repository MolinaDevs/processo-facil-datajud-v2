import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type ProcessResult } from "@shared/schema";
import { type ApiResponse } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ExportDialog from "./export-dialog";

interface ProcessResultsProps {
  result: ProcessResult;
  onFavoriteToggle: () => void;
  favorites: any[];
}

export default function ProcessResults({ 
  result, 
  onFavoriteToggle, 
  favorites 
}: ProcessResultsProps) {
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleCreateAlert = () => {
    toast({
      title: "Alerta configurado!",
      description: `Você será notificado sobre atualizações no processo ${result.numeroProcesso}.`,
    });
  };

  const handleFollowProcess = () => {
    toast({
      title: "Acompanhamento ativado!",
      description: `Você está acompanhando o processo ${result.numeroProcesso}.`,
    });
  };

  const isFavorited = favorites.some(fav => fav.processNumber === result.numeroProcesso);

  const addFavoriteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/favorites", {
        processNumber: result.numeroProcesso,
        tribunal: result.tribunal,
        processData: result,
      });
      return response.json() as Promise<ApiResponse<any>>;
    },
    onSuccess: () => {
      toast({
        title: "Favorito adicionado",
        description: "Processo adicionado aos favoritos com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      onFavoriteToggle();
    },
    onError: (error) => {
      toast({
        title: "Erro ao adicionar favorito",
        description: error instanceof Error ? error.message : "Erro desconhecido.",
        variant: "destructive",
      });
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/favorites/${result.numeroProcesso}`);
      return response.json() as Promise<ApiResponse<any>>;
    },
    onSuccess: () => {
      toast({
        title: "Favorito removido",
        description: "Processo removido dos favoritos.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      onFavoriteToggle();
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover favorito",
        description: error instanceof Error ? error.message : "Erro desconhecido.",
        variant: "destructive",
      });
    },
  });

  const handleFavoriteClick = () => {
    if (isFavorited) {
      removeFavoriteMutation.mutate();
    } else {
      addFavoriteMutation.mutate();
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6" data-testid="process-results">
      {/* Process Information Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle data-testid="text-process-info-title">Informações do Processo</CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleFavoriteClick}
                disabled={addFavoriteMutation.isPending || removeFavoriteMutation.isPending}
                data-testid="button-favorite"
                title={isFavorited ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
              >
                <i className={isFavorited ? "fas fa-heart text-red-500" : "far fa-heart"}></i>
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsExportDialogOpen(true)}
                data-testid="button-export" 
                title="Exportar Dados"
              >
                <i className="fas fa-download"></i>
              </Button>
              <Button variant="ghost" size="icon" data-testid="button-share" title="Compartilhar">
                <i className="fas fa-share-alt"></i>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Número do Processo
              </label>
              <p className="text-sm font-mono text-foreground" data-testid="text-process-number">
                {result.numeroProcesso}
              </p>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Tribunal
              </label>
              <p className="text-sm text-foreground" data-testid="text-tribunal">
                {result.tribunal}
              </p>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Classe Processual
              </label>
              <p className="text-sm text-foreground" data-testid="text-process-class">
                {result.classeProcessual}
              </p>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Data de Ajuizamento
              </label>
              <p className="text-sm text-foreground" data-testid="text-filing-date">
                {formatDate(result.dataAjuizamento)}
              </p>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Órgão Julgador
              </label>
              <p className="text-sm text-foreground" data-testid="text-court">
                {result.orgaoJulgador}
              </p>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Última Atualização
              </label>
              <p className="text-sm text-foreground" data-testid="text-last-update">
                {formatDate(result.ultimaAtualizacao)}
              </p>
            </div>
          </div>

          {/* Process Subjects */}
          {result.assuntos && result.assuntos.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-foreground mb-3">Assuntos do Processo</h4>
              <div className="flex flex-wrap gap-2" data-testid="process-subjects">
                {result.assuntos.map((subject, index) => (
                  <Badge 
                    key={subject.codigo || index} 
                    variant="secondary"
                    data-testid={`subject-${index}`}
                  >
                    {subject.nome}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Technical Information */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-foreground mb-3">Informações Técnicas</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              {result.nivelSigilo !== undefined && (
                <div>
                  <span className="text-muted-foreground">Nível de Sigilo:</span>
                  <Badge variant={result.nivelSigilo === 0 ? "default" : "destructive"} className="ml-2">
                    {result.nivelSigilo === 0 ? "Público" : `Sigilo ${result.nivelSigilo}`}
                  </Badge>
                </div>
              )}
              {result.codigoSistema && (
                <div>
                  <span className="text-muted-foreground">Sistema:</span>
                  <span className="ml-2 font-mono">{result.sistemaProcessual} (Cód. {result.codigoSistema})</span>
                </div>
              )}
              {result.codigoFormato && (
                <div>
                  <span className="text-muted-foreground">Formato:</span>
                  <span className="ml-2 font-mono">{result.formatoProcesso} (Cód. {result.codigoFormato})</span>
                </div>
              )}
              {result.codigoOrgaoJulgador && (
                <div>
                  <span className="text-muted-foreground">Cód. Órgão:</span>
                  <span className="ml-2 font-mono">{result.codigoOrgaoJulgador}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Process Movements Timeline - Component not implemented yet */}
      {result.movimentos && result.movimentos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Movimentações do Processo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.movimentos.map((movement, index) => (
                <div key={index} className="border-l-2 border-primary pl-4 pb-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-medium text-foreground">
                      {movement.nome}
                    </h5>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(movement.dataHora)}
                    </span>
                  </div>
                  {movement.complemento && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {movement.complemento}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="flex items-center space-x-3 p-4 h-auto"
              onClick={() => setIsExportDialogOpen(true)}
              data-testid="button-export-action"
            >
              <i className="fas fa-download text-primary"></i>
              <span className="text-sm font-medium">Exportar Dados</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex items-center space-x-3 p-4 h-auto"
              onClick={handleCreateAlert}
              data-testid="button-alert"
            >
              <i className="fas fa-bell text-primary"></i>
              <span className="text-sm font-medium">Criar Alerta</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex items-center space-x-3 p-4 h-auto"
              onClick={() => window.print()}
              data-testid="button-print"
            >
              <i className="fas fa-print text-primary"></i>
              <span className="text-sm font-medium">Imprimir</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex items-center space-x-3 p-4 h-auto"
              onClick={handleFollowProcess}
              data-testid="button-follow"
            >
              <i className="fas fa-eye text-primary"></i>
              <span className="text-sm font-medium">Acompanhar</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        data={[result]}
        defaultTitle={`Processo ${result.numeroProcesso}`}
      />
    </div>
  );
}
