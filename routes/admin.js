const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database');

// Terima instance keycloak dari server.js
module.exports = function (keycloak) {
    // Ambil nama peran dari environment variable
    const adminRoles = (process.env.KEYCLOAK_ADMIN_ROLES || 'superadmin')
        .split(',')
        .map(role => role.trim());

    // Middleware untuk memeriksa apakah pengguna memiliki SALAH SATU dari peran yang diizinkan.
    const protectWithAnyRole = keycloak.protect((token, req) => {
        // Loop melalui setiap peran yang diizinkan
        for (const role of adminRoles) {
            // Jika token memiliki peran realm tersebut, izinkan akses
            if (token.hasRealmRole(role)) {
                return true;
            }
        }
        // Jika setelah dicek semua peran tidak ada yang cocok, tolak akses
        return false;
    });

    // Halaman Dashboard (dilindungi oleh Keycloak + Peran)
    router.get('/dashboard', protectWithRole, (req, res) => {
        db.all("SELECT * FROM twibbons ORDER BY created_at DESC", [], (err, rows) => {
            if (err) {
                return res.status(500).send("Gagal mengambil data twibbon.");
            }
            res.render('admin/dashboard', { twibbons: rows, message: null });
        });
    });

    // Proses Upload Twibbon (juga dilindungi oleh peran)
    router.post('/upload', protectWithRole, (req, res) => {
        if (!req.files || Object.keys(req.files).length === 0 || !req.files.twibbonFile) {
            return res.status(400).send('Tidak ada file yang diunggah.');
        }

        const { title, slug } = req.body;
        const twibbonFile = req.files.twibbonFile;

        if (!title || !slug) {
            return res.status(400).send('Judul dan slug harus diisi.');
        }

        if (twibbonFile.mimetype !== 'image/png') {
            return res.status(400).send('File harus berformat PNG transparan.');
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const newFilename = `${slug}-${uniqueSuffix}${path.extname(twibbonFile.name)}`;
        const uploadPath = path.join(__dirname, '..', 'uploads/twibbons', newFilename);

        twibbonFile.mv(uploadPath, (err) => {
            if (err) return res.status(500).send(err);

            db.run("INSERT INTO twibbons (title, slug, filename) VALUES (?, ?, ?)", [title, slug, newFilename], function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).send('Slug sudah digunakan. Harap gunakan slug lain.');
                    }
                    return res.status(500).send("Gagal menyimpan data ke database.");
                }
                res.redirect('/admin/dashboard');
            });
        });
    });

    router.get('/logout', (req, res) => {
        // Hapus sesi lokal terlebih dahulu
        // req.session.destroy();

        // Bangun URL logout Keycloak dengan parameter redirect kustom
        const redirectUrl = `${process.env.URL_PORTAL}`;
        // const logoutUrl = `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/logout?post_logout_redirect_uri=${redirectUrl}`;

        // Arahkan pengguna ke halaman logout Keycloak
        res.redirect(redirectUrl);
    });

    // Rute login dan logout sekarang ditangani oleh middleware keycloak
    // Tidak perlu lagi rute /login atau /logout manual di sini.

    return router;
};