# DevCollab — Backend

A Node.js + Express REST API with real-time socket support for the DevCollab developer matchmaking platform.

---

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Auth**: Firebase Admin SDK (Google OAuth) + JWT (httpOnly cookies)
- **Real-time**: Socket.io
- **File Upload**: Multer + Cloudinary + Streamifier
- **Other**: Helmet, CORS, Morgan, bcryptjs, cookie-parser, express-rate-limit

---

## Project Structure

```
server/
├── src/
│   ├── config/
│   │   └── db.js               # MongoDB connection
│   ├── controllers/
│   │   ├── auth.controller.js  # Google auth, logout, getMe
│   │   ├── profile.controller.js # Discover feed, update profile, avatar upload
│   │   └── swipe.controller.js # Swipe logic + match creation
│   ├── middleware/
│   │   └── auth.middleware.js  # JWT verification via cookie
│   ├── models/
│   │   ├── User.js             # User schema with ELO score
│   │   ├── Swipe.js            # Swipe actions (like/pass/superlike)
│   │   ├── Match.js            # Mutual matches with score
│   │   └── Message.js          # Chat messages
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── profile.routes.js
│   │   ├── swipe.routes.js
│   │   ├── match.routes.js
│   │   └── message.routes.js
│   ├── services/
│   │   └── matchmaking.service.js # Match score computation (Jaccard + role bonus)
│   └── socket/
│       └── socket.js           # Socket.io server with JWT auth middleware
├── app.js                      # Express app setup
├── server.js                   # Entry point
└── .env                        # Environment variables
```

---

## Getting Started

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Set up environment variables

Create a `.env` file in the `server/` directory:

```env
# App
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# MongoDB
MONGO_URI=your_mongodb_connection_string

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. Firebase Admin SDK setup

1. Go to **Firebase Console → Project Settings → Service Accounts**
2. Click **Generate new private key**
3. Copy `project_id`, `client_email`, and `private_key` into `.env`
4. Make sure `FIREBASE_PRIVATE_KEY` is wrapped in double quotes with literal `\n` between lines

### 4. Run the server

```bash
# Development (with nodemon)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:5000`

---

## API Routes

### Auth — `/api/auth`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/google` | — | Firebase Google login / register |
| POST | `/logout` | — | Clear JWT cookie |
| GET | `/me` | ✅ | Get current user |

### Profile — `/api/profile`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/discover` | ✅ | Get unswiped profiles with filters |
| PUT | `/update` | ✅ | Update profile fields |
| POST | `/avatar` | ✅ | Upload avatar to Cloudinary |

**Discover query params**: `role`, `skills` (comma-separated), `commitment`, `projectType`, `limit`

### Swipe — `/api/swipe`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/` | ✅ | Swipe on a profile (like/pass/superlike) |

**Body**: `{ targetId: string, action: "like" | "pass" | "superlike" }`

On mutual like → creates a Match + emits `new_match` socket event to both users.

### Matches — `/api/matches`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/` | ✅ | Get all matches for current user |

### Messages — `/api/messages`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/:matchId` | ✅ | Get chat history for a match |

---

## Socket Events

Socket server requires JWT token in handshake auth:
```js
socket = io("http://localhost:5000", {
  auth: { token: "your_jwt_token" }
});
```

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_match` | `{ matchId }` | Join a match chat room |
| `send_message` | `{ matchId, content, type }` | Send a message |
| `typing` | `{ matchId }` | Emit typing indicator |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `new_match` | `{ matchId, matchScore, with }` | Fired when a mutual match is created |
| `receive_message` | Message object | New message in a match room |
| `user_typing` | `{ userId }` | Someone is typing |
| `user_offline` | `{ userId }` | User disconnected |

---

## Match Score Algorithm

Located in `src/services/matchmaking.service.js`:

- **Skill overlap**: Jaccard similarity → `(intersection / union) × 100`
- **Role bonus**: +15 points for complementary roles:
  - frontend + backend
  - frontend + devops
  - ml + backend
- **Max score**: 100

---

## Models

### User
```
name, email, password (hashed), avatar, bio, role, skills[],
lookingFor[], projectIdea, projectType, commitment, experience,
github, linkedin, isAvailable, location, eloScore (default: 1200)
```

### Swipe
```
from (User), to (User), action (like | pass | superlike)
Unique index on (from, to)
```

### Match
```
users [User, User], matchScore, status (active | archived), matchedAt
```

### Message
```
matchId, sender (User), content (max 2000), type (text | project_proposal), read
```