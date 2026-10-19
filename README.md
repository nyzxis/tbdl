<div align="center">

# ⚡ TBDL — TeraBox Direct Downloader & API

A modern, lightning-fast, self-hostable **TeraBox Direct Link Generator & Web Interface** built with **Bun** and **TypeScript**.

[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-%232496ED.svg?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

[Features](#-features) • [Quick Start](#-quick-start) • [Docker Deployment](#-docker-deployment) • [API Documentation](#-api-documentation) • [Cookie Guide](#-how-to-get-your-ndus-cookie)

---

</div>

## ✨ Features

- ⚡ **Ultra-Fast Performance**: Built on Bun's native HTTP server and engine.
- 🎨 **Modern Responsive UI**: Clean glassmorphism frontend styled with Tailwind CSS.
- 📂 **Multi-File & Folder Support**: Extracts single files or full folder contents with individual download URLs.
- 💾 **Smart In-Memory Caching**: 2-hour TTL cache reduces repetitive requests and avoids rate limiting.
- 📋 **One-Click Actions**: Instant Direct Download, Copy Link, and Local Download History.
- 🌐 **Multi-Domain Support**: Works across `terabox.app`, `terabox.com`, `1024terabox.com`, `teraboxshare.com`, `teraboxlink.com`, and mirrors.
- 🐳 **Docker Ready**: Includes `Dockerfile` and `docker-compose.yml` for effortless containerization.
- 🔌 **REST API & CORS**: Easily integrate with external apps, Telegram bots, or browser scripts.

---

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) (v1.0+) or [Docker](https://www.docker.com/)

### 1. Clone & Install

```bash
git clone https://github.com/nyzxis/tbdl.git
cd tbdl
bun install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and supply your TeraBox `ndus` cookie:
```env
PORT=5000
TERABOX_COOKIE_NDUS=your_ndus_cookie_here
```

### 3. Run

```bash
# Development mode (with live reload)
bun run dev

# Production
bun run start
```

Visit **`http://localhost:5000`** in your browser.

---

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Build and start container in detached mode
docker compose up -d
```

### Using Plain Docker

```bash
docker build -t tbdl .
docker run -d -p 5000:5000 --env-file .env --name tbdl-app tbdl
```

---

## 🍪 How to Get Your `ndus` Cookie

TeraBox protects file downloads behind account sessions. To bypass token errors:

1. Open your browser and log into [TeraBox](https://www.terabox.com).
2. Press `F12` to open **Developer Tools** and navigate to the **Application** (or **Storage**) tab.
3. Under **Cookies**, select `https://www.terabox.com`.
4. Locate the cookie named **`ndus`**.
5. Copy its value and paste it into your `.env` as `TERABOX_COOKIE_NDUS=...`.

---

## 🔌 API Documentation

### Extract Download Link

#### `GET /api`
```http
GET /api?url=https://terabox.app/s/1HSEb8PZRUE7Z1Tvd3ZtT0g
```

#### `POST /api`
```http
POST /api
Content-Type: application/json

{
  "url": "https://terabox.app/s/1HSEb8PZRUE7Z1Tvd3ZtT0g"
}
```

#### Response Example
```json
{
  "status": "success",
  "response_time": "0.342s",
  "url": "https://terabox.app/s/1HSEb8PZRUE7Z1Tvd3ZtT0g",
  "surl": "1HSEb8PZRUE7Z1Tvd3ZtT0g",
  "filename": "sample_video.mp4",
  "size": "520.40 MB",
  "bytes": 545678901,
  "download": "https://d.terabox.app/...",
  "thumbs": "https://thumb.terabox.app/...",
  "list": [
    {
      "server_filename": "sample_video.mp4",
      "size": "520.40 MB",
      "bytes": 545678901,
      "dlink": "https://d.terabox.app/..."
    }
  ],
  "timestamp": "2026-10-19T10:30:00.000Z"
}
```

### Health Check
```http
GET /health
```
```json
{
  "status": "ok",
  "service": "tbdl",
  "version": "1.0.0",
  "cached_items": 3,
  "timestamp": "2026-10-19T10:30:00.000Z"
}
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
