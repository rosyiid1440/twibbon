require('dotenv').config();
const express = require('express');
const path = require('path');
const fileUpload = require('express-fileupload');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/twibbons', express.static(path.join(__dirname, 'uploads/twibbons')));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

app.post('/logout-backchannel', express.urlencoded({ extended: true }), (req, res) => {
    console.log('[BACKCHANNEL] Received logout request from Keycloak');
    console.log('[BACKCHANNEL] Request body:', req.body);

    try {
        // Ambil logout token dari request body
        let logoutToken = req.body.logout_token;

        if (!logoutToken) {
            console.error('[BACKCHANNEL] No logout token found in request');
            return res.sendStatus(400);
        }

        // Decode token tanpa verifikasi (hanya untuk mendapatkan payload)
        const decoded = jwt.decode(logoutToken, { complete: false });
        console.log('[BACKCHANNEL] Decoded token:', decoded);

        if (decoded && (decoded.sub || decoded.sid)) {
            const userSubject = decoded.sub;
            const sessionId = decoded.sid;

            console.log(`[BACKCHANNEL] Processing logout for user: ${userSubject}, session: ${sessionId}`);

            // Hapus session dari memory store berdasarkan subject atau session ID
            memoryStore.all((err, sessions) => {
                if (err) {
                    console.error('[BACKCHANNEL] Error getting sessions:', err);
                    return res.sendStatus(500);
                }

                let sessionDestroyed = false;

                console.log(`[BACKCHANNEL] Total sessions to check: ${Object.keys(sessions || {}).length}`);

                // Iterasi semua session dan hapus yang sesuai
                Object.keys(sessions || {}).forEach(sid => {
                    const session = sessions[sid];

                    console.log(`[BACKCHANNEL] Checking session ${sid}:`, {
                        hasKeycloakToken: !!session['keycloak-token'],
                        hasGrant: !!session.grant,
                        keys: Object.keys(session)
                    });

                    // Debug: tampilkan struktur session untuk membantu troubleshooting
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`[BACKCHANNEL] Session ${sid} structure:`, JSON.stringify(session, null, 2));
                    }

                    let shouldDestroy = false;

                    // Cara 1: Cek keycloak-token (yang disimpan sebagai JSON string)
                    if (session['keycloak-token']) {
                        try {
                            let tokenData;

                            // Parse jika berupa string JSON
                            if (typeof session['keycloak-token'] === 'string') {
                                tokenData = JSON.parse(session['keycloak-token']);
                            } else {
                                tokenData = session['keycloak-token'];
                            }

                            // Decode access token untuk mendapatkan informasi user
                            if (tokenData.access_token) {
                                const accessTokenContent = jwt.decode(tokenData.access_token);
                                console.log(`[BACKCHANNEL] Found keycloak-token with parsed sub: ${accessTokenContent?.sub}, session_state: ${accessTokenContent?.session_state}, sid: ${accessTokenContent?.sid}`);

                                if ((userSubject && accessTokenContent?.sub === userSubject) ||
                                    (sessionId && accessTokenContent?.session_state === sessionId) ||
                                    (sessionId && accessTokenContent?.sid === sessionId)) {
                                    shouldDestroy = true;
                                    console.log('[BACKCHANNEL] Match found via parsed keycloak-token');
                                }
                            }

                            // Fallback: cek session_state langsung dari tokenData
                            if (!shouldDestroy && tokenData.session_state) {
                                console.log(`[BACKCHANNEL] Checking direct session_state: ${tokenData.session_state}`);
                                if (sessionId && tokenData.session_state === sessionId) {
                                    shouldDestroy = true;
                                    console.log('[BACKCHANNEL] Match found via direct session_state');
                                }
                            }
                        } catch (parseError) {
                            console.error('[BACKCHANNEL] Error parsing keycloak-token JSON:', parseError);
                        }
                    }

                    // Cara 2: Cek grant object (keycloak-connect format yang lebih umum)
                    if (!shouldDestroy && session.grant && session.grant.access_token && session.grant.access_token.content) {
                        const grantContent = session.grant.access_token.content;
                        console.log(`[BACKCHANNEL] Found grant with sub: ${grantContent.sub}, session_state: ${grantContent.session_state}, sid: ${grantContent.sid}`);

                        if ((userSubject && grantContent.sub === userSubject) ||
                            (sessionId && grantContent.session_state === sessionId) ||
                            (sessionId && grantContent.sid === sessionId)) {
                            shouldDestroy = true;
                            console.log('[BACKCHANNEL] Match found via grant');
                        }
                    }

                    // Cara 3: Cek jika session ID mengandung informasi yang cocok
                    if (!shouldDestroy && sessionId && (sid === sessionId || sid.includes(sessionId))) {
                        shouldDestroy = true;
                        console.log('[BACKCHANNEL] Match found via session ID comparison');
                    }

                    // Cara 4: Cek berdasarkan user subject saja (fallback)
                    if (!shouldDestroy && userSubject) {
                        // Periksa semua properti dalam session yang mungkin mengandung user info
                        const sessionStr = JSON.stringify(session);
                        if (sessionStr.includes(userSubject)) {
                            shouldDestroy = true;
                            console.log('[BACKCHANNEL] Match found via string search for user subject');
                        }
                    }

                    if (shouldDestroy) {
                        console.log(`[BACKCHANNEL] Destroying session: ${sid}`);
                        memoryStore.destroy(sid, (err) => {
                            if (err) {
                                console.error('[BACKCHANNEL] Error destroying session:', err);
                            } else {
                                console.log('[BACKCHANNEL] Session destroyed successfully');
                                sessionDestroyed = true;
                            }
                        });
                    }
                });

                if (!sessionDestroyed) {
                    console.log('[BACKCHANNEL] No matching session found to destroy');
                    // Masih return 200 karena ini normal behavior
                }
            });
        } else {
            console.error('[BACKCHANNEL] Invalid token payload - no sub or sid found');
            return res.sendStatus(400);
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('[BACKCHANNEL] Error processing logout:', error);
        res.sendStatus(500);
    }
});

// Inisialisasi Session Store (diperlukan oleh Keycloak)
const memoryStore = new session.MemoryStore();
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: memoryStore
}));

// Inisialisasi Keycloak
const keycloakConfig = {
    "realm": process.env.KEYCLOAK_REALM,
    "auth-server-url": process.env.KEYCLOAK_URL,
    "ssl-required": "external",
    "resource": process.env.KEYCLOAK_CLIENT_ID,
    "credentials": {
        "secret": process.env.KEYCLOAK_CLIENT_SECRET
    },
    "confidential-port": 0
};
const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

// Tambahkan middleware Keycloak ke aplikasi
app.use(keycloak.middleware({
    // logout: '/logout', // URL logout di dalam aplikasi
    admin: '/admin'    // URL dasar untuk area admin
}));

// Routes
const publicRoutes = require('./routes/public');
// Kirim instance keycloak ke file route admin
const adminRoutes = require('./routes/admin')(keycloak);

app.use('/', publicRoutes);
app.use('/admin', adminRoutes);

// 404 Handler
app.use((req, res) => {
    res.status(404).render('public/404');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});