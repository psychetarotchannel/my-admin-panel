const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../frontend/uploads'))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Database setup
const db = new sqlite3.Database('./admin.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Updated creators table with all required fields
  db.run(`CREATE TABLE IF NOT EXISTS creators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    status TEXT DEFAULT 'active',
    viewers INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    featured_priority INTEGER DEFAULT 0,
    is_paid_member INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating creators table:', err.message);
    } else {
      console.log('Creators table ready');
    }
  });
}

// Settings API
app.get('/api/settings', (req, res) => {
  db.all('SELECT key, value FROM settings', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  });
});

app.put('/api/settings', (req, res) => {
  const settings = req.body;
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
  
  let completed = 0;
  const keys = Object.keys(settings);
  
  if (keys.length === 0) {
    return res.json({ success: true });
  }
  
  keys.forEach(key => {
    stmt.run([key, settings[key]], (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      completed++;
      if (completed === keys.length) {
        stmt.finalize();
        res.json({ success: true });
      }
    });
  });
});

// Creator Management APIs

// GET /api/creators - List all creators
app.get('/api/creators', (req, res) => {
  db.all('SELECT * FROM creators ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// GET /api/creators/:id - Get single creator
app.get('/api/creators/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM creators WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Creator not found' });
    }
    res.json(row);
  });
});

// POST /api/creators - Create new creator
app.post('/api/creators', upload.single('avatar'), (req, res) => {
  const { display_name, description, status, viewers, is_featured, featured_priority, is_paid_member } = req.body;
  const avatar_url = req.file ? `/uploads/${req.file.filename}` : null;
  
  const stmt = db.prepare(`INSERT INTO creators 
    (display_name, description, avatar_url, status, viewers, is_featured, featured_priority, is_paid_member, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`);
  
  stmt.run([
    display_name, 
    description, 
    avatar_url, 
    status || 'active',
    viewers || 0,
    is_featured ? 1 : 0,
    featured_priority || 0,
    is_paid_member ? 1 : 0
  ], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, id: this.lastID });
  });
  
  stmt.finalize();
});

// PUT /api/creators/:id - Update creator
app.put('/api/creators/:id', upload.single('avatar'), (req, res) => {
  const { id } = req.params;
  const { display_name, description, status, viewers, is_featured, featured_priority, is_paid_member } = req.body;
  
  // Build dynamic query based on provided fields
  let fields = [];
  let values = [];
  
  if (display_name !== undefined) {
    fields.push('display_name = ?');
    values.push(display_name);
  }
  if (description !== undefined) {
    fields.push('description = ?');
    values.push(description);
  }
  if (req.file) {
    fields.push('avatar_url = ?');
    values.push(`/uploads/${req.file.filename}`);
  }
  if (status !== undefined) {
    fields.push('status = ?');
    values.push(status);
  }
  if (viewers !== undefined) {
    fields.push('viewers = ?');
    values.push(viewers);
  }
  if (is_featured !== undefined) {
    fields.push('is_featured = ?');
    values.push(is_featured ? 1 : 0);
  }
  if (featured_priority !== undefined) {
    fields.push('featured_priority = ?');
    values.push(featured_priority);
  }
  if (is_paid_member !== undefined) {
    fields.push('is_paid_member = ?');
    values.push(is_paid_member ? 1 : 0);
  }
  
  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(id);
  const query = `UPDATE creators SET ${fields.join(', ')} WHERE id = ?`;
  
  db.run(query, values, function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }
    res.json({ success: true });
  });
});

// DELETE /api/creators/:id - Delete creator
app.delete('/api/creators/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM creators WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }
    res.json({ success: true });
  });
});

// Analytics API
app.get('/api/analytics/dashboard', (req, res) => {
  // Return dummy statistics
  db.get('SELECT COUNT(*) as total FROM creators', [], (err, totalRow) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    db.get('SELECT COUNT(*) as active FROM creators WHERE status = "active"', [], (err2, activeRow) => {
      if (err2) {
        return res.status(500).json({ error: err2.message });
      }
      
      db.get('SELECT COUNT(*) as featured FROM creators WHERE is_featured = 1', [], (err3, featuredRow) => {
        if (err3) {
          return res.status(500).json({ error: err3.message });
        }
        
        db.get('SELECT SUM(viewers) as totalViewers FROM creators', [], (err4, viewersRow) => {
          if (err4) {
            return res.status(500).json({ error: err4.message });
          }
          
          res.json({
            totalCreators: totalRow.total || 0,
            activeCreators: activeRow.active || 0,
            featuredCreators: featuredRow.featured || 0,
            totalViewers: viewersRow.totalViewers || 0,
            revenue: 0,
            growth: 0
          });
        });
      });
    });
  });
});

// Export API
app.get('/api/export/creators', (req, res) => {
  db.all('SELECT * FROM creators ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      exportDate: new Date().toISOString(),
      creators: rows
    });
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve admin panel
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin panel available at http://localhost:${PORT}/admin`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    }
    console.log('Database connection closed');
    process.exit(0);
  });
});
