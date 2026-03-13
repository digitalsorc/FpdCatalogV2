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
  try {
    const products = db.prepare('SELECT * FROM base_products ORDER BY created_at DESC').all();
    res.json(products.map((p: any) => {
      let printArea = { x: 25, y: 25, width: 50, height: 50 };
      let dimensions = { w: 0, h: 0 };
      
      try {
        if (p.print_area) printArea = JSON.parse(p.print_area);
      } catch (e) { console.error("Parse error print_area:", e); }
      
      try {
        if (p.dimensions) dimensions = JSON.parse(p.dimensions);
      } catch (e) { console.error("Parse error dimensions:", e); }

      return {
        ...p,
        printArea,
        dimensions
      };
    }));
  } catch (err) {
    console.error("Failed to get products:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post('/api/base-products', upload.array('images'), (req, res) => {
  const files = (req as any).files as any[];
  const { configs } = req.body; // Optional JSON string of configs
  
  let parsedConfigs: any[] = [];
  try {
    if (configs) parsedConfigs = JSON.parse(configs);
  } catch (e) {
    console.error("Failed to parse configs:", e);
  }

  const stmt = db.prepare(`
    INSERT INTO base_products (id, name, url, print_area, align, dimensions)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const results = files.map(file => {
    const id = Math.random().toString(36).substring(7);
    const url = `/uploads/${file.filename}`;
    const name = file.originalname;
    
    // Check if we have a config for this file name
    const config = parsedConfigs.find(c => c.name === name);
    
    const printArea = config?.printArea ? (typeof config.printArea === 'string' ? config.printArea : JSON.stringify(config.printArea)) : JSON.stringify({ x: 25, y: 25, width: 50, height: 50 });
    const align = config?.align || 'top';
    const dimensions = config?.dimensions ? (typeof config.dimensions === 'string' ? config.dimensions : JSON.stringify(config.dimensions)) : JSON.stringify({ w: 0, h: 0 }); // Will be updated by client if needed

    stmt.run(id, name, url, printArea, align, dimensions);
    return { 
      id, 
      name, 
      url, 
      printArea: JSON.parse(printArea), 
      align, 
      dimensions: JSON.parse(dimensions) 
    };
  });

  res.json(results);
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

app.delete('/api/base-products', (req, res) => {
  try {
    const products = db.prepare('SELECT url FROM base_products').all() as any[];
    products.forEach(p => {
      const filePath = path.join(__dirname, p.url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
    db.prepare('DELETE FROM base_products').run();
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to clear products:", err);
    res.status(500).json({ error: "Internal server error" });
  }
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

app.post('/api/base-products/bulk-config', (req, res) => {
  const configs = req.body;
  const stmt = db.prepare(`
    UPDATE base_products 
    SET print_area = ?, align = ?, dimensions = ?
    WHERE name = ?
  `);
  
  const transaction = db.transaction((items) => {
    for (const item of items) {
      stmt.run(
        typeof item.printArea === 'string' ? item.printArea : JSON.stringify(item.printArea), 
        item.align, 
        typeof item.dimensions === 'string' ? item.dimensions : JSON.stringify(item.dimensions), 
        item.name
      );
    }
  });
  
  transaction(configs);
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
