require('dotenv').config();
const express = require('express');
const path = require('path');
const fileUpload = require('express-fileupload');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const db = require('./database'); // Inisialisasi database

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
// Membuat folder uploads/twibbons dapat diakses secara publik
app.use('/twibbons', express.static(path.join(__dirname, 'uploads/twibbons')));

app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

// Session Middleware
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.sqlite',
        dir: './db'
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 jam
}));

// Routes
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

app.use('/', publicRoutes);
app.use('/admin', adminRoutes);

// 404 Handler
app.use((req, res) => {
    res.status(404).render('public/404');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});