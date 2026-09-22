import os
import asyncio
import threading
from datetime import datetime

import cv2
import numpy as np
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

from database import get_connection, create_table


# ============================================================
# SENTINEL AI
# YOLO + BYTE TRACK + VIRTUAL FENCE + RISK + INCIDENTS
# ============================================================

app = FastAPI(
    title="SentinelAI API",
    description="AI-powered security incident monitoring system",
    version="2.0"
)


# ============================================================
# CONFIGURATION
# ============================================================

MODEL_NAME = "yolov8n.pt"

CONFIDENCE_THRESHOLD = 0.45

CAMERA_NAME = "C04"
ZONE_NAME = "Restricted Zone B"

# Original reference resolution
REFERENCE_WIDTH = 1280
REFERENCE_HEIGHT = 720

# Virtual restricted zone
ZONE_X1 = 500
ZONE_Y1 = 250
ZONE_X2 = 900
ZONE_Y2 = 600

TRACK_TIMEOUT = 30


# ============================================================
# YOLO MODEL
# ============================================================

MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "vision",
    "yolov8n.pt"
)

print("Loading SentinelAI YOLO model from:")
print(MODEL_PATH)

model = YOLO(MODEL_PATH)

print("YOLO model loaded successfully.")


# ============================================================
# THREAD LOCK
# ============================================================

# YOLO/ByteTrack state must not be accessed concurrently.
model_lock = threading.Lock()


# ============================================================
# TRACKING STATE
# ============================================================

tracking_state = {}

previous_positions = {}
entry_times = {}
incident_created = {}


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "https://sentinel-ai-frontend-xufy.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DATABASE
# ============================================================

create_table()


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "SentinelAI",
        "model": "YOLOv8n",
        "tracker": "ByteTrack"
    }


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():
    return {
        "system": "SentinelAI",
        "status": "online",
        "message": "AI security monitoring API is running"
    }


# ============================================================
# INCIDENTS
# ============================================================

@app.get("/incidents")
def get_incidents():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT * FROM incidents ORDER BY id DESC"
    )

    rows = cursor.fetchall()

    connection.close()

    return [dict(row) for row in rows]


# ============================================================
# CREATE MANUAL INCIDENT
# ============================================================

@app.post("/incidents")
def create_incident(incident: dict):

    connection = get_connection()
    cursor = connection.cursor()

    created_at = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    cursor.execute(
        """
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
        """,
        (
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
        )
    )

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

    cursor.execute(
        """
        UPDATE incidents
        SET status = ?
        WHERE id = ?
        """,
        ("Verified", incident_id)
    )

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

    cursor.execute(
        """
        UPDATE incidents
        SET status = ?
        WHERE id = ?
        """,
        ("Dismissed", incident_id)
    )

    connection.commit()
    connection.close()

    return {
        "message": "Incident dismissed",
        "incident_id": incident_id
    }


# ============================================================
# ZONE CALCULATION
# ============================================================

def get_scaled_zone(width, height):

    scale_x = width / REFERENCE_WIDTH
    scale_y = height / REFERENCE_HEIGHT

    return {
        "x1": int(ZONE_X1 * scale_x),
        "y1": int(ZONE_Y1 * scale_y),
        "x2": int(ZONE_X2 * scale_x),
        "y2": int(ZONE_Y2 * scale_y)
    }


# ============================================================
# INSIDE ZONE
# ============================================================

def is_inside_zone(x, y, zone):

    return (
        zone["x1"] <= x <= zone["x2"]
        and
        zone["y1"] <= y <= zone["y2"]
    )


# ============================================================
# DISTANCE TO ZONE
# ============================================================

def distance_to_zone(x, y, zone):

    dx = max(
        zone["x1"] - x,
        0,
        x - zone["x2"]
    )

    dy = max(
        zone["y1"] - y,
        0,
        y - zone["y2"]
    )

    return (dx ** 2 + dy ** 2) ** 0.5


# ============================================================
# MOVEMENT
# ============================================================

def calculate_movement(track_id, current_x, current_y):

    previous = previous_positions.get(track_id)

    previous_positions[track_id] = (
        current_x,
        current_y
    )

    if previous is None:
        return "UNKNOWN"

    previous_x, previous_y = previous

    dx = current_x - previous_x
    dy = current_y - previous_y

    if abs(dx) < 5 and abs(dy) < 5:
        return "STATIONARY"

    if abs(dy) > abs(dx):

        if dy > 0:
            return "NORTH → SOUTH"

        return "SOUTH → NORTH"

    if dx > 0:
        return "WEST → EAST"

    return "EAST → WEST"


# ============================================================
# RISK
# ============================================================

def calculate_risk(duration):

    current_hour = datetime.now().hour

    night_context = (
        current_hour >= 20
        or current_hour < 6
    )

    risk_score = 40

    if night_context:
        risk_score += 20

    if duration >= 10:
        risk_score += 15

    if risk_score >= 61:
        risk_level = "HIGH"

    elif risk_score >= 31:
        risk_level = "MEDIUM"

    else:
        risk_level = "LOW"

    return (
        risk_score,
        risk_level,
        night_context
    )


# ============================================================
# CREATE AUTOMATIC INCIDENT
# ============================================================

def create_automatic_incident(
    track_id,
    movement,
    duration,
    risk_score,
    risk_level
):

    try:

        connection = get_connection()
        cursor = connection.cursor()

        created_at = datetime.now().strftime(
            "%Y-%m-%d %H:%M:%S"
        )

        cursor.execute(
            """
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
            """,
            (
                "Restricted-Zone Intrusion",
                CAMERA_NAME,
                ZONE_NAME,
                track_id,
                movement,
                duration,
                risk_score,
                risk_level,
                created_at,
                "Awaiting Verification"
            )
        )

        connection.commit()

        incident_id = cursor.lastrowid

        connection.close()

        incident_created[track_id] = incident_id

        print(
            "INTRUSION DETECTED | "
            f"Person ID: {track_id} | "
            f"Incident: {incident_id} | "
            f"Risk: {risk_level}"
        )

        return incident_id

    except Exception as error:

        print(
            "Incident creation error:",
            error
        )

        return None


# ============================================================
# UPDATE ACTIVE INCIDENT
# ============================================================

def update_incident(
    incident_id,
    duration,
    risk_score,
    risk_level
):

    try:

        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            UPDATE incidents
            SET duration = ?,
                risk_score = ?,
                risk_level = ?
            WHERE id = ?
            """,
            (
                duration,
                risk_score,
                risk_level,
                incident_id
            )
        )

        connection.commit()
        connection.close()

    except Exception as error:

        print(
            "Incident update error:",
            error
        )


# ============================================================
# CLEAN OLD TRACKS
# ============================================================

def cleanup_tracks():

    now = datetime.now().timestamp()

    expired = []

    for track_id, state in tracking_state.items():

        last_seen = state.get(
            "last_seen",
            now
        )

        if now - last_seen > TRACK_TIMEOUT:

            expired.append(track_id)

    for track_id in expired:

        tracking_state.pop(
            track_id,
            None
        )

        previous_positions.pop(
            track_id,
            None
        )

        entry_times.pop(
            track_id,
            None
        )

        incident_created.pop(
            track_id,
            None
        )


# ============================================================
# YOLO DETECTION
# ============================================================

def process_frame(frame):

    height, width = frame.shape[:2]

    zone = get_scaled_zone(
        width,
        height
    )

    detections = []

    intrusion_detected = False

    active_intrusions = 0

    # IMPORTANT:
    # ByteTrack state is kept sequentially.
    with model_lock:

        results = model.track(
            frame,
            persist=True,
            tracker="bytetrack.yaml",
            conf=CONFIDENCE_THRESHOLD,
            classes=[0],
            imgsz=640,
            verbose=False
        )

    if not results:

        return {
            "success": True,
            "camera": CAMERA_NAME,
            "zone": zone,
            "detections": [],
            "count": 0,
            "intrusion_detected": False,
            "active_intrusions": 0
        }

    result = results[0]

    if result.boxes is None:

        return {
            "success": True,
            "camera": CAMERA_NAME,
            "zone": zone,
            "detections": [],
            "count": 0,
            "intrusion_detected": False,
            "active_intrusions": 0
        }

    boxes = result.boxes

    ids = boxes.id

    for i in range(len(boxes)):

        cls_id = int(
            boxes.cls[i].item()
        )

        confidence = float(
            boxes.conf[i].item()
        )

        if cls_id != 0:
            continue

        x1, y1, x2, y2 = (
            boxes.xyxy[i].tolist()
        )

        x1 = int(x1)
        y1 = int(y1)
        x2 = int(x2)
        y2 = int(y2)

        if ids is not None:

            track_id = int(
                ids[i].item()
            )

        else:

            track_id = i

        # Bottom-center of person
        center_x = int(
            (x1 + x2) / 2
        )

        foot_y = int(y2)

        inside = is_inside_zone(
            center_x,
            foot_y,
            zone
        )

        movement = calculate_movement(
            track_id,
            center_x,
            foot_y
        )

        now_timestamp = (
            datetime.now().timestamp()
        )

        state = tracking_state.get(
            track_id
        )

        previous_inside = False

        previous_distance = None

        if state:

            previous_inside = state.get(
                "inside",
                False
            )

            previous_distance = state.get(
                "distance"
            )

        current_distance = distance_to_zone(
            center_x,
            foot_y,
            zone
        )

        # Determine event
        if inside and not previous_inside:

            event = "ENTERED"

        elif inside and previous_inside:

            event = "INSIDE"

        elif not inside and previous_inside:

            event = "EXITED"

        elif (
            not inside
            and previous_distance is not None
            and current_distance < previous_distance
        ):

            event = "APPROACHING"

        elif (
            not inside
            and previous_distance is not None
            and current_distance > previous_distance
        ):

            event = "MOVING_AWAY"

        else:

            event = "OUTSIDE"

        # Start timer on entry
        if inside and track_id not in entry_times:

            entry_times[track_id] = (
                now_timestamp
            )

        # Remove timer after exit
        if not inside and track_id in entry_times:

            if previous_inside:

                entry_times.pop(
                    track_id,
                    None
                )

        # Duration
        if track_id in entry_times:

            duration = round(
                now_timestamp
                - entry_times[track_id],
                1
            )

        else:

            duration = 0

        risk_score, risk_level, night_context = (
            calculate_risk(duration)
        )

        incident_id = incident_created.get(
            track_id
        )

        # New intrusion
        if (
            event == "ENTERED"
            and incident_id is None
        ):

            incident_id = create_automatic_incident(
                track_id,
                movement,
                duration,
                risk_score,
                risk_level
            )

        # Update active intrusion
        elif (
            inside
            and incident_id is not None
        ):

            update_incident(
                incident_id,
                duration,
                risk_score,
                risk_level
            )

        if inside:

            intrusion_detected = True

            active_intrusions += 1

        # Save tracking state
        tracking_state[track_id] = {
            "inside": inside,
            "distance": current_distance,
            "last_seen": now_timestamp
        }

        detections.append(
            {
                "label": "person",
                "track_id": track_id,
                "confidence": round(
                    confidence,
                    3
                ),
                "box": [
                    x1,
                    y1,
                    x2,
                    y2
                ],
                "position": [
                    center_x,
                    foot_y
                ],
                "inside_zone": inside,
                "zone_status": (
                    "INSIDE"
                    if inside
                    else "OUTSIDE"
                ),
                "event": event,
                "entered_zone": (
                    event == "ENTERED"
                ),
                "exited_zone": (
                    event == "EXITED"
                ),
                "approaching_zone": (
                    event == "APPROACHING"
                ),
                "movement": movement,
                "duration": duration,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "night_context": night_context,
                "incident_id": incident_id
            }
        )

    cleanup_tracks()

    return {
        "success": True,
        "camera": CAMERA_NAME,
        "frame": {
            "width": width,
            "height": height
        },
        "zone": zone,
        "detections": detections,
        "count": len(detections),
        "intrusion_detected": intrusion_detected,
        "active_intrusions": active_intrusions,
        "system": {
            "model": "YOLOv8n",
            "tracker": "ByteTrack",
            "confidence": CONFIDENCE_THRESHOLD
        }
    }


# ============================================================
# DETECT FRAME
# ============================================================

@app.post("/detect")
async def detect_frame(request: Request):

    try:

        image_bytes = await request.body()

        if not image_bytes:

            return {
                "success": False,
                "error": "No image received"
            }

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

        # Run CPU-heavy YOLO work outside
        # the FastAPI event loop.
        result = await asyncio.to_thread(
            process_frame,
            frame
        )

        return result

    except Exception as error:

        print(
            "Detection error:",
            repr(error)
        )

        return {
            "success": False,
            "error": str(error)
        }
