# DevCollab — Backend API

> **Node.js + Express + MongoDB** REST API powering the DevCollab developer matching platform.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [WebSocket Events](#websocket-events)
- [Data Models](#data-models)
- [Architecture Notes](#architecture-notes)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js v20+ |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT + Firebase Admin SDK |
| Realtime | Socket.io |
| File Storage | Cloudinary |
| Security | Helmet, CORS, express-rate-limit |
| Deploy | Render.com |

---

## Project Structure

```
src/
├── app.js                    # Express app setup, middleware, routes
├── config/
│   └── db.js                 # MongoDB connection
├── controllers/
│   ├── auth.controller.js    # Google OAuth + JWT
│   ├── profile.controller.js # Discover feed, profile update, avatar
│   ├── project.controller.js # CRUD + applications
│   ├── room.controller.js    # Tasks, links, members (project rooms)
│   ├── github.controller.js  # GitHub public API proxy
│   ├── swipe.controller.js   # Like/pass/superlike
│   └── notification.controller.js
├── middleware/
│   └── auth.middleware.js    # JWT protect middleware
├── models/
│   ├── User.js
│   ├── Match.js
│   ├── Message.js
│   ├── Swipe.js
│   ├── Project.js
│   ├── Application.js
│   ├── Task.js
│   ├── RoomLink.js
│   └── Notification.js
├── routes/
│   ├── auth.routes.js
│   ├── profile.routes.js
│   ├── project.routes.js
│   ├── match.routes.js
│   ├── message.routes.js
│   ├── swipe.routes.js
│   ├── notification.routes.js
│   └── github.routes.js
├── services/
│   ├── matchmaking.service.js  # ELO scoring + match creation
│   └── notification.service.js
├── socket/
│   └── socket.js             # Socket.io setup + events
└── seed.js                   # Database seeding script
```

---

## Getting Started

### Prerequisites

- Node.js v20+
- MongoDB Atlas account (or local MongoDB)
- Firebase project with service account credentials
- Cloudinary account

### Installation

```bash
# Clone the repo
git clone https://github.com/your-username/devcollab-server.git
cd devcollab-server

# Install dependencies
npm install

# Copy env template
cp .env.example .env
# Fill in your environment variables (see below)

# Seed the database with sample data (optional)
node src/seed.js

# Start development server
npm run dev

# Start production server
npm start
```

Server runs on `http://localhost:5000` by default.

---

## Environment Variables

Create a `.env` file in the root:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/devcollab

# JWT
JWT_SECRET=your_super_secret_jwt_key_here

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Cloudinary (avatar uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Client URL (CORS)
CLIENT_URL=http://localhost:3000

# GitHub API (optional — increases rate limit from 60 to 5000 req/hr)
GITHUB_TOKEN=ghp_your_token_here
```

---

## API Reference

All protected routes require:
```
Authorization: Bearer <jwt_token>
```

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/google` | ❌ | Verify Firebase idToken, issue JWT |
| `GET` | `/api/auth/me` | ✅ | Return current authenticated user |
| `POST` | `/api/auth/logout` | ✅ | Clear auth cookie |

**POST `/api/auth/google`**
```json
// Request
{ "idToken": "<firebase_id_token>" }

// Response
{
  "success": true,
  "isNewUser": false,
  "token": "<jwt>",
  "user": { "_id", "name", "email", "role", "avatar" }
}
```

---

### Profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/profile/discover` | ✅ | Paginated discover feed |
| `PUT` | `/api/profile/update` | ✅ | Update profile fields |
| `POST` | `/api/profile/avatar` | ✅ | Upload avatar (multipart) |
| `GET` | `/api/profile/:name` | ✅ | Public profile by username |

**GET `/api/profile/discover`** — Query params:
```
?limit=10&role=frontend&skills=React,TypeScript&commitment=parttime&search=alex
```

---

### Swipe

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/swipe` | ✅ | Record swipe action |

```json
// Request
{ "targetId": "<user_id>", "action": "like" }
// action: "like" | "pass" | "superlike"
```

---

### Matches

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/matches` | ✅ | List all matches for current user |

---

### Messages

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/messages/:matchId` | ✅ | Fetch message history |

---

### Projects

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/projects` | ✅ | Browse open projects |
| `POST` | `/api/projects` | ✅ | Create project listing |
| `GET` | `/api/projects/mine` | ✅ | My posted projects |
| `GET` | `/api/projects/:id` | ✅ | Single project + applied status |
| `PUT` | `/api/projects/:id` | ✅ | Update project (owner only) |
| `DELETE` | `/api/projects/:id` | ✅ | Delete project (owner only) |
| `POST` | `/api/projects/:id/apply` | ✅ | Apply to a project |
| `GET` | `/api/projects/:id/applications` | ✅ | View applications (owner only) |
| `PUT` | `/api/projects/:id/applications/:appId` | ✅ | Accept or reject application |

**POST `/api/projects`**
```json
{
  "title": "DevCollab Mobile",
  "description": "React Native version...",
  "techStack": ["React Native", "TypeScript"],
  "rolesNeeded": ["mobile", "backend"],
  "stage": "idea",
  "commitment": "parttime",
  "projectType": "sideproject",
  "openPositions": 2
}
```

---

### Project Rooms

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/projects/:id/tasks` | ✅ | Get task board |
| `POST` | `/api/projects/:id/tasks` | ✅ | Create task |
| `PATCH` | `/api/projects/:id/tasks/:taskId` | ✅ | Update task status |
| `DELETE` | `/api/projects/:id/tasks/:taskId` | ✅ | Delete task |
| `GET` | `/api/projects/:id/links` | ✅ | Get shared links |
| `POST` | `/api/projects/:id/links` | ✅ | Add link |
| `DELETE` | `/api/projects/:id/links/:linkId` | ✅ | Delete link |
| `GET` | `/api/projects/:id/members` | ✅ | Get room members |

> All room routes verify membership (owner or accepted applicant) server-side.

---

### GitHub

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/github/stats?username=` | ✅ | Fetch GitHub public stats |

---

### Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/notifications` | ✅ | Get notifications |
| `PUT` | `/api/notifications/read-all` | ✅ | Mark all as read |
| `PUT` | `/api/notifications/:id/read` | ✅ | Mark one as read |

---

## WebSocket Events

Connect with:
```js
const socket = io("http://localhost:5000", {
  auth: { token: "<jwt_token>" }
});
```

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_match` | `{ matchId }` | Join a chat room |
| `send_message` | `{ matchId, content, type }` | Send a message |
| `typing` | `{ matchId }` | Broadcast typing indicator |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `receive_message` | `Message object` | New message in room |
| `user_typing` | — | Other user is typing |
| `new_match` | `{ matchId, matchScore, with }` | Mutual match created |

---

## Data Models

### User
```
name, email, password (bcrypt), avatar, role, skills[],
lookingFor[], projectIdea, projectType, commitment,
experience, github, linkedin, isAvailable, eloScore (default: 1200)
```

### Project
```
title, description, techStack[], rolesNeeded[], stage,
commitment, projectType, postedBy (ref), openPositions, isOpen
```

### Application
```
project (ref), applicant (ref), message, role,
status: pending | accepted | rejected
```

### Match
```
users[] (2× User ref), matchScore, status, matchedAt
```

### Task
```
project (ref), title, status: todo | inprogress | done, createdBy (ref)
```

---

## Architecture Notes

### Authentication Flow
1. Client sends Firebase `idToken` to `POST /api/auth/google`
2. Backend verifies via Firebase Admin SDK
3. Backend issues its own 7-day JWT
4. All subsequent requests use `Authorization: Bearer <jwt>`
5. `protect` middleware reads from `Authorization` header or `cookie`

### ELO Matching
- Each user starts with `eloScore: 1200`
- Discover feed sorts by `eloScore` descending
- Score adjusts based on like/pass ratio over time
- Ensures high-quality profiles surface first

### Rate Limiting
All API routes: 500 requests per 15 minutes per IP.

### CORS
Allowed origins:
- `http://localhost:3000`
- `https://dev-collaber-fe-eight.vercel.app`
- `process.env.CLIENT_URL`

---

## Scripts

```bash
npm run dev      # nodemon — auto-restart on changes
npm start        # production start
node src/seed.js # seed database with sample users/projects
```

---

## Deployment (Render.com)

1. Connect GitHub repo to Render
2. Set **Build Command**: `npm install`
3. Set **Start Command**: `node server.js`
4. Add all environment variables in Render dashboard
5. Enable **Auto-Deploy** on push to `main`
