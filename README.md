# SmartSeason Field Monitoring System

A full-stack web application for tracking crop progress across multiple fields during a growing season.

## Overview

SmartSeason provides a simple and effective way to manage agricultural fields with support for two user roles:
- **Admin (Coordinator)**: Full system access, can create/manage fields and view all updates
- **Field Agent**: Assigned to specific fields, can update field stages and add observations

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: React 18
- **Database**: PostgreSQL
- **Authentication**: JWT tokens

## Project Structure

```
smartseason/
├── backend/              # Express API
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Auth middleware
│   ├── routes/           # API routes
│   ├── database/         # Schema and connection
│   ├── scripts/          # DB init and seed scripts
│   └── server.js         # Entry point
├── frontend/             # React app
│   ├── public/
│   └── src/
│       ├── components/   # Reusable components
│       ├── context/      # Auth context
│       ├── pages/        # Page components
│       ├── services/     # API service
│       └── styles.css    # Global styles
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js (v16+)
- PostgreSQL (v12+)
- npm or yarn

### 1. Clone and Install Dependencies

```bash
cd smartseason

# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```bash
# Connect to PostgreSQL (adjust credentials as needed)
psql -U postgres

# Create database
CREATE DATABASE smartseason;
\q
```

Update the `.env` file in the backend directory with your database credentials:

```
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=smartseason
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret_key_here
```

### 3. Initialize Database

```bash
cd backend

# Initialize schema
npm run init-db

# Seed with demo data
npm run seed
```

### 4. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@smartseason.com | admin123 |
| Field Agent | agent1@smartseason.com | agent123 |
| Field Agent | agent2@smartseason.com | agent123 |
| Field Agent | agent3@smartseason.com | agent123 |

## Design Decisions

### Field Status Logic

Field status is computed dynamically based on the following rules:

- **Completed**: Field has reached the `harvested` stage
- **At Risk**: Any of these conditions are met:
  - Planted stage with >14 days elapsed (should have sprouted)
  - Growing stage with >120 days elapsed (exceeded typical growing period)
  - Ready stage with >150 days elapsed (should have been harvested)
- **Active**: Default status when no risk conditions are met

The status is calculated on-the-fly when fetching field data, ensuring real-time accuracy based on current planting dates and stages.

### Data Model

- **Users**: Stores authentication and role information
- **Fields**: Core entity with name, crop type, planting date, current stage, and assigned agent
- **Field Updates**: Tracks stage transitions and observations with timestamp and agent attribution

### Authentication

- JWT tokens with 24-hour expiration
- Tokens stored in localStorage (frontend)
- Role-based access control on both frontend routes and backend endpoints

### API Design

- RESTful endpoints following resource-based naming
- Consistent JSON response format with error handling
- Protected routes using JWT middleware
- Role-based authorization for admin-only operations

## Key Features

- **Role-based Access**: Admins manage all fields; Agents see only their assignments
- **Field Lifecycle**: Track progress through Planted → Growing → Ready → Harvested
- **Status Monitoring**: Automatically identify fields that may need attention
- **Update History**: Complete audit trail of all field changes
- **Dashboard**: Overview with statistics and recent activity
- **Responsive UI**: Clean, modern interface that works on desktop and mobile

## Assumptions Made

1. **Planting Date as Anchor**: All status calculations are based on the planting date as the reference point
2. **Hardcoded Risk Thresholds**: The day thresholds for "at risk" status are based on typical crop cycles and can be adjusted
3. **Single Agent per Field**: Each field is assigned to exactly one field agent (simplification)
4. **Stage Progression**: While the UI allows any stage update, the normal flow is sequential through the lifecycle
5. **No Email Notifications**: The system focuses on tracking rather than alerts (could be added)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create user (admin only in practice)
- `POST /api/auth/login` - Authenticate and get token
- `GET /api/auth/me` - Get current user info

### Fields
- `GET /api/fields` - List fields (role-based filtering)
- `GET /api/fields/:id` - Get field details with history
- `POST /api/fields` - Create field (admin only)
- `PUT /api/fields/:id` - Update field (admin only)
- `DELETE /api/fields/:id` - Delete field (admin only)
- `POST /api/fields/:id/updates` - Add stage update
- `GET /api/fields/dashboard` - Dashboard data

### Agents
- `GET /api/agents` - List field agents (admin only)
- `GET /api/agents/:id` - Get agent with assigned fields (admin only)

## Development Notes

- The backend uses a simple in-memory query approach with PostgreSQL
- No ORM is used for simplicity and direct SQL control
- Frontend uses React Context for auth state management
- CSS uses CSS variables for easy theming
- No external UI library to keep dependencies minimal

## Possible Enhancements

- Email notifications for at-risk fields
- Photo uploads for field observations
- Weather API integration
- Reports and analytics
- Multi-crop support with different lifecycle timelines
- Mobile app with offline capability
