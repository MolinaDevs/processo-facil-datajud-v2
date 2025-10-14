import express, { type Request, Response } from "express";
import cors from "cors";
import { registerRoutes } from "../server/routes";

const app = express();

// Fix Vercel path rewriting - restore original URL
app.use((req, _res, next) => {
  if (process.env.VERCEL) {
    const originalPath = req.headers['x-vercel-forwarded-for-path'] as string || 
                        req.headers['x-forwarded-uri'] as string ||
                        req.headers['x-vercel-matched-path'] as string;
    
    if (originalPath) {
      req.url = originalPath;
      req.originalUrl = originalPath;
    }
  }
  next();
});

// CORS middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Register all routes
registerRoutes(app);

// Error handler
app.use((err: any, _req: Request, res: Response, _next: any) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

// Export for Vercel serverless
export default app;
