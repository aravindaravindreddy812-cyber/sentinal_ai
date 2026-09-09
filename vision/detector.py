from ultralytics import YOLO
import cv2

# 1. Load the local model weights
model = YOLO("yolov8n.pt")

# 2. Open the video file directly from the local folder
video = cv2.VideoCapture(0)

while True:
    ret, frame = video.read()

    if not ret:
        print("Could not find or open the video file locally!")
        break

    # 3. Run object tracking
    results = model(frame)
    annotated = results[0].plot()

    cv2.imshow("SentinelAI - C04", annotated)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

video.release()
cv2.destroyAllWindows()