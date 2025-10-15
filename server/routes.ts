import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processSearchSchema, advancedSearchSchema, bulkSearchSchema, exportRequestSchema, insertSearchHistorySchema, insertFavoriteSchema, insertFollowSchema, type BulkSearchResult, type ProcessResult } from "@shared/schema";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { stringify } from "csv-stringify/sync";
import * as XLSX from "xlsx";

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
function formatDateSafely(dateValue: string | Date, format: 'date' | 'time' | 'datetime' = 'date'): string {
  if (!dateValue) return '';
  
  // List of known sentinel values that should be returned as-is
  const sentinelValues = ['Não informado', 'N/A', 'n/a', 'não disponível'];
  
  // If it's a known sentinel string, return as is
  if (typeof dateValue === 'string' && sentinelValues.some(s => dateValue.toLowerCase() === s.toLowerCase())) {
    return dateValue;
  }
  
  try {
    const date = new Date(dateValue);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      // If parsing failed, return the original string if it was a string
      return typeof dateValue === 'string' ? dateValue : '';
    }
    
    if (format === 'date') {
      return date.toLocaleDateString('pt-BR');
    } else if (format === 'time') {
      return date.toLocaleTimeString('pt-BR');
    } else {
      return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR')}`;
    }
  } catch {
    // If any error occurs, return the original string value
    return typeof dateValue === 'string' ? dateValue : '';
  }
}

async function generatePDF(processes: ProcessResult[], title: string = "Relatório de Processos", includeMovements: boolean = true, includeSubjects: boolean = true): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        size: 'A4',
        bufferPages: true,
        autoFirstPage: true
      });
      
      const buffers: Buffer[] = [];
      
      // Set up event handlers BEFORE any operations
      doc.on('data', (chunk: Buffer) => {
        buffers.push(chunk);
      });
      
      doc.on('end', () => {
        try {
          const pdfBuffer = Buffer.concat(buffers);
          console.log(`[PDF] Generated successfully. Size: ${pdfBuffer.length} bytes`);
          resolve(pdfBuffer);
        } catch (bufferError) {
          console.error('[PDF] Error concatenating buffers:', bufferError);
          reject(new Error(`Erro ao criar buffer PDF: ${bufferError instanceof Error ? bufferError.message : 'desconhecido'}`));
        }
      });
      
      doc.on('error', (err: Error) => {
        console.error('[PDF] PDFDocument error:', err);
        reject(new Error(`Erro do PDFKit: ${err.message}`));
      });
      
      // Add content
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
        doc.text(`Data de Ajuizamento: ${formatDateSafely(process.dataAjuizamento)}`);
        doc.text(`Última Atualização: ${formatDateSafely(process.ultimaAtualizacao)}`);
        doc.moveDown(1);
        
        // Subjects
        if (includeSubjects && process.assuntos && process.assuntos.length > 0) {
          doc.fontSize(12).font('Helvetica-Bold').text('Assuntos:');
          doc.fontSize(10).font('Helvetica');
          process.assuntos.forEach(subject => {
            doc.text(`• ${subject.nome} (${subject.codigo})`);
          });
          doc.moveDown(1);
        }
        
        // Movements
        if (includeMovements && process.movimentos && process.movimentos.length > 0) {
          doc.fontSize(12).font('Helvetica-Bold').text('Movimentações:');
          doc.fontSize(10).font('Helvetica');
          process.movimentos.forEach(movement => {
            const date = formatDateSafely(movement.dataHora, 'date');
            const time = formatDateSafely(movement.dataHora, 'time');
            doc.text(`• ${date} ${time} - ${movement.nome}`);
            if (movement.complemento) {
              doc.text(`  ${movement.complemento}`);
            }
          });
        }
      });
      
      // Finalize the PDF
      doc.end();
    } catch (error) {
      console.error('[PDF] Error during generation:', error);
      reject(new Error(`Erro ao gerar PDF: ${error instanceof Error ? error.message : 'desconhecido'}`));
    }
  });
}

function generateCSV(processes: ProcessResult[], includeMovements: boolean = true, includeSubjects: boolean = true): string {
  const records: Record<string, any>[] = [];
  
  processes.forEach(process => {
    const record: Record<string, any> = {
      'Número do Processo': process.numeroProcesso,
      'Classe Processual': process.classeProcessual,
      'Código Classe': process.codigoClasseProcessual,
      'Tribunal': process.tribunal,
      'Órgão Julgador': process.orgaoJulgador,
      'Grau': process.grau,
      'Sistema': process.sistemaProcessual,
      'Formato': process.formatoProcesso,
      'Data de Ajuizamento': formatDateSafely(process.dataAjuizamento),
      'Última Atualização': formatDateSafely(process.ultimaAtualizacao),
    };
    
    // Add subjects as semicolon-separated list
    if (includeSubjects && process.assuntos && process.assuntos.length > 0) {
      record['Assuntos'] = process.assuntos.map(s => s.nome).join('; ');
      record['Códigos dos Assuntos'] = process.assuntos.map(s => s.codigo).join('; ');
    } else {
      record['Assuntos'] = '';
      record['Códigos dos Assuntos'] = '';
    }
    
    // Add movement summary with last 3 movements
    if (includeMovements && process.movimentos && process.movimentos.length > 0) {
      record['Total de Movimentações'] = process.movimentos.length;
      
      // Last 3 movements (most recent first)
      record['Último Andamento'] = process.movimentos[0]?.nome || '';
      record['Data Último Andamento'] = formatDateSafely(process.movimentos[0]?.dataHora);
      
      record['Penúltimo Andamento'] = process.movimentos[1]?.nome || '';
      record['Data Penúltimo Andamento'] = formatDateSafely(process.movimentos[1]?.dataHora);
      
      record['Antepenúltimo Andamento'] = process.movimentos[2]?.nome || '';
      record['Data Antepenúltimo Andamento'] = formatDateSafely(process.movimentos[2]?.dataHora);
      
      // Add all movements as a detailed text field
      const movementsText = process.movimentos.map((mov, idx) => {
        const date = formatDateSafely(mov.dataHora, 'date');
        const time = formatDateSafely(mov.dataHora, 'time');
        return `[${idx + 1}] ${date} ${time} - ${mov.nome}${mov.complemento ? ' | ' + mov.complemento : ''}`;
      }).join(' || ');
      
      record['Histórico Completo de Movimentações'] = movementsText;
    } else {
      record['Total de Movimentações'] = 0;
      record['Último Andamento'] = '';
      record['Data Último Andamento'] = '';
      record['Penúltimo Andamento'] = '';
      record['Data Penúltimo Andamento'] = '';
      record['Antepenúltimo Andamento'] = '';
      record['Data Antepenúltimo Andamento'] = '';
      record['Histórico Completo de Movimentações'] = '';
    }
    
    records.push(record);
  });
  
  return stringify(records, { 
    header: true,
    delimiter: ',',
    quoted: true,
    quoted_empty: true,
    bom: true
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

function generateExcel(processes: ProcessResult[], includeMovements: boolean = true, includeSubjects: boolean = true): Buffer {
  const workbook = XLSX.utils.book_new();
  
  // Main sheet with process data
  const mainData: any[] = [];
  
  processes.forEach(process => {
    const row: any = {
      'Número do Processo': process.numeroProcesso,
      'Classe Processual': process.classeProcessual,
      'Código Classe': process.codigoClasseProcessual,
      'Tribunal': process.tribunal,
      'Órgão Julgador': process.orgaoJulgador,
      'Código Órgão Julgador': process.codigoOrgaoJulgador || '',
      'Grau': process.grau,
      'Sistema': process.sistemaProcessual,
      'Código Sistema': process.codigoSistema || '',
      'Formato': process.formatoProcesso,
      'Código Formato': process.codigoFormato || '',
      'Data de Ajuizamento': formatDateSafely(process.dataAjuizamento),
      'Última Atualização': formatDateSafely(process.ultimaAtualizacao),
      'Nível de Sigilo': process.nivelSigilo || '',
      'Código Município': process.codigoMunicipio || '',
    };
    
    if (includeSubjects) {
      row['Assuntos'] = process.assuntos.map(s => `${s.nome} (${s.codigo})`).join('; ');
      row['Códigos Assuntos'] = process.assuntos.map(s => s.codigo).join('; ');
    }
    
    row['Quantidade de Movimentos'] = process.movimentos.length;
    
    // Add last 3 movements (most recent first)
    if (includeMovements && process.movimentos.length > 0) {
      row['Último Andamento'] = process.movimentos[0]?.nome || '';
      row['Data Último Andamento'] = formatDateSafely(process.movimentos[0]?.dataHora);
      
      row['Penúltimo Andamento'] = process.movimentos[1]?.nome || '';
      row['Data Penúltimo Andamento'] = formatDateSafely(process.movimentos[1]?.dataHora);
      
      row['Antepenúltimo Andamento'] = process.movimentos[2]?.nome || '';
      row['Data Antepenúltimo Andamento'] = formatDateSafely(process.movimentos[2]?.dataHora);
    } else {
      row['Último Andamento'] = '';
      row['Data Último Andamento'] = '';
      row['Penúltimo Andamento'] = '';
      row['Data Penúltimo Andamento'] = '';
      row['Antepenúltimo Andamento'] = '';
      row['Data Antepenúltimo Andamento'] = '';
    }
    
    mainData.push(row);
  });
  
  const mainSheet = XLSX.utils.json_to_sheet(mainData);
  
  // Set column widths
  const wscols = [
    { wch: 25 }, // Número do Processo
    { wch: 30 }, // Classe Processual
    { wch: 15 }, // Código Classe
    { wch: 15 }, // Tribunal
    { wch: 30 }, // Órgão Julgador
    { wch: 20 }, // Código Órgão
    { wch: 10 }, // Grau
    { wch: 15 }, // Sistema
    { wch: 15 }, // Código Sistema
    { wch: 15 }, // Formato
    { wch: 15 }, // Código Formato
    { wch: 18 }, // Data Ajuizamento
    { wch: 18 }, // Última Atualização
    { wch: 15 }, // Nível Sigilo
    { wch: 15 }, // Código Município
    { wch: 50 }, // Assuntos
    { wch: 30 }, // Códigos Assuntos
    { wch: 22 }, // Quantidade Movimentos
    { wch: 50 }, // Último Andamento
    { wch: 18 }, // Data Último Andamento
    { wch: 50 }, // Penúltimo Andamento
    { wch: 18 }, // Data Penúltimo Andamento
    { wch: 50 }, // Antepenúltimo Andamento
    { wch: 18 }, // Data Antepenúltimo Andamento
  ];
  mainSheet['!cols'] = wscols;
  
  XLSX.utils.book_append_sheet(workbook, mainSheet, "Processos");
  
  // Movements sheet if requested
  if (includeMovements) {
    const movementsData: any[] = [];
    
    processes.forEach(process => {
      process.movimentos.forEach((movement, index) => {
        const movRow: any = {
          'Número do Processo': process.numeroProcesso,
          'Sequência': index + 1,
          'Data': formatDateSafely(movement.dataHora, 'date'),
          'Hora': formatDateSafely(movement.dataHora, 'time'),
          'Código Movimento': movement.codigo || '',
          'Nome do Movimento': movement.nome,
          'Complemento': movement.complemento || '',
        };
        
        if (movement.orgaoJulgador) {
          movRow['Órgão Julgador Movimento'] = movement.orgaoJulgador.nomeOrgao;
          movRow['Código Órgão Movimento'] = movement.orgaoJulgador.codigoOrgao;
        }
        
        if (movement.complementosTabelados && movement.complementosTabelados.length > 0) {
          movRow['Complementos Tabelados'] = movement.complementosTabelados
            .map(c => `${c.nome}: ${c.descricao} (${c.codigo}=${c.valor})`)
            .join('; ');
        }
        
        movementsData.push(movRow);
      });
    });
    
    if (movementsData.length > 0) {
      const movSheet = XLSX.utils.json_to_sheet(movementsData);
      
      const movWscols = [
        { wch: 25 }, // Número do Processo
        { wch: 10 }, // Sequência
        { wch: 12 }, // Data
        { wch: 10 }, // Hora
        { wch: 18 }, // Código Movimento
        { wch: 40 }, // Nome do Movimento
        { wch: 50 }, // Complemento
        { wch: 30 }, // Órgão Julgador Movimento
        { wch: 20 }, // Código Órgão Movimento
        { wch: 60 }, // Complementos Tabelados
      ];
      movSheet['!cols'] = movWscols;
      
      XLSX.utils.book_append_sheet(workbook, movSheet, "Movimentações");
    }
  }
  
  // Subjects sheet if requested
  if (includeSubjects) {
    const subjectsData: any[] = [];
    
    processes.forEach(process => {
      process.assuntos.forEach(subject => {
        subjectsData.push({
          'Número do Processo': process.numeroProcesso,
          'Código Assunto': subject.codigo,
          'Nome do Assunto': subject.nome,
        });
      });
    });
    
    if (subjectsData.length > 0) {
      const subjSheet = XLSX.utils.json_to_sheet(subjectsData);
      
      const subjWscols = [
        { wch: 25 }, // Número do Processo
        { wch: 15 }, // Código Assunto
        { wch: 50 }, // Nome do Assunto
      ];
      subjSheet['!cols'] = subjWscols;
      
      XLSX.utils.book_append_sheet(workbook, subjSheet, "Assuntos");
    }
  }
  
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
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
      console.log('[Export] Request received for format:', req.body.format);
      
      const { format, data, title, includeMovements, includeSubjects } = exportRequestSchema.parse(req.body);
      
      if (!data || data.length === 0) {
        console.error('[Export] No data provided');
        return res.status(400).json({
          success: false,
          error: "Nenhum dado fornecido para exportação"
        });
      }

      console.log(`[Export] Processing ${data.length} processes for ${format} export`);
      const filename = `processos_${new Date().toISOString().split('T')[0]}`;
      
      switch (format) {
        case "pdf":
          try {
            console.log('[Export] Starting PDF generation...');
            const pdfBuffer = await generatePDF(data, title, includeMovements, includeSubjects);
            console.log(`[Export] PDF generated successfully, size: ${pdfBuffer.length} bytes`);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
            res.send(pdfBuffer);
          } catch (pdfError) {
            console.error('[Export] PDF generation failed:', pdfError);
            throw pdfError;
          }
          break;
          
        case "csv":
          console.log('[Export] Starting CSV generation...');
          const csvContent = generateCSV(data, includeMovements, includeSubjects);
          console.log('[Export] CSV generated successfully');
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
          res.send(csvContent);
          break;
          
        case "excel":
          console.log('[Export] Starting Excel generation...');
          const excelBuffer = generateExcel(data, includeMovements, includeSubjects);
          console.log(`[Export] Excel generated successfully, size: ${excelBuffer.length} bytes`);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
          res.send(excelBuffer);
          break;
          
        case "json":
          console.log('[Export] Starting JSON generation...');
          const jsonContent = generateJSON(data, includeMovements, includeSubjects);
          console.log('[Export] JSON generated successfully');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
          res.send(jsonContent);
          break;
          
        default:
          console.error('[Export] Unsupported format:', format);
          return res.status(400).json({
            success: false,
            error: "Formato de exportação não suportado"
          });
      }
    } catch (error) {
      console.error("[Export] Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro na exportação de dados";
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error("[Export] Stack:", errorStack);
      
      res.status(500).json({
        success: false,
        error: errorMessage
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

  // Get follows
  app.get("/api/follows", async (req, res) => {
    try {
      const follows = await storage.getFollows();
      res.json({ success: true, data: follows });
    } catch (error) {
      console.error("Get follows error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erro ao carregar acompanhamentos" 
      });
    }
  });

  // Add follow
  app.post("/api/follows", async (req, res) => {
    try {
      const followData = insertFollowSchema.parse(req.body);
      
      // Check if already exists
      const existing = await storage.getFollowByProcessNumber(followData.processNumber);
      if (existing) {
        return res.status(400).json({ 
          success: false, 
          error: "Processo já está sendo acompanhado" 
        });
      }
      
      const follow = await storage.addFollow(followData);
      res.json({ success: true, data: follow });
    } catch (error) {
      console.error("Add follow error:", error);
      res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro ao adicionar acompanhamento" 
      });
    }
  });

  // Remove follow
  app.delete("/api/follows/:processNumber", async (req, res) => {
    try {
      const { processNumber } = req.params;
      const removed = await storage.removeFollow(processNumber);
      
      if (!removed) {
        return res.status(404).json({ 
          success: false, 
          error: "Acompanhamento não encontrado" 
        });
      }
      
      res.json({ success: true, message: "Acompanhamento removido" });
    } catch (error) {
      console.error("Remove follow error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erro ao remover acompanhamento" 
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
