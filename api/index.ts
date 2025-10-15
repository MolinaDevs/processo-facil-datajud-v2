import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import { registerRoutes } from '../server/routes';

let app: ReturnType<typeof express> | null = null;

function getApp() {
  if (!app) {
    app = express();
    
    app.use(cors({
      origin: '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: false, limit: '10mb' }));

    // Register routes
    registerRoutes(app);
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const expressApp = getApp();
  return expressApp(req as any, res as any);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
