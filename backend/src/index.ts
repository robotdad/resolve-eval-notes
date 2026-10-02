import express from 'express';
import cors from 'cors';
import path from 'path';
import router from './routes';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api', router);

// Serve static frontend files in production
const frontendBuildPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendBuildPath));

// Fallback to index.html for SPA routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Notes backend running on http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api/notes`);
  });
}

export default app;
