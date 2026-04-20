/**
 * Migration script: SQLite to Firestore
 * 
 * Run this after setting up Firebase credentials
 * npm run migrate-to-firestore
 */

const admin = require('firebase-admin');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
    try {
        const serviceAccount = require('../serviceAccountKey.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
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

// Connect to SQLite
const sqliteDb = new sqlite3.Database(path.join(__dirname, '..', 'smartseason.db'), sqlite3.OPEN_READONLY);

// Promisify SQLite queries
const sqliteQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        sqliteDb.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

async function migrateUsers() {
    console.log('Migrating users...');
    const users = await sqliteQuery('SELECT * FROM users');
    
    for (const user of users) {
        await db.collection('users').doc(String(user.id)).set({
            email: user.email,
            password_hash: user.password_hash,
            name: user.name,
            role: user.role,
            created_at: user.created_at ? admin.firestore.Timestamp.fromDate(new Date(user.created_at)) : admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`  Migrated user: ${user.email}`);
    }
    
    console.log(`✅ Migrated ${users.length} users\n`);
}

async function migrateFields() {
    console.log('Migrating fields...');
    const fields = await sqliteQuery('SELECT * FROM fields');
    
    for (const field of fields) {
        await db.collection('fields').doc(String(field.id)).set({
            name: field.name,
            crop_type: field.crop_type,
            planting_date: field.planting_date,
            current_stage: field.current_stage || 'planted',
            assigned_agent_id: field.assigned_agent_id ? String(field.assigned_agent_id) : null,
            created_at: field.created_at ? admin.firestore.Timestamp.fromDate(new Date(field.created_at)) : admin.firestore.FieldValue.serverTimestamp(),
            updated_at: field.updated_at ? admin.firestore.Timestamp.fromDate(new Date(field.updated_at)) : admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`  Migrated field: ${field.name}`);
    }
    
    console.log(`✅ Migrated ${fields.length} fields\n`);
}

async function migrateFieldUpdates() {
    console.log('Migrating field updates...');
    const updates = await sqliteQuery('SELECT * FROM field_updates');
    
    for (const update of updates) {
        // Use Firestore auto-generated ID for updates
        await db.collection('field_updates').add({
            field_id: String(update.field_id),
            agent_id: String(update.agent_id),
            stage: update.stage,
            notes: update.notes,
            created_at: update.created_at ? admin.firestore.Timestamp.fromDate(new Date(update.created_at)) : admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`  Migrated update for field ${update.field_id}`);
    }
    
    console.log(`✅ Migrated ${updates.length} field updates\n`);
}

async function migrate() {
    try {
        console.log('🚀 Starting migration from SQLite to Firestore...\n');
        
        await migrateUsers();
        await migrateFields();
        await migrateFieldUpdates();
        
        console.log('✨ Migration complete!');
        console.log('\nNext steps:');
        console.log('1. Update your .env file with Firebase credentials');
        console.log('2. Install dependencies: cd backend && npm install');
        console.log('3. Start the server: npm run dev');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        sqliteDb.close();
    }
}

migrate();
