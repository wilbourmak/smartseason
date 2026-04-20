const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'smartseason.db');
const db = new sqlite3.Database(dbPath);

const initDb = () => {
    console.log('Initializing SQLite database...');
    
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'field_agent')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Fields table
        db.run(`CREATE TABLE IF NOT EXISTS fields (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            crop_type TEXT NOT NULL,
            planting_date DATE NOT NULL,
            current_stage TEXT NOT NULL CHECK (current_stage IN ('planted', 'growing', 'ready', 'harvested')),
            assigned_agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Field updates table
        db.run(`CREATE TABLE IF NOT EXISTS field_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            field_id INTEGER NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
            agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            stage TEXT NOT NULL CHECK (stage IN ('planted', 'growing', 'ready', 'harvested')),
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Database initialization failed:', err);
                process.exit(1);
            } else {
                console.log('Database initialized successfully');
                db.close();
                process.exit(0);
            }
        });
    });
};

initDb();
