import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type Movement } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProcessTimelineProps {
  movements: Movement[];
}

export default function ProcessTimeline({ movements }: ProcessTimelineProps) {
  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  if (!movements || movements.length === 0) {
    return (
      <Card data-testid="process-timeline">
        <CardHeader>
          <CardTitle>Movimentações Processuais</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8" data-testid="text-no-movements">
            Nenhuma movimentação encontrada para este processo.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="process-timeline">
      <CardHeader>
        <CardTitle>Movimentações Processuais</CardTitle>
        <p className="text-sm text-muted-foreground">
          Histórico cronológico das movimentações do processo
        </p>
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          {movements.map((movement, index) => (
            <div 
              key={index} 
              className="flex items-start space-x-4"
              data-testid={`movement-${index}`}
            >
              <div className="flex-shrink-0 w-3 h-3 bg-primary rounded-full mt-2"></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <p 
                      className="text-sm font-medium text-foreground"
                      data-testid={`movement-name-${index}`}
                    >
                      {movement.nome}
                    </p>
                    {movement.codigo && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        Cód. {movement.codigo}
                      </span>
                    )}
                  </div>
                  <time 
                    className="text-xs text-muted-foreground"
                    data-testid={`movement-date-${index}`}
                  >
                    {formatDateTime(movement.dataHora)}
                  </time>
                </div>
                {movement.complemento && (
                  <p 
                    className="text-sm text-muted-foreground"
                    data-testid={`movement-description-${index}`}
                  >
                    {movement.complemento}
                  </p>
                )}
                {movement.complementosTabelados && movement.complementosTabelados.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {movement.complementosTabelados.map((comp, compIndex) => (
                      <div 
                        key={compIndex}
                        className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded"
                      >
                        <span className="font-medium">{comp.descricao}:</span> {comp.nome}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {movements.length > 5 && (
          <Button 
            variant="outline" 
            className="w-full mt-6"
            data-testid="button-load-more"
          >
            Carregar Mais Movimentações
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
