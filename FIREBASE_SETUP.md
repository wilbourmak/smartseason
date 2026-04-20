# Firebase Firestore Setup Guide

This guide walks you through setting up Firebase Firestore for SmartSeason backend.

## ✅ What Was Changed

The backend has been migrated from SQLite to Firebase Firestore:

| Component | Before | After |
|-----------|--------|-------|
| Database | SQLite | Firebase Firestore |
| Dependencies | `sqlite3` | `firebase-admin` |
| Data Storage | Local file | Cloud NoSQL database |

## 📋 Setup Steps

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create Project"
3. Name it "smartseason" (or your preferred name)
4. Disable Google Analytics (optional)
5. Click "Create Project"

### 2. Get Service Account Key

1. In Firebase Console, go to ⚙️ **Project Settings** (gear icon)
2. Click **Service Accounts** tab
3. Click **Generate new private key**
4. Save the JSON file as `serviceAccountKey.json` in the `backend/` folder

Your file structure should look like:
```
smartseason/
└── backend/
    ├── serviceAccountKey.json  ← Put it here
    ├── .env
    ├── package.json
    └── ...
```

### 3. Configure Environment Variables (Alternative)

If you prefer environment variables over the JSON file, update `.env`:

```bash
# backend/.env
PORT=5000
JWT_SECRET=your_jwt_secret_here

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"
```

> ⚠️ **Note**: When using environment variables, replace newlines in the private key with `\n`

### 4. Migrate Your Data

If you have existing data in SQLite and want to migrate it:

```bash
cd backend
npm run migrate-to-firestore
```

This will copy all users, fields, and field updates from SQLite to Firestore.

### 5. Start the Server

```bash
cd backend
npm run dev
```

The server will connect to Firestore instead of SQLite.

## 🔥 Firestore Database Structure

```
users/{userId}
  - email: string
  - password_hash: string
  - name: string
  - role: "admin" | "field_agent"
  - created_at: timestamp

fields/{fieldId}
  - name: string
  - crop_type: string
  - planting_date: string (ISO date)
  - current_stage: "planted" | "growing" | "ready" | "harvested"
  - assigned_agent_id: string (reference to user)
  - created_at: timestamp
  - updated_at: timestamp

field_updates/{updateId}
  - field_id: string (reference to field)
  - agent_id: string (reference to user)
  - stage: string
  - notes: string
  - created_at: timestamp
```

## 🔐 Security Rules

Set up Firestore security rules in Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated access from your backend
    match /{document=**} {
      allow read, write: if true;  // Backend handles auth
    }
  }
}
```

> ⚠️ **Note**: The backend uses JWT authentication. Firestore rules are permissive because the backend validates all requests.

## 🧪 Testing

Test the API after migration:

```bash
# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smartseason.com","password":"admin123"}'

# Test fields (use token from login)
curl http://localhost:5000/api/fields \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🚀 Deployment Options

### Option A: Keep Backend Separate (Recommended)

1. Deploy backend to Render/Railway/Heroku
2. Set environment variables in hosting platform
3. Frontend can still be hosted on Firebase Hosting

### Option B: Full Firebase (Serverless)

1. Move API logic to Firebase Cloud Functions
2. Deploy everything to Firebase
3. See `FIREBASE_HOSTING_GUIDE.md` for details

## 📚 Files Changed

| File | Change |
|------|--------|
| `backend/database/connection.js` | SQLite → Firestore adapter |
| `backend/controllers/authController.js` | Firestore queries |
| `backend/controllers/fieldController.js` | Firestore queries |
| `backend/routes/agents.js` | Firestore queries |
| `backend/middleware/auth.js` | Firestore user lookup |
| `backend/package.json` | Added `firebase-admin`, removed `sqlite3` |
| `backend/.env.example` | Firebase config examples |
| `backend/scripts/migrate-to-firestore.js` | New migration script |

## 🔄 Rollback (If Needed)

To go back to SQLite:

```bash
cd backend
npm uninstall firebase-admin
npm install sqlite3
```

Then restore the original files from Git:
```bash
git checkout HEAD -- database/connection.js
```

## ❓ Troubleshooting

### "Failed to initialize Firebase"
- Check that `serviceAccountKey.json` exists in `backend/`
- Verify the JSON file is valid
- Or check environment variables are set correctly

### "Permission denied"
- Check Firestore security rules in Firebase Console
- Ensure service account has proper permissions

### "Cannot find module 'firebase-admin'"
- Run `npm install` in the backend folder

### Migration fails
- Make sure SQLite database file exists
- Check that `smartseason.db` is in the backend folder
- Ensure Firebase project is properly configured

## 💰 Costs

Firebase Firestore pricing:
- **Free tier**: 50K reads, 20K writes, 20K deletes per day
- **Paid**: ~$0.06 per 100K reads, $0.18 per 100K writes

For a small app like SmartSeason, you should stay within the free tier.

## 📞 Next Steps

1. ✅ Backend is ready for Firebase
2. ⬜ Create Firebase project
3. ⬜ Download service account key
4. ⬜ Place key in `backend/serviceAccountKey.json`
5. ⬜ (Optional) Run migration
6. ⬜ Start server and test

Need help? Check the Firebase documentation: https://firebase.google.com/docs/firestore
