import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type ProcessResult } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SearchHistoryProps {
  history: any[];
  onProcessSelect: (result: ProcessResult) => void;
}

export default function SearchHistory({ history, onProcessSelect }: SearchHistoryProps) {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const handleHistoryItemClick = (item: any) => {
    if (item.resultData) {
      onProcessSelect(item.resultData);
    }
  };

  return (
    <Card className="sticky top-4" data-testid="search-history">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Buscas Recentes</CardTitle>
          <Button variant="ghost" size="icon" data-testid="button-close-history">
            <i className="fas fa-times"></i>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {!history || history.length === 0 ? (
          <p className="text-muted-foreground text-center py-4" data-testid="text-no-history">
            Nenhuma busca realizada ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {history.map((item, index) => (
              <div
                key={item.id || index}
                className="p-3 border border-border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                onClick={() => handleHistoryItemClick(item)}
                data-testid={`history-item-${index}`}
              >
                <p className="text-sm font-mono text-foreground" data-testid={`history-process-${index}`}>
                  {item.processNumber}
                </p>
                <p className="text-xs text-muted-foreground" data-testid={`history-details-${index}`}>
                  {item.tribunal.toUpperCase()} - {formatDate(item.searchedAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
