const jwt = require('jsonwebtoken');
const db = require('../database/connection');

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const userDoc = await db.firestore.collection('users').doc(decoded.userId).get();
        
        if (!userDoc.exists) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        const userData = userDoc.data();
        req.user = {
            id: userDoc.id,
            email: userData.email,
            name: userData.name,
            role: userData.role
        };
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
};

const authorizeAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

module.exports = { authenticate, authorizeAdmin };
