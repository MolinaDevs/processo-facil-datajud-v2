import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processSearchSchema, advancedSearchSchema, bulkSearchSchema, exportRequestSchema, insertSearchHistorySchema, insertFavoriteSchema, type BulkSearchResult, type ProcessResult } from "@shared/schema";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { stringify } from "csv-stringify/sync";

// Since we can't install busca-processos-judiciais in this environment,
// we'll implement direct API calls to DataJud
const DATAJUD_BASE_URL = "https://api-publica.datajud.cnj.jus.br/";
const API_KEY = process.env.DATAJUD_API_KEY;

// For demo/development purposes, we'll use demo mode when no API key is set
const isDemoMode = !API_KEY;

// Tribunal mappings
const tribunalAliases: Record<string, string> = {
  // Tribunais Superiores
  stj: "stj",
  stf: "stf", 
  tst: "tst",
  tse: "tse",
  stm: "stm",
  // Justiça Federal
  trf1: "trf1",
  trf2: "trf2", 
  trf3: "trf3",
  trf4: "trf4",
  trf5: "trf5",
  trf6: "trf6",
  // Justiça Estadual - Major ones
  tjsp: "tjsp",
  tjrj: "tjrj",
  tjmg: "tjmg", 
  tjrs: "tjrs",
  tjpr: "tjpr",
  tjsc: "tjsc",
  tjac: "tjac",
  tjal: "tjal",
  tjam: "tjam",
  tjap: "tjap",
  tjba: "tjba",
  tjce: "tjce",
  tjdft: "tjdft",
  tjes: "tjes",
  tjgo: "tjgo",
  tjma: "tjma",
  tjms: "tjms",
  tjmt: "tjmt",
  tjpa: "tjpa",
  tjpb: "tjpb",
  tjpe: "tjpe",
  tjpi: "tjpi",
  tjrn: "tjrn",
  tjro: "tjro",
  tjrr: "tjrr",
  tjse: "tjse",
  tjto: "tjto",
};

async function searchDataJudProcess(tribunal: string, processNumber: string) {
  // If no API key is configured, force demo mode for any process
  if (isDemoMode) {
    throw new Error("Modo demonstração: Use 'demo-process-123' ou '0000000-00.0000.0.00.0000' para testar");
  }

  const tribunalAlias = tribunalAliases[tribunal.toLowerCase()];
  if (!tribunalAlias) {
    throw new Error(`Tribunal não suportado: ${tribunal}`);
  }

  const url = `${DATAJUD_BASE_URL}api_publica_${tribunalAlias}/_search`;
  const cleanProcessNumber = processNumber.replace(/\D/g, ""); // Remove formatting
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `APIKey ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: {
        match: {
          numeroProcesso: cleanProcessNumber,
        }
      },
      size: 1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na API DataJud: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.hits || !data.hits.hits || data.hits.hits.length === 0) {
    throw new Error("Processo não encontrado");
  }

  const processData = data.hits.hits[0]._source;
  
  // Transform to our expected format
  return {
    numeroProcesso: processData.numeroProcesso || processNumber,
    classeProcessual: processData.classe?.nome || "Não informado",
    codigoClasseProcessual: processData.classe?.codigo || 0,
    sistemaProcessual: processData.sistema?.nome || processData.sistema || "Não informado",
    codigoSistema: processData.sistema?.codigo,
    formatoProcesso: processData.formato?.nome || processData.formato || "eletrônico",
    codigoFormato: processData.formato?.codigo,
    tribunal: tribunal.toUpperCase(),
    ultimaAtualizacao: processData.dataHoraUltimaAtualizacao || processData.dataUltimaAtualizacao || new Date().toISOString(),
    grau: processData.grau || "Não informado",
    dataAjuizamento: processData.dataAjuizamento || "Não informado",
    nivelSigilo: processData.nivelSigilo,
    movimentos: processData.movimentos || [],
    orgaoJulgador: processData.orgaoJulgador?.nome || "Não informado",
    codigoOrgaoJulgador: processData.orgaoJulgador?.codigo,
    codigoMunicipio: processData.orgaoJulgador?.codigoMunicipioIBGE,
    assuntos: processData.assuntos || [],
  };
}

async function advancedSearchDataJud(searchParams: any) {
  const { tribunal, processClass, judgingBody, filingDateFrom, filingDateTo, searchTerm } = searchParams;
  
  // If no API key is configured, force demo mode
  if (isDemoMode) {
    throw new Error("Modo demonstração: Use 'demo-process-123' ou 'demo' no campo de busca para testar");
  }

  const tribunalAlias = tribunalAliases[tribunal.toLowerCase()];
  if (!tribunalAlias) {
    throw new Error(`Tribunal não suportado: ${tribunal}`);
  }

  const url = `${DATAJUD_BASE_URL}api_publica_${tribunalAlias}/_search`;
  
  // Build Elasticsearch query
  const query: any = {
    bool: {
      must: []
    }
  };

  // Add process class filter
  if (processClass) {
    query.bool.must.push({
      match: {
        "classe.nome": processClass
      }
    });
  }

  // Add judging body filter
  if (judgingBody) {
    query.bool.must.push({
      match: {
        "orgaoJulgador.nome": judgingBody
      }
    });
  }

  // Add date range filter
  if (filingDateFrom || filingDateTo) {
    const dateRange: any = {};
    if (filingDateFrom) dateRange.gte = filingDateFrom;
    if (filingDateTo) dateRange.lte = filingDateTo;
    
    query.bool.must.push({
      range: {
        dataAjuizamento: dateRange
      }
    });
  }

  // Add general search term
  if (searchTerm) {
    query.bool.must.push({
      multi_match: {
        query: searchTerm,
        fields: ["classe.nome", "orgaoJulgador.nome", "assuntos.nome"]
      }
    });
  }

  // If no filters specified, return error
  if (query.bool.must.length === 0) {
    throw new Error("É necessário especificar pelo menos um filtro de busca");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `APIKey ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      size: 20, // Return more results for advanced search
      sort: [{ dataAjuizamento: { order: "desc" } }]
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na API DataJud: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.hits || !data.hits.hits || data.hits.hits.length === 0) {
    throw new Error("Nenhum processo encontrado com os filtros especificados");
  }

  // Transform all results
  return data.hits.hits.map((hit: any) => {
    const processData = hit._source;
    return {
      numeroProcesso: processData.numeroProcesso || "Não informado",
      classeProcessual: processData.classe?.nome || "Não informado",
      codigoClasseProcessual: processData.classe?.codigo || 0,
      sistemaProcessual: processData.sistema?.nome || processData.sistema || "Não informado",
      codigoSistema: processData.sistema?.codigo,
      formatoProcesso: processData.formato?.nome || processData.formato || "eletrônico",
      codigoFormato: processData.formato?.codigo,
      tribunal: tribunal.toUpperCase(),
      ultimaAtualizacao: processData.dataHoraUltimaAtualizacao || processData.dataUltimaAtualizacao || new Date().toISOString(),
      grau: processData.grau || "Não informado",
      dataAjuizamento: processData.dataAjuizamento || "Não informado",
      nivelSigilo: processData.nivelSigilo,
      movimentos: processData.movimentos || [],
      orgaoJulgador: processData.orgaoJulgador?.nome || "Não informado",
      codigoOrgaoJulgador: processData.orgaoJulgador?.codigo,
      codigoMunicipio: processData.orgaoJulgador?.codigoMunicipioIBGE,
      assuntos: processData.assuntos || [],
    };
  });
}

async function bulkSearchDataJud(tribunal: string, processNumbers: string[]): Promise<BulkSearchResult[]> {
  const tribunalAlias = tribunalAliases[tribunal.toLowerCase()];
  if (!tribunalAlias) {
    throw new Error(`Tribunal não suportado: ${tribunal}`);
  }

  // Process up to 50 numbers in parallel with rate limiting
  const results: BulkSearchResult[] = [];
  const batchSize = 10; // Process 10 at a time to avoid overwhelming the API
  
  for (let i = 0; i < processNumbers.length; i += batchSize) {
    const batch = processNumbers.slice(i, i + batchSize);
    const batchPromises = batch.map(async (processNumber): Promise<BulkSearchResult> => {
      try {
        // Check for demo process numbers
        if (processNumber === "0000000-00.0000.0.00.0000" || 
            processNumber === "demo-process-123" ||
            processNumber.includes("demo")) {
          return {
            processNumber,
            result: {
              numeroProcesso: processNumber,
              classeProcessual: "Ação Civil Pública (Demo)",
              codigoClasseProcessual: 12729,
              sistemaProcessual: "PJe",
              codigoSistema: 3,
              formatoProcesso: "eletrônico",
              codigoFormato: 1,
              tribunal: tribunal.toUpperCase(),
              ultimaAtualizacao: new Date().toISOString(),
              grau: "1º Grau",
              dataAjuizamento: "2023-01-15T00:00:00Z",
              nivelSigilo: 0,
              movimentos: [
                {
                  codigo: 26,
                  nome: "Distribuição",
                  dataHora: "2023-01-15T10:00:00Z",
                  complemento: "Processo distribuído para análise",
                  complementosTabelados: [
                    {
                      codigo: 2,
                      valor: 1,
                      nome: "competência exclusiva",
                      descricao: "tipo_de_distribuicao_redistribuicao"
                    }
                  ]
                }
              ],
              orgaoJulgador: "1ª Vara Cível",
              codigoOrgaoJulgador: 9700,
              codigoMunicipio: 3550308,
              assuntos: [
                { codigo: 10518, nome: "Responsabilidade Civil" }
              ],
            },
            error: null,
            status: "success" as const,
          };
        }

        const result = await searchDataJudProcess(tribunal, processNumber);
        return {
          processNumber,
          result,
          error: null,
          status: "success" as const,
        };
      } catch (error) {
        return {
          processNumber,
          result: null,
          error: error instanceof Error ? error.message : "Erro desconhecido",
          status: error instanceof Error && error.message === "Processo não encontrado" ? "not_found" : "error",
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Add a small delay between batches to respect rate limits
    if (i + batchSize < processNumbers.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

// Export utility functions
function generatePDF(processes: ProcessResult[], title: string = "Relatório de Processos", includeMovements: boolean = true, includeSubjects: boolean = true): Buffer {
  const doc = new PDFDocument({ 
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    size: 'A4'
  });
  
  const buffers: Buffer[] = [];
  doc.on('data', buffers.push.bind(buffers));
  
  // Header
  doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.fontSize(10).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
  doc.moveDown(2);
  
  processes.forEach((process, index) => {
    if (index > 0) {
      doc.addPage();
    }
    
    // Process Header
    doc.fontSize(14).font('Helvetica-Bold').text(`Processo: ${process.numeroProcesso}`);
    doc.moveDown(0.5);
    
    // Basic Information
    doc.fontSize(10).font('Helvetica');
    doc.text(`Classe Processual: ${process.classeProcessual}`);
    doc.text(`Tribunal: ${process.tribunal}`);
    doc.text(`Órgão Julgador: ${process.orgaoJulgador}`);
    doc.text(`Grau: ${process.grau}`);
    doc.text(`Sistema: ${process.sistemaProcessual} (${process.formatoProcesso})`);
    doc.text(`Data de Ajuizamento: ${new Date(process.dataAjuizamento).toLocaleDateString('pt-BR')}`);
    doc.text(`Última Atualização: ${new Date(process.ultimaAtualizacao).toLocaleDateString('pt-BR')}`);
    doc.moveDown(1);
    
    // Subjects
    if (includeSubjects && process.assuntos.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Assuntos:');
      doc.fontSize(10).font('Helvetica');
      process.assuntos.forEach(subject => {
        doc.text(`• ${subject.nome} (${subject.codigo})`);
      });
      doc.moveDown(1);
    }
    
    // Movements
    if (includeMovements && process.movimentos.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Movimentações:');
      doc.fontSize(10).font('Helvetica');
      process.movimentos.forEach(movement => {
        const date = new Date(movement.dataHora).toLocaleDateString('pt-BR');
        const time = new Date(movement.dataHora).toLocaleTimeString('pt-BR');
        doc.text(`• ${date} ${time} - ${movement.nome}`);
        if (movement.complemento) {
          doc.text(`  ${movement.complemento}`);
        }
      });
    }
  });
  
  doc.end();
  
  return Buffer.concat(buffers);
}

function generateCSV(processes: ProcessResult[], includeMovements: boolean = true, includeSubjects: boolean = true): string {
  const records: any[] = [];
  
  processes.forEach(process => {
    const baseRecord = {
      'Número do Processo': process.numeroProcesso,
      'Classe Processual': process.classeProcessual,
      'Tribunal': process.tribunal,
      'Órgão Julgador': process.orgaoJulgador,
      'Grau': process.grau,
      'Sistema': process.sistemaProcessual,
      'Formato': process.formatoProcesso,
      'Data de Ajuizamento': new Date(process.dataAjuizamento).toLocaleDateString('pt-BR'),
      'Última Atualização': new Date(process.ultimaAtualizacao).toLocaleDateString('pt-BR'),
    };
    
    if (includeSubjects) {
      baseRecord['Assuntos'] = process.assuntos.map(s => `${s.nome} (${s.codigo})`).join('; ');
    }
    
    if (includeMovements && process.movimentos.length > 0) {
      process.movimentos.forEach((movement, index) => {
        const record = { ...baseRecord };
        if (index === 0) {
          // First movement includes all process data
        } else {
          // Subsequent movements only include movement data
          Object.keys(record).forEach(key => {
            if (!key.startsWith('Movimento')) {
              record[key] = '';
            }
          });
        }
        
        record[`Movimento ${index + 1} - Data`] = new Date(movement.dataHora).toLocaleDateString('pt-BR');
        record[`Movimento ${index + 1} - Hora`] = new Date(movement.dataHora).toLocaleTimeString('pt-BR');
        record[`Movimento ${index + 1} - Nome`] = movement.nome;
        record[`Movimento ${index + 1} - Complemento`] = movement.complemento || '';
        
        records.push(record);
      });
    } else {
      records.push(baseRecord);
    }
  });
  
  return stringify(records, { 
    header: true,
    delimiter: ',',
    quoted: true,
    quotedEmpty: true,
    encodeBOM: true
  });
}

function generateJSON(processes: ProcessResult[], includeMovements: boolean = true, includeSubjects: boolean = true): string {
  const filteredProcesses = processes.map(process => {
    const filtered: any = {
      numeroProcesso: process.numeroProcesso,
      classeProcessual: process.classeProcessual,
      tribunal: process.tribunal,
      orgaoJulgador: process.orgaoJulgador,
      grau: process.grau,
      sistemaProcessual: process.sistemaProcessual,
      formatoProcesso: process.formatoProcesso,
      dataAjuizamento: process.dataAjuizamento,
      ultimaAtualizacao: process.ultimaAtualizacao,
    };
    
    if (includeSubjects) {
      filtered.assuntos = process.assuntos;
    }
    
    if (includeMovements) {
      filtered.movimentos = process.movimentos;
    }
    
    return filtered;
  });
  
  return JSON.stringify({
    metadata: {
      geradoEm: new Date().toISOString(),
      totalProcessos: processes.length,
      includeMovimentos: includeMovements,
      includeAssuntos: includeSubjects,
    },
    processos: filteredProcesses
  }, null, 2);
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Search process endpoint
  app.post("/api/search-process", async (req, res) => {
    try {
      const { processNumber, tribunal } = processSearchSchema.parse(req.body);
      
      // Check for demo process number for testing
      if (processNumber === "0000000-00.0000.0.00.0000" || processNumber === "demo-process-123") {
        const demoResult = {
          numeroProcesso: processNumber,
          classeProcessual: "Ação Civil Pública",
          codigoClasseProcessual: 12729,
          sistemaProcessual: "PJe",
          codigoSistema: 3,
          formatoProcesso: "eletrônico",
          codigoFormato: 1,
          tribunal: tribunal.toUpperCase(),
          ultimaAtualizacao: new Date().toISOString(),
          grau: "1º Grau",
          dataAjuizamento: "2023-01-15T00:00:00Z",
          nivelSigilo: 0,
          movimentos: [
            {
              codigo: 26,
              nome: "Distribuição",
              dataHora: "2023-01-15T10:00:00Z",
              complemento: "Processo distribuído para análise",
              complementosTabelados: [
                {
                  codigo: 2,
                  valor: 1,
                  nome: "competência exclusiva",
                  descricao: "tipo_de_distribuicao_redistribuicao"
                }
              ]
            },
            {
              codigo: 193,
              nome: "Citação",
              dataHora: "2023-02-01T14:30:00Z",
              complemento: "Citação realizada com sucesso"
            },
            {
              codigo: 970,
              nome: "Audiência de Conciliação",
              dataHora: "2023-03-15T09:00:00Z",
              complemento: "Audiência realizada - sem acordo"
            }
          ],
          orgaoJulgador: "1ª Vara Cível",
          codigoOrgaoJulgador: 9700,
          codigoMunicipio: 3550308,
          assuntos: [
            { codigo: 10518, nome: "Responsabilidade Civil" },
            { codigo: 10520, nome: "Dano Material" }
          ],
        };
        
        // Save to search history
        await storage.addSearchHistory({
          processNumber,
          tribunal,
          resultData: demoResult,
        });
        
        return res.json({ success: true, data: demoResult });
      }
      
      const result = await searchDataJudProcess(tribunal, processNumber);
      
      // Save to search history
      await storage.addSearchHistory({
        processNumber,
        tribunal,
        resultData: result,
      });
      
      res.json({ success: true, data: result });
    } catch (error) {
      // Also save failed searches to history for user reference
      const { processNumber, tribunal } = req.body;
      if (processNumber && tribunal) {
        await storage.addSearchHistory({
          processNumber,
          tribunal,
          resultData: null,
        });
      }
      
      console.error("Search process error:", error);
      res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro na busca do processo" 
      });
    }
  });

  // Advanced search endpoint
  app.post("/api/advanced-search", async (req, res) => {
    try {
      const searchParams = advancedSearchSchema.parse(req.body);
      
      // Check for demo advanced search
      if (searchParams.processClass === "Demo" || 
          searchParams.searchTerm === "demo" ||
          searchParams.searchTerm === "demo-process-123" ||
          searchParams.searchTerm === "0000000-00.0000.0.00.0000") {
        const demoResults = [
          {
            numeroProcesso: "1234567-89.2023.8.26.0001",
            classeProcessual: "Ação de Cobrança",
            codigoClasseProcessual: 10234,
            sistemaProcessual: "PJe",
            codigoSistema: 3,
            formatoProcesso: "eletrônico",
            codigoFormato: 1,
            tribunal: searchParams.tribunal.toUpperCase(),
            ultimaAtualizacao: new Date().toISOString(),
            grau: "1º Grau",
            dataAjuizamento: "2023-01-15T00:00:00Z",
            nivelSigilo: 0,
            movimentos: [
              {
                codigo: 26,
                nome: "Distribuição",
                dataHora: "2023-01-15T10:00:00Z",
                complemento: "Processo distribuído"
              }
            ],
            orgaoJulgador: "2ª Vara Cível",
            codigoOrgaoJulgador: 9701,
            codigoMunicipio: 3550308,
            assuntos: [
              { codigo: 10518, nome: "Cobrança de Dívida" }
            ],
          },
          {
            numeroProcesso: "2345678-90.2023.8.26.0002",
            classeProcessual: "Ação de Cobrança",
            codigoClasseProcessual: 10234,
            sistemaProcessual: "PJe",
            codigoSistema: 3,
            formatoProcesso: "eletrônico",
            codigoFormato: 1,
            tribunal: searchParams.tribunal.toUpperCase(),
            ultimaAtualizacao: new Date().toISOString(),
            grau: "1º Grau",
            dataAjuizamento: "2023-02-10T00:00:00Z",
            nivelSigilo: 0,
            movimentos: [
              {
                codigo: 26,
                nome: "Distribuição",
                dataHora: "2023-02-10T09:00:00Z",
                complemento: "Processo distribuído"
              }
            ],
            orgaoJulgador: "3ª Vara Cível",
            codigoOrgaoJulgador: 9702,
            codigoMunicipio: 3550308,
            assuntos: [
              { codigo: 10518, nome: "Cobrança de Dívida" }
            ],
          }
        ];
        
        // Save each result to search history
        for (const result of demoResults) {
          await storage.addSearchHistory({
            processNumber: result.numeroProcesso,
            tribunal: searchParams.tribunal,
            resultData: result,
          });
        }
        
        return res.json({ success: true, data: demoResults });
      }
      
      const results = await advancedSearchDataJud(searchParams);
      
      // Save first result to search history
      if (results.length > 0) {
        await storage.addSearchHistory({
          processNumber: results[0].numeroProcesso,
          tribunal: searchParams.tribunal,
          resultData: results[0],
        });
      }
      
      res.json({ success: true, data: results });
    } catch (error) {
      console.error("Advanced search error:", error);
      res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro na busca avançada" 
      });
    }
  });

  // Bulk search endpoint
  app.post("/api/bulk-search", async (req, res) => {
    try {
      const { tribunal, processNumbers } = bulkSearchSchema.parse(req.body);
      
      // Check for demo mode - if any process number contains "demo"
      const isDemoMode = processNumbers.some(num => 
        num.includes("demo") || 
        num === "0000000-00.0000.0.00.0000" || 
        num === "demo-process-123"
      );
      
      if (isDemoMode) {
        // Generate demo results for all process numbers
        const demoResults: BulkSearchResult[] = processNumbers.map((processNumber, index) => ({
          processNumber,
          result: {
            numeroProcesso: processNumber,
            classeProcessual: `Ação Civil Pública (Demo ${index + 1})`,
            codigoClasseProcessual: 12729,
            sistemaProcessual: "PJe",
            codigoSistema: 3,
            formatoProcesso: "eletrônico",
            codigoFormato: 1,
            tribunal: tribunal.toUpperCase(),
            ultimaAtualizacao: new Date().toISOString(),
            grau: "1º Grau",
            dataAjuizamento: new Date(2023, 0, 15 + index).toISOString(),
            nivelSigilo: 0,
            movimentos: [
              {
                codigo: 26,
                nome: "Distribuição",
                dataHora: new Date(2023, 0, 15 + index, 10, 0, 0).toISOString(),
                complemento: `Processo distribuído para análise - Demo ${index + 1}`
              }
            ],
            orgaoJulgador: `${index + 1}ª Vara Cível`,
            codigoOrgaoJulgador: 9700 + index,
            codigoMunicipio: 3550308,
            assuntos: [
              { codigo: 10518, nome: "Responsabilidade Civil" }
            ],
          },
          error: null,
          status: "success" as const,
        }));
        
        // Save successful results to search history
        for (const result of demoResults) {
          if (result.status === "success" && result.result) {
            await storage.addSearchHistory({
              processNumber: result.processNumber,
              tribunal: tribunal,
              resultData: result.result,
            });
          }
        }
        
        return res.json({ success: true, data: demoResults });
      }
      
      const results = await bulkSearchDataJud(tribunal, processNumbers);
      
      // Save successful results to search history
      for (const result of results) {
        if (result.status === "success" && result.result) {
          await storage.addSearchHistory({
            processNumber: result.processNumber,
            tribunal: tribunal,
            resultData: result.result,
          });
        }
      }
      
      res.json({ success: true, data: results });
    } catch (error) {
      console.error("Bulk search error:", error);
      res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro na busca em lote" 
      });
    }
  });

  // Export data endpoint
  app.post("/api/export", async (req, res) => {
    try {
      const { format, data, title, includeMovements, includeSubjects } = exportRequestSchema.parse(req.body);
      
      if (!data || data.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Nenhum dado fornecido para exportação"
        });
      }

      const filename = `processos_${new Date().toISOString().split('T')[0]}`;
      
      switch (format) {
        case "pdf":
          const pdfBuffer = generatePDF(data, title, includeMovements, includeSubjects);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
          res.send(pdfBuffer);
          break;
          
        case "csv":
          const csvContent = generateCSV(data, includeMovements, includeSubjects);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
          res.send(csvContent);
          break;
          
        case "json":
          const jsonContent = generateJSON(data, includeMovements, includeSubjects);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
          res.send(jsonContent);
          break;
          
        default:
          return res.status(400).json({
            success: false,
            error: "Formato de exportação não suportado"
          });
      }
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Erro na exportação de dados"
      });
    }
  });

  // Get search history
  app.get("/api/search-history", async (req, res) => {
    try {
      const history = await storage.getSearchHistory();
      res.json({ success: true, data: history });
    } catch (error) {
      console.error("Get search history error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erro ao carregar histórico" 
      });
    }
  });

  // Get favorites
  app.get("/api/favorites", async (req, res) => {
    try {
      const favorites = await storage.getFavorites();
      res.json({ success: true, data: favorites });
    } catch (error) {
      console.error("Get favorites error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erro ao carregar favoritos" 
      });
    }
  });

  // Add favorite
  app.post("/api/favorites", async (req, res) => {
    try {
      const favoriteData = insertFavoriteSchema.parse(req.body);
      
      // Check if already exists
      const existing = await storage.getFavoriteByProcessNumber(favoriteData.processNumber);
      if (existing) {
        return res.status(400).json({ 
          success: false, 
          error: "Processo já está nos favoritos" 
        });
      }
      
      const favorite = await storage.addFavorite(favoriteData);
      res.json({ success: true, data: favorite });
    } catch (error) {
      console.error("Add favorite error:", error);
      res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro ao adicionar favorito" 
      });
    }
  });

  // Remove favorite
  app.delete("/api/favorites/:processNumber", async (req, res) => {
    try {
      const { processNumber } = req.params;
      const removed = await storage.removeFavorite(processNumber);
      
      if (!removed) {
        return res.status(404).json({ 
          success: false, 
          error: "Favorito não encontrado" 
        });
      }
      
      res.json({ success: true, message: "Favorito removido" });
    } catch (error) {
      console.error("Remove favorite error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erro ao remover favorito" 
      });
    }
  });

  // Get tribunal list
  app.get("/api/tribunals", (req, res) => {
    const tribunals = [
      {
        category: "Tribunais Superiores",
        items: [
          { value: "stj", label: "STJ - Superior Tribunal de Justiça" },
          { value: "stf", label: "STF - Supremo Tribunal Federal" },
          { value: "tst", label: "TST - Tribunal Superior do Trabalho" },
          { value: "tse", label: "TSE - Tribunal Superior Eleitoral" },
          { value: "stm", label: "STM - Superior Tribunal Militar" },
        ]
      },
      {
        category: "Justiça Federal",
        items: [
          { value: "trf1", label: "TRF1 - Tribunal Regional Federal da 1ª Região" },
          { value: "trf2", label: "TRF2 - Tribunal Regional Federal da 2ª Região" },
          { value: "trf3", label: "TRF3 - Tribunal Regional Federal da 3ª Região" },
          { value: "trf4", label: "TRF4 - Tribunal Regional Federal da 4ª Região" },
          { value: "trf5", label: "TRF5 - Tribunal Regional Federal da 5ª Região" },
          { value: "trf6", label: "TRF6 - Tribunal Regional Federal da 6ª Região" },
        ]
      },
      {
        category: "Justiça Estadual",
        items: [
          { value: "tjsp", label: "TJSP - Tribunal de Justiça de São Paulo" },
          { value: "tjrj", label: "TJRJ - Tribunal de Justiça do Rio de Janeiro" },
          { value: "tjmg", label: "TJMG - Tribunal de Justiça de Minas Gerais" },
          { value: "tjrs", label: "TJRS - Tribunal de Justiça do Rio Grande do Sul" },
          { value: "tjpr", label: "TJPR - Tribunal de Justiça do Paraná" },
          { value: "tjsc", label: "TJSC - Tribunal de Justiça de Santa Catarina" },
          { value: "tjba", label: "TJBA - Tribunal de Justiça da Bahia" },
          { value: "tjgo", label: "TJGO - Tribunal de Justiça de Goiás" },
          { value: "tjce", label: "TJCE - Tribunal de Justiça do Ceará" },
          { value: "tjpe", label: "TJPE - Tribunal de Justiça de Pernambuco" },
        ]
      },
    ];
    
    res.json({ success: true, data: tribunals });
  });

  const httpServer = createServer(app);
  return httpServer;
}
