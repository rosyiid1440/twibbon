const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Pastikan direktori db ada
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

const dbPath = path.join(dbDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Membuat tabel jika belum ada
        db.run(`CREATE TABLE IF NOT EXISTS twibbons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            filename TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating table', err.message);
            }
        });
    }
});

module.exports = db;