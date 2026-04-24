# Browser Extension Demo

End-to-end walkthrough for the Multi-False Detector Chrome extension.

---

## Architecture

```
Browser tab (any news page)
│
│  content.js (injected automatically)
│  ├─ document.body.innerText      → raw visible text
│  └─ largest visible <img>.src    → image URL
│
▼
popup.js (runs inside the extension popup)
│  POST http://localhost:8000/analyze
│  { "text": "...", "image_url": "..." }
│
▼
backend/main.py  (FastAPI, local server)
│
├─ image_url present?
│   ├─ YES → model_service.load_image_from_url()
│   │         Download → PIL.Image → Resize(224) → ToTensor → Normalize
│   │         model_service.predict(text, image_tensor)
│   │         └─ TextEncoder (BERT)  ──┐
│   │         └─ VisionEncoder (VGG) ──┤ concat → FC → Sigmoid → P(fake)
│   │                                  └─ used_image: true
│   └─ NO  → model_service.predict_text_only(text)
│             └─ returns MEDIUM, used_image: false
│
▼
{ "risk": "LOW|MEDIUM|HIGH", "reason": "...", "used_image": true/false }
│
▼
popup.html result box
(coloured background: red=HIGH, yellow=MEDIUM, green=LOW)
```

---

## Demo Steps

### 1. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Wait for the startup log:

```
INFO:     Started server process [...]
INFO:     Uvicorn running on http://127.0.0.1:8000
```

Model loading (BERT + VGG-19) takes roughly 5–15 seconds on first run.

### 2. Load the extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `extension/` folder
4. The "Multi-False Detector" extension icon appears in the toolbar

### 3. Analyse a page

1. Navigate to any news article or social media post
2. Click the **Multi-False Detector** toolbar icon
3. Click **Analyse Current Page**
4. The popup shows a loading message ("Analysing…") then the result

---

## Expected Result

| Scenario | Expected output |
|---|---|
| News article with image on page | `Risk: HIGH/MEDIUM/LOW` + model confidence · `Image detected · Image used by model` |
| Page with no images | `Risk: MEDIUM` · fallback message · `No image found` |
| Image fails to download | `Risk: MEDIUM` · `Image could not be loaded (...)` · `used_image: false` |
| Backend not running | `Error: Failed to connect to backend. Is it running on port 8000?` |

The terminal running uvicorn prints a debug block for every request:

```
--- /analyze request ---
  [1] text length    : 3241 chars
  [2] image_url      : yes → https://example.com/photo.jpg
  [3] image download : success
  [4] tensor shape   : [1, 3, 224, 224]
  [5] model prob     : 0.7821
  [6] risk level     : HIGH
```

---

## Troubleshooting

### Backend not running

**Symptom:** Extension shows `Error: Failed to connect to backend. Is it running on port 8000?`

**Fix:**
- Make sure `uvicorn main:app --reload` is running in the `backend/` folder
- Confirm nothing else is using port 8000: `lsof -i :8000`
- If the port is taken, restart on a different port: `uvicorn main:app --port 8001` and update `BACKEND_URL` in `extension/popup.js`

---

### No image found

**Symptom:** Result says `No image found` and risk is always `MEDIUM`

**Why:** The extension looks for visible `<img>` tags with a non-empty `src` that are rendered in the layout (non-zero size, not `display:none`). Some pages load images as CSS backgrounds, `<picture>` elements, or lazy-load them after scroll.

**Workarounds:**
- Scroll to the main article image before clicking Analyse — lazy-loaded images won't be in the DOM until they're near the viewport
- Open DevTools → Console and run `document.querySelector("img")?.src` to check what the page exposes

---

### CORS / localhost permission error

**Symptom:** Browser console shows a CORS error or `net::ERR_CONNECTION_REFUSED`

**Why:** Chrome extensions can make `fetch()` calls to `localhost` without special permissions, but the backend must send the correct `Access-Control-Allow-Origin` header (it does — see `CORSMiddleware` in `backend/main.py`).

**Fix:**
- Confirm the backend is actually running (see above)
- If you changed the port, update `BACKEND_URL` in `extension/popup.js` and reload the extension via `chrome://extensions`
- Hard-reload the extension after any code change: click the refresh icon on the extension card in `chrome://extensions`

---

### Model always returns MEDIUM

**Symptom:** Every page returns `MEDIUM` regardless of content

**Most likely cause:** The extension is not finding any image, so the backend falls back to `predict_text_only()` which always returns `MEDIUM` (the model requires paired text + image).

**Check the terminal output** — line `[2]` shows whether `image_url` was sent, and line `[3]` shows whether the download succeeded.
