import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { exportRequestSchema, type ExportRequest, type ProcessResult } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: ProcessResult[];
  defaultTitle?: string;
}

export default function ExportDialog({ 
  isOpen, 
  onClose, 
  data, 
  defaultTitle = "Relatório de Processos" 
}: ExportDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const form = useForm<ExportRequest>({
    resolver: zodResolver(exportRequestSchema),
    defaultValues: {
      format: "pdf",
      data: data,
      title: defaultTitle,
      includeMovements: true,
      includeSubjects: true,
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (exportData: ExportRequest) => {
      const response = await apiRequest("POST", "/api/export", exportData);
      return response;
    },
    onSuccess: async (response: Response) => {
      const contentType = response.headers.get('Content-Type') || '';
      const contentDisposition = response.headers.get('Content-Disposition') || '';
      
      // Extract filename from Content-Disposition header
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `processos_${new Date().toISOString().split('T')[0]}`;
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Exportação concluída",
        description: `Arquivo ${filename} baixado com sucesso`,
      });
      
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro na exportação",
        description: error?.message || "Erro desconhecido durante a exportação",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (formData: ExportRequest) => {
    setIsExporting(true);
    try {
      await exportMutation.mutateAsync(formData);
    } finally {
      setIsExporting(false);
    }
  };

  const formatLabels = {
    pdf: "PDF - Relatório detalhado",
    csv: "CSV - Planilha de dados",
    json: "JSON - Dados estruturados",
  };

  const formatDescriptions = {
    pdf: "Formato ideal para relatórios completos e impressão",
    csv: "Formato compatível com Excel e outras planilhas",
    json: "Formato técnico para integração com sistemas",
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="export-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className="fas fa-download text-blue-600"></i>
            Exportar Dados
          </DialogTitle>
          <DialogDescription>
            Exporte {data.length} processo(s) em diferentes formatos
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Format Selection */}
            <FormField
              control={form.control}
              name="format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Formato de Exportação</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-export-format">
                        <SelectValue placeholder="Selecione um formato" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(formatLabels).map(([value, label]) => (
                        <SelectItem 
                          key={value} 
                          value={value}
                          data-testid={`option-format-${value}`}
                        >
                          <div>
                            <div className="font-medium">{label}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDescriptions[value as keyof typeof formatDescriptions]}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Title for PDF */}
            {form.watch("format") === "pdf" && (
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título do Relatório</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Digite o título do relatório"
                        {...field}
                        data-testid="input-export-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Separator />

            {/* Include Options */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Incluir nos dados exportados:</h4>
              
              <FormField
                control={form.control}
                name="includeMovements"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-include-movements"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Movimentações</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Inclui histórico completo de movimentações processuais
                      </p>
                    </div>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="includeSubjects"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-include-subjects"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Assuntos</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Inclui lista de assuntos e códigos relacionados
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {/* Data Preview */}
            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-info-circle text-blue-600"></i>
                <span className="text-sm font-medium">Dados a serem exportados</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• {data.length} processo(s)</p>
                <p>• {data.reduce((acc, proc) => acc + proc.movimentos.length, 0)} movimentação(ões)</p>
                <p>• {data.reduce((acc, proc) => acc + proc.assuntos.length, 0)} assunto(s)</p>
              </div>
            </div>

            <DialogFooter className="flex justify-between sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isExporting}
                data-testid="button-cancel-export"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isExporting || !form.formState.isValid}
                data-testid="button-confirm-export"
              >
                {isExporting ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Exportando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-download mr-2"></i>
                    Exportar
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}