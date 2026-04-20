const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Handle uncaught errors to prevent crashes
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Don't exit, let the server continue running
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit
});

// Load environment variables
dotenv.config();

console.log('Starting SmartSeason server...');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('PORT:', process.env.PORT || 5000);
console.log('JWT_SECRET set:', !!process.env.JWT_SECRET);
console.log('Current directory:', process.cwd());
console.log('Files in cwd:', require('fs').readdirSync('.'));

if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET not set. Using default for development only!');
    process.env.JWT_SECRET = 'default_dev_secret_do_not_use_in_production';
}

// Import routes
const authRoutes = require('./routes/auth');
const fieldRoutes = require('./routes/fields');
const agentRoutes = require('./routes/agents');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// Health check endpoint - respond immediately, don't wait for DB
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'SmartSeason API',
        version: '1.0.0',
        status: 'running'
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/fields', fieldRoutes);
app.use('/api/agents', agentRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize database before starting server
const { exec } = require('child_process');

const initDb = () => {
    return new Promise((resolve, reject) => {
        console.log('Initializing database...');
        exec('node scripts/init-db.js', { cwd: __dirname }, (error, stdout, stderr) => {
            if (error) {
                console.error('Database init error:', error);
                reject(error);
            } else {
                console.log(stdout);
                resolve();
            }
        });
    });
};

// Start server after DB init
const PORT = process.env.PORT || 5000;

initDb().then(() => {
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`API available at http://localhost:${PORT}/api`);
        console.log(`Health check at http://localhost:${PORT}/health`);
    });

    server.on('error', (err) => {
        console.error('Server failed to start:', err);
        process.exit(1);
    });
}).catch(err => {
    console.error('Failed to initialize:', err);
    process.exit(1);
});

// Export for testing
module.exports = app;
