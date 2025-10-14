import express from 'express';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import compiled routes
let routes;
try {
  routes = await import('../dist/routes.js');
} catch (error) {
  console.error('Error loading routes:', error);
  // Fallback routes
  app.get('/api', (req, res) => {
    res.json({ status: 'error', message: 'Routes not loaded properly' });
  });
}

if (routes && routes.registerRoutes) {
  routes.registerRoutes(app);
}

// Export for Vercel
export default app;
