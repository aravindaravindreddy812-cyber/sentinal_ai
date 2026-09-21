from fastapi import FastAPI, Request
import cv2
import numpy as np
from ultralytics import YOLO
from fastapi.middleware.cors import CORSMiddleware
from database import get_connection, create_table
from datetime import datetime
import math


app = FastAPI(
    title="SentinelAI API",
    description="AI-powered security incident monitoring system",
    version="2.0"
)


# ============================================================
# YOLO MODEL
# ============================================================

model = YOLO("yolov8n.pt")


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://sentinel-ai-frontend-xufy.onrender.com",
        "http://localhost:5173",
        "http://localhost:5174"
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
# SECURITY CONFIGURATION
# ============================================================

CAMERA_ID = "C04"
ZONE_NAME = "Restricted Zone B"

# Original reference resolution
REFERENCE_WIDTH = 1280
REFERENCE_HEIGHT = 720

# Original restricted zone
ZONE_X1 = 500
ZONE_Y1 = 250
ZONE_X2 = 900
ZONE_Y2 = 600

CONFIDENCE_THRESHOLD = 0.45

# Tracking state
tracking_state = {}

# Remove lost tracks after this many seconds
TRACK_TIMEOUT = 30


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():
    return {
        "system": "SentinelAI",
        "status": "online",
        "version": "2.0",
        "camera": CAMERA_ID,
        "zone": ZONE_NAME,
        "message": "AI security monitoring API is running"
    }


# ============================================================
# GET ALL INCIDENTS
# ============================================================

@app.get("/incidents")
def get_incidents():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT *
        FROM incidents
        ORDER BY id DESC
    """)

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

    cursor.execute("""
        INSERT INTO incidents
        (
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
    """, ("Verified", incident_id))

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
    """, ("Dismissed", incident_id))

    connection.commit()
    connection.close()

    return {
        "message": "Incident dismissed",
        "incident_id": incident_id
    }


# ============================================================
# SCALE RESTRICTED ZONE TO CURRENT FRAME
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
# CHECK WHETHER POINT IS INSIDE ZONE
# ============================================================

def is_inside_zone(x, y, zone):

    return (
        zone["x1"] <= x <= zone["x2"]
        and
        zone["y1"] <= y <= zone["y2"]
    )


# ============================================================
# DISTANCE FROM POINT TO ZONE
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

    return math.sqrt(
        dx * dx + dy * dy
    )


# ============================================================
# MOVEMENT DIRECTION
# ============================================================

def calculate_movement(previous, current):

    if previous is None:
        return "STATIONARY"

    px, py = previous
    cx, cy = current

    dx = cx - px
    dy = cy - py

    threshold = 5

    if abs(dx) < threshold and abs(dy) < threshold:
        return "STATIONARY"

    if abs(dy) >= abs(dx):

        if dy > threshold:
            return "SOUTH"

        if dy < -threshold:
            return "NORTH"

    else:

        if dx > threshold:
            return "EAST"

        if dx < -threshold:
            return "WEST"

    return "MOVING"


# ============================================================
# RISK CALCULATION
# ============================================================

def calculate_risk(duration, movement, night):

    score = 40

    # Night-time movement
    if night:
        score += 20

    # Long duration inside restricted area
    if duration >= 10:
        score += 15

    elif duration >= 5:
        score += 10

    # Movement adds risk
    if movement != "STATIONARY":
        score += 5

    score = min(score, 100)

    if score >= 70:
        level = "HIGH"

    elif score >= 50:
        level = "MEDIUM"

    else:
        level = "LOW"

    return score, level


# ============================================================
# CREATE AUTOMATIC INCIDENT
# ============================================================

def create_automatic_incident(
    person_id,
    movement,
    duration,
    risk_score,
    risk_level
):

    connection = get_connection()
    cursor = connection.cursor()

    created_at = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    cursor.execute("""
        INSERT INTO incidents
        (
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
        "Restricted-Zone Intrusion",
        CAMERA_ID,
        ZONE_NAME,
        person_id,
        movement,
        duration,
        risk_score,
        risk_level,
        created_at,
        "Awaiting Verification"
    ))

    connection.commit()

    incident_id = cursor.lastrowid

    connection.close()

    return incident_id


# ============================================================
# UPDATE ACTIVE INCIDENT
# ============================================================

def update_incident(
    incident_id,
    movement,
    duration,
    risk_score,
    risk_level
):

    if incident_id is None:
        return

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        UPDATE incidents
        SET
            movement = ?,
            duration = ?,
            risk_score = ?,
            risk_level = ?
        WHERE id = ?
    """, (
        movement,
        duration,
        risk_score,
        risk_level,
        incident_id
    ))

    connection.commit()
    connection.close()


# ============================================================
# DETECTION + TRACKING + INTRUSION INTELLIGENCE
# ============================================================

@app.post("/detect")
async def detect_frame(request: Request):

    try:

        # ----------------------------------------------------
        # RECEIVE IMAGE
        # ----------------------------------------------------

        image_bytes = await request.body()

        if not image_bytes:

            return {
                "success": False,
                "error": "No image received"
            }


        # ----------------------------------------------------
        # DECODE IMAGE
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


        height, width = frame.shape[:2]


        # ----------------------------------------------------
        # SCALE ZONE
        # ----------------------------------------------------

        zone = get_scaled_zone(
            width,
            height
        )


        # ----------------------------------------------------
        # YOLO + BYTE TRACK
        # ----------------------------------------------------

        results = model.track(
            frame,
            persist=True,
            tracker="bytetrack.yaml",
            conf=CONFIDENCE_THRESHOLD,
            classes=[0],
            verbose=False
        )


        detections = []

        active_track_ids = set()

        intrusion_detected = False

        active_intrusions = []


        # ----------------------------------------------------
        # PROCESS TRACKS
        # ----------------------------------------------------

        for result in results:

            if result.boxes is None:
                continue

            boxes = result.boxes

            if boxes.id is None:
                continue


            for i in range(len(boxes)):

                cls_id = int(
                    boxes.cls[i].item()
                )

                confidence = float(
                    boxes.conf[i].item()
                )

                track_id = int(
                    boxes.id[i].item()
                )

                label = model.names[cls_id]

                x1, y1, x2, y2 = (
                    boxes.xyxy[i].tolist()
                )


                # ------------------------------------------------
                # PERSON REFERENCE POINT
                # Bottom-center = approximate foot position
                # ------------------------------------------------

                center_x = int(
                    (x1 + x2) / 2
                )

                foot_y = int(y2)

                current_position = (
                    center_x,
                    foot_y
                )


                inside_zone = is_inside_zone(
                    center_x,
                    foot_y,
                    zone
                )


                active_track_ids.add(
                    track_id
                )


                # ------------------------------------------------
                # TRACK STATE
                # ------------------------------------------------

                previous_state = tracking_state.get(
                    track_id
                )

                previous_position = None

                previous_inside = False

                previous_distance = None

                entry_time = None

                incident_id = None


                if previous_state:

                    previous_position = (
                        previous_state.get(
                            "position"
                        )
                    )

                    previous_inside = (
                        previous_state.get(
                            "inside",
                            False
                        )
                    )

                    previous_distance = (
                        previous_state.get(
                            "distance"
                        )
                    )

                    entry_time = (
                        previous_state.get(
                            "entry_time"
                        )
                    )

                    incident_id = (
                        previous_state.get(
                            "incident_id"
                        )
                    )


                # ------------------------------------------------
                # CURRENT DISTANCE TO ZONE
                # ------------------------------------------------

                current_distance = distance_to_zone(
                    center_x,
                    foot_y,
                    zone
                )


                # ------------------------------------------------
                # MOVEMENT
                # ------------------------------------------------

                movement = calculate_movement(
                    previous_position,
                    current_position
                )


                # ------------------------------------------------
                # TIME
                # ------------------------------------------------

                now = datetime.now()


                if inside_zone:

                    if not previous_inside:

                        # Person has just entered
                        entry_time = now

                    if entry_time is None:

                        entry_time = now

                    duration = (
                        now - entry_time
                    ).total_seconds()

                else:

                    if previous_inside:

                        duration = (
                            now - entry_time
                        ).total_seconds()

                    else:

                        duration = 0


                # ------------------------------------------------
                # NIGHT CONTEXT
                # ------------------------------------------------

                hour = now.hour

                night_context = (
                    hour >= 20
                    or
                    hour < 6
                )


                # ------------------------------------------------
                # DETERMINE EVENT
                # ------------------------------------------------

                if previous_state is None:

                    if inside_zone:

                        event = "ENTERED"

                        zone_status = "ENTERED"

                    else:

                        event = "DETECTED"

                        zone_status = "OUTSIDE"


                elif (
                    not previous_inside
                    and inside_zone
                ):

                    event = "ENTERED"

                    zone_status = "ENTERED"


                elif (
                    previous_inside
                    and not inside_zone
                ):

                    event = "EXITED"

                    zone_status = "EXITED"


                elif inside_zone:

                    event = "INSIDE"

                    zone_status = "INSIDE"


                else:

                    # Person is outside
                    # Check whether they are approaching

                    if (
                        previous_distance is not None
                        and
                        current_distance
                        < previous_distance - 5
                    ):

                        event = "APPROACHING"

                        zone_status = "APPROACHING"

                    elif (
                        previous_distance is not None
                        and
                        current_distance
                        > previous_distance + 5
                    ):

                        event = "MOVING_AWAY"

                        zone_status = "OUTSIDE"

                    else:

                        event = "OUTSIDE"

                        zone_status = "OUTSIDE"


                # ------------------------------------------------
                # RISK
                # ------------------------------------------------

                if inside_zone:

                    risk_score, risk_level = calculate_risk(
                        duration,
                        movement,
                        night_context
                    )

                else:

                    risk_score = 0

                    risk_level = "LOW"


                # ------------------------------------------------
                # CREATE INCIDENT WHEN ENTERING
                # ------------------------------------------------

                if (
                    event == "ENTERED"
                    and
                    incident_id is None
                ):

                    incident_id = create_automatic_incident(
                        person_id=track_id,
                        movement=movement,
                        duration=duration,
                        risk_score=risk_score,
                        risk_level=risk_level
                    )

                    intrusion_detected = True


                # ------------------------------------------------
                # UPDATE ACTIVE INCIDENT
                # ------------------------------------------------

                if (
                    inside_zone
                    and
                    incident_id is not None
                ):

                    update_incident(
                        incident_id=incident_id,
                        movement=movement,
                        duration=duration,
                        risk_score=risk_score,
                        risk_level=risk_level
                    )

                    active_intrusions.append({
                        "track_id": track_id,
                        "incident_id": incident_id,
                        "duration": round(
                            duration,
                            1
                        ),
                        "risk_score": risk_score,
                        "risk_level": risk_level
                    })


                # ------------------------------------------------
                # DETECTION RESPONSE
                # ------------------------------------------------

                detection = {

                    "label": label,

                    "track_id": track_id,

                    "confidence": round(
                        confidence,
                        3
                    ),

                    "box": [
                        round(x1),
                        round(y1),
                        round(x2),
                        round(y2)
                    ],

                    "position": [
                        center_x,
                        foot_y
                    ],

                    "inside_zone": inside_zone,

                    "zone_status": zone_status,

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

                    "duration": round(
                        duration,
                        1
                    ),

                    "risk_score": risk_score,

                    "risk_level": risk_level,

                    "night_context": night_context,

                    "incident_id": incident_id
                }


                detections.append(
                    detection
                )


                # ------------------------------------------------
                # SAVE TRACK STATE
                # ------------------------------------------------

                tracking_state[track_id] = {

                    "position": current_position,

                    "inside": inside_zone,

                    "distance": current_distance,

                    "entry_time": entry_time,

                    "incident_id": incident_id,

                    "last_seen": now
                }


        # ========================================================
        # CLEAN OLD TRACKS
        # ========================================================

        now = datetime.now()

        expired_tracks = []

        for track_id, state in tracking_state.items():

            last_seen = state.get(
                "last_seen"
            )

            if last_seen is None:
                continue

            elapsed = (
                now - last_seen
            ).total_seconds()

            if elapsed > TRACK_TIMEOUT:

                expired_tracks.append(
                    track_id
                )


        for track_id in expired_tracks:

            del tracking_state[
                track_id
            ]


        # ========================================================
        # RESPONSE
        # ========================================================

        return {

            "success": True,

            "camera": CAMERA_ID,

            "frame": {
                "width": width,
                "height": height
            },

            "zone": {
                "name": ZONE_NAME,
                "x1": zone["x1"],
                "y1": zone["y1"],
                "x2": zone["x2"],
                "y2": zone["y2"]
            },

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


    except Exception as e:

        return {

            "success": False,

            "error": str(e)

        }
