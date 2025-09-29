import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { advancedSearchSchema, type AdvancedSearchRequest, type ProcessResult } from "@shared/schema";
import { type ApiResponse, type TribunalCategory } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, FilterIcon } from "lucide-react";

interface AdvancedSearchFormProps {
  onSearchSuccess: (results: ProcessResult[]) => void;
  isSearching: boolean;
  setIsSearching: (searching: boolean) => void;
}

export default function AdvancedSearchForm({ 
  onSearchSuccess, 
  isSearching, 
  setIsSearching 
}: AdvancedSearchFormProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);

  const form = useForm<AdvancedSearchRequest>({
    resolver: zodResolver(advancedSearchSchema),
    defaultValues: {
      tribunal: "",
      processClass: "",
      judgingBody: "",
      filingDateFrom: "",
      filingDateTo: "",
      searchTerm: "",
    },
  });

  const { data: tribunalsData } = useQuery<ApiResponse<TribunalCategory[]>>({
    queryKey: ["/api/tribunals"],
  });

  const searchMutation = useMutation({
    mutationFn: async (data: AdvancedSearchRequest) => {
      const response = await apiRequest("POST", "/api/advanced-search", data);
      return response.json() as Promise<ApiResponse<ProcessResult[]>>;
    },
    onMutate: () => {
      setIsSearching(true);
    },
    onSuccess: (response) => {
      if (response.success && response.data) {
        onSearchSuccess(response.data);
        toast({
          title: "Busca concluída",
          description: `Encontrados ${response.data.length} processo(s) com os filtros especificados.`,
        });
      } else {
        toast({
          title: "Nenhum resultado",
          description: response.error || "Não foram encontrados processos com os filtros especificados.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Erro na busca avançada",
        description: error instanceof Error ? error.message : "Erro desconhecido na busca.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSearching(false);
    },
  });

  const onSubmit = (data: AdvancedSearchRequest) => {
    // Remove empty fields
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== "")
    ) as AdvancedSearchRequest;
    
    searchMutation.mutate(cleanData);
  };

  const commonProcessClasses = [
    "Ação Civil Pública",
    "Ação de Cobrança",
    "Ação de Danos Morais",
    "Ação de Indenização",
    "Ação de Execução",
    "Ação Declaratória",
    "Busca e Apreensão",
    "Mandado de Segurança",
    "Demo" // For testing
  ];

  const commonJudgingBodies = [
    "1ª Vara Cível",
    "2ª Vara Cível",
    "3ª Vara Cível",
    "Vara da Fazenda Pública",
    "Vara de Família",
    "Vara Criminal",
    "Vara do Trabalho",
    "Vara Federal"
  ];

  return (
    <Card className="mb-8" data-testid="advanced-search-form-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FilterIcon className="h-5 w-5 text-primary" />
              Busca Avançada
            </CardTitle>
            <CardDescription>
              Pesquise processos por classe, órgão julgador, data e outros filtros
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="button-toggle-advanced-search"
          >
            {isExpanded ? "Ocultar" : "Expandir"}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="advanced-search-form">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Tribunal Selection */}
                <FormField
                  control={form.control}
                  name="tribunal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tribunal *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-advanced-tribunal">
                            <SelectValue placeholder="Selecione o Tribunal" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tribunalsData?.data?.map((category) => (
                            <div key={category.category}>
                              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                {category.category}
                              </div>
                              {category.items.map((tribunal) => (
                                <SelectItem 
                                  key={tribunal.value} 
                                  value={tribunal.value}
                                  data-testid={`advanced-tribunal-option-${tribunal.value}`}
                                >
                                  {tribunal.label}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Process Class */}
                <FormField
                  control={form.control}
                  name="processClass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Classe Processual</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-process-class">
                            <SelectValue placeholder="Selecione a classe processual" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {commonProcessClasses.map((className) => (
                            <SelectItem 
                              key={className} 
                              value={className}
                              data-testid={`process-class-option-${className.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              {className}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Judging Body */}
                <FormField
                  control={form.control}
                  name="judgingBody"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Órgão Julgador</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-judging-body">
                            <SelectValue placeholder="Selecione o órgão julgador" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {commonJudgingBodies.map((body) => (
                            <SelectItem 
                              key={body} 
                              value={body}
                              data-testid={`judging-body-option-${body.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              {body}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Search Term */}
                <FormField
                  control={form.control}
                  name="searchTerm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Termo de Busca</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: responsabilidade civil, demo"
                          data-testid="input-search-term"
                        />
                      </FormControl>
                      <FormDescription>
                        Busca nos campos de classe, órgão julgador e assuntos
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Date From */}
                <FormField
                  control={form.control}
                  name="filingDateFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Ajuizamento (De)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          data-testid="input-date-from"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Date To */}
                <FormField
                  control={form.control}
                  name="filingDateTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Ajuizamento (Até)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          data-testid="input-date-to"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    Filtros ativos
                  </Badge>
                  {form.watch("processClass") && (
                    <Badge variant="secondary">Classe: {form.watch("processClass")}</Badge>
                  )}
                  {form.watch("judgingBody") && (
                    <Badge variant="secondary">Órgão: {form.watch("judgingBody")}</Badge>
                  )}
                  {form.watch("searchTerm") && (
                    <Badge variant="secondary">Termo: {form.watch("searchTerm")}</Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                    data-testid="button-clear-filters"
                  >
                    Limpar Filtros
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSearching}
                    data-testid="button-advanced-search"
                  >
                    {isSearching ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Buscando...
                      </>
                    ) : (
                      <>
                        <FilterIcon className="h-4 w-4 mr-2" />
                        Buscar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      )}
    </Card>
  );
}