# ForgeX — A Git-Inspired Version Control Platform

ForgeX is a full-stack, Git-inspired version control platform built to explore and implement the core concepts behind modern version control systems.

It combines a React development interface, a Node.js and Express backend, MongoDB for application data, and a custom Python engine for repository operations.

## Features

- Repository creation, browsing, and deletion
- File and folder management
- File staging and unstaging
- Commit creation and history
- Branch creation, listing, and switching
- File differences between commits
- Fast-forward and merge operations
- Merge conflict detection and resolution
- Commit revert and cherry-pick
- Repository tags and releases
- Monaco-based code editing
- Commit Intelligence and Repository Insights
- JWT authentication and protected API routes
- Repository ownership checks
- SHA-256 object integrity verification
- Python engine execution timeout and output limits

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite, JavaScript, CSS |
| Code Editor | Monaco Editor |
| Backend | Node.js, Express 5 |
| Database | MongoDB, Mongoose |
| Authentication | JWT, bcryptjs |
| Version Control Engine | Python |
| Security | Helmet, CORS, express-rate-limit |
| Testing | Node.js Test Runner, Python unittest, ESLint |

## Architecture

```text
React Frontend
      |
      v
Express REST API
      |
      +------ MongoDB / Mongoose
      |
      v
Python Engine Service
      |
      v
Python Version Control Engine
      |
      +-- Repository Engine
      +-- Object Store
      +-- Staging Area
      +-- Commit Engine
      +-- Branch Engine
      +-- Diff Engine
      +-- Merge Engine
      +-- History Operations
```

## Project Structure

```text
ForgeX/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── tests/
│   └── server.js
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       └── services/
├── engine/
│   ├── api/
│   ├── core/
│   ├── storage/
│   └── tests/
└── storage/
    └── repositories/
```

## Prerequisites

- Node.js
- npm
- Python 3
- MongoDB Community Server
- Git

## Installation

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd ForgeX
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

Create `backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/forgex_db
JWT_SECRET=replace_with_a_long_random_secret
CORS_ORIGINS=http://localhost:5173
PYTHON_EXECUTABLE=python
```

Use a strong private JWT secret. Never commit `.env` files.

### 4. Start MongoDB

Ensure your local MongoDB service is running.

### 5. Start the backend

From the `backend` directory:

```bash
npm run dev
```

Backend URL: `http://localhost:5000`

Health endpoint: `http://localhost:5000/api/health`

### 6. Install and start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

Ensure Python is available using the configured `PYTHON_EXECUTABLE` command. The backend launches the Python engine when repository operations are requested.

## API Overview

| Route | Purpose |
|---|---|
| `/api/auth` | Registration, login, and profile |
| `/api/repositories` | Repository management |
| `/api/repository-files` | File and folder operations |
| `/api/version-control` | Staging, commits, branches, diffs, merges, history, tags, and releases |
| `/api/health` | Health endpoint |

Protected routes require authentication.

## Testing

Backend:

```bash
cd backend
npm test
```

Python engine tests (from project root):

```bash
python -m unittest discover -s engine/tests -t engine -v
```

Frontend lint:

```bash
cd frontend
npm run lint
```

Frontend production build:

```bash
npm run build
```

## Engineering Highlights

- Custom Python-based version control engine
- Content-addressed object storage
- Commit snapshots and branch history
- Merge conflict detection and resolution
- SHA-256 object integrity verification
- Repository ownership enforcement
- Path validation and process execution limits
- JSON communication between Node.js and Python

## Future Improvements

- Remote repository synchronization
- Collaborative development
- Pull-request-style workflows
- Real-time collaboration
- Cloud deployment
- CI/CD integration

## Project Goal

ForgeX explores how version-control systems work internally by implementing repository management, commits, branches, object storage, diffs, and merging in a web-based platform.

**ForgeX — Understand Version Control. Build It Yourself.**
