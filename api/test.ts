import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ 
    message: 'Test API working!',
    timestamp: new Date().toISOString(),
    env: {
      hasDatajudKey: !!process.env.DATAJUD_API_KEY,
      hasSessionSecret: !!process.env.SESSION_SECRET,
    }
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
