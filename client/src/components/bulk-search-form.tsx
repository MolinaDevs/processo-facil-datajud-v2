import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { bulkSearchSchema, type BulkSearchRequest, type BulkSearchResult } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type ApiResponse } from "@/lib/types";

interface BulkSearchFormProps {
  onSearchSuccess: (results: BulkSearchResult[]) => void;
  isSearching: boolean;
  setIsSearching: (searching: boolean) => void;
}

export default function BulkSearchForm({ 
  onSearchSuccess, 
  isSearching, 
  setIsSearching 
}: BulkSearchFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();

  const form = useForm<BulkSearchRequest>({
    resolver: zodResolver(bulkSearchSchema),
    defaultValues: {
      tribunal: "",
      processNumbers: [],
    },
  });

  const { data: tribunalsData } = useQuery<ApiResponse<any[]>>({
    queryKey: ["/api/tribunals"],
  });

  const bulkSearchMutation = useMutation({
    mutationFn: async (data: BulkSearchRequest): Promise<ApiResponse<BulkSearchResult[]>> => {
      const response = await apiRequest("POST", "/api/bulk-search", data);
      return response.json();
    },
    onSuccess: (response: ApiResponse<BulkSearchResult[]>) => {
      if (response.success && response.data) {
        onSearchSuccess(response.data);
        const successCount = response.data.filter(r => r.status === "success").length;
        const errorCount = response.data.filter(r => r.status === "error").length;
        const notFoundCount = response.data.filter(r => r.status === "not_found").length;
        
        toast({
          title: "Busca em lote concluída",
          description: `${successCount} processos encontrados, ${notFoundCount} não encontrados, ${errorCount} erros`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro na busca em lote",
        description: error?.error || "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: BulkSearchRequest) => {
    setIsSearching(true);
    try {
      await bulkSearchMutation.mutateAsync(data);
    } finally {
      setIsSearching(false);
    }
  };

  const parseProcessNumbers = (text: string): string[] => {
    return text
      .split(/[\n,;]/)
      .map(num => num.trim())
      .filter(num => num.length > 0);
  };

  const handleProcessNumbersChange = (text: string) => {
    const numbers = parseProcessNumbers(text);
    form.setValue("processNumbers", numbers);
  };

  const tribunals = tribunalsData?.data || [];

  return (
    <Card className="mb-8" data-testid="bulk-search-form">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <i className="fas fa-layer-group text-blue-600"></i>
              Busca em Lote
            </CardTitle>
            <CardDescription>
              Pesquise até 50 processos simultaneamente por tribunal
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="button-toggle-bulk-search"
          >
            {isExpanded ? (
              <>
                <i className="fas fa-chevron-up mr-2"></i>
                Recolher
              </>
            ) : (
              <>
                <i className="fas fa-chevron-down mr-2"></i>
                Expandir
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Tribunal Selection */}
              <FormField
                control={form.control}
                name="tribunal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tribunal *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-bulk-tribunal">
                          <SelectValue placeholder="Selecione um tribunal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tribunals.map((category: any) => (
                          <div key={category.category}>
                            <div className="px-2 py-1 text-sm font-semibold text-muted-foreground">
                              {category.category}
                            </div>
                            {category.items.map((tribunal: any) => (
                              <SelectItem 
                                key={tribunal.value} 
                                value={tribunal.value}
                                data-testid={`option-tribunal-${tribunal.value}`}
                              >
                                {tribunal.label}
                              </SelectItem>
                            ))}
                            <Separator className="my-1" />
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Process Numbers Input */}
              <FormField
                control={form.control}
                name="processNumbers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Números dos Processos *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Digite os números dos processos separados por quebra de linha, vírgula ou ponto e vírgula.&#10;&#10;Exemplo:&#10;0000000-00.0000.0.00.0000&#10;demo-process-1&#10;demo-process-2"
                        className="min-h-[120px] font-mono text-sm"
                        onChange={(e) => handleProcessNumbersChange(e.target.value)}
                        data-testid="textarea-process-numbers"
                      />
                    </FormControl>
                    <FormMessage />
                    
                    {/* Process Count Display */}
                    {field.value && field.value.length > 0 && (
                      <div className="mt-2" data-testid="process-count-display">
                        <Badge variant="secondary" className="mr-2">
                          {field.value.length} processos
                        </Badge>
                        {field.value.length > 50 && (
                          <Badge variant="destructive">
                            Máximo: 50 processos
                          </Badge>
                        )}
                      </div>
                    )}
                  </FormItem>
                )}
              />

              {/* Demo Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <i className="fas fa-info-circle text-blue-600 mt-1"></i>
                  <div>
                    <h4 className="font-medium text-blue-900 mb-2">Modo de Demonstração</h4>
                    <p className="text-sm text-blue-800 mb-2">
                      Para testar a funcionalidade, use números de processos que contenham a palavra "demo":
                    </p>
                    <div className="font-mono text-xs bg-blue-100 p-2 rounded border">
                      demo-process-1<br />
                      demo-process-2<br />
                      demo-process-3<br />
                      0000000-00.0000.0.00.0000
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isSearching || !form.formState.isValid}
                data-testid="button-bulk-search"
              >
                {isSearching ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Buscando processos...
                  </>
                ) : (
                  <>
                    <i className="fas fa-search mr-2"></i>
                    Buscar em Lote
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      )}
    </Card>
  );
}