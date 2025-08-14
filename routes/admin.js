const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database');

// Middleware untuk memeriksa apakah admin sudah login
const isAdmin = (req, res, next) => {
    if (req.session.isAdmin) {
        return next();
    }
    res.redirect('/admin/login');
};

// GET Halaman Login
router.get('/login', (req, res) => {
    res.render('admin/login', { error: null });
});

// POST Proses Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect('/admin/dashboard');
    } else {
        res.render('admin/login', { error: 'Username atau password salah!' });
    }
});

// GET Halaman Dashboard (dilindungi)
router.get('/dashboard', isAdmin, (req, res) => {
    db.all("SELECT * FROM twibbons ORDER BY created_at DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).send("Gagal mengambil data twibbon.");
        }
        res.render('admin/dashboard', { twibbons: rows, message: null });
    });
});

// POST Proses Upload Twibbon (dilindungi)
router.post('/upload', isAdmin, (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0 || !req.files.twibbonFile) {
        return res.status(400).send('Tidak ada file yang diunggah.');
    }

    const { title, slug } = req.body;
    const twibbonFile = req.files.twibbonFile;

    if (!title || !slug) {
        return res.status(400).send('Judul dan slug harus diisi.');
    }

    // Validasi tipe file
    if (twibbonFile.mimetype !== 'image/png') {
        return res.status(400).send('File harus berformat PNG transparan.');
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const newFilename = `${slug}-${uniqueSuffix}${path.extname(twibbonFile.name)}`;
    const uploadPath = path.join(__dirname, '..', 'uploads/twibbons', newFilename);

    twibbonFile.mv(uploadPath, (err) => {
        if (err) {
            return res.status(500).send(err);
        }

        // Simpan ke database
        db.run("INSERT INTO twibbons (title, slug, filename) VALUES (?, ?, ?)", [title, slug, newFilename], function (err) {
            if (err) {
                // Handle slug unik error
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).send('Slug sudah digunakan. Harap gunakan slug lain.');
                }
                return res.status(500).send("Gagal menyimpan data ke database.");
            }
            res.redirect('/admin/dashboard');
        });
    });
});

// GET Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/admin/dashboard');
        }
        res.clearCookie('connect.sid');
        res.redirect('/admin/login');
    });
});

module.exports = router;