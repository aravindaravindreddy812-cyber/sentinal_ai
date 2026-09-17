# SentinelAI Command Center — Frontend

This is the first frontend layer for the **current SentinelAI prototype**.

It does NOT replace your YOLO / tracking / risk prototype. It sits on top of it.

## Current integration

The dashboard expects your existing FastAPI server at:

`http://127.0.0.1:8000`

It already uses the endpoints your current backend provides:

- `GET /incidents`
- `PUT /incidents/{id}/verify`
- `PUT /incidents/{id}/dismiss`

The live CCTV panel is prepared for:

- `GET /video`

Your current backend does not have `/video` yet. Do **not** add a second webcam reader while `vision/tracker.py` is still running. The next backend step should refactor the existing tracker so one Python process owns the webcam and streams the processed frames to the browser.

## Run

Open a terminal inside this `frontend` folder:

```bash
npm install
npm run dev
```

Then open the Vite address shown in the terminal, normally:

`http://localhost:5173`

## Important

For the current prototype, keep your existing AI pipeline intact.

Recommended final flow:

Webcam → tracker.py / vision engine → FastAPI → React dashboard

Not:

Webcam → tracker.py
AND
Webcam → another FastAPI process

That would create competing webcam access.

## What is already implemented in this frontend

- Dark security-command-center UI
- Live CCTV panel
- Active incident card
- Explainable risk panel
- Camera network
- Incident timeline
- Incident database table
- Verify / dismiss buttons
- Analytics page
- Responsive layout
- Automatic incident refresh every 3 seconds
- FastAPI connection status

## Next integration step

Refactor the current `vision/tracker.py` into a reusable vision engine and let FastAPI own the single camera stream. Then `/video` can return the processed frames and the dashboard will become a genuinely live browser-based SentinelAI console.
