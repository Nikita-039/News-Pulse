# 📡 News Pulse — Topic-Clustered News Timeline

> A full-stack news intelligence platform that ingests live RSS articles, groups them into topic clusters using TF-IDF + DBSCAN, and displays an interactive timeline.

---

## Architecture

```
RSS Feeds  ──►  Python Scraper  ──►  MongoDB Atlas  ◄──  Node.js API  ◄──  React Frontend
  BBC            feedparser +              ▲             Express.js          Vite + Custom CSS
  NPR            trafilatura               │             5 REST endpoints
  Guardian       TF-IDF + DBSCAN     same cluster ←─────────────────────────────────────────
```

```
News Pulse/
├── scraper/          ← Python pipeline
├── backend/          ← Node.js REST API
└── frontend/         ← React (Vite) UI
```

---

## RSS Sources

| Source | Feed URL |
|---|---|
| BBC News | `https://feeds.bbci.co.uk/news/rss.xml` |
| NPR | `https://feeds.npr.org/1001/rss.xml` |
| The Guardian | `https://www.theguardian.com/world/rss` |

---

## Clustering Approach

**Method: TF-IDF + Cosine Similarity + DBSCAN**

1. Concatenate `title + summary` for each article.
2. Vectorise with `TfidfVectorizer(stop_words='english', ngram_range=(1,2), max_features=5000)`.
3. Compute pairwise cosine similarity → convert to **distance matrix**: `dist = 1 − cosine_similarity`.
4. Run `DBSCAN(eps=0.55, min_samples=2, metric="precomputed")` on the precomputed distance matrix.
5. Noise articles (label `−1`) each become their own singleton cluster.
6. Cluster label = top-3 TF-IDF terms of the centroid.

**Why TF-IDF + DBSCAN?**
- No need to pre-specify K (unlike k-means) — the number of topics is discovered automatically.
- Naturally handles noise: articles that don't fit any cluster become singletons rather than being forced into a wrong group.
- Cosine similarity on TF-IDF vectors is well-studied and effective for short news texts.

**Parameters:**
- `eps=0.95` — two articles are in the same cluster if their cosine distance ≤ 0.95 (similarity ≥ 0.05). Tunable via `DBSCAN_EPS` env var.
- `min_samples=2` — a cluster requires at least 2 articles. Tunable via `DBSCAN_MIN_SAMPLES`.

**Known limitation:**
- DBSCAN's time complexity is O(n²) for the distance matrix computation. For very large corpora (>10 000 articles) this will be slow. A mini-batch or approximate-NN approach (e.g., HNSW) would be needed at scale.

**Re-run correctness:**
Every pipeline run loads **all** articles from MongoDB (not just new ones) before clustering. Old cluster documents are dropped and rewritten so assignments are always globally consistent.

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- A **MongoDB Atlas** free cluster (M0)

---

## Setup

### 1. MongoDB Atlas

1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
2. Add a database user and whitelist your IP (or `0.0.0.0/0` for dev).
3. Copy your connection string: `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/`.

### 2. Python Scraper

```bash
cd scraper

# Copy env template and fill in your Atlas URI
cp .env.example .env
# Edit .env → set MONGODB_URI=mongodb+srv://...

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux

pip install -r requirements.txt

# Run the pipeline manually
python pipeline.py
```

### 3. Node.js Backend

```bash
cd backend

cp .env.example .env
# Edit .env → same MONGODB_URI, set PYTHON_CMD=python (or python3)

npm install
npm run dev          # starts on http://localhost:5000
```

### 4. React Frontend

```bash
cd frontend

npm install
npm run dev          # starts on http://localhost:5173
```

Open **http://localhost:5173** — click **Refresh Data** to run the first ingestion.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/clusters` | List all clusters (label, count, time range) |
| `GET` | `/clusters/:id` | Full cluster detail + sorted articles |
| `GET` | `/timeline` | Timeline-formatted clusters with intensity |
| `POST` | `/ingest/trigger` | Trigger Python pipeline; returns `{jobId}` |
| `GET` | `/ingest/status/:jobId` | Poll ingestion job status |

---

## Environment Variables

### `scraper/.env`

| Variable | Default | Description |
|---|---|---|
| `MONGODB_URI` | — | **Required.** Atlas connection string |
| `DB_NAME` | `news_pulse` | Database name |
| `DBSCAN_EPS` | `0.95` | DBSCAN distance threshold |
| `DBSCAN_MIN_SAMPLES` | `2` | Min articles per cluster |

### `backend/.env`

| Variable | Default | Description |
|---|---|---|
| `MONGODB_URI` | — | **Required.** Same Atlas connection string |
| `DB_NAME` | `news_pulse` | Must match scraper `DB_NAME` |
| `PORT` | `5000` | API server port |
| `PYTHON_CMD` | `python` | Python executable name |

---

## Deployment

### Backend + Scraper (Render)
The backend and Python scraper are containerised together using the provided `Dockerfile`.
1. Create a new **Web Service** on [Render](https://render.com).
2. Connect your GitHub repository.
3. Select **Docker** as the environment.
4. Add the `MONGODB_URI` environment variable.
5. Deploy.

### Frontend (Vercel)
1. Import your GitHub repository to [Vercel](https://vercel.com).
2. Set the Root Directory to `frontend`.
3. Add `VITE_API_BASE_URL` environment variable pointing to your deployed Render URL (e.g. `https://your-backend.onrender.com`).
4. Deploy.

---

## Tech Stack

| Layer | Technology |
|---|---|
| RSS parsing | `feedparser` |
| Article extraction | `trafilatura` |
| Clustering | `scikit-learn` (TF-IDF + DBSCAN) |
| Database | MongoDB Atlas (`pymongo` / `mongoose`) |
| API | Node.js + Express |
| Frontend | React 18 + Vite |
| Timeline UI | Custom CSS Layout |
| Styling | Vanilla CSS (dark glassmorphism) |
