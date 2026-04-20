const express = require('express');

console.log('Starting minimal server...');

const app = express();

app.get('/', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});
