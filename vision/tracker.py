import cv2
import time
import requests

from datetime import datetime
from ultralytics import YOLO


# ============================================================
# SENTINELAI - TRACKER + FASTAPI INTEGRATION
# ============================================================


# ============================================================
# 1. LOAD YOLO MODEL
# ============================================================

model = YOLO("yolov8n.pt")


# ============================================================
# 2. BACKEND CONFIGURATION
# ============================================================

# FastAPI endpoint
BACKEND_URL = "http://127.0.0.1:8000/incidents"

# Camera information
CAMERA_ID = "C04"

# Restricted zone name
ZONE_NAME = "Restricted Zone B"


# ============================================================
# 3. OPEN WEBCAM
# ============================================================

cap = cv2.VideoCapture(0)

# Try to use 1280x720 webcam resolution
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)


if not cap.isOpened():

    print("ERROR: Could not open webcam.")

    exit()


# ============================================================
# 4. CREATE LARGE RESIZABLE WINDOW
# ============================================================

window_name = "SentinelAI - Live CCTV"

cv2.namedWindow(
    window_name,
    cv2.WINDOW_NORMAL
)

cv2.resizeWindow(
    window_name,
    1280,
    720
)


# ============================================================
# 5. VIRTUAL RESTRICTED ZONE
# ============================================================

# These coordinates are for a 1280x720 frame.
#
# Change these values to move or resize
# the restricted area.

ZONE_X1 = 500
ZONE_Y1 = 250

ZONE_X2 = 900
ZONE_Y2 = 600


# ============================================================
# 6. TRACKING DATA
# ============================================================

# Previous center position of each person
previous_positions = {}


# Time when each person entered the zone
entry_times = {}


# Prevents duplicate incidents
incident_created = {}


# Stores time when person was last outside
outside_times = {}


# Local incident number
incident_number = 100


# ============================================================
# 7. SETTINGS
# ============================================================

# Detection confidence

CONFIDENCE_THRESHOLD = 0.45


# How long a person must remain inside
# before an incident is generated.

INCIDENT_TRIGGER_TIME = 2


# Persistence time for risk calculation

PERSISTENCE_TIME = 10


# ============================================================
# 8. SEND INCIDENT TO FASTAPI
# ============================================================

def send_incident_to_backend(
    person_id,
    movement,
    duration,
    risk_score,
    risk_level
):

    incident_data = {

        "type": "Restricted-Zone Intrusion",

        "camera": CAMERA_ID,

        "zone": ZONE_NAME,

        "person_id": int(person_id),

        "movement": movement,

        "duration": float(duration),

        "risk_score": int(risk_score),

        "risk_level": risk_level
    }


    try:

        response = requests.post(

            BACKEND_URL,

            json=incident_data,

            timeout=2
        )


        # ----------------------------------------------------
        # SUCCESS
        # ----------------------------------------------------

        if response.status_code == 200:

            data = response.json()

            backend_incident_id = data.get(
                "incident_id",
                "UNKNOWN"
            )

            print()
            print("✓ INCIDENT SENT TO BACKEND")
            print(
                f"  Backend Incident ID : "
                f"{backend_incident_id}"
            )
            print()

            return True, backend_incident_id


        # ----------------------------------------------------
        # BACKEND ERROR
        # ----------------------------------------------------

        else:

            print()
            print(
                "✗ BACKEND ERROR:",
                response.status_code
            )
            print()

            return False, None


    # --------------------------------------------------------
    # SERVER NOT RUNNING / CONNECTION ERROR
    # --------------------------------------------------------

    except requests.exceptions.RequestException as error:

        print()
        print(
            "✗ BACKEND CONNECTION FAILED"
        )

        print(
            f"  Error: {error}"
        )

        print(
            "  Make sure FastAPI is running."
        )

        print()

        return False, None


# ============================================================
# 9. MAIN WEBCAM LOOP
# ============================================================

while True:


    # ========================================================
    # READ FRAME
    # ========================================================

    ret, frame = cap.read()


    if not ret:

        print(
            "Failed to grab frame from webcam."
        )

        break


    # ========================================================
    # YOLO TRACKING
    # ========================================================

    results = model.track(

        frame,

        persist=True,

        tracker="bytetrack.yaml",

        conf=CONFIDENCE_THRESHOLD,

        classes=[0],       # 0 = person

        imgsz=480,

        verbose=False
    )


    # ========================================================
    # DRAW RESTRICTED ZONE
    # ========================================================

    cv2.rectangle(

        frame,

        (ZONE_X1, ZONE_Y1),

        (ZONE_X2, ZONE_Y2),

        (0, 0, 255),

        3
    )


    cv2.putText(

        frame,

        "RESTRICTED ZONE",

        (ZONE_X1, ZONE_Y1 - 15),

        cv2.FONT_HERSHEY_SIMPLEX,

        0.9,

        (0, 0, 255),

        2
    )


    # ========================================================
    # DEFAULT SYSTEM STATUS
    # ========================================================

    intrusion_detected = False

    highest_risk = 0


    # ========================================================
    # CHECK DETECTIONS
    # ========================================================

    if results[0].boxes.id is not None:


        boxes = results[0].boxes


        track_ids = boxes.id.int().tolist()

        class_ids = boxes.cls.int().tolist()

        confidences = boxes.conf.tolist()

        coordinates = boxes.xyxy.tolist()


        # ====================================================
        # PROCESS EVERY TRACKED PERSON
        # ====================================================

        for (
            track_id,
            class_id,
            confidence,
            box
        ) in zip(

            track_ids,

            class_ids,

            confidences,

            coordinates
        ):


            # ------------------------------------------------
            # PERSON ONLY
            # ------------------------------------------------

            if class_id != 0:

                continue


            # ------------------------------------------------
            # GET BOUNDING BOX
            # ------------------------------------------------

            x1, y1, x2, y2 = map(
                int,
                box
            )


            # ------------------------------------------------
            # FIND CENTER
            # ------------------------------------------------

            center_x = int(
                (x1 + x2) / 2
            )

            center_y = int(
                (y1 + y2) / 2
            )


            # ------------------------------------------------
            # CHECK RESTRICTED ZONE
            # ------------------------------------------------

            inside_zone = (

                ZONE_X1 < center_x < ZONE_X2

                and

                ZONE_Y1 < center_y < ZONE_Y2
            )


            # =================================================
            # CALCULATE MOVEMENT
            # =================================================

            movement = "STATIONARY"


            if track_id in previous_positions:


                previous_x, previous_y = (
                    previous_positions[track_id]
                )


                dx = center_x - previous_x

                dy = center_y - previous_y


                movement_threshold = 8


                if (

                    abs(dx) < movement_threshold

                    and

                    abs(dy) < movement_threshold

                ):

                    movement = "STATIONARY"


                elif abs(dx) > abs(dy):


                    if dx > 0:

                        movement = "EAST"

                    else:

                        movement = "WEST"


                else:


                    if dy > 0:

                        movement = "SOUTH"

                    else:

                        movement = "NORTH"


            # Save current position

            previous_positions[track_id] = (
                center_x,
                center_y
            )


            # =================================================
            # PERSON LABEL
            # =================================================

            label = (
                f"Person ID: {track_id}"
            )


            cv2.putText(

                frame,

                label,

                (
                    x1,
                    max(y1 - 10, 20)
                ),

                cv2.FONT_HERSHEY_SIMPLEX,

                0.65,

                (255, 255, 255),

                2
            )


            # =================================================
            # DRAW CENTER POINT
            # =================================================

            cv2.circle(

                frame,

                (center_x, center_y),

                5,

                (255, 0, 0),

                -1
            )


            # =================================================
            # PERSON INSIDE RESTRICTED ZONE
            # =================================================

            if inside_zone:


                intrusion_detected = True


                # =============================================
                # START ENTRY TIMER
                # =============================================

                if track_id not in entry_times:


                    entry_times[track_id] = (
                        time.time()
                    )


                    incident_created[track_id] = False


                    print()
                    print(
                        "======================================"
                    )
                    print(
                        "INTRUSION DETECTED"
                    )
                    print(
                        f"Person ID : {track_id}"
                    )
                    print(
                        f"Camera    : {CAMERA_ID}"
                    )
                    print(
                        f"Zone      : {ZONE_NAME}"
                    )
                    print(
                        f"Movement  : {movement}"
                    )
                    print(
                        "======================================"
                    )


                # =============================================
                # CALCULATE DURATION
                # =============================================

                duration = (
                    time.time()
                    - entry_times[track_id]
                )


                # =============================================
                # CHECK NIGHT TIME
                # =============================================

                current_hour = datetime.now().hour


                is_night = (

                    current_hour >= 20

                    or

                    current_hour < 6
                )


                # =============================================
                # RISK SCORE
                # =============================================

                risk_score = 40


                # Night movement

                if is_night:

                    risk_score += 20


                # Persistence

                if duration >= PERSISTENCE_TIME:

                    risk_score += 15


                # Keep score within 0-100

                risk_score = min(
                    risk_score,
                    100
                )


                # =============================================
                # RISK LEVEL
                # =============================================

                if risk_score >= 61:

                    risk_level = "HIGH"


                elif risk_score >= 31:

                    risk_level = "MEDIUM"


                else:

                    risk_level = "LOW"


                highest_risk = max(

                    highest_risk,

                    risk_score
                )


                # =============================================
                # DRAW ALERT BOX
                # =============================================

                cv2.rectangle(

                    frame,

                    (x1, y1),

                    (x2, y2),

                    (0, 0, 255),

                    4
                )


                # =============================================
                # PERSON INFORMATION
                # =============================================

                cv2.putText(

                    frame,

                    f"ID: {track_id}",

                    (x1, y2 + 25),

                    cv2.FONT_HERSHEY_SIMPLEX,

                    0.65,

                    (0, 0, 255),

                    2
                )


                cv2.putText(

                    frame,

                    f"Movement: {movement}",

                    (x1, y2 + 50),

                    cv2.FONT_HERSHEY_SIMPLEX,

                    0.55,

                    (0, 0, 255),

                    2
                )


                cv2.putText(

                    frame,

                    f"Duration: {int(duration)} sec",

                    (x1, y2 + 75),

                    cv2.FONT_HERSHEY_SIMPLEX,

                    0.55,

                    (0, 0, 255),

                    2
                )


                cv2.putText(

                    frame,

                    f"Risk: {risk_level} ({risk_score})",

                    (x1, y2 + 100),

                    cv2.FONT_HERSHEY_SIMPLEX,

                    0.55,

                    (0, 0, 255),

                    2
                )


                # =================================================
                # CREATE INCIDENT
                # =================================================

                if (

                    duration >= INCIDENT_TRIGGER_TIME

                    and

                    not incident_created.get(
                        track_id,
                        False
                    )

                ):


                    # ---------------------------------------------
                    # GENERATE LOCAL INCIDENT NUMBER
                    # ---------------------------------------------

                    incident_number += 1


                    incident_time = (
                        datetime.now()
                        .strftime("%H:%M:%S")
                    )


                    # ---------------------------------------------
                    # SEND TO FASTAPI
                    # ---------------------------------------------

                    success, backend_id = (
                        send_incident_to_backend(

                            person_id=track_id,

                            movement=movement,

                            duration=duration,

                            risk_score=risk_score,

                            risk_level=risk_level
                        )
                    )


                    # ---------------------------------------------
                    # MARK AS CREATED ONLY AFTER
                    # SUCCESSFUL SEND
                    #
                    # This prevents losing an incident if the
                    # backend is temporarily unavailable.
                    # ---------------------------------------------

                    if success:

                        incident_created[track_id] = True


                    # ---------------------------------------------
                    # TERMINAL INCIDENT REPORT
                    # ---------------------------------------------

                    print()

                    print(
                        "****************************************"
                    )

                    print(
                        f"INCIDENT #{incident_number}"
                    )

                    print(
                        "****************************************"
                    )

                    print(
                        "Type       : "
                        "Restricted-Zone Intrusion"
                    )

                    print(
                        f"Camera     : {CAMERA_ID}"
                    )

                    print(
                        f"Zone       : {ZONE_NAME}"
                    )

                    print(
                        f"Person ID  : {track_id}"
                    )

                    print(
                        f"Time       : {incident_time}"
                    )

                    print(
                        f"Movement   : {movement}"
                    )

                    print(
                        f"Duration   : "
                        f"{int(duration)} seconds"
                    )

                    print(
                        f"Risk Score : {risk_score}"
                    )

                    print(
                        f"Risk Level : {risk_level}"
                    )

                    print(
                        "Status     : "
                        "Awaiting Operator Verification"
                    )


                    if success:

                        print(
                            f"Backend ID : "
                            f"{backend_id}"
                        )

                        print(
                            "Backend    : CONNECTED"
                        )

                    else:

                        print(
                            "Backend    : NOT CONNECTED"
                        )


                    print(
                        "****************************************"
                    )

                    print()


            # =================================================
            # PERSON OUTSIDE RESTRICTED ZONE
            # =================================================

            else:


                # Normal bounding box

                cv2.rectangle(

                    frame,

                    (x1, y1),

                    (x2, y2),

                    (255, 0, 0),

                    2
                )


                # ---------------------------------------------
                # DISPLAY CONFIDENCE
                # ---------------------------------------------

                cv2.putText(

                    frame,

                    f"{confidence:.2f}",

                    (x1, y2 + 20),

                    cv2.FONT_HERSHEY_SIMPLEX,

                    0.5,

                    (255, 255, 255),

                    1
                )


    # ========================================================
    # TOP SYSTEM STATUS
    # ========================================================

    if intrusion_detected:


        cv2.putText(

            frame,

            "!!! INTRUSION DETECTED !!!",

            (30, 45),

            cv2.FONT_HERSHEY_SIMPLEX,

            1.0,

            (0, 0, 255),

            3
        )


    else:


        cv2.putText(

            frame,

            "AREA SECURE",

            (30, 45),

            cv2.FONT_HERSHEY_SIMPLEX,

            1.0,

            (0, 255, 0),

            2
        )


    # ========================================================
    # CAMERA INFORMATION
    # ========================================================

    cv2.putText(

        frame,

        f"CAMERA: {CAMERA_ID}",

        (30, 80),

        cv2.FONT_HERSHEY_SIMPLEX,

        0.65,

        (255, 255, 255),

        2
    )


    cv2.putText(

        frame,

        "SENTINELAI LIVE MONITOR",

        (30, 110),

        cv2.FONT_HERSHEY_SIMPLEX,

        0.65,

        (255, 255, 255),

        2
    )


    # ========================================================
    # BACKEND STATUS
    # ========================================================

    cv2.putText(

        frame,

        "BACKEND: FASTAPI",

        (30, 140),

        cv2.FONT_HERSHEY_SIMPLEX,

        0.55,

        (255, 255, 255),

        2
    )


    # ========================================================
    # DISPLAY FRAME
    # ========================================================

    cv2.imshow(

        window_name,

        frame
    )


    # ========================================================
    # KEYBOARD CONTROLS
    # ========================================================

    key = cv2.waitKey(1) & 0xFF


    # Press Q to quit

    if key == ord("q"):

        break


# ============================================================
# CLEANUP
# ============================================================

cap.release()

cv2.destroyAllWindows()