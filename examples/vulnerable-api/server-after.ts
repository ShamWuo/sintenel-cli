// Secure Express API - AFTER Sintenel-CLI Remediation
// This shows the patched version with security best practices

import express from 'express';
import { createConnection } from 'mysql2/promise';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const app = express();

// Fixed: Use environment variables
const db = createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'userdb'
});

app.use(express.json());

// Fixed #1: Parameterized query prevents SQL injection
app.get('/users/:id', async (req, res) => {
  try {
    const conn = await db;
    const [results] = await conn.execute(
      'SELECT * FROM users WHERE id = ?',
      [req.params.id]
    );
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Fixed #2: Parameterized query with proper escaping
app.get('/search', async (req, res) => {
  const searchTerm = req.query.q as string;
  
  if (!searchTerm || searchTerm.length > 100) {
    return res.status(400).json({ error: 'Invalid search term' });
  }

  try {
    const conn = await db;
    const [results] = await conn.execute(
      'SELECT * FROM users WHERE name LIKE ?',
      [`%${searchTerm}%`]
    );
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Fixed #3: Command injection prevented with validation
app.post('/backup', async (req, res) => {
  const filename = req.body.filename;
  
  // Strict validation - alphanumeric and hyphens only
  if (!/^[a-zA-Z0-9-]+$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  try {
    await execAsync(`tar -czf backups/${filename}.tar.gz data/`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Backup failed' });
  }
});

// Fixed #4: Restricted CORS with origin whitelist
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`Secure server running on port ${PORT}`);
});
