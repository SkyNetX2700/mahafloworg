# Server-side YOLO model

Place the supplied YOLO `.pt` file in this directory and configure the API server with:

```text
YOLO_MODEL_PATH=/absolute/path/to/your-model.pt
YOLO_MODEL_NAME=your-model-name
```

The file is intentionally not bundled into the browser. The API loads it only for `/api/detect`, which accepts a base64 CCTV image and returns only class-0 person detections, bounding boxes, confidences, a count, and `Low` / `Medium` / `High` crowd level.

If no model is configured, `/api/health` reports a degraded state and `/api/detect` returns a clear setup error. It never returns simulated detections.