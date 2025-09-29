import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processSearchSchema, advancedSearchSchema, insertSearchHistorySchema, insertFavoriteSchema } from "@shared/schema";
import { z } from "zod";

// Since we can't install busca-processos-judiciais in this environment,
// we'll implement direct API calls to DataJud
const DATAJUD_BASE_URL = "https://api-publica.datajud.cnj.jus.br/";
const API_KEY = process.env.DATAJUD_API_KEY || "APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

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
  const tribunalAlias = tribunalAliases[tribunal.toLowerCase()];
  if (!tribunalAlias) {
    throw new Error(`Tribunal não suportado: ${tribunal}`);
  }

  const url = `${DATAJUD_BASE_URL}api_publica_${tribunalAlias}/_search`;
  const cleanProcessNumber = processNumber.replace(/\D/g, ""); // Remove formatting
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": API_KEY,
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
    sistemaProcessual: processData.sistema || "Não informado",
    formatoProcesso: processData.formato || "eletrônico",
    tribunal: tribunal.toUpperCase(),
    ultimaAtualizacao: processData.dataUltimaAtualizacao || new Date().toISOString(),
    grau: processData.grau || "Não informado",
    dataAjuizamento: processData.dataAjuizamento || "Não informado",
    movimentos: processData.movimentos || [],
    orgaoJulgador: processData.orgaoJulgador?.nome || "Não informado",
    codigoMunicipio: processData.orgaoJulgador?.codigoMunicipioIBGE || 0,
    assuntos: processData.assuntos || [],
  };
}

async function advancedSearchDataJud(searchParams: any) {
  const { tribunal, processClass, judgingBody, filingDateFrom, filingDateTo, searchTerm } = searchParams;
  
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
      "Authorization": API_KEY,
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
      sistemaProcessual: processData.sistema || "Não informado",
      formatoProcesso: processData.formato || "eletrônico",
      tribunal: tribunal.toUpperCase(),
      ultimaAtualizacao: processData.dataUltimaAtualizacao || new Date().toISOString(),
      grau: processData.grau || "Não informado",
      dataAjuizamento: processData.dataAjuizamento || "Não informado",
      movimentos: processData.movimentos || [],
      orgaoJulgador: processData.orgaoJulgador?.nome || "Não informado",
      codigoMunicipio: processData.orgaoJulgador?.codigoMunicipioIBGE || 0,
      assuntos: processData.assuntos || [],
    };
  });
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
          formatoProcesso: "eletrônico",
          tribunal: tribunal.toUpperCase(),
          ultimaAtualizacao: new Date().toISOString(),
          grau: "1º Grau",
          dataAjuizamento: "2023-01-15T00:00:00Z",
          movimentos: [
            {
              nome: "Distribuição",
              dataHora: "2023-01-15T10:00:00Z",
              complemento: "Processo distribuído para análise"
            },
            {
              nome: "Citação",
              dataHora: "2023-02-01T14:30:00Z",
              complemento: "Citação realizada com sucesso"
            },
            {
              nome: "Audiência de Conciliação",
              dataHora: "2023-03-15T09:00:00Z",
              complemento: "Audiência realizada - sem acordo"
            }
          ],
          orgaoJulgador: "1ª Vara Cível",
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
      if (searchParams.processClass === "Demo" || searchParams.searchTerm === "demo") {
        const demoResults = [
          {
            numeroProcesso: "1234567-89.2023.8.26.0001",
            classeProcessual: "Ação de Cobrança",
            codigoClasseProcessual: 10234,
            sistemaProcessual: "PJe",
            formatoProcesso: "eletrônico",
            tribunal: searchParams.tribunal.toUpperCase(),
            ultimaAtualizacao: new Date().toISOString(),
            grau: "1º Grau",
            dataAjuizamento: "2023-01-15T00:00:00Z",
            movimentos: [
              {
                nome: "Distribuição",
                dataHora: "2023-01-15T10:00:00Z",
                complemento: "Processo distribuído"
              }
            ],
            orgaoJulgador: "2ª Vara Cível",
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
            formatoProcesso: "eletrônico",
            tribunal: searchParams.tribunal.toUpperCase(),
            ultimaAtualizacao: new Date().toISOString(),
            grau: "1º Grau",
            dataAjuizamento: "2023-02-10T00:00:00Z",
            movimentos: [
              {
                nome: "Distribuição",
                dataHora: "2023-02-10T09:00:00Z",
                complemento: "Processo distribuído"
              }
            ],
            orgaoJulgador: "3ª Vara Cível",
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
