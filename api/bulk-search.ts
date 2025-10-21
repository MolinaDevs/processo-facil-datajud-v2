import type { VercelRequest, VercelResponse } from '@vercel/node';

const DATAJUD_BASE_URL = "https://api-publica.datajud.cnj.jus.br/";
const API_KEY = process.env.DATAJUD_API_KEY;
const isDemoMode = !API_KEY;

const tribunalAliases: Record<string, string> = {
  stj: "stj", stf: "stf", tst: "tst", tse: "tse", stm: "stm",
  trf1: "trf1", trf2: "trf2", trf3: "trf3", trf4: "trf4", trf5: "trf5", trf6: "trf6",
  tjsp: "tjsp", tjrj: "tjrj", tjmg: "tjmg", tjrs: "tjrs", tjpr: "tjpr", tjsc: "tjsc",
  tjba: "tjba", tjce: "tjce", tjpe: "tjpe", tjgo: "tjgo", tjdft: "tjdft",
};

interface BulkSearchResult {
  processNumber: string;
  result: any | null;
  error: string | null;
  status: "success" | "error" | "not_found";
}

async function searchDataJudProcess(tribunal: string, processNumber: string) {
  if (isDemoMode) {
    throw new Error("Modo demonstração: Configure DATAJUD_API_KEY");
  }

  const tribunalAlias = tribunalAliases[tribunal.toLowerCase()];
  if (!tribunalAlias) {
    throw new Error(`Tribunal não suportado: ${tribunal}`);
  }

  const url = `${DATAJUD_BASE_URL}api_publica_${tribunalAlias}/_search`;
  const cleanProcessNumber = processNumber.replace(/\D/g, "");
  
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

async function bulkSearchDataJud(tribunal: string, processNumbers: string[]): Promise<BulkSearchResult[]> {
  const tribunalAlias = tribunalAliases[tribunal.toLowerCase()];
  if (!tribunalAlias) {
    throw new Error(`Tribunal não suportado: ${tribunal}`);
  }

  const results: BulkSearchResult[] = [];
  const batchSize = 10; // Process 10 at a time to avoid overwhelming the API
  
  for (let i = 0; i < processNumbers.length; i += batchSize) {
    const batch = processNumbers.slice(i, i + batchSize);
    const batchPromises = batch.map(async (processNumber): Promise<BulkSearchResult> => {
      try {
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
    
    // Add a small delay between batches to avoid rate limiting
    if (i + batchSize < processNumbers.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'POST') {
    try {
      const { tribunal, processNumbers } = req.body;
      
      if (!tribunal || !processNumbers || !Array.isArray(processNumbers)) {
        return res.status(400).json({
          success: false,
          error: 'Tribunal e lista de processos são obrigatórios'
        });
      }
      
      if (processNumbers.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'A lista de processos não pode estar vazia'
        });
      }
      
      if (processNumbers.length > 1000) {
        return res.status(400).json({
          success: false,
          error: 'Máximo de 1000 processos por busca'
        });
      }
      
      const results = await bulkSearchDataJud(tribunal, processNumbers);
      
      return res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error("Bulk search error:", error);
      return res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro na busca em lote" 
      });
    }
  }
  
  return res.status(405).json({ 
    success: false,
    error: 'Method not allowed' 
  });
}
