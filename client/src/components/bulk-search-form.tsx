import { useState, useRef } from "react";
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
import Papa from "papaparse";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo CSV",
        variant: "destructive",
      });
      return;
    }

    Papa.parse(file, {
      complete: (results) => {
        const processNumbers: string[] = [];
        
        results.data.forEach((row: any) => {
          if (Array.isArray(row)) {
            row.forEach((cell) => {
              const trimmed = String(cell).trim();
              if (trimmed.length > 0) {
                processNumbers.push(trimmed);
              }
            });
          } else if (typeof row === 'object' && row !== null) {
            Object.values(row).forEach((value) => {
              const trimmed = String(value).trim();
              if (trimmed.length > 0) {
                processNumbers.push(trimmed);
              }
            });
          }
        });

        const uniqueNumbers = Array.from(new Set(processNumbers));
        form.setValue("processNumbers", uniqueNumbers);
        
        toast({
          title: "Arquivo importado",
          description: `${uniqueNumbers.length} números de processos carregados`,
        });

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        toast({
          title: "Erro ao processar CSV",
          description: error.message,
          variant: "destructive",
        });
      },
    });
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
              Pesquise até 1000 processos simultaneamente por tribunal
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
                    <div className="flex gap-2 mb-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                        data-testid="input-csv-file"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="button-upload-csv"
                      >
                        <i className="fas fa-file-upload mr-2"></i>
                        Importar CSV
                      </Button>
                      <span className="text-xs text-muted-foreground self-center">
                        Ou digite manualmente abaixo
                      </span>
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="Digite os números dos processos separados por quebra de linha, vírgula ou ponto e vírgula.&#10;&#10;Exemplo:&#10;0000000-00.0000.0.00.0000&#10;1234567-89.0123.4.56.7890"
                        className="min-h-[120px] font-mono text-sm"
                        onChange={(e) => handleProcessNumbersChange(e.target.value)}
                        value={field.value?.join('\n') || ''}
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
                        {field.value.length > 1000 && (
                          <Badge variant="destructive">
                            Máximo: 1000 processos
                          </Badge>
                        )}
                      </div>
                    )}
                  </FormItem>
                )}
              />

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