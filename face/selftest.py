"""
Run inside the container to check the models work on one of your photos:

    docker compose cp photo.jpg face:/tmp/photo.jpg
    docker compose exec face python selftest.py /tmp/photo.jpg
"""
import sys

import numpy as np

import app

if len(sys.argv) != 2:
    sys.exit("usage: python selftest.py /path/to/photo.jpg")

with open(sys.argv[1], "rb") as f:
    result = app.embed_image(f.read())

faces = result["faces"]
print(f"image {result['width']}x{result['height']}, faces found: {len(faces)}")
for i, face in enumerate(faces):
    emb = np.array(face["embedding"], dtype=np.float32)
    print(f"  face {i}: box={face['box']} detector_score={face['score']:.2f} embedding_length={len(emb)}")

if len(faces) == 1:
    a = np.array(faces[0]["embedding"], dtype=np.float32)
    same = float(a @ a / (np.linalg.norm(a) ** 2))
    print(f"self-similarity (should be 1.0): {same:.3f}")
    print("OK: models loaded and produced an embedding.")
elif not faces:
    print("No face detected. Try a clearer, front-facing photo.")
