const admin = require('firebase-admin');

let dbInstance = null;
let adminInstance = null;

function getDb() {
    if (dbInstance) return dbInstance;
    
    try {
        if (!admin.apps.length) {
            let creds = null;
            
            try {
                const serviceAccount = require('../serviceAccountKey.json');
                creds = admin.credential.cert(serviceAccount);
                console.log('[Firebase] Using service account file');
            } catch (e) {
                if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
                    creds = admin.credential.cert({
                        projectId: process.env.FIREBASE_PROJECT_ID,
                        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    });
                    console.log('[Firebase] Using environment variables');
                }
            }
            
            if (creds) {
                admin.initializeApp({ credential: creds });
            } else {
                admin.initializeApp();
                console.log('[Firebase] Using Application Default Credentials');
            }
        }
        
        adminInstance = admin;
        dbInstance = admin.firestore();
        console.log('[Firebase] Firestore ready');
        return dbInstance;
    } catch (error) {
        console.error('[Firebase] Init failed:', error.message);
        throw error;
    }
}

function getAdmin() {
    if (!adminInstance) getDb();
    return adminInstance;
}

module.exports = { getDb, getAdmin };
