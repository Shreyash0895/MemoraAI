FROM python:3.11-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Models from the OpenCV Zoo. The second URL is a fallback that serves the large file directly.
# The build fails loudly if a download is missing or only a small placeholder file arrived.
RUN mkdir -p /models \
 && curl -fsSL -o /models/face_detection_yunet_2023mar.onnx \
      https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx \
    || curl -fsSL -o /models/face_detection_yunet_2023mar.onnx \
      https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
RUN curl -fsSL -o /models/face_recognition_sface_2021dec.onnx \
      https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx \
    || curl -fsSL -o /models/face_recognition_sface_2021dec.onnx \
      https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx
RUN test "$(stat -c%s /models/face_detection_yunet_2023mar.onnx)" -gt 50000 \
 && test "$(stat -c%s /models/face_recognition_sface_2021dec.onnx)" -gt 1000000

COPY app.py selftest.py ./
RUN useradd --create-home app
USER app

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
