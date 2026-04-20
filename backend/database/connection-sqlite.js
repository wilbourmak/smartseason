const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use persistent disk on Render, or local for development
const dbPath = process.env.RENDER_DISK_PATH 
    ? path.join(process.env.RENDER_DISK_PATH, 'smartseason.db')
    : path.join(__dirname, '..', 'smartseason.db');

const db = new sqlite3.Database(dbPath);

// Promisify database methods
const dbAsync = {
    query: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            const isSelect = sql.trim().toLowerCase().startsWith('select');
            if (isSelect) {
                db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve({ rows });
                });
            } else {
                db.run(sql, params, function(err) {
                    if (err) reject(err);
                    else resolve({ rows: [{ id: this.lastID }] });
                });
            }
        });
    },
    connect: () => {
        console.log('Connected to SQLite database at:', dbPath);
        return Promise.resolve();
    }
};

module.exports = dbAsync;
