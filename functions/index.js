const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');

// Load environment variables
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const fieldRoutes = require('./routes/fields');
const agentsRoutes = require('./routes/agents');

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'SmartSeason API is running',
        timestamp: new Date().toISOString()
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/fields', fieldRoutes);
app.use('/api/agents', agentsRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Export the Express app as a Firebase Cloud Function
exports.api = functions
    .runWith({
        timeoutSeconds: 60,
        memory: '512MB',
        minInstances: 0,
        maxInstances: 10
    })
    .https.onRequest(app);
