// Vulnerable Express API - SQL Injection Example
// This is a BEFORE example showing common vulnerabilities

import express from 'express';
import { createConnection } from 'mysql2';

const app = express();
const db = createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password123', // Hardcoded credential!
  database: 'userdb'
});

app.use(express.json());

// Vulnerability #1: SQL Injection in user lookup
app.get('/users/:id', (req, res) => {
  const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Vulnerability #2: SQL Injection in search
app.get('/search', (req, res) => {
  const searchTerm = req.query.q;
  const query = `SELECT * FROM users WHERE name LIKE '%${searchTerm}%'`;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Vulnerability #3: Command Injection
app.post('/backup', (req, res) => {
  const filename = req.body.filename;
  require('child_process').exec(`tar -czf backups/${filename}.tar.gz data/`, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Vulnerability #4: Overly permissive CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
