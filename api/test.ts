import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ 
    status: 'ok',
    message: 'Vercel function working!',
    env: {
      hasDatajudKey: !!process.env.DATAJUD_API_KEY,
      hasSessionSecret: !!process.env.SESSION_SECRET,
      hasDatabaseUrl: !!process.env.DATABASE_URL
    }
  });
}
