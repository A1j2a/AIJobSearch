# AI Job Finder - Local Desktop Job Search & Matching Application

A zero-cost, privacy-first local application for automated job searching, multi-keyword job collection, and AI-powered match analysis using a local LLM via Ollama.

---

## Phase 1 Completed Architecture

- **Backend Server**: Node.js & Express REST API (`http://localhost:3001`)
- **Database Engine**: SQLite file-based DB at `data/jobsearch.db` (auto-created on boot)
- **Frontend App**: React 18, Vite, TypeScript, Lucide Icons (`http://localhost:5173`)
- **Design System**: Modern Vanilla CSS SaaS theme with blue accent (`#2563eb`)
- **Pre-configured Profile**: Ajay Patidar (React Native Developer, 3+ yrs experience, Ahmedabad/Gandhinagar/Remote India)

---

## How to Run Locally

### Prerequisites
- Node.js (v18 or higher) & npm installed on your Mac.
- Ollama (optional for Phase 1 UI test, required for AI analysis in Phase 3).

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start Development Application
Run both backend Express server and Vite frontend simultaneously:
```bash
npm run dev
```

### Step 3: Open in Browser
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Endpoints Summary

- `GET /api/profile` - Fetch user profile
- `PUT /api/profile` - Update user profile & master skills
- `GET /api/search-config` - Fetch multi-keyword search criteria
- `PUT /api/search-config` - Save search keywords & experience filters
- `GET /api/settings` - App settings & job source statuses
- `PUT /api/settings` - Save Ollama/Telegram/Scheduler settings
- `POST /api/settings/test-ollama` - Check Ollama AI reachability
- `GET /api/dashboard/stats` - Summary metrics
- `GET /api/jobs` - Normalized job listings
- `GET /api/logs` - System audit log entries
