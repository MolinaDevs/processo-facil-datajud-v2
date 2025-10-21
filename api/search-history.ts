import type { VercelRequest, VercelResponse} from '@vercel/node';

// In-memory storage (temporário - será substituído por DB)
const searchHistory: any[] = [];

export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    return res.status(200).json(searchHistory.slice(0, 10));
  }
  
  if (req.method === 'POST') {
    const newSearch = {
      id: Math.random().toString(36).substring(7),
      ...req.body,
      searchedAt: new Date().toISOString()
    };
    searchHistory.unshift(newSearch);
    return res.status(201).json(newSearch);
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
