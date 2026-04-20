# Firebase Hosting Guide for SmartSeason

This guide covers deploying your SmartSeason full-stack app to Firebase.

## Overview

**Architecture:**
- **Frontend**: Firebase Hosting (React app)
- **Backend**: Firebase Cloud Functions + Firestore (recommended) OR keep external hosting
- **Database**: Firebase Firestore (replace SQLite)

---

## Prerequisites

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login
```

---

## Option 1: Full Firebase Migration (Recommended)

### Step 1: Initialize Firebase Project

```bash
cd smartseason
firebase init
```

**Select these features:**
- [x] Hosting (Configure files for Firebase Hosting)
- [x] Functions (Configure Cloud Functions)
- [x] Firestore (Set up Firestore database)

**Configuration:**
- Project: Select your existing or create new
- Firestore rules: `firestore.rules`
- Firestore indexes: `firestore.indexes.json`
- Functions language: JavaScript
- Hosting public dir: `frontend/build`
- Configure as SPA: Yes

### Step 2: Update Backend for Firebase Functions

**Install dependencies in `functions/`:**
```bash
cd functions
npm install express cors bcryptjs jsonwebtoken
```

**Create `functions/index.js`:**
```javascript
const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Auth middleware
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Fields API
app.get('/api/fields', authenticate, async (req, res) => {
  const snapshot = await db.collection('fields').get();
  const fields = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.json(fields);
});

app.post('/api/fields', authenticate, async (req, res) => {
  const field = await db.collection('fields').add({
    ...req.body,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  res.json({ id: field.id });
});

// Export functions
exports.api = functions.https.onRequest(app);
```

### Step 3: Migrate SQLite to Firestore

**Create `scripts/migrate-to-firestore.js`:**
```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrate() {
  // Read from SQLite and write to Firestore
  const sqlite3 = require('sqlite3').verbose();
  const dbOld = new sqlite3.Database('./smartseason.db');
  
  // Migrate users
  dbOld.all('SELECT * FROM users', [], async (err, rows) => {
    for (const user of rows) {
      await db.collection('users').doc(String(user.id)).set({
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: new Date(user.created_at)
      });
    }
    console.log('Users migrated');
  });
  
  // Migrate fields
  dbOld.all('SELECT * FROM fields', [], async (err, rows) => {
    for (const field of rows) {
      await db.collection('fields').doc(String(field.id)).set({
        name: field.name,
        cropType: field.crop_type,
        plantingDate: field.planting_date,
        currentStage: field.current_stage,
        assignedAgentId: field.assigned_agent_id,
        createdAt: new Date(field.created_at)
      });
    }
    console.log('Fields migrated');
  });
}

migrate();
```

### Step 4: Update Frontend API Calls

**Edit `frontend/src/services/api.js`:**
```javascript
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://us-central1-YOUR-PROJECT.cloudfunctions.net/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### Step 5: Build and Deploy

```bash
# Build frontend
cd frontend
npm run build

# Deploy everything
cd ..
firebase deploy
```

**Your app will be live at:** `https://your-project.web.app`

---

## Option 2: Frontend Only on Firebase (Hybrid)

Keep your Node.js backend on Render/Railway/Heroku, host React frontend on Firebase.

### Step 1: Set Up Backend Hosting

**Render (Recommended - Free Tier):**
1. Go to https://render.com
2. Create Web Service
3. Connect your GitHub repo
4. Settings:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: `Node`

**Get your backend URL:** `https://smartseason-api.onrender.com`

### Step 2: Configure Frontend

**Update `frontend/.env.production`:**
```
REACT_APP_API_URL=https://smartseason-api.onrender.com
```

**Update `frontend/package.json` - Remove proxy:**
```json
{
  "name": "smartseason-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": { ... },
  "scripts": { ... }
  // Remove "proxy" line
}
```

**Update `frontend/src/services/api.js`:**
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### Step 3: Deploy Frontend to Firebase

```bash
# Initialize Firebase Hosting only
cd smartseason
firebase init hosting

# Build and deploy
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

---

## Option 3: Firebase Static Hosting (Simplest)

For demo/testing without backend:

**1. Create static data file `frontend/public/data/fields.json`**

**2. Mock API service `frontend/src/services/mockApi.js`:**
```javascript
const mockData = {
  fields: [
    { id: 1, name: "North Field", cropType: "Wheat", stage: "Growing" },
    { id: 2, name: "South Field", cropType: "Corn", stage: "Planted" }
  ]
};

export const mockApi = {
  getFields: () => Promise.resolve({ data: mockData.fields }),
  getField: (id) => Promise.resolve({ data: mockData.fields.find(f => f.id === id) })
};
```

**3. Deploy:**
```bash
cd frontend
npm run build
firebase deploy
```

---

## Firebase Configuration Files

### `firebase.json`
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default"
    }
  ],
  "hosting": {
    "public": "frontend/build",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### `firestore.rules`
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /fields/{fieldId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.role == 'admin';
    }
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Environment Variables

### Frontend `.env`
```
REACT_APP_API_URL=https://us-central1-your-project.cloudfunctions.net/api
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project
```

### Firebase Functions Config
```bash
# Set environment variables
firebase functions:config:set app.jwt_secret="your-jwt-secret"
firebase functions:config:set app.db_password="your-db-password"

# Access in functions
const config = functions.config();
const jwtSecret = config.app.jwt_secret;
```

---

## Cost Estimates

| Service | Free Tier | Paid (Small) |
|---------|-----------|--------------|
| Firebase Hosting | 10GB/month | ~$0.15/GB after |
| Cloud Functions | 2M invocations/month | ~$0.40/million |
| Firestore | 50K reads/day | ~$0.06/100K reads |
| Authentication | 10K users/month | ~$0.01/100 verifications |

**Expected monthly cost for small app:** $0-5

---

## Quick Commands Reference

```bash
# Login
firebase login

# Initialize
firebase init

# Deploy everything
firebase deploy

# Deploy specific parts
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules

# View logs
firebase functions:log

# Emulators for local testing
firebase emulators:start
```

---

## Troubleshooting

### CORS Issues
Add to `functions/index.js`:
```javascript
const cors = require('cors')({
  origin: ['https://your-project.web.app', 'http://localhost:3000'],
  credentials: true
});
```

### "Function execution took too long"
Increase timeout in `firebase.json`:
```json
{
  "functions": [{
    "source": "functions",
    "timeoutSeconds": 300
  }]
}
```

### Build fails
Check Node version in `functions/package.json`:
```json
{
  "engines": {
    "node": "18"
  }
}
```

---

## Recommended Approach

For your SmartSeason app, I recommend **Option 2 (Hybrid)**:

1. **Keep backend on Render** - Easier migration from current SQLite setup
2. **Frontend on Firebase Hosting** - Fast CDN, custom domain, SSL
3. **Cost**: ~$0/month for low traffic

**Next Steps:**
1. Sign up at https://render.com
2. Deploy backend following Step 1
3. Update frontend API URL
4. Run `firebase init hosting`
5. Deploy with `firebase deploy`

Your app will be live in ~10 minutes!
