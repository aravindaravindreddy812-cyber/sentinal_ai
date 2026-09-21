from fastapi import FastAPI, Request
import cv2
import numpy as np
from ultralytics import YOLO
from fastapi.middleware.cors import CORSMiddleware
from database import get_connection, create_table
from datetime import datetime

app = FastAPI(
    title="SentinelAI API",
    description="AI-powered security incident monitoring system",
    version="1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://sentinel-ai-frontend-xufy.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database table when server starts
create_table()


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
        SELECT * FROM incidents
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
