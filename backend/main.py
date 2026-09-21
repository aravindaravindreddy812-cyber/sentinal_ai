from fastapi import FastAPI, Request
import cv2
import numpy as np
from ultralytics import YOLO
from fastapi.middleware.cors import CORSMiddleware
from database import get_connection, create_table
from datetime import datetime
from pathlib import Path


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="SentinelAI API",
    description="AI-powered security incident monitoring system",
    version="1.0"
)


# ============================================================
# YOLO MODEL
# ============================================================

# backend/main.py
# Model is stored in:
# vision/yolov8n.pt

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR.parent / "vision" / "yolov8n.pt"

model = YOLO(str(MODEL_PATH))


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://localhost:5173",
        "https://sentinel-ai-frontend-xufy.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DATABASE
# ============================================================

# Create database table when server starts
create_table()


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():
    return {
        "system": "SentinelAI",
        "status": "online",
        "message": "Security monitoring API is running"
    }


# ============================================================
# GET ALL INCIDENTS
# ============================================================

@app.get("/incidents")
def get_incidents():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT * FROM incidents ORDER BY id DESC
    """)

    rows = cursor.fetchall()

    connection.close()

    return [dict(row) for row in rows]


# ============================================================
# CREATE INCIDENT
# ============================================================

@app.post("/incidents")
def create_incident(incident: dict):

    connection = get_connection()
    cursor = connection.cursor()

    created_at = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    cursor.execute("""
        INSERT INTO incidents (
            type,
            camera,
            zone,
            person_id,
            movement,
            duration,
            risk_score,
            risk_level,
            created_at,
            status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        incident.get("type"),
        incident.get("camera"),
        incident.get("zone"),
        incident.get("person_id"),
        incident.get("movement"),
        incident.get("duration"),
        incident.get("risk_score"),
        incident.get("risk_level"),
        created_at,
        "Awaiting Verification"
    ))

    connection.commit()

    incident_id = cursor.lastrowid

    connection.close()

    return {
        "message": "Incident created successfully",
        "incident_id": incident_id
    }


# ============================================================
# VERIFY INCIDENT
# ============================================================

@app.put("/incidents/{incident_id}/verify")
def verify_incident(incident_id: int):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        UPDATE incidents
        SET status = ?
        WHERE id = ?
    """, (
        "Verified",
        incident_id
    ))

    connection.commit()

    connection.close()

    return {
        "message": "Incident verified",
        "incident_id": incident_id
    }


# ============================================================
# DISMISS INCIDENT
# ============================================================

@app.put("/incidents/{incident_id}/dismiss")
def dismiss_incident(incident_id: int):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        UPDATE incidents
        SET status = ?
        WHERE id = ?
    """, (
        "Dismissed",
        incident_id
    ))

    connection.commit()

    connection.close()

    return {
        "message": "Incident dismissed",
        "incident_id": incident_id
    }


# ============================================================
# YOLO WEBCAM FRAME DETECTION
# ============================================================

@app.post("/detect")
async def detect_frame(request: Request):

    try:

        # ----------------------------------------------------
        # Receive image from browser
        # ----------------------------------------------------

        image_bytes = await request.body()

        if not image_bytes:
            return {
                "success": False,
                "error": "No image received"
            }


        # ----------------------------------------------------
        # Convert bytes -> OpenCV image
        # ----------------------------------------------------

        image_array = np.frombuffer(
            image_bytes,
            dtype=np.uint8
        )

        frame = cv2.imdecode(
            image_array,
            cv2.IMREAD_COLOR
        )

        if frame is None:
            return {
                "success": False,
                "error": "Could not decode image"
            }


        # ----------------------------------------------------
        # Run YOLO
        # ----------------------------------------------------

        results = model(
            frame,
            verbose=False
        )


        # ----------------------------------------------------
        # Extract detections
        # ----------------------------------------------------

        detections = []

        for result in results:

            if result.boxes is None:
                continue

            boxes = result.boxes

            for i in range(len(boxes)):

                cls_id = int(
                    boxes.cls[i].item()
                )

                confidence = float(
                    boxes.conf[i].item()
                )

                label = model.names[cls_id]

                x1, y1, x2, y2 = (
                    boxes.xyxy[i].tolist()
                )

                detections.append({
                    "label": label,
                    "confidence": round(
                        confidence,
                        3
                    ),
                    "box": [
                        round(x1),
                        round(y1),
                        round(x2),
                        round(y2)
                    ]
                })


        # ----------------------------------------------------
        # Return detection result
        # ----------------------------------------------------

        return {
            "success": True,
            "detections": detections,
            "count": len(detections)
        }


    except Exception as e:

        return {
            "success": False,
            "error": str(e)
        }
