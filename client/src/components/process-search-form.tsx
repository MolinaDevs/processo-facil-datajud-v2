import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { processSearchSchema, type ProcessSearchRequest, type ProcessResult } from "@shared/schema";
import { type ApiResponse, type TribunalCategory } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ProcessSearchFormProps {
  onSearchSuccess: (result: ProcessResult) => void;
  isSearching: boolean;
  setIsSearching: (searching: boolean) => void;
}

export default function ProcessSearchForm({ 
  onSearchSuccess, 
  isSearching, 
  setIsSearching 
}: ProcessSearchFormProps) {
  const { toast } = useToast();

  const form = useForm<ProcessSearchRequest>({
    resolver: zodResolver(processSearchSchema),
    defaultValues: {
      processNumber: "",
      tribunal: "",
    },
  });

  const { data: tribunalsData } = useQuery<ApiResponse<TribunalCategory[]>>({
    queryKey: ["/api/tribunals"],
  });

  const searchMutation = useMutation({
    mutationFn: async (data: ProcessSearchRequest) => {
      const response = await apiRequest("POST", "/api/search-process", data);
      return response.json() as Promise<ApiResponse<ProcessResult>>;
    },
    onMutate: () => {
      setIsSearching(true);
    },
    onSuccess: (response) => {
      if (response.success && response.data) {
        onSearchSuccess(response.data);
        toast({
          title: "Processo encontrado",
          description: "As informações do processo foram carregadas com sucesso.",
        });
      } else {
        toast({
          title: "Erro na busca",
          description: response.error || "Não foi possível encontrar o processo.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Erro na busca",
        description: error instanceof Error ? error.message : "Erro desconhecido na busca.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSearching(false);
    },
  });

  const onSubmit = (data: ProcessSearchRequest) => {
    searchMutation.mutate(data);
  };

  const formatProcessNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, "");
    
    // Format as NNNNNNN-DD.AAAA.J.TR.OOOO
    if (digits.length <= 7) return digits;
    if (digits.length <= 9) return `${digits.slice(0, 7)}-${digits.slice(7)}`;
    if (digits.length <= 13) return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9)}`;
    if (digits.length <= 14) return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13)}`;
    if (digits.length <= 16) return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14)}`;
    
    return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
  };

  return (
    <Card className="mb-8" data-testid="search-form-card">
      <CardHeader>
        <CardTitle>Consulta de Processos Judiciais</CardTitle>
        <CardDescription>
          Digite o número do processo ou selecione o tribunal para buscar informações processuais
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="search-form">
            <FormField
              control={form.control}
              name="processNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número do Processo</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        placeholder="Ex: 1234567-89.2023.8.26.0001"
                        className="pl-10"
                        onChange={(e) => {
                          const formatted = formatProcessNumber(e.target.value);
                          field.onChange(formatted);
                        }}
                        data-testid="input-process-number"
                      />
                      <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"></i>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Formato: NNNNNNN-DD.AAAA.J.TR.OOOO
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tribunal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tribunal</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-tribunal">
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
                              data-testid={`tribunal-option-${tribunal.value}`}
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

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSearching}
              data-testid="button-search"
            >
              {isSearching ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Buscando...
                </>
              ) : (
                <>
                  <i className="fas fa-search mr-2"></i>
                  Buscar Processo
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
