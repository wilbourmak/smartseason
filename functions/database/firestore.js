const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    try {
        // Try to use service account file first
        const serviceAccount = require('../serviceAccountKey.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        // Fall back to environment variables
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            })
        });
    }
}

const db = admin.firestore();

// Firestore database interface matching the SQLite pattern
const firestoreDb = {
    // Get collection reference
    collection: (name) => db.collection(name),
    
    // Query documents
    query: async (collectionName, conditions = [], orderBy = null, limit = null) => {
        let ref = db.collection(collectionName);
        
        // Apply where conditions
        conditions.forEach(cond => {
            ref = ref.where(cond.field, cond.op, cond.value);
        });
        
        // Apply ordering
        if (orderBy) {
            ref = ref.orderBy(orderBy.field, orderBy.direction || 'asc');
        }
        
        // Apply limit
        if (limit) {
            ref = ref.limit(limit);
        }
        
        const snapshot = await ref.get();
        const rows = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Convert Firestore timestamps to ISO strings for compatibility
            created_at: doc.data().created_at?.toDate?.().toISOString() || doc.data().created_at,
            updated_at: doc.data().updated_at?.toDate?.().toISOString() || doc.data().updated_at,
            planting_date: doc.data().planting_date || doc.data().plantingDate,
        }));
        
        return { rows };
    },
    
    // Get single document by ID
    getById: async (collectionName, id) => {
        const doc = await db.collection(collectionName).doc(id).get();
        if (!doc.exists) {
            return { rows: [] };
        }
        const data = doc.data();
        return {
            rows: [{
                id: doc.id,
                ...data,
                created_at: data.created_at?.toDate?.().toISOString() || data.created_at,
                updated_at: data.updated_at?.toDate?.().toISOString() || data.updated_at,
            }]
        };
    },
    
    // Insert document
    insert: async (collectionName, data) => {
        const docRef = db.collection(collectionName).doc();
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        
        await docRef.set({
            ...data,
            created_at: timestamp,
            updated_at: timestamp,
        });
        
        return { 
            rows: [{ 
                id: docRef.id,
                ...data 
            }] 
        };
    },
    
    // Update document
    update: async (collectionName, id, data) => {
        const docRef = db.collection(collectionName).doc(id);
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        
        await docRef.update({
            ...data,
            updated_at: timestamp,
        });
        
        // Get updated document
        const updated = await docRef.get();
        return {
            rows: [{
                id: updated.id,
                ...updated.data(),
                created_at: updated.data().created_at?.toDate?.().toISOString(),
                updated_at: updated.data().updated_at?.toDate?.().toISOString(),
            }]
        };
    },
    
    // Delete document
    delete: async (collectionName, id) => {
        await db.collection(collectionName).doc(id).delete();
        return { rows: [{ id }] };
    },
    
    // For backward compatibility with old pool.query interface
    queryLegacy: async (sql, params = []) => {
        // Parse simple SQL-like queries for backward compatibility
        // This is a simplified adapter - production code should use Firestore methods directly
        console.warn('Legacy SQL query used:', sql);
        throw new Error('Use Firestore native methods instead of SQL queries');
    },
    
    connect: async () => {
        console.log('Connected to Firestore database');
        return Promise.resolve();
    },
    
    // Get Firestore instance for advanced operations
    firestore: db,
    admin: admin
};

module.exports = firestoreDb;
