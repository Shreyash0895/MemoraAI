"""
MemoraAI face service.

Stateless: it only turns a photo into face fingerprints (128-number embeddings).
The Node API stores the fingerprints in SQLite and does the matching.

Models (OpenCV Zoo): YuNet detects faces, SFace turns a face into an embedding.
"""
import os
import threading

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Request
from starlette.concurrency import run_in_threadpool

MODEL_DIR = os.environ.get("MODEL_DIR", "/models")
DETECTOR_PATH = os.path.join(MODEL_DIR, "face_detection_yunet_2023mar.onnx")
RECOGNIZER_PATH = os.path.join(MODEL_DIR, "face_recognition_sface_2021dec.onnx")

MAX_BYTES = 4 * 1024 * 1024   # reject huge uploads
MAX_SIDE = 1280               # larger images are shrunk before detection
MAX_FACES = 5

detector = cv2.FaceDetectorYN.create(DETECTOR_PATH, "", (320, 320), 0.85, 0.3, 5000)
recognizer = cv2.FaceRecognizerSF.create(RECOGNIZER_PATH, "")
lock = threading.Lock()       # the detector keeps per-call state (input size)

app = FastAPI(title="MemoraAI face service")


def embed_image(data: bytes) -> dict:
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("could not decode image")

    h, w = img.shape[:2]
    scale = min(1.0, MAX_SIDE / max(h, w))
    if scale < 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        h, w = img.shape[:2]

    faces_out = []
    with lock:
        detector.setInputSize((w, h))
        _, faces = detector.detect(img)
        if faces is not None:
            largest_first = sorted(faces, key=lambda r: float(r[2]) * float(r[3]), reverse=True)
            for face in largest_first[:MAX_FACES]:
                aligned = recognizer.alignCrop(img, face)
                feature = recognizer.feature(aligned)
                faces_out.append({
                    "box": [int(round(float(v))) for v in face[:4]],   # x, y, width, height
                    "score": float(face[14]),
                    "embedding": [float(v) for v in feature.flatten()],
                })
    return {"width": int(w), "height": int(h), "faces": faces_out}


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/embed")
async def embed(request: Request):
    data = await request.body()
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="invalid image size")
    try:
        return await run_in_threadpool(embed_image, data)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
