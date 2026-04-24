# backend/main.py
#
# FastAPI server for the Multi-False Detector extension.
#
# Run with:
#   uvicorn main:app --reload
#
# Routing logic:
#   image_url present and downloadable → predict(text, image_tensor)  [real model]
#   image_url missing or download fails → predict_text_only(text)      [fallback]

from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Importing model_service triggers model loading (BERT + VGG19).
# This happens once when uvicorn starts, not on every request.
from model_service import load_image_from_url, predict, predict_text_only

app = FastAPI(title="Multi-False Detector API", version="0.3.0")

# Allow the Chrome extension (and local dev tools) to reach this API.
# In production, replace "*" with your actual extension origin or domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Request / response schemas
# --------------------------------------------------------------------------- #

class AnalyseRequest(BaseModel):
    text: str
    image_url: Optional[str] = None


class AnalyseResponse(BaseModel):
    risk: str        # "LOW" | "MEDIUM" | "HIGH"
    reason: str
    used_image: bool # True when the real model ran with an image; False for fallback


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #

@app.post("/analyze", response_model=AnalyseResponse)
def analyze(request: AnalyseRequest) -> AnalyseResponse:
    """
    Analyse page text (and optionally an image) for misinformation risk.

    Decision tree:
      1. image_url provided → download + preprocess → run full multimodal model
         - If download or preprocessing fails, fall back to text-only
      2. No image_url → text-only fallback (model requires paired image)
    """
    if request.image_url:
        try:
            image_tensor = load_image_from_url(request.image_url)
            result = predict(request.text, image_tensor)
            return AnalyseResponse(**result, used_image=True)
        except Exception as exc:
            # Surface the fallback reason so it's visible in the extension
            fallback_reason = (
                f"Image could not be loaded ({type(exc).__name__}); "
                "text-only fallback used."
            )
            return AnalyseResponse(risk="MEDIUM", reason=fallback_reason, used_image=False)

    # No image URL supplied
    result = predict_text_only(request.text)
    return AnalyseResponse(**result, used_image=False)
