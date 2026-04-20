const admin = require('firebase-admin');

let db = null;
let firebaseAdmin = null;

function initializeFirebase() {
    if (firebaseAdmin) return firebaseAdmin;
    
    try {
        if (!admin.apps.length) {
            try {
                // Try to use service account file first (local development)
                const serviceAccount = require('../serviceAccountKey.json');
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
                console.log('Firebase initialized with service account file');
            } catch (fileError) {
                // Fall back to environment variables
                if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
                    admin.initializeApp({
                        credential: admin.credential.cert({
                            projectId: process.env.FIREBASE_PROJECT_ID,
                            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                        })
                    });
                    console.log('Firebase initialized with environment variables');
                } else {
                    // Use Application Default Credentials (Cloud Run / GCP)
                    admin.initializeApp();
                    console.log('Firebase initialized with Application Default Credentials');
                }
            }
        }
        
        firebaseAdmin = admin;
        db = admin.firestore();
        return firebaseAdmin;
    } catch (error) {
        console.error('Failed to initialize Firebase:', error.message);
        throw error;
    }
}

// Initialize immediately but catch errors
initializeFirebase();

// Firestore database interface matching the SQLite pattern
const firestoreDb = {
    collection: (name) => {
        if (!db) {
            initializeFirebase();
        }
        return db.collection(name);
    },
    
    query: async (sql, params = []) => {
        // Legacy SQL adapter - parse simple queries for backward compatibility
        const sqlLower = sql.toLowerCase().trim();
        
        // Parse SELECT queries
        if (sqlLower.startsWith('select')) {
            // Extract table name from FROM clause
            const fromMatch = sql.match(/from\s+(\w+)/i);
            if (!fromMatch) throw new Error('Could not parse table name from query');
            
            const tableName = fromMatch[1];
            let collectionRef = db.collection(tableName);
            
            // Parse WHERE conditions
            const whereMatch = sql.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|$)/i);
            if (whereMatch && params.length > 0) {
                // Simple single condition parsing
                const conditions = whereMatch[1].split(/\s+and\s+/i);
                conditions.forEach((cond, index) => {
                    if (params[index] !== undefined) {
                        const fieldMatch = cond.match(/(\w+)\s*[=<>!?]+/);
                        if (fieldMatch) {
                            collectionRef = collectionRef.where(fieldMatch[1], '==', params[index]);
                        }
                    }
                });
            }
            
            // Parse ORDER BY
            const orderMatch = sql.match(/order\s+by\s+(\w+)(?:\s+(asc|desc))?/i);
            if (orderMatch) {
                const direction = (orderMatch[2] || 'asc').toLowerCase();
                collectionRef = collectionRef.orderBy(orderMatch[1], direction);
            }
            
            // Parse LIMIT
            const limitMatch = sql.match(/limit\s+(\d+)/i);
            if (limitMatch) {
                collectionRef = collectionRef.limit(parseInt(limitMatch[1]));
            }
            
            const snapshot = await collectionRef.get();
            const rows = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                created_at: doc.data().created_at?.toDate?.().toISOString() || doc.data().created_at,
                updated_at: doc.data().updated_at?.toDate?.().toISOString() || doc.data().updated_at,
            }));
            
            return { rows };
        }
        
        // Parse INSERT queries
        if (sqlLower.startsWith('insert')) {
            const tableMatch = sql.match(/into\s+(\w+)/i);
            if (!tableMatch) throw new Error('Could not parse table name from INSERT');
            
            const tableName = tableMatch[1];
            const fieldsMatch = sql.match(/\(([^)]+)\)/);
            
            if (fieldsMatch) {
                const fields = fieldsMatch[1].split(',').map(f => f.trim());
                const data = {};
                fields.forEach((field, index) => {
                    if (params[index] !== undefined) {
                        data[field] = params[index];
                    }
                });
                
                const docRef = db.collection(tableName).doc();
                const timestamp = admin.firestore.FieldValue.serverTimestamp();
                
                await docRef.set({
                    ...data,
                    created_at: timestamp,
                    updated_at: timestamp,
                });
                
                return { rows: [{ id: docRef.id, ...data }] };
            }
        }
        
        // Parse UPDATE queries
        if (sqlLower.startsWith('update')) {
            const tableMatch = sql.match(/update\s+(\w+)/i);
            if (!tableMatch) throw new Error('Could not parse table name from UPDATE');
            
            const tableName = tableMatch[1];
            
            // Find document by WHERE condition (assuming ID is last param)
            const whereMatch = sql.match(/where\s+id\s*=\s*\?/i);
            if (whereMatch && params.length > 0) {
                const id = params[params.length - 1];
                const setMatch = sql.match(/set\s+(.+?)\s+where/i);
                
                if (setMatch) {
                    const updates = {};
                    const assignments = setMatch[1].split(',');
                    assignments.forEach((assignment, index) => {
                        const fieldMatch = assignment.match(/(\w+)\s*=/);
                        if (fieldMatch && params[index] !== undefined) {
                            updates[fieldMatch[1]] = params[index];
                        }
                    });
                    
                    const timestamp = admin.firestore.FieldValue.serverTimestamp();
                    await db.collection(tableName).doc(id).update({
                        ...updates,
                        updated_at: timestamp,
                    });
                    
                    const updated = await db.collection(tableName).doc(id).get();
                    return { rows: [{ id, ...updated.data() }] };
                }
            }
        }
        
        // Parse DELETE queries
        if (sqlLower.startsWith('delete')) {
            const tableMatch = sql.match(/from\s+(\w+)/i);
            if (!tableMatch) throw new Error('Could not parse table name from DELETE');
            
            const tableName = tableMatch[1];
            const whereMatch = sql.match(/where\s+id\s*=\s*\?/i);
            
            if (whereMatch && params.length > 0) {
                const id = params[0];
                await db.collection(tableName).doc(id).delete();
                return { rows: [{ id }] };
            }
        }
        
        throw new Error(`Query type not supported: ${sql.substring(0, 50)}`);
    },
    
    connect: () => {
        console.log('Connected to Firestore database');
        return Promise.resolve();
    },
    
    firestore: db,
    admin: admin
};

module.exports = firestoreDb;
