import express, { type Request, Response } from "express";
import cors from "cors";
import { registerRoutes } from "../server/routes";

const app = express();

// Fix Vercel path rewriting - restore original URL from query param
app.use((req, _res, next) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const vercelPath = url.searchParams.get('__vercel_path');
  
  if (vercelPath) {
    // Remove the query parameter and use the original path
    url.searchParams.delete('__vercel_path');
    const cleanQuery = url.search;
    req.url = vercelPath + cleanQuery;
    req.originalUrl = vercelPath + cleanQuery;
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
