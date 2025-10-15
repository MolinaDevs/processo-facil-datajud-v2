import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/app';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
