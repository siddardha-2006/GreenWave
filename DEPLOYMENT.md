# Deployment Guide for GREEN-WAVE

[![Deploy with Docker](https://img.shields.io/badge/Deploy-Docker-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)
[![Deploy to Render](https://img.shields.io/badge/Deploy-Render-46E3B7.svg?logo=render&logoColor=white)](https://render.com/)
[![Deploy to Railway](https://img.shields.io/badge/Deploy-Railway-0B0D0E.svg?logo=railway&logoColor=white)](https://railway.app/)
[![Deploy to Vercel](https://img.shields.io/badge/Deploy-Vercel-000000.svg?logo=vercel&logoColor=white)](https://vercel.com/)

This guide provides step-by-step instructions for deploying the **GREEN-WAVE** platform across different environments:

1. [Architecture & Deployment Model](#-architecture--deployment-model)
2. [Method 1: Docker Compose (Recommended for Local / VPS / Cloud VMs)](#-method-1-docker-compose-recommended)
3. [Method 2: 1-Click Cloud PaaS (Render / Railway / Fly.io)](#-method-2-cloud-paas-render--railway--flyio)
4. [Method 3: Decoupled Cloud (Frontend on Vercel + Backend on Render/Railway)](#-method-3-decoupled-cloud-deployment)
5. [Method 4: Production Linux VPS (Ubuntu / Nginx / Systemd / Let's Encrypt SSL)](#-method-4-production-linux-vps-with-nginx--systemd)
6. [Environment Variables Reference](#-environment-variables-reference)
7. [Health Checks & Verification](#-health-checks--verification)

---

## 🏗 Architecture & Deployment Model

GREEN-WAVE is built as a **unified, production-ready stack**:
- **Backend**: FastAPI (Python 3.11+) running with Uvicorn, executing discrete-event simulation, QAOA/QUBO optimization via Qiskit Aer, and streaming live WebSocket telemetry.
- **Frontend**: React 18, Three.js 3D visualizer, and Tailwind CSS compiled via Vite into static assets.
- **Unified Serving**: In production, the FastAPI application automatically detects and mounts the compiled `frontend/dist` directory at root (`/`), serving both the web client and the `/api` / `/ws` endpoints from a single port (`8000`) with **zero CORS complexity**.
- **Database (Optional)**: MongoDB 7.0 for persistent experiment history. If MongoDB is omitted, the application automatically operates using its built-in in-memory repository.

---

## 🐳 Method 1: Docker Compose (Recommended)

This runs the entire stack (FastAPI backend, compiled 3D React frontend, and MongoDB) with a single command.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

### Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/siddardha-2006/GreenWave.git
   cd GreenWave
   ```

2. **Launch all services**:
   ```bash
   docker compose up -d --build
   ```

3. **Verify the running containers**:
   ```bash
   docker compose ps
   ```

4. **Access the application**:
   - Web Application & 3D Visualizer: **`http://localhost:8000`**
   - Interactive API Docs (Swagger): **`http://localhost:8000/docs`**
   - Healthcheck Endpoint: **`http://localhost:8000/health`**

5. **Stop or view logs**:
   ```bash
   # View live logs
   docker compose logs -f green-wave

   # Stop containers
   docker compose down
   ```

---

## ☁️ Method 2: Cloud PaaS (Render / Railway / Fly.io)

Deploy with zero server management using the multi-stage `Dockerfile`.

### Option A: Render.com
1. Sign in to [Render](https://render.com) and click **New +** $\to$ **Web Service**.
2. Connect your GitHub repository: `https://github.com/siddardha-2006/GreenWave`.
3. Configure the service:
   - **Environment**: `Docker`
   - **Branch**: `main`
   - **Plan**: `Starter` or `Standard` (Recommended: 1 CPU / 1GB RAM minimum for quantum circuit simulations).
4. Under **Advanced**, add Environment Variables:
   - `APP_ENV`: `production`
   - `API_HOST`: `0.0.0.0`
   - `API_PORT`: `8000`
5. Click **Create Web Service**. Render builds the React frontend, sets up Python/Qiskit, and exposes your live HTTPS URL.

---

### Option B: Railway.app
1. Go to [Railway](https://railway.app) $\to$ **New Project** $\to$ **Deploy from GitHub repo**.
2. Select `siddardha-2006/GreenWave`.
3. Railway automatically detects the `Dockerfile`.
4. Go to **Settings** $\to$ **Networking** $\to$ Click **Generate Domain**.
5. Set environment variable `PORT` = `8000`.
6. Access your public HTTPS endpoint.

---

### Option C: Fly.io
1. Install Fly CLI and authenticate:
   ```bash
   fly auth login
   ```
2. Launch the application:
   ```bash
   fly launch --no-deploy
   ```
3. Set internal port to 8000 in `fly.toml`:
   ```toml
   [http_service]
     internal_port = 8000
     force_https = true
   ```
4. Deploy:
   ```bash
   fly deploy
   ```

---

## ⚡ Method 3: Decoupled Cloud Deployment

Deploy the frontend to **Vercel / Netlify** and the backend to **Render / Railway / AWS ECS**.

### 1. Deploy Backend (FastAPI)
Deploy the backend following [Method 2](#-method-2-cloud-paas-render--railway--flyio) or to AWS ECS / DigitalOcean App Platform.
Copy your public backend URL (e.g., `https://greenwave-api.onrender.com`).

### 2. Deploy Frontend to Vercel
1. Import `siddardha-2006/GreenWave` into [Vercel](https://vercel.com).
2. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add a `frontend/vercel.json` rewrite file to proxy API and WebSocket traffic:
   ```json
   {
     "rewrites": [
       { "source": "/api/:path*", "destination": "https://greenwave-api.onrender.com/api/:path*" },
       { "source": "/ws/:path*", "destination": "https://greenwave-api.onrender.com/ws/:path*" },
       { "source": "/health", "destination": "https://greenwave-api.onrender.com/health" }
     ]
   }
   ```
4. Click **Deploy**.

---

## 🖥 Method 4: Production Linux VPS with Nginx & Systemd

For dedicated Linux VPS instances (Ubuntu 22.04 / 24.04 LTS on AWS EC2, DigitalOcean, Hetzner, Linode, or GCP).

### 1. System Packages & Python Setup
```bash
sudo apt update && sudo apt install -y python3-pip python3-venv git curl nginx certbot python3-certbot-nginx

# Install Node.js 20 LTS for frontend build
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Clone Repository & Build Frontend
```bash
sudo mkdir -p /var/www/greenwave
sudo chown -R $USER:$USER /var/www/greenwave
cd /var/www/greenwave

git clone https://github.com/siddardha-2006/GreenWave.git .

# Build React Three.js Frontend
cd frontend
npm ci
npm run build
cd ..
```

### 3. Setup Python Backend Environment
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Create Systemd Service for Auto-Restart
Create `/etc/systemd/system/greenwave.service`:
```ini
[Unit]
Description=GREEN-WAVE Traffic Optimization Platform
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/var/www/greenwave
Environment="PATH=/var/www/greenwave/.venv/bin"
Environment="APP_ENV=production"
Environment="API_HOST=127.0.0.1"
Environment="API_PORT=8000"
ExecStart=/var/www/greenwave/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable greenwave
sudo systemctl start greenwave
sudo systemctl status greenwave
```

### 5. Configure Nginx Reverse Proxy with WebSockets
Create `/etc/nginx/sites-available/greenwave`:
```nginx
server {
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable configuration and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/greenwave /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Enable Free HTTPS / SSL via Certbot
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## ⚙️ Environment Variables Reference

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `APP_ENV` | `development` | Environment mode (`development` or `production`). |
| `API_HOST` | `127.0.0.1` (or `0.0.0.0` in Docker) | Host interface to bind. |
| `API_PORT` | `8000` | Port for the FastAPI server. |
| `MONGODB_URI` | `mongodb://localhost:27017` | Optional connection string to MongoDB. |
| `MONGODB_DATABASE` | `green_wave` | MongoDB database name. |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS allowed origin. Set to `*` or your production domain. |
| `DEFAULT_QAOA_SHOTS` | `2048` | Number of measurement shots per quantum evaluation. |
| `DEFAULT_QAOA_P` | `1` | Default QAOA depth layer ($p=1, 2, 3$). |
| `DECISION_INTERVAL_SECONDS` | `10.0` | Seconds between periodic optimization re-evaluations. |

---

## 🩺 Health Checks & Verification

After deployment, verify that both the backend and frontend are operating properly:

1. **Health Endpoint**:
   ```bash
   curl -i http://localhost:8000/health
   ```
   *Expected Response:*
   ```json
   HTTP/1.1 200 OK
   {"status":"healthy","service":"green-wave-api"}
   ```

2. **Frontend UI**:
   Open your browser to `http://localhost:8000/`. You should see the tactile Relevo & Vinco dashboard with the Three.js 3D spatial simulation and real-time telemetry gauges.

3. **Start an Experiment**:
   In the Job Specification panel, click **"EXECUTE RUN // INITIATE OPTIMIZATION"**. Verify that:
   - Vehicles spawn and flow across the 3D intersection.
   - Signal heads cycle between Green, Yellow, and Red.
   - The Decision Audit Log receives real-time QAOA / classical solver decisions.

