import './env.js';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { initDb, q } from './db.js';
import { initStorage } from './storage.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import projectRoutes from './routes/projects.js';
import itemRoutes from './routes/items.js';
import contractRoutes from './routes/contracts.js';
import documentRoutes from './routes/documents.js';
import feedbackRoutes from './routes/feedback.js';
import settingsRoutes from './routes/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built client in production (client/dist)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

/** Create a default admin so the app is usable on first run. */
async function bootstrapAdmin() {
  if (await q.get("SELECT TOP 1 1 AS ok FROM rz_users WHERE role = 'admin'")) return;
  const email = process.env.ADMIN_EMAIL || 'admin@rahazone.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  await q.run('INSERT INTO rz_users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    'Administrator', email, bcrypt.hashSync(password, 10), 'admin');
  console.log(`Created default admin: ${email} / ${password}`);
}

try {
  await initDb();
  console.log(`Document storage: ${await initStorage()}`);
  await bootstrapAdmin();
  app.listen(PORT, () => console.log(`Rahazone API listening on http://localhost:${PORT}`));
} catch (err) {
  console.error('Failed to start:', err.message);
  process.exit(1);
}
