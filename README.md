# 🎬 Bollywood Streams — Stremio Addon

Browse and stream **Hindi (Bollywood)**, **Punjabi (Pollywood)**, and **South Indian (Telugu, Tamil, Malayalam, Kannada)** movies with **Dual Audio & Hindi Dubbed** support directly in Stremio.

[![Stremio](https://img.shields.io/badge/stremio-addon%20v1.0-purple.svg)](https://stremio.com)
[![Status](https://img.shields.io/badge/status-active%20%7C%2024%2F7-brightgreen.svg)]()
[![Node](https://img.shields.io/badge/node-%3E%3D18-blue.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()

---

## ⚡ 1-Click Install (Hosted 24/7 in Cloud)

You can install and use this addon immediately without running any local server:

- **Desktop / Mobile (1-Click)**:  
  👉 **[Install in Stremio](stremio://bollywood-streams.onrender.com/manifest.json)**
- **Stremio Web**:  
  👉 **[Open in Stremio Web](https://web.stremio.com/#/addons?addon=https%3A%2F%2Fbollywood-streams.onrender.com%2Fmanifest.json)**
- **Manual Installation**:  
  In Stremio, go to **Addons (🧩)**, paste this URL into the search bar, and click **Install**:
  ```text
  https://bollywood-streams.onrender.com/manifest.json
  ```

---

## 🌟 Features

- **6 Dedicated Indian Cinema Catalogs**:
  - 🔥 **Popular Hindi / Bollywood**: All-time and modern blockbusters (*Jawan*, *Pathaan*, *Dangal*, *3 Idiots*, *Animal*, *Sholay*).
  - 🆕 **New Hindi Releases**: Live real-time theatrical and OTT Hindi movie drops.
  - ⭐ **Top Rated Hindi**: Masterpieces with IMDb 8.0+.
  - 💥 **South Indian Hits (Hindi Dubbed / Multi Audio)**: Telugu, Tamil, Malayalam, and Kannada pan-India hits (*Pushpa*, *KGF*, *RRR*, *Kalki 2898 AD*, *Salaar*, *Kantara*, *Devara*, *Leo*).
  - 🌾 **Popular Punjabi (Pollywood)**: Top Punjabi hits (*Carry On Jatta*, *Jatt & Juliet*, *Qismat*, *Chal Mera Putt*, *Sardaarji*).
  - 🆕 **New Punjabi Releases**: Real-time newest Punjabi cinema releases.
- **Audio & Dubbed Badges**:
  - Automatically identifies and highlights:
    - `🎧 Dual Audio` *(e.g. Hindi + Telugu, Hindi + Tamil)*
    - `🎧 Hindi Dubbed` *(including clean OTT Hindi audio)*
    - `🎧 Punjabi Audio`
    - `🎧 Tamil Dubbed` / `Telugu Dubbed`
- **Priority Ranking**:
  - Dual Audio and Hindi Dubbed streams are automatically ranked at the top of the stream list.
  - Quality sorting: 4K, 1080p, 720p, HDR, x265 with active seeder count.
- **Universal Search**:
  - Search any Indian title across Hindi, Punjabi, Tamil, Telugu, Malayalam, and Kannada directly in Stremio's search bar.

---

## 🛠️ Self-Hosting (Optional)

If you prefer to run your own instance:

```bash
# Clone repository
git clone https://github.com/inzamamraj-netizen/bollywood-streams.git
cd bollywood-streams

# Install dependencies
npm install

# Run (set your TMDB API key)
TMDB_API_KEY=your_tmdb_key npm start
```

Or deploy to your own cloud host (Render, Railway, Koyeb, Docker) using the included `Dockerfile` and `render.yaml`.

---

## 📄 License

MIT
