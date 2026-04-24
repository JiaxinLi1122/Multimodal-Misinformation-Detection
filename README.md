# Multimodal Fake News Detection

> A deep learning system that detects fake news on social media by jointly analyzing **text** and **images**, using BERT for language understanding and VGG-19 for visual feature extraction, with support for both Twitter (English) and Weibo (Chinese) datasets.

---

## Background

Misinformation on social media rarely travels as text alone — fabricated stories are routinely paired with out-of-context or manipulated images to increase credibility. Text-only classifiers miss this signal entirely.

This project takes a **multimodal approach**: text and image features are encoded independently by pretrained models, then fused into a single representation for binary classification (real vs. fake). The architecture is intentionally simple — the goal is a clean, reproducible baseline that demonstrates multimodal reasoning without requiring massive compute.

---

## Model Architecture

```
Text (post) ──► BERT-base-uncased
                └─ [CLS] pooler output (768-dim)
                └─ FC(768 → 2742) + ReLU + Dropout(0.4)
                └─ FC(2742 → 32)
                └─ text_feat  ──────────────────────────┐
                                                        ▼
                                              Concat (64-dim)
                                              FC(64 → 35) + ReLU + Dropout
                                              FC(35 → 1) + Sigmoid
                                                        ▲
Image (224×224) ──► VGG-19 (pretrained, ImageNet)       │
                    └─ feature extractor (4096-dim)      │
                    └─ FC(4096 → 2742) + ReLU + Dropout │
                    └─ FC(2742 → 32)                     │
                    └─ img_feat  ────────────────────────┘

Output: P(fake) — threshold at 0.5
```

**Design decisions:**
- BERT and VGG-19 backbone weights are **frozen** by default (set `fine_tune_*_module: true` in config to unfreeze)
- Fusion strategy: simple concatenation — interpretable and computationally cheap
- Loss: Binary Cross-Entropy (`BCELoss`)
- Optimizer: AdamW with linear warmup scheduler

---

## Project Structure

```
.
├── main.py            # Training entry point (data loading, training loop, final evaluation)
├── test.py            # Standalone test-set evaluation (loads saved checkpoint)
├── dataset.py         # FakeNewsDataset — CSV + image loading, BERT tokenization
├── mult_models.py     # TextEncoder, VisionEncoder, Text_Concat_Vision, train(), evaluate()
├── key_words.py       # Keyword frequency analysis → writes to SQLite
│
├── config/
│   └── config.json    # All hyperparameters (model + optimizer + training)
│
├── backend/           # FastAPI inference server
│   ├── main.py        # POST /analyze endpoint
│   ├── model_service.py  # Model loading, image fetching, inference functions
│   └── requirements.txt
│
├── extension/         # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── popup.html / popup.js   # Extension UI
│   └── content.js              # Page text + image extraction
│
├── docs/
│   ├── plugin-plan.md    # Extension architecture plan
│   └── plugin-demo.md    # Demo walkthrough and troubleshooting
│
├── crawler/
│   ├── Twitter/       # Twitter API crawler (tweets, articles, user profiles)
│   └── weibo/         # Weibo crawler (posts, images, user metadata)
│
├── data/
│   └── twitter/
│       ├── train_posts_clean.csv   # Labeled training posts
│       ├── test_posts.csv          # Held-out test posts
│       ├── images_train/           # ⚠ Not tracked in git (see Data section)
│       └── images_test/            # ⚠ Not tracked in git
│
├── saved_models/      # Auto-created — best checkpoint saved here
├── logs/              # Auto-created — training log written here
└── requirements.txt
```

---

## Dataset

### Twitter (English)

| Split | File | Records |
|-------|------|---------|
| Train | `train_posts_clean.csv` | ~13,366 |
| Test  | `test_posts.csv`        | ~1,111  |

**Key columns:** `post_text`, `image_id`, `label` (`fake` / `real`)

Images are organized by event folder (e.g., `boston_fake_001.jpg`) under `images_train/` and `images_test/`.

Source: [FakeNewsNet](https://github.com/KaiDMML/FakeNewsNet) — PolitiFact and GossipCop.

### Weibo (Chinese)

| Split | Rumor | Non-Rumor |
|-------|-------|-----------|
| Train | 5,486 | 4,515 |
| Test  | 892   | 918   |

> ⚠ **Image data is not included in this repository** due to size and licensing. See the [Data Setup](#data-setup) section below.

---

## Data Setup

Images must be placed manually after cloning:

```
data/twitter/images_train/    ← training images (.jpg, named by image_id)
data/twitter/images_test/     ← test images
```

To obtain the images, use the Twitter crawler in `crawler/Twitter/` with your own API keys, or request the dataset from the [FakeNewsNet repository](https://github.com/KaiDMML/FakeNewsNet).

---

## Installation

**Requirements:** Python 3.8+, CUDA GPU recommended (CPU training is very slow with BERT + VGG-19).

```bash
pip install -r requirements.txt
```

Download required NLTK data (only needed for `key_words.py`):

```python
import nltk
nltk.download('punkt')
nltk.download('wordnet')
nltk.download('stopwords')
```

---

## Configuration

All hyperparameters live in a single file: **`config/config.json`**

```json
{
  "text_fc2_out": 32,
  "text_fc1_out": 2742,
  "dropout_p": 0.4,
  "fine_tune_text_module": false,
  "img_fc1_out": 2742,
  "img_fc2_out": 32,
  "fine_tune_vis_module": false,
  "fusion_output_size": 35,

  "l_r": 3e-05,
  "eps": 1e-08,

  "seed": 42,
  "epochs": 10,
  "batch_size": 8,
  "max_len": 500,
  "val_split_ratio": 0.1,
  "early_stopping_patience": 3,
  "early_stopping_min_delta": 1e-4
}
```

---

## Training

```bash
python main.py
```

**What happens:**

1. Loads `train_posts_clean.csv` and performs a stratified 90/10 train/val split (preserving class ratios)
2. `test_posts.csv` is held out completely — never seen during training
3. Trains for up to `epochs` rounds with early stopping based on **validation loss**
4. Saves the best checkpoint to `saved_models/best_model.pt`
5. After training, loads the best checkpoint and runs **one** final evaluation on the test set
6. Logs all epoch metrics to `logs/train.log`

**Training image pipeline (train only):**

```
Resize(224×224) → RandomHorizontalFlip → RandomRotation(±10°)
→ ColorJitter(brightness/contrast/saturation=0.1, hue=0.05)
→ ToTensor → Normalize(ImageNet stats)
```

Val and test images use the deterministic pipeline (Resize → ToTensor → Normalize) — no augmentation.

---

## Evaluation

```bash
python test.py
```

Loads the saved checkpoint and evaluates on the test set. Outputs all metrics to console.

---

## Evaluation Metrics

The model reports five metrics:

| Metric | Definition | Why it matters here |
|--------|-----------|---------------------|
| **Accuracy** | Correct predictions / total | Useful baseline; misleading on imbalanced data |
| **Precision** (fake) | TP / (TP + FP) | How often "predicted fake" is actually fake — low = too many false alarms |
| **Recall** (fake) | TP / (TP + FN) | How many real fakes are caught — low = dangerous misses |
| **F1** (fake) | Harmonic mean of P & R | Single number balancing precision and recall |
| **Confusion Matrix** | TN / FP / FN / TP | Shows which error type dominates |

Precision, Recall, and F1 use `average='binary'` with **fake (1) as the positive class** — because the task objective is to detect fake news, not to be evaluated on how well the model identifies real posts.

**Why not just accuracy?** If the test set is 70% real, a model that always predicts "real" achieves 70% accuracy but catches zero fake news. F1 captures this failure; accuracy does not.

---

## Experimental Results

| Dataset | Model | Accuracy | Precision | Recall | F1 |
|---------|-------|----------|-----------|--------|-----|
| Twitter | BERT + VGG-19 (frozen) | — | — | — | — |
| Twitter | BERT + VGG-19 (fine-tuned) | — | — | — | — |

> Results pending. Fill in after running `python main.py`.

---

## Training Logs

Each training run writes to `logs/train.log` (overwritten on each run). Log format:

```
2024-04-22 14:32:01 | INFO     | Dataset split — train: 12029, val: 1337, test: 1111
2024-04-22 14:32:01 | INFO     | Training config — epochs=10, batch_size=8, lr=3e-05, patience=3, val_split=10%
2024-04-22 14:47:23 | INFO     | Epoch 1 | train_loss=0.689234 | val_loss=0.671102 | acc=58.34% | precision=61.20% | recall=54.10% | f1=57.43%
2024-04-22 14:47:23 | INFO     | Saved best model — epoch=1, val_loss=0.671102
...
2024-04-22 15:12:44 | WARNING  | EarlyStopping: no improvement 3/3
2024-04-22 15:12:44 | WARNING  | Early stopping triggered at epoch 7.
2024-04-22 15:13:01 | INFO     | TEST RESULTS | loss=0.612xxx | acc=68.45% | precision=71.20% | recall=65.80% | f1=68.39%
```

---

## Experiments

- Baseline (no augmentation):  
  👉 See details: `experiments/baseline.md`

Summary:
- Best validation loss: **0.038 (Epoch 4)**
- Accuracy: ~99%
- Slight overfitting observed after epoch 4

---

## Browser Extension Demo

A Manifest V3 Chrome extension lets you analyse any webpage in real time using the trained model via a local FastAPI backend.

### What the extension does

1. Extracts the visible page text (`document.body.innerText`)
2. Finds the largest visible image on the page
3. POSTs both to `http://localhost:8000/analyze`
4. Displays the risk level (`LOW` / `MEDIUM` / `HIGH`), the model's reasoning, and whether an image was used

### Run the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

The server starts at `http://localhost:8000`. The trained model is loaded once at startup (takes 5–15 seconds while BERT and VGG-19 weights load).

Interactive API docs: `http://localhost:8000/docs`

### Load the Chrome extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked** and select the `extension/` folder
4. The "Multi-False Detector" icon appears in the toolbar
5. Navigate to any news page and click the icon → **Analyse Current Page**

### Current limitation

The trained `Text_Concat_Vision` model requires **both** a text embedding and an image embedding — neither input alone is sufficient for calibrated output. When the extension finds an image URL on the page the backend downloads and preprocesses it for the model. If no image is found (or the download fails) the backend returns `MEDIUM` with a fallback message rather than running partial inference.

Full demo walkthrough and troubleshooting: [`docs/plugin-demo.md`](docs/plugin-demo.md)

---

## Future Work

- [ ] Replace VGG-19 with a Vision Transformer (ViT) or CLIP image encoder
- [ ] Add cross-attention between text and image token sequences instead of late fusion
- [ ] Fine-tune BERT on social media domain data before fusion
- [ ] Add explainability — gradient-based saliency maps for image regions, attention weights for text
- [ ] Extend to multilingual BERT for joint Chinese/English modeling
- [ ] REST API + lightweight web UI for real-time post verification

---

## Changelog

### [0.3.0] — Chrome Extension + FastAPI Backend
- **Chrome extension prototype** added (`extension/`): extracts visible text and the largest image from any page, displays risk level in a popup
- **FastAPI backend** added (`backend/`): `POST /analyze` endpoint, CORS-enabled, returns `{ risk, reason, used_image }`
- **Real model loading** connected: `Text_Concat_Vision` checkpoint (`saved_models/best_model.pt`) loaded once at server startup via `model_service.py`
- **Multimodal inference path** prepared: if `image_url` is provided, the backend downloads the image, applies the training eval transform (Resize 224 → ToTensor → ImageNet normalise), and passes both text and image through the model; falls back to `MEDIUM` with an explanation when no image is available

---

## License

This project is for academic and research purposes. No license has been explicitly attached — if you intend to build on this work, please open an issue to discuss.
