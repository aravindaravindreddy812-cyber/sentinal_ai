from fastapi import FastAPI, Request
import cv2
import numpy as np
from ultralytics import YOLO
from fastapi.middleware.cors import CORSMiddleware
from database import get_connection, create_table
from datetime import datetime
from pathlib import Path
import time

# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="SentinelAI API",
    description="AI-powered security incident monitoring system",
    version="1.0"
)


# ============================================================
# YOLO MODEL
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR.parent / "vision" / "yolov8n.pt"

model = YOLO(str(MODEL_PATH))


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
# TRACKING SETTINGS
# ============================================================

CONFIDENCE_THRESHOLD = 0.45

PERSISTENCE_TIME = 10

CAMERA_ID = "C04"

ZONE_NAME = "Restricted Zone B"


# ============================================================
# TRACKING STATE
# ============================================================

# Previous center position of each tracked person
previous_positions = {}


# Time when person entered restricted zone
entry_times = {}


# Whether an incident has already been created
# for the current zone entry
incident_created = {}


# Whether person was inside zone during previous frame
previous_inside = {}


# Last time each person was seen
last_seen = {}


# ============================================================
# ORIGINAL ZONE COORDINATES
# ============================================================

# These are based on your original 1280x720 prototype.

ZONE_X1 = 500
ZONE_Y1 = 250

ZONE_X2 = 900
ZONE_Y2 = 600


# ============================================================
# ROOT
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
        SELECT *
        FROM incidents
        ORDER BY id DESC
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
# HELPER:
# CHECK WHETHER PERSON IS INSIDE RESTRICTED ZONE
# ============================================================

def is_inside_zone(x, y, frame_width, frame_height):

    # Scale original 1280x720 zone
    # to whatever webcam resolution is received.

    scale_x = frame_width / 1280
    scale_y = frame_height / 720

    zx1 = ZONE_X1 * scale_x
    zy1 = ZONE_Y1 * scale_y

    zx2 = ZONE_X2 * scale_x
    zy2 = ZONE_Y2 * scale_y

    return (
        x >= zx1
        and x <= zx2
        and y >= zy1
        and y <= zy2
    )


# ============================================================
# HELPER:
# MOVEMENT DIRECTION
# ============================================================

def calculate_movement(previous, current):

    if previous is None:

        return "STATIONARY"

    previous_x, previous_y = previous

    current_x, current_y = current

    dx = current_x - previous_x

    dy = current_y - previous_y

    threshold = 8

    if abs(dx) < threshold and abs(dy) < threshold:

        return "STATIONARY"

    if abs(dx) > abs(dy):

        if dx > 0:
            return "WEST → EAST"

        return "EAST → WEST"

    else:

        if dy > 0:
            return "NORTH → SOUTH"

        return "SOUTH → NORTH"


# ============================================================
# HELPER:
# RISK SCORE
# ============================================================

def calculate_risk(duration):

    current_hour = datetime.now().hour

    is_night = (
        current_hour >= 20
        or current_hour < 6
    )

    # Base restricted-zone risk
    risk_score = 40

    # Night movement
    if is_night:

        risk_score += 20

    # Persistence
    if duration >= PERSISTENCE_TIME:

        risk_score += 15

    # Keep within 0–100
    risk_score = min(risk_score, 100)

    if risk_score >= 61:

        risk_level = "HIGH"

    elif risk_score >= 31:

        risk_level = "MEDIUM"

    else:

        risk_level = "LOW"

    return risk_score, risk_level, is_night


# ============================================================
# HELPER:
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

            track_id,

            movement,

            round(duration, 1),

            risk_score,

            risk_level,

            created_at,

            "Awaiting Verification"

        ))

        connection.commit()

        incident_id = cursor.lastrowid

        connection.close()

        print()
        print("======================================")
        print("🚨 INTRUSION DETECTED")
        print(f"Incident  : #{incident_id}")
        print(f"Person ID : {track_id}")
        print(f"Camera    : {CAMERA_ID}")
        print(f"Zone      : {ZONE_NAME}")
        print(f"Movement  : {movement}")
        print(f"Duration  : {round(duration, 1)} sec")
        print(f"Risk      : {risk_score}/100")
        print(f"Level     : {risk_level}")
        print("Status    : Awaiting Verification")
        print("======================================")
        print()

        return incident_id

    except Exception as e:

        print(
            "Automatic incident creation failed:",
            e
        )

        return None


# ============================================================
# DETECTION + TRACKING
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


        frame_height, frame_width = frame.shape[:2]


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

        current_time = time.time()

        active_track_ids = set()

        intrusion_detected = False

        active_intrusions = []


        # ----------------------------------------------------
        # PROCESS TRACKED PEOPLE
        # ----------------------------------------------------

        if (
            results
            and results[0].boxes is not None
            and results[0].boxes.id is not None
        ):

            boxes = results[0].boxes

            track_ids = boxes.id.int().tolist()

            confidences = boxes.conf.tolist()

            coordinates = boxes.xyxy.tolist()


            for track_id, confidence, box in zip(
                track_ids,
                confidences,
                coordinates
            ):

                track_id = int(track_id)

                confidence = float(confidence)

                x1, y1, x2, y2 = map(
                    int,
                    box
                )


                # ------------------------------------------------
                # PERSON CENTER
                # ------------------------------------------------

                center_x = int(
                    (x1 + x2) / 2
                )

                # Bottom-center is more useful
                # for zone crossing.
                center_y = int(y2)


                current_position = (
                    center_x,
                    center_y
                )


                # ------------------------------------------------
                # MOVEMENT
                # ------------------------------------------------

                previous_position = (
                    previous_positions.get(track_id)
                )

                movement = calculate_movement(
                    previous_position,
                    current_position
                )


                previous_positions[track_id] = (
                    current_position
                )

                last_seen[track_id] = current_time


                # ------------------------------------------------
                # ZONE STATUS
                # ------------------------------------------------

                inside_zone = is_inside_zone(
                    center_x,
                    center_y,
                    frame_width,
                    frame_height
                )


                was_inside = previous_inside.get(
                    track_id,
                    False
                )


                # ------------------------------------------------
                # ENTRY DETECTION
                # ------------------------------------------------

                entered_zone = (
                    inside_zone
                    and not was_inside
                )


                # ------------------------------------------------
                # START TIMER WHEN ENTERING
                # ------------------------------------------------

                if entered_zone:

                    entry_times[track_id] = (
                        current_time
                    )

                    incident_created[track_id] = False


                # ------------------------------------------------
                # IF INSIDE ZONE
                # ------------------------------------------------

                duration = 0

                risk_score = 0

                risk_level = "LOW"

                is_night = False


                if inside_zone:

                    intrusion_detected = True

                    # If entry time doesn't exist
                    # create it.
                    if track_id not in entry_times:

                        entry_times[track_id] = (
                            current_time
                        )

                    duration = (
                        current_time
                        - entry_times[track_id]
                    )


                    # Risk calculation

                    (
                        risk_score,
                        risk_level,
                        is_night
                    ) = calculate_risk(
                        duration
                    )


                    active_intrusions.append({

                        "person_id": track_id,

                        "duration": round(
                            duration,
                            1
                        ),

                        "movement": movement,

                        "risk_score": risk_score,

                        "risk_level": risk_level

                    })


                    # ------------------------------------------------
                    # CREATE INCIDENT ONLY ON ENTRY
                    # ------------------------------------------------

                    if (
                        entered_zone
                        and not incident_created.get(
                            track_id,
                            False
                        )
                    ):

                        create_automatic_incident(

                            track_id,

                            movement,

                            duration,

                            risk_score,

                            risk_level

                        )

                        incident_created[
                            track_id
                        ] = True


                else:

                    # Person is outside.

                    duration = 0

                    risk_score = 0

                    risk_level = "LOW"


                # ------------------------------------------------
                # SAVE CURRENT ZONE STATE
                # ------------------------------------------------

                previous_inside[
                    track_id
                ] = inside_zone


                # ------------------------------------------------
                # RESPONSE FOR THIS PERSON
                # ------------------------------------------------

                detections.append({

                    "label": "person",

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

                    "inside_zone": inside_zone,

                    "zone_status": (
                        "INSIDE"
                        if inside_zone
                        else "OUTSIDE"
                    ),

                    "entered_zone": entered_zone,

                    "movement": movement,

                    "duration": round(
                        duration,
                        1
                    ),

                    "risk_score": risk_score,

                    "risk_level": risk_level,

                    "night_context": is_night

                })


        # ----------------------------------------------------
        # CLEAN OLD TRACKS
        # ----------------------------------------------------

        cleanup_before = current_time - 30

        old_ids = [

            track_id

            for track_id, seen_time
            in last_seen.items()

            if seen_time < cleanup_before

        ]


        for track_id in old_ids:

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

            previous_inside.pop(
                track_id,
                None
            )

            last_seen.pop(
                track_id,
                None
            )


        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return {

            "success": True,

            "camera": CAMERA_ID,

            "zone": {

                "name": ZONE_NAME,

                "x1": ZONE_X1,

                "y1": ZONE_Y1,

                "x2": ZONE_X2,

                "y2": ZONE_Y2

            },

            "detections": detections,

            "count": len(detections),

            "intrusion_detected": (
                intrusion_detected
            ),

            "active_intrusions": (
                active_intrusions
            )

        }


    except Exception as e:

        print(
            "Detection error:",
            e
        )

        return {

            "success": False,

            "error": str(e)

        }
