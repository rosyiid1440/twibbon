require('dotenv').config();
const express = require('express');
const path = require('path');
const fileUpload = require('express-fileupload');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/twibbons', express.static(path.join(__dirname, 'uploads/twibbons')));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

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