const express = require('express');
const router = express.Router();
const db = require('../database');

// Halaman utama - menampilkan daftar twibbon
router.get('/', (req, res) => {
    db.all("SELECT * FROM twibbons ORDER BY created_at DESC", [], (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Internal Server Error");
            return;
        }
        res.render('public/home', { twibbons: rows });
    });
});

// Halaman detail twibbon
router.get('/twibbon/:slug', (req, res) => {
    const slug = req.params.slug;
    db.get("SELECT * FROM twibbons WHERE slug = ?", [slug], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send("Error retrieving data from database.");
        }
        if (!row) {
            return res.status(404).render('public/404');
        }
        res.render('public/twibbon', { twibbon: row });
    });
});

module.exports = router;