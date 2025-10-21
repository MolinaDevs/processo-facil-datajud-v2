import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Teste simples - retornar tribunais hardcoded
    const tribunals = [
      { code: "stj", name: "Superior Tribunal de Justiça", category: "Superior" },
      { code: "stf", name: "Supremo Tribunal Federal", category: "Superior" },
      { code: "tst", name: "Tribunal Superior do Trabalho", category: "Superior" },
      { code: "tjsp", name: "Tribunal de Justiça de São Paulo", category: "Estadual" },
      { code: "tjrj", name: "Tribunal de Justiça do Rio de Janeiro", category: "Estadual" }
    ];

    res.status(200).json(tribunals);
  } catch (error) {
    console.error('Error in tribunals endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
