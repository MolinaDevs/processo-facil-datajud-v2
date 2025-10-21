import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-memory storage (temporário - será substituído por DB)
const favorites: any[] = [];

export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    return res.status(200).json(favorites);
  }
  
  if (req.method === 'POST') {
    const newFavorite = {
      id: Math.random().toString(36).substring(7),
      ...req.body,
      addedAt: new Date().toISOString()
    };
    favorites.push(newFavorite);
    return res.status(201).json(newFavorite);
  }
  
  if (req.method === 'DELETE') {
    const { processNumber } = req.body;
    const index = favorites.findIndex(f => f.processNumber === processNumber);
    if (index > -1) {
      favorites.splice(index, 1);
      return res.status(200).json({ success: true });
    }
    return res.status(404).json({ error: 'Favorite not found' });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
