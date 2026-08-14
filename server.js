require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Server } = require('socket.io');

const db = require('./db');
const { attachUser, requireAuth } = require('./middleware/auth');
const { attachBoardSocket } = require('./sockets/boardSocket');

const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.set('io', io);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1); // required on Heroku for secure cookies to work

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

if (!process.env.SESSION_SECRET) {
  console.warn('Warning: SESSION_SECRET is not set. Using an insecure default — set this in production.');
}

const sessionMiddleware = session({
  store: new pgSession({
    pool: db.pool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  name: 'retro.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
});

app.use(sessionMiddleware);
app.use(attachUser);

app.use('/', authRoutes);
app.use('/', requireAuth, boardRoutes);
app.use('/api', requireAuth, apiRoutes);

app.use((req, res) => {
  res.status(404).send('Not found');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong.');
});

attachBoardSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Retro Board listening on port ${PORT}`);
});
