import type { VercelRequest, VercelResponse } from '@vercel/node';

// Lista de tribunais brasileiros
const tribunals = [
  // Tribunais Superiores
  { code: "stj", name: "Superior Tribunal de Justiça", category: "Superior" },
  { code: "stf", name: "Supremo Tribunal Federal", category: "Superior" },
  { code: "tst", name: "Tribunal Superior do Trabalho", category: "Superior" },
  { code: "tse", name: "Tribunal Superior Eleitoral", category: "Superior" },
  { code: "stm", name: "Superior Tribunal Militar", category: "Superior" },
  
  // Tribunais Regionais Federais
  { code: "trf1", name: "TRF 1ª Região", category: "Federal" },
  { code: "trf2", name: "TRF 2ª Região", category: "Federal" },
  { code: "trf3", name: "TRF 3ª Região", category: "Federal" },
  { code: "trf4", name: "TRF 4ª Região", category: "Federal" },
  { code: "trf5", name: "TRF 5ª Região", category: "Federal" },
  { code: "trf6", name: "TRF 6ª Região", category: "Federal" },
  
  // Tribunais de Justiça Estaduais
  { code: "tjsp", name: "Tribunal de Justiça de São Paulo", category: "Estadual" },
  { code: "tjrj", name: "Tribunal de Justiça do Rio de Janeiro", category: "Estadual" },
  { code: "tjmg", name: "Tribunal de Justiça de Minas Gerais", category: "Estadual" },
  { code: "tjrs", name: "Tribunal de Justiça do Rio Grande do Sul", category: "Estadual" },
  { code: "tjpr", name: "Tribunal de Justiça do Paraná", category: "Estadual" },
  { code: "tjsc", name: "Tribunal de Justiça de Santa Catarina", category: "Estadual" },
  { code: "tjba", name: "Tribunal de Justiça da Bahia", category: "Estadual" },
  { code: "tjce", name: "Tribunal de Justiça do Ceará", category: "Estadual" },
  { code: "tjpe", name: "Tribunal de Justiça de Pernambuco", category: "Estadual" },
  { code: "tjgo", name: "Tribunal de Justiça de Goiás", category: "Estadual" },
  { code: "tjdft", name: "Tribunal de Justiça do Distrito Federal", category: "Estadual" },
];

export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    return res.status(200).json(tribunals);
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
