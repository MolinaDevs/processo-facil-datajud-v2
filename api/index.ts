import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import { registerRoutes } from '../server/routes';

// Create Express app singleton
let app: express.Express | null = null;

function getApp() {
  if (!app) {
    app = express();
    
    // CORS configuration
    app.use(cors({
      origin: '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Body parsers
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: false, limit: '10mb' }));

    // Error handling middleware
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Error in Express app:', err);
      res.status(500).json({ 
        error: 'Internal server error', 
        message: err.message,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    });

    // Register all routes
    try {
      registerRoutes(app);
      console.log('Routes registered successfully');
    } catch (error) {
      console.error('Error registering routes:', error);
      throw error;
    }
  }
  return app;
}

// Vercel serverless handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Log environment check
    console.log('Environment variables check:', {
      hasDatajudKey: !!process.env.DATAJUD_API_KEY,
      hasSessionSecret: !!process.env.SESSION_SECRET,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV
    });

    const expressApp = getApp();
    
    // Convert Vercel request/response to Express format
    return new Promise((resolve, reject) => {
      expressApp(req as any, res as any, (err: any) => {
        if (err) {
          console.error('Express error:', err);
          reject(err);
        } else {
          resolve(undefined);
        }
      });
    });
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ 
      error: 'Server initialization failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
