import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Database
const db = new Database('mockup_generator.db');
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS base_products (
    id TEXT PRIMARY KEY,
    name TEXT,
    url TEXT,
    print_area TEXT,
    align TEXT,
    dimensions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS designs (
    id TEXT PRIMARY KEY,
    name TEXT,
    url TEXT,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

const app = express();
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Serve uploads statically
app.use('/uploads', express.static(uploadsDir));

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// API Routes
app.get('/api/base-products', (req, res) => {
  const products = db.prepare('SELECT * FROM base_products ORDER BY created_at DESC').all();
  res.json(products.map((p: any) => ({
    ...p,
    printArea: JSON.parse(p.print_area),
    dimensions: JSON.parse(p.dimensions)
  })));
});

app.post('/api/base-products', upload.single('image'), (req, res) => {
  const { name, printArea, align, dimensions } = req.body;
  const id = Math.random().toString(36).substring(7);
  const file = (req as any).file;
  const url = `/uploads/${file?.filename}`;

  db.prepare(`
    INSERT INTO base_products (id, name, url, print_area, align, dimensions)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, url, printArea, align, dimensions);

  res.json({ id, name, url, printArea: JSON.parse(printArea), align, dimensions: JSON.parse(dimensions) });
});

app.delete('/api/base-products/:id', (req, res) => {
  const product = db.prepare('SELECT url FROM base_products WHERE id = ?').get(req.params.id) as any;
  if (product) {
    const filePath = path.join(__dirname, product.url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM base_products WHERE id = ?').run(req.params.id);
  }
  res.json({ success: true });
});

app.get('/api/designs', (req, res) => {
  const designs = db.prepare('SELECT * FROM designs ORDER BY created_at DESC').all();
  res.json(designs);
});

app.post('/api/designs', upload.array('images'), (req, res) => {
  const category = req.body.category || 'Uncategorized';
  const files = (req as any).files as any[];
  
  const stmt = db.prepare(`
    INSERT INTO designs (id, name, url, category)
    VALUES (?, ?, ?, ?)
  `);

  const results = files.map(file => {
    const id = Math.random().toString(36).substring(7);
    const url = `/uploads/${file.filename}`;
    stmt.run(id, file.originalname, url, category);
    return { id, name: file.originalname, url, category };
  });

  res.json(results);
});

app.delete('/api/designs/:id', (req, res) => {
  const design = db.prepare('SELECT url FROM designs WHERE id = ?').get(req.params.id) as any;
  if (design) {
    const filePath = path.join(__dirname, design.url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM designs WHERE id = ?').run(req.params.id);
  }
  res.json({ success: true });
});

app.put('/api/base-products/:id', (req, res) => {
  const { name, printArea, align, dimensions } = req.body;
  
  db.prepare(`
    UPDATE base_products 
    SET name = ?, print_area = ?, align = ?, dimensions = ?
    WHERE id = ?
  `).run(name, printArea, align, dimensions, req.params.id);

  res.json({ success: true });
});

// Settings API
app.get('/api/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings').all();
  const config: Record<string, string> = {};
  settings.forEach((s: any) => config[s.key] = s.value);
  res.json(config);
});

app.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  res.json({ success: true });
});

// Vite Integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://localhost:3000');
  });
}

startServer();
