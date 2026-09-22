'use strict';

const path = require('path');
// Load environment variables from server/.env or root .env
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { connectDatabase } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');

const complaintsRouter = require('./routes/complaints');
const dashboardRouter = require('./routes/dashboard');
const departmentsRouter = require('./routes/departments');
const notificationsRouter = require('./routes/notifications');
const aiRouter = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ── Security & Middleware ───────────────────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: false, // Allow dev tools / Vite proxy
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: [CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiter for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api/', apiLimiter);

// ── Routes ──────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Smart City Grievance API',
    version: '1.0.0',
  });
});

app.use('/api/complaints', complaintsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/ai', aiRouter);

// 404 Route
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Cannot ${req.method} ${req.originalUrl}` });
});

// Error Handler
app.use(errorHandler);

// ── Start Server ────────────────────────────────────────────────────────────

async function start() {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`\n🚀  Smart City Grievance Backend running on http://localhost:${PORT}`);
    console.log(`📡  Accepting requests from: ${CLIENT_URL}\n`);
  });
}

// Only start if executed directly
if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { app, start };
