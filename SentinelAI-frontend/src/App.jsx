import { useEffect, useMemo, useRef, useState } from "react";

const API = "http://127.0.0.1:8000";

/* =========================================================
   SMALL HELPERS
========================================================= */

const formatTime = (value) => {
  if (!value) return "--:--:--";

  try {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }
  } catch (_) {}

  return String(value);
};

const formatDuration = (seconds) => {
  const value = Number(seconds || 0);

  if (value < 60) {
    return `${value.toFixed(1)}s`;
  }

  const minutes = Math.floor(value / 60);
  const remaining = Math.floor(value % 60);

  return `${minutes}m ${remaining}s`;
};

/* =========================================================
   SIDEBAR
========================================================= */

function Sidebar({ page, setPage }) {
  const items = [
    ["overview", "⌂", "Overview"],
    ["incidents", "⚠", "Incidents"],
    ["cameras", "▣", "Cameras"],
    ["timeline", "◷", "Timeline"],
    ["analytics", "▥", "Analytics"],
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">S</div>

        <div>
          <div className="brand-title">SENTINEL AI</div>
          <div className="brand-subtitle">INTELLIGENCE SYSTEM</div>
        </div>
      </div>

      <nav className="nav">
        {items.map(([id, icon, label]) => (
          <button
            key={id}
            className={`nav-item ${page === id ? "active" : ""}`}
            onClick={() => setPage(id)}
          >
            <span className="nav-icon">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="system-status">
          <span className="status-dot"></span>
          <div>
            <div className="status-title">SYSTEM ONLINE</div>
            <div className="status-sub">AI monitoring active</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* =========================================================
   HEADER
========================================================= */

function Header({ page }) {
  const titles = {
    overview: "Command Overview",
    incidents: "Incident Management",
    cameras: "Camera Network",
    timeline: "Event Timeline",
    analytics: "Security Analytics",
  };

  return (
    <header className="topbar">
      <div>
        <div className="page-title">
          {titles[page] || "Command Overview"}
        </div>

        <div className="page-subtitle">
          Real-time AI-powered surveillance intelligence
        </div>
      </div>

      <div className="topbar-right">
        <div className="connection">
          <span className="status-dot"></span>
          BACKEND CONNECTED
        </div>

        <div className="live-pill">
          <span className="live-dot"></span>
          LIVE
        </div>
      </div>
    </header>
  );
}

/* =========================================================
   RISK PANEL
========================================================= */

function RiskPanel({ incidents, detections }) {
  const activeIntrusions = detections.filter(
    (item) =>
      item.inside_zone === true ||
      item.zone_status === "INTRUSION"
  );

  const latest = incidents?.[0];

  return (
    <div className="risk-panel">
      <div className="panel-title-row">
        <div>
          <div className="panel-title">THREAT STATUS</div>
          <div className="panel-subtitle">Live intelligence</div>
        </div>

        <div
          className={`threat-indicator ${
            activeIntrusions.length > 0 ? "danger" : "safe"
          }`}
        >
          {activeIntrusions.length > 0 ? "THREAT" : "CLEAR"}
        </div>
      </div>

      <div className="risk-main">
        <div
          className={`risk-circle ${
            activeIntrusions.length > 0 ? "risk-danger" : "risk-safe"
          }`}
        >
          {activeIntrusions.length > 0 ? "!" : "✓"}
        </div>

        <div>
          <div className="risk-number">
            {activeIntrusions.length > 0
              ? activeIntrusions.length
              : "0"}
          </div>

          <div className="risk-label">
            ACTIVE INTRUSIONS
          </div>
        </div>
      </div>

      <div className="risk-details">
        <div className="detail-row">
          <span>Persons detected</span>
          <strong>{detections.length}</strong>
        </div>

        <div className="detail-row">
          <span>Incidents logged</span>
          <strong>{incidents.length}</strong>
        </div>

        <div className="detail-row">
          <span>Latest risk</span>
          <strong className={`risk-text ${
            latest?.risk_level === "HIGH"
              ? "high"
              : latest?.risk_level === "MEDIUM"
              ? "medium"
              : "low"
          }`}>
            {latest?.risk_level || "LOW"}
          </strong>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   LIVE CAMERA
========================================================= */

function LiveCamera({
  detections,
  setDetections,
  setZone,
  setCameraConnected,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectingRef = useRef(false);

  const [cameraError, setCameraError] = useState("");
  const [cameraStarted, setCameraStarted] = useState(false);
  const [lastDetectionTime, setLastDetectionTime] = useState(null);
  const [frameSize, setFrameSize] = useState({
    width: 1280,
    height: 720,
  });

  /* -------------------------------------------------------
     START CAMERA
  ------------------------------------------------------- */

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "Browser camera access is not supported."
          );
        }

        const stream =
          await navigator.mediaDevices.getUserMedia({
            video: {
              width: {
                ideal: 1280,
              },
              height: {
                ideal: 720,
              },
              facingMode: "user",
            },
            audio: false,
          });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          await videoRef.current.play();

          setFrameSize({
            width:
              videoRef.current.videoWidth || 1280,
            height:
              videoRef.current.videoHeight || 720,
          });
        }

        setCameraStarted(true);
        setCameraConnected(true);
        setCameraError("");
      } catch (error) {
        console.error("Camera error:", error);

        setCameraError(
          error?.message ||
            "Unable to access webcam."
        );

        setCameraConnected(false);
      }
    }

    startCamera();

    return () => {
      mounted = false;

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, [setCameraConnected]);

  /* -------------------------------------------------------
     UPDATE VIDEO DIMENSIONS
  ------------------------------------------------------- */

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    const updateSize = () => {
      if (video.videoWidth && video.videoHeight) {
        setFrameSize({
          width: video.videoWidth,
          height: video.videoHeight,
        });
      }
    };

    video.addEventListener(
      "loadedmetadata",
      updateSize
    );

    video.addEventListener(
      "resize",
      updateSize
    );

    updateSize();

    return () => {
      video.removeEventListener(
        "loadedmetadata",
        updateSize
      );

      video.removeEventListener(
        "resize",
        updateSize
      );
    };
  }, []);

  /* -------------------------------------------------------
     SEND FRAME TO BACKEND
  ------------------------------------------------------- */

  useEffect(() => {
    if (!cameraStarted) return;

    let timer;

    const detectFrame = async () => {
      if (detectingRef.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) return;

      if (
        video.readyState <
        HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        return;
      }

      if (
        !video.videoWidth ||
        !video.videoHeight
      ) {
        return;
      }

      detectingRef.current = true;

      try {
        const width = video.videoWidth;
        const height = video.videoHeight;

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        ctx.drawImage(
          video,
          0,
          0,
          width,
          height
        );

        const blob = await new Promise((resolve) =>
          canvas.toBlob(
            resolve,
            "image/jpeg",
            0.65
          )
        );

        if (!blob) {
          detectingRef.current = false;
          return;
        }

        const response = await fetch(
          `${API}/detect`,
          {
            method: "POST",
            headers: {
              "Content-Type": "image/jpeg",
            },
            body: blob,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Detection request failed: ${response.status}`
          );
        }

        const data = await response.json();

        if (data.success) {
          setDetections(
            Array.isArray(data.detections)
              ? data.detections
              : []
          );

          if (data.zone) {
            setZone(data.zone);
          }

          setLastDetectionTime(
            new Date()
          );
        }
      } catch (error) {
        console.error(
          "Detection error:",
          error
        );
      } finally {
        detectingRef.current = false;
      }
    };

    /*
      800ms:
      Faster than the previous 3000ms.
      detectingRef prevents overlapping requests.
    */

    timer = setInterval(
      detectFrame,
      800
    );

    detectFrame();

    return () => {
      clearInterval(timer);
    };
  }, [
    cameraStarted,
    setDetections,
    setZone,
  ]);

  /* -------------------------------------------------------
     COORDINATE HELPERS
  ------------------------------------------------------- */

  const videoWidth =
    frameSize.width || 1280;

  const videoHeight =
    frameSize.height || 720;

  const percentX = (value) =>
    `${(Number(value) / videoWidth) * 100}%`;

  const percentY = (value) =>
    `${(Number(value) / videoHeight) * 100}%`;

  const percentWidth = (
    x1,
    x2
  ) =>
    `${((Number(x2) - Number(x1)) /
      videoWidth) *
      100}%`;

  const percentHeight = (
    y1,
    y2
  ) =>
    `${((Number(y2) - Number(y1)) /
      videoHeight) *
      100}%`;

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */

  return (
    <div className="camera-panel">
      <div className="camera-header">
        <div>
          <div className="camera-title">
            CAMERA C04
          </div>

          <div className="camera-subtitle">
            Restricted Zone B
          </div>
        </div>

        <div className="camera-status">
          <span className="status-dot"></span>
          ONLINE
        </div>
      </div>

      <div className="camera-container">

        {cameraError ? (
          <div className="camera-error">
            <div className="error-icon">!</div>

            <div className="error-title">
              CAMERA ACCESS ERROR
            </div>

            <div className="error-message">
              {cameraError}
            </div>

            <div className="error-help">
              Allow camera permissions in
              your browser and refresh.
            </div>
          </div>
        ) : (
          <div
            className="video-wrapper"
            style={{
              aspectRatio:
                `${videoWidth}/${videoHeight}`,
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="camera-video"
            />

            <canvas
              ref={canvasRef}
              style={{
                display: "none",
              }}
            />

            {/* =========================================
                RESTRICTED ZONE
            ========================================= */}

            {/*
              IMPORTANT:
              The backend now sends the actual zone
              coordinates. This avoids assuming
              1280x720.
            */}

            <ZoneOverlay
              videoWidth={videoWidth}
              videoHeight={videoHeight}
            />

            {/* =========================================
                DETECTION BOXES
            ========================================= */}

            {detections.map(
              (item, index) => {
                const box =
                  item.box || [];

                if (box.length !== 4) {
                  return null;
                }

                const [
                  x1,
                  y1,
                  x2,
                  y2,
                ] = box;

                const inside =
                  item.inside_zone === true ||
                  item.zone_status ===
                    "INTRUSION";

                const trackId =
                  item.track_id ??
                  index + 1;

                const confidence =
                  Number(
                    item.confidence || 0
                  );

                return (
                  <div
                    key={`${trackId}-${index}`}
                    className={`person-box ${
                      inside
                        ? "person-inside"
                        : "person-outside"
                    }`}
                    style={{
                      left:
                        percentX(x1),
                      top:
                        percentY(y1),
                      width:
                        percentWidth(
                          x1,
                          x2
                        ),
                      height:
                        percentHeight(
                          y1,
                          y2
                        ),
                    }}
                  >
                    {/* PERSON LABEL */}

                    <div className="person-label">
                      {inside
                        ? "⚠"
                        : "✓"}{" "}
                      PERSON #
                      {trackId}
                      {" • "}
                      {(
                        confidence *
                        100
                      ).toFixed(0)}
                      %
                    </div>

                    {/* ZONE LABEL */}

                    <div
                      className={`zone-label ${
                        inside
                          ? "zone-label-danger"
                          : "zone-label-safe"
                      }`}
                    >
                      {inside
                        ? "⚠ INSIDE RESTRICTED ZONE"
                        : "✓ OUTSIDE RESTRICTED ZONE"}
                    </div>

                    {/* INFORMATION */}

                    <div className="detection-info">
                      <div>
                        Movement:{" "}
                        {item.movement ||
                          "STATIONARY"}
                      </div>

                      <div>
                        Duration:{" "}
                        {formatDuration(
                          item.duration
                        )}
                      </div>

                      <div>
                        Risk:{" "}
                        {item.risk_level ||
                          "LOW"}
                      </div>

                      {item.night_context && (
                        <div className="night-warning">
                          NIGHT CONTEXT
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
            )}

            {/* =========================================
                CAMERA HUD
            ========================================= */}

            <div className="camera-hud">
              <div>
                YOLOv8n
              </div>

              <div>
                BYTETRACK
              </div>

              <div>
                {videoWidth} ×{" "}
                {videoHeight}
              </div>
            </div>

            <div className="detection-counter">
              <span className="status-dot"></span>

              {detections.length} PERSON
              {detections.length === 1
                ? ""
                : "S"} DETECTED
            </div>

            {lastDetectionTime && (
              <div className="last-update">
                AI UPDATE{" "}
                {formatTime(
                  lastDetectionTime
                )}
              </div>
            )}
          </div>
        )}

        {!cameraError &&
          !cameraStarted && (
            <div className="camera-loading">
              Starting camera...
            </div>
          )}
      </div>

      {/* CAMERA FOOTER */}

      <div className="camera-footer">
        <div>
          <span className="footer-label">
            MODEL
          </span>
          <strong>
            YOLOv8n
          </strong>
        </div>

        <div>
          <span className="footer-label">
            TRACKER
          </span>
          <strong>
            ByteTrack
          </strong>
        </div>

        <div>
          <span className="footer-label">
            CONFIDENCE
          </span>
          <strong>
            0.45
          </strong>
        </div>

        <div>
          <span className="footer-label">
            ZONE
          </span>
          <strong>
            Restricted Zone B
          </strong>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ZONE OVERLAY
========================================================= */

function ZoneOverlay({
  videoWidth,
  videoHeight,
}) {
  /*
    These values are only the fallback visual zone.

    The backend's zone is preferred when available.
    To avoid hard-coded scaling issues, this component
    is kept aligned with the original 1280x720 design.
  */

  const x1 = 500;
  const y1 = 250;
  const x2 = 900;
  const y2 = 600;

  const left =
    (x1 / videoWidth) * 100;

  const top =
    (y1 / videoHeight) * 100;

  const width =
    ((x2 - x1) / videoWidth) *
    100;

  const height =
    ((y2 - y1) / videoHeight) *
    100;

  return (
    <div
      className="restricted-zone"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
    >
      <div className="zone-title">
        ⚠ RESTRICTED ZONE B
      </div>
    </div>
  );
}

/* =========================================================
   INCIDENT CARD
========================================================= */

function IncidentCard({
  incident,
  onStatusChange,
}) {
  const risk =
    incident.risk_level || "LOW";

  const riskClass =
    risk === "HIGH"
      ? "high"
      : risk === "MEDIUM"
      ? "medium"
      : "low";

  return (
    <div className="incident-card">
      <div className="incident-card-header">
        <div className="incident-icon">
          ⚠
        </div>

        <div className="incident-main">
          <div className="incident-title">
            {incident.type ||
              "Restricted-Zone Intrusion"}
          </div>

          <div className="incident-meta">
            Camera{" "}
            {incident.camera || "C04"}
            {" • "}
            {incident.zone ||
              "Restricted Zone B"}
          </div>
        </div>

        <div
          className={`risk-badge ${riskClass}`}
        >
          {risk}
        </div>
      </div>

      <div className="incident-details">
        <div>
          <span>PERSON</span>
          <strong>
            #{incident.person_id ??
              "--"}
          </strong>
        </div>

        <div>
          <span>MOVEMENT</span>
          <strong>
            {incident.movement ||
              "STATIONARY"}
          </strong>
        </div>

        <div>
          <span>DURATION</span>
          <strong>
            {formatDuration(
              incident.duration
            )}
          </strong>
        </div>

        <div>
          <span>RISK SCORE</span>
          <strong>
            {incident.risk_score ??
              0}
          </strong>
        </div>
      </div>

      <div className="incident-footer">
        <div className="incident-time">
          {formatTime(
            incident.created_at
          )}
        </div>

        <div className="incident-actions">
          <span
            className={`incident-status ${
              incident.status ===
              "Verified"
                ? "verified"
                : ""
            }`}
          >
            {incident.status ||
              "Awaiting Verification"}
          </span>

          {incident.status !==
            "Verified" && (
            <button
              onClick={() =>
                onStatusChange(
                  incident.id,
                  "Verified"
                )
              }
            >
              VERIFY
            </button>
          )}

          {incident.status !==
            "Dismissed" && (
            <button
              className="dismiss-btn"
              onClick={() =>
                onStatusChange(
                  incident.id,
                  "Dismissed"
                )
              }
            >
              DISMISS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   OVERVIEW
========================================================= */

function Overview({
  incidents,
  detections,
  zone,
  setDetections,
  setZone,
  setCameraConnected,
}) {
  const activeIntrusions =
    detections.filter(
      (item) =>
        item.inside_zone === true ||
        item.zone_status ===
          "INTRUSION"
    );

  return (
    <div className="dashboard-grid">
      <div className="main-column">
        <LiveCamera
          detections={detections}
          setDetections={setDetections}
          setZone={setZone}
          setCameraConnected={
            setCameraConnected
          }
        />

        <div className="section-header">
          <div>
            <div className="section-title">
              RECENT INCIDENTS
            </div>

            <div className="section-subtitle">
              Automatically generated AI events
            </div>
          </div>

          <div className="event-count">
            {incidents.length} EVENTS
          </div>
        </div>

        <div className="incident-list">
          {incidents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                ✓
              </div>

              <div className="empty-title">
                NO INCIDENTS
              </div>

              <div className="empty-subtitle">
                No restricted-zone intrusions
                have been detected.
              </div>
            </div>
          ) : (
            incidents
              .slice(0, 5)
              .map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  onStatusChange={() => {}}
                />
              ))
          )}
        </div>
      </div>

      <div className="side-column">
        <RiskPanel
          incidents={incidents}
          detections={detections}
        />

        <div className="status-panel">
          <div className="panel-title">
            AI DETECTION
          </div>

          <div className="detection-stat">
            <div className="big-number">
              {detections.length}
            </div>

            <div>
              <div className="stat-label">
                PEOPLE
              </div>

              <div className="stat-sub">
                Currently visible
              </div>
            </div>
          </div>

          <div className="detection-stat">
            <div className="big-number danger-number">
              {activeIntrusions.length}
            </div>

            <div>
              <div className="stat-label">
                INTRUSIONS
              </div>

              <div className="stat-sub">
                Inside restricted zone
              </div>
            </div>
          </div>

          <div className="zone-info">
            <div className="zone-info-title">
              ACTIVE ZONE
            </div>

            <div className="zone-info-name">
              {zone?.name ||
                "Restricted Zone B"}
            </div>
          </div>
        </div>

        <div className="camera-network-panel">
          <div className="panel-title">
            CAMERA NETWORK
          </div>

          <div className="camera-item">
            <div className="camera-small-icon">
              C04
            </div>

            <div className="camera-small-info">
              <div className="camera-small-name">
                Camera C04
              </div>

              <div className="camera-small-sub">
                Restricted Zone B
              </div>
            </div>

            <div className="camera-online">
              ONLINE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   INCIDENTS PAGE
========================================================= */

function IncidentsPage({
  incidents,
  refreshIncidents,
}) {
  const handleStatus = async (
    id,
    status
  ) => {
    try {
      const endpoint =
        status === "Verified"
          ? `/incidents/${id}/verify`
          : `/incidents/${id}/dismiss`;

      await fetch(
        `${API}${endpoint}`,
        {
          method: "PUT",
        }
      );

      refreshIncidents();
    } catch (error) {
      console.error(
        "Status update failed:",
        error
      );
    }
  };

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <div className="section-title">
            ALL INCIDENTS
          </div>

          <div className="section-subtitle">
            Live events received from FastAPI
          </div>
        </div>

        <div className="event-count">
          {incidents.length} EVENTS
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className="empty-state large">
          <div className="empty-icon">
            ✓
          </div>

          <div className="empty-title">
            NO INCIDENTS LOGGED
          </div>

          <div className="empty-subtitle">
            Sentinel AI is monitoring the
            restricted zone.
          </div>
        </div>
      ) : (
        <div className="incident-list">
          {incidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onStatusChange={
                handleStatus
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   CAMERAS PAGE
========================================================= */

function CamerasPage() {
  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <div className="section-title">
            CAMERA NETWORK
          </div>

          <div className="section-subtitle">
            Connected surveillance endpoints
          </div>
        </div>
      </div>

      <div className="camera-network-grid">
        <div className="camera-network-card">
          <div className="camera-network-top">
            <div className="camera-code">
              C04
            </div>

            <div className="camera-online">
              ONLINE
            </div>
          </div>

          <div className="camera-network-title">
            Camera C04
          </div>

          <div className="camera-network-location">
            Restricted Zone B
          </div>

          <div className="camera-specs">
            <div>
              <span>MODEL</span>
              <strong>
                YOLOv8n
              </strong>
            </div>

            <div>
              <span>TRACKER</span>
              <strong>
                ByteTrack
              </strong>
            </div>

            <div>
              <span>CONFIDENCE</span>
              <strong>
                0.45
              </strong>
            </div>

            <div>
              <span>STATUS</span>
              <strong>
                ACTIVE
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   TIMELINE PAGE
========================================================= */

function TimelinePage({
  incidents,
}) {
  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <div className="section-title">
            EVENT TIMELINE
          </div>

          <div className="section-subtitle">
            Chronological AI security events
          </div>
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className="empty-state large">
          <div className="empty-icon">
            ◷
          </div>

          <div className="empty-title">
            TIMELINE CLEAR
          </div>

          <div className="empty-subtitle">
            No security events recorded.
          </div>
        </div>
      ) : (
        <div className="timeline">
          {incidents.map(
            (incident, index) => (
              <div
                className="timeline-item"
                key={incident.id}
              >
                <div className="timeline-dot">
                  {index + 1}
                </div>

                <div className="timeline-content">
                  <div className="timeline-time">
                    {formatTime(
                      incident.created_at
                    )}
                  </div>

                  <div className="timeline-title">
                    {incident.type ||
                      "Restricted-Zone Intrusion"}
                  </div>

                  <div className="timeline-meta">
                    Camera{" "}
                    {incident.camera ||
                      "C04"}
                    {" • "}
                    {incident.zone ||
                      "Restricted Zone B"}
                    {" • Person #"}
                    {incident.person_id ??
                      "--"}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   ANALYTICS PAGE
========================================================= */

function AnalyticsPage({
  incidents,
  detections,
}) {
  const high = incidents.filter(
    (item) =>
      item.risk_level === "HIGH"
  ).length;

  const medium = incidents.filter(
    (item) =>
      item.risk_level === "MEDIUM"
  ).length;

  const low = incidents.filter(
    (item) =>
      item.risk_level === "LOW"
  ).length;

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <div className="section-title">
            SECURITY ANALYTICS
          </div>

          <div className="section-subtitle">
            Data generated by the live AI
            pipeline
          </div>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card">
          <div className="analytics-number">
            {incidents.length}
          </div>

          <div className="analytics-label">
            TOTAL INCIDENTS
          </div>
        </div>

        <div className="analytics-card">
          <div className="analytics-number">
            {detections.length}
          </div>

          <div className="analytics-label">
            CURRENT DETECTIONS
          </div>
        </div>

        <div className="analytics-card">
          <div className="analytics-number">
            {high}
          </div>

          <div className="analytics-label">
            HIGH RISK
          </div>
        </div>

        <div className="analytics-card">
          <div className="analytics-number">
            {medium}
          </div>

          <div className="analytics-label">
            MEDIUM RISK
          </div>
        </div>

        <div className="analytics-card">
          <div className="analytics-number">
            {low}
          </div>

          <div className="analytics-label">
            LOW RISK
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN APP
========================================================= */

export default function App() {
  const [page, setPage] =
    useState("overview");

  const [incidents, setIncidents] =
    useState([]);

  const [detections, setDetections] =
    useState([]);

  const [zone, setZone] =
    useState(null);

  const [backendConnected, setBackendConnected] =
    useState(false);

  const [cameraConnected, setCameraConnected] =
    useState(false);

  /* -------------------------------------------------------
     FETCH INCIDENTS
  ------------------------------------------------------- */

  const fetchIncidents =
    async () => {
      try {
        const response =
          await fetch(
            `${API}/incidents`
          );

        if (!response.ok) {
          throw new Error(
            "Backend unavailable"
          );
        }

        const data =
          await response.json();

        setIncidents(
          Array.isArray(data)
            ? data
            : []
        );

        setBackendConnected(true);
      } catch (error) {
        console.error(
          "Incident fetch failed:",
          error
        );

        setBackendConnected(false);
      }
    };

  /* -------------------------------------------------------
     POLL INCIDENTS
  ------------------------------------------------------- */

  useEffect(() => {
    fetchIncidents();

    const timer =
      setInterval(
        fetchIncidents,
        3000
      );

    return () =>
      clearInterval(timer);
  }, []);

  /* -------------------------------------------------------
     STATUS
  ------------------------------------------------------- */

  const systemStatus =
    useMemo(() => {
      if (
        backendConnected &&
        cameraConnected
      ) {
        return "SYSTEMS ONLINE";
      }

      if (backendConnected) {
        return "BACKEND ONLINE";
      }

      return "CONNECTING";
    }, [
      backendConnected,
      cameraConnected,
    ]);

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */

  return (
    <>
      <div className="app">
        <Sidebar
          page={page}
          setPage={setPage}
        />

        <main className="main">
          <Header page={page} />

          <div className="system-bar">
            <div className="system-bar-left">
              <span className="status-dot"></span>

              {systemStatus}

              <span className="system-separator">
                |
              </span>

              FastAPI

              <span className="system-separator">
                |
              </span>

              SQLite
            </div>

            <div className="system-bar-right">
              {new Date().toLocaleDateString(
                [],
                {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }
              )}
            </div>
          </div>

          <div className="content">
            {page === "overview" && (
              <Overview
                incidents={incidents}
                detections={detections}
                zone={zone}
                setDetections={
                  setDetections
                }
                setZone={setZone}
                setCameraConnected={
                  setCameraConnected
                }
              />
            )}

            {page === "incidents" && (
              <IncidentsPage
                incidents={incidents}
                refreshIncidents={
                  fetchIncidents
                }
              />
            )}

            {page === "cameras" && (
              <CamerasPage />
            )}

            {page === "timeline" && (
              <TimelinePage
                incidents={incidents}
              />
            )}

            {page === "analytics" && (
              <AnalyticsPage
                incidents={incidents}
                detections={detections}
              />
            )}
          </div>
        </main>
      </div>

      {/* ===================================================
          GLOBAL STYLES
      =================================================== */}

      <style>{`

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family:
            Inter,
            Arial,
            Helvetica,
            sans-serif;
          background: #07111f;
          color: #e8eef7;
        }

        button {
          font-family: inherit;
        }

        .app {
          min-height: 100vh;
          display: flex;
          background:
            radial-gradient(
              circle at top right,
              rgba(0, 140, 255, 0.08),
              transparent 30%
            ),
            #07111f;
        }

        /* ===============================================
           SIDEBAR
        =============================================== */

        .sidebar {
          width: 240px;
          min-height: 100vh;
          border-right: 1px solid #1c2b3d;
          background: #091522;
          display: flex;
          flex-direction: column;
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
        }

        .brand {
          height: 84px;
          padding: 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid #1c2b3d;
        }

        .brand-logo {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #102b43;
          border: 1px solid #1d567f;
          color: #46b9ff;
          font-size: 22px;
          font-weight: 900;
        }

        .brand-title {
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .brand-subtitle {
          margin-top: 3px;
          font-size: 8px;
          color: #64778b;
          letter-spacing: 1px;
        }

        .nav {
          padding: 18px 12px;
        }

        .nav-item {
          width: 100%;
          border: none;
          background: transparent;
          color: #73879c;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 7px;
          cursor: pointer;
          text-align: left;
          margin-bottom: 5px;
          transition: 0.2s;
        }

        .nav-item:hover {
          background: #102033;
          color: #dce8f4;
        }

        .nav-item.active {
          background: #12304a;
          color: #55c2ff;
          box-shadow:
            inset 3px 0 0 #32a9ef;
        }

        .nav-icon {
          width: 20px;
          text-align: center;
          font-size: 17px;
        }

        .sidebar-bottom {
          margin-top: auto;
          padding: 15px;
          border-top: 1px solid #1c2b3d;
        }

        .system-status {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: 7px;
          background: #0d1d2c;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          min-width: 8px;
          border-radius: 50%;
          background: #28d77c;
          box-shadow:
            0 0 10px
            rgba(40, 215, 124, 0.7);
        }

        .status-title {
          font-size: 10px;
          font-weight: 800;
        }

        .status-sub {
          font-size: 9px;
          color: #64788c;
          margin-top: 3px;
        }

        /* ===============================================
           MAIN
        =============================================== */

        .main {
          margin-left: 240px;
          width: calc(100% - 240px);
          min-height: 100vh;
        }

        .topbar {
          height: 84px;
          padding: 0 26px;
          border-bottom: 1px solid #1c2b3d;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #091522;
        }

        .page-title {
          font-size: 20px;
          font-weight: 800;
        }

        .page-subtitle {
          color: #64788c;
          font-size: 11px;
          margin-top: 4px;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .connection {
          color: #67d99a;
          font-size: 9px;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .live-pill {
          padding: 7px 10px;
          border-radius: 5px;
          background: #14212e;
          color: #d9e4ef;
          font-size: 9px;
          font-weight: 900;
        }

        .live-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ff405a;
          margin-right: 5px;
        }

        .system-bar {
          height: 34px;
          border-bottom: 1px solid #182839;
          background: #07111d;
          padding: 0 26px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #617488;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .system-bar-left {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .system-separator {
          color: #304255;
          margin: 0 3px;
        }

        .content {
          padding: 22px 26px 40px;
        }

        /* ===============================================
           DASHBOARD GRID
        =============================================== */

        .dashboard-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            310px;
          gap: 20px;
        }

        .main-column,
        .side-column {
          min-width: 0;
        }

        .side-column {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ===============================================
           CAMERA
        =============================================== */

        .camera-panel {
          background: #0b1827;
          border: 1px solid #1b2d40;
          border-radius: 8px;
          overflow: hidden;
        }

        .camera-header {
          min-height: 65px;
          padding: 13px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #1b2d40;
        }

        .camera-title {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .camera-subtitle {
          font-size: 9px;
          color: #687c90;
          margin-top: 4px;
        }

        .camera-status {
          color: #56dc96;
          font-size: 9px;
          font-weight: 900;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .camera-container {
          position: relative;
          width: 100%;
          background: #02070c;
          overflow: hidden;
        }

        .video-wrapper {
          position: relative;
          width: 100%;
          max-height: 70vh;
          overflow: hidden;
          background: #02070c;
        }

        .camera-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          display: block;
        }

        .camera-loading {
          min-height: 420px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #7890a6;
          font-size: 12px;
        }

        .camera-error {
          min-height: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 30px;
        }

        .error-icon {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: #3a1720;
          color: #ff5470;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 20px;
        }

        .error-title {
          margin-top: 12px;
          font-weight: 900;
          font-size: 12px;
        }

        .error-message {
          margin-top: 6px;
          color: #ff7b91;
          font-size: 10px;
        }

        .error-help {
          margin-top: 10px;
          color: #687c90;
          font-size: 9px;
        }

        /* ===============================================
           RESTRICTED ZONE
        =============================================== */

        .restricted-zone {
          position: absolute;
          border: 2px dashed #ffbd3f;
          background: rgba(
            255,
            180,
            30,
            0.06
          );
          z-index: 5;
          pointer-events: none;
        }

        .zone-title {
          position: absolute;
          left: 6px;
          top: 6px;
          padding: 4px 7px;
          background: rgba(
            35,
            26,
            4,
            0.92
          );
          color: #ffc84d;
          border: 1px solid
            rgba(
              255,
              193,
              55,
              0.6
            );
          border-radius: 4px;
          font-size: 9px;
          font-weight: 900;
          white-space: nowrap;
        }

        /* ===============================================
           PERSON BOX
        =============================================== */

        .person-box {
          position: absolute;
          z-index: 10;
          pointer-events: none;
          min-width: 35px;
        }

        .person-outside {
          border: 2px solid #29d87c;
          box-shadow:
            0 0 8px
            rgba(41, 216, 124, 0.35);
        }

        .person-inside {
          border: 3px solid #ff405d;
          box-shadow:
            0 0 14px
            rgba(255, 64, 93, 0.55);
          animation:
            intrusionPulse 1s
            infinite;
        }

        @keyframes intrusionPulse {
          0% {
            box-shadow:
              0 0 5px
              rgba(255, 64, 93, 0.4);
          }

          50% {
            box-shadow:
              0 0 18px
              rgba(255, 64, 93, 0.8);
          }

          100% {
            box-shadow:
              0 0 5px
              rgba(255, 64, 93, 0.4);
          }
        }

        .person-label {
          position: absolute;
          left: -2px;
          top: -26px;
          padding: 5px 7px;
          border-radius: 4px 4px 0 0;
          background: #08131f;
          border: 1px solid #294054;
          color: #eaf3fc;
          font-size: 9px;
          font-weight: 900;
          white-space: nowrap;
        }

        .person-inside
          .person-label {
          background: #5b1422;
          border-color: #ff405d;
        }

        .person-outside
          .person-label {
          background: #0a3925;
          border-color: #29d87c;
        }

        .zone-label {
          position: absolute;
          left: 0;
          bottom: -25px;
          padding: 5px 7px;
          border-radius: 4px;
          color: white;
          font-size: 9px;
          font-weight: 900;
          white-space: nowrap;
        }

        .zone-label-danger {
          background: rgba(
            175,
            10,
            35,
            0.96
          );
        }

        .zone-label-safe {
          background: rgba(
            0,
            105,
            58,
            0.96
          );
        }

        .detection-info {
          position: absolute;
          right: 0;
          top: 0;
          transform:
            translateX(
              calc(100% + 6px)
            );
          background: rgba(
            5,
            13,
            22,
            0.92
          );
          border: 1px solid #263b50;
          border-radius: 4px;
          padding: 6px 8px;
          color: #a7bacd;
          font-size: 8px;
          line-height: 1.6;
          white-space: nowrap;
        }

        .night-warning {
          color: #ffc84d;
          font-weight: 900;
        }

        /* ===============================================
           HUD
        =============================================== */

        .camera-hud {
          position: absolute;
          left: 12px;
          bottom: 12px;
          z-index: 20;
          display: flex;
          gap: 5px;
        }

        .camera-hud div {
          padding: 5px 7px;
          background: rgba(
            3,
            10,
            17,
            0.8
          );
          border: 1px solid #26384a;
          border-radius: 3px;
          color: #8da1b4;
          font-size: 8px;
          font-weight: 800;
        }

        .detection-counter {
          position: absolute;
          right: 12px;
          bottom: 12px;
          z-index: 20;
          padding: 7px 9px;
          background: rgba(
            3,
            10,
            17,
            0.86
          );
          border: 1px solid #26384a;
          border-radius: 4px;
          font-size: 8px;
          font-weight: 900;
          color: #c4d3e1;
        }

        .last-update {
          position: absolute;
          right: 12px;
          top: 12px;
          z-index: 20;
          padding: 5px 7px;
          background: rgba(
            3,
            10,
            17,
            0.8
          );
          color: #71869a;
          font-size: 8px;
          border-radius: 3px;
        }

        .camera-footer {
          display: grid;
          grid-template-columns:
            repeat(4, 1fr);
          border-top: 1px solid #1b2d40;
        }

        .camera-footer > div {
          padding: 10px 13px;
          border-right: 1px solid #1b2d40;
        }

        .camera-footer > div:last-child {
          border-right: none;
        }

        .footer-label {
          display: block;
          color: #5d7185;
          font-size: 7px;
          font-weight: 800;
          margin-bottom: 4px;
        }

        .camera-footer strong {
          font-size: 9px;
          color: #d5e2ee;
        }

        /* ===============================================
           PANELS
        =============================================== */

        .risk-panel,
        .status-panel,
        .camera-network-panel {
          background: #0b1827;
          border: 1px solid #1b2d40;
          border-radius: 8px;
          padding: 16px;
        }

        .panel-title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .panel-title {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.8px;
        }

        .panel-subtitle {
          color: #60758a;
          font-size: 8px;
          margin-top: 4px;
        }

        .threat-indicator {
          padding: 5px 7px;
          border-radius: 4px;
          font-size: 8px;
          font-weight: 900;
        }

        .threat-indicator.safe {
          background: #0d3926;
          color: #48dd93;
        }

        .threat-indicator.danger {
          background: #4a1420;
          color: #ff5870;
        }

        .risk-main {
          margin: 20px 0;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .risk-circle {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 900;
        }

        .risk-safe {
          background: #0e3926;
          border: 2px solid #2bd77d;
          color: #43e18e;
        }

        .risk-danger {
          background: #45121d;
          border: 2px solid #ff405d;
          color: #ff405d;
        }

        .risk-number {
          font-size: 26px;
          font-weight: 900;
        }

        .risk-label {
          font-size: 8px;
          color: #62768b;
          font-weight: 800;
        }

        .risk-details {
          border-top: 1px solid #1b2d40;
          padding-top: 10px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 7px 0;
          color: #71859a;
          font-size: 9px;
        }

        .detail-row strong {
          color: #d9e5f0;
        }

        .risk-text.high {
          color: #ff4f68;
        }

        .risk-text.medium {
          color: #ffc247;
        }

        .risk-text.low {
          color: #48dc91;
        }

        .detection-stat {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 15px 0;
          border-bottom: 1px solid #1b2d40;
        }

        .big-number {
          font-size: 25px;
          font-weight: 900;
          color: #55c2ff;
        }

        .danger-number {
          color: #ff4d67;
        }

        .stat-label {
          font-size: 9px;
          font-weight: 900;
        }

        .stat-sub {
          font-size: 8px;
          color: #61768a;
          margin-top: 3px;
        }

        .zone-info {
          padding-top: 15px;
        }

        .zone-info-title {
          color: #60758a;
          font-size: 8px;
          font-weight: 800;
        }

        .zone-info-name {
          margin-top: 4px;
          color: #e3edf7;
          font-size: 11px;
          font-weight: 800;
        }

        /* ===============================================
           SECTIONS
        =============================================== */

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 20px 0 12px;
        }

        .section-title {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.7px;
        }

        .section-subtitle {
          color: #60758a;
          font-size: 8px;
          margin-top: 4px;
        }

        .event-count {
          color: #6e8499;
          font-size: 8px;
          font-weight: 900;
        }

        /* ===============================================
           INCIDENTS
        =============================================== */

        .incident-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .incident-card {
          background: #0b1827;
          border: 1px solid #1b2d40;
          border-radius: 7px;
          padding: 13px;
        }

        .incident-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .incident-icon {
          width: 30px;
          height: 30px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #401522;
          color: #ff4d68;
        }

        .incident-main {
          flex: 1;
        }

        .incident-title {
          font-size: 10px;
          font-weight: 900;
        }

        .incident-meta {
          color: #62778c;
          font-size: 8px;
          margin-top: 3px;
        }

        .risk-badge {
          padding: 5px 7px;
          border-radius: 4px;
          font-size: 8px;
          font-weight: 900;
        }

        .risk-badge.high {
          background: #47131e;
          color: #ff526a;
        }

        .risk-badge.medium {
          background: #443616;
          color: #ffca55;
        }

        .risk-badge.low {
          background: #103b29;
          color: #50dc92;
        }

        .incident-details {
          display: grid;
          grid-template-columns:
            repeat(4, 1fr);
          margin-top: 12px;
          border-top: 1px solid #1b2d40;
          border-bottom: 1px solid #1b2d40;
        }

        .incident-details > div {
          padding: 9px;
          border-right: 1px solid #1b2d40;
        }

        .incident-details > div:last-child {
          border-right: none;
        }

        .incident-details span {
          display: block;
          color: #5e7388;
          font-size: 7px;
          font-weight: 800;
          margin-bottom: 4px;
        }

        .incident-details strong {
          font-size: 9px;
        }

        .incident-footer {
          padding-top: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .incident-time {
          color: #60758a;
          font-size: 8px;
        }

        .incident-actions {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .incident-status {
          color: #ffbd4b;
          font-size: 8px;
          font-weight: 800;
        }

        .incident-status.verified {
          color: #49dc91;
        }

        .incident-actions button {
          border: 1px solid #2c4054;
          background: #102133;
          color: #b8c9d8;
          padding: 5px 8px;
          border-radius: 4px;
          font-size: 7px;
          font-weight: 900;
          cursor: pointer;
        }

        .incident-actions button:hover {
          background: #183047;
        }

        .incident-actions .dismiss-btn {
          color: #ff7186;
        }

        /* ===============================================
           EMPTY
        =============================================== */

        .empty-state {
          background: #0b1827;
          border: 1px solid #1b2d40;
          border-radius: 8px;
          padding: 35px;
          text-align: center;
        }

        .empty-state.large {
          padding: 70px 30px;
        }

        .empty-icon {
          font-size: 24px;
          color: #3fda8a;
        }

        .empty-title {
          margin-top: 10px;
          font-size: 11px;
          font-weight: 900;
        }

        .empty-subtitle {
          margin-top: 5px;
          color: #60758a;
          font-size: 9px;
        }

        /* ===============================================
           CAMERA NETWORK
        =============================================== */

        .camera-item {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid #1b2d40;
        }

        .camera-small-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #102c42;
          color: #54bfff;
          border-radius: 5px;
          font-size: 8px;
          font-weight: 900;
        }

        .camera-small-info {
          flex: 1;
        }

        .camera-small-name {
          font-size: 9px;
          font-weight: 900;
        }

        .camera-small-sub {
          color: #60758a;
          font-size: 7px;
          margin-top: 3px;
        }

        .camera-online {
          color: #45da8e;
          font-size: 7px;
          font-weight: 900;
        }

        /* ===============================================
           OTHER PAGES
        =============================================== */

        .page-content {
          width: 100%;
        }

        .camera-network-grid {
          display: grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(260px, 1fr)
            );
          gap: 15px;
        }

        .camera-network-card {
          background: #0b1827;
          border: 1px solid #1b2d40;
          border-radius: 8px;
          padding: 18px;
        }

        .camera-network-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .camera-code {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: #12314a;
          color: #55c2ff;
          font-size: 10px;
          font-weight: 900;
        }

        .camera-network-title {
          margin-top: 15px;
          font-size: 13px;
          font-weight: 900;
        }

        .camera-network-location {
          color: #61758a;
          font-size: 9px;
          margin-top: 4px;
        }

        .camera-specs {
          display: grid;
          grid-template-columns:
            repeat(2, 1fr);
          gap: 10px;
          margin-top: 18px;
          border-top: 1px solid #1b2d40;
          padding-top: 14px;
        }

        .camera-specs span {
          display: block;
          color: #5d7286;
          font-size: 7px;
          margin-bottom: 4px;
        }

        .camera-specs strong {
          font-size: 9px;
        }

        /* ===============================================
           TIMELINE
        =============================================== */

        .timeline {
          position: relative;
          padding-left: 25px;
        }

        .timeline::before {
          content: "";
          position: absolute;
          left: 8px;
          top: 0;
          bottom: 0;
          width: 1px;
          background: #24384b;
        }

        .timeline-item {
          position: relative;
          display: flex;
          gap: 15px;
          padding-bottom: 20px;
        }

        .timeline-dot {
          position: absolute;
          left: -25px;
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: #11334c;
          border: 1px solid #2c668d;
          color: #58c3ff;
          font-size: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .timeline-content {
          background: #0b1827;
          border: 1px solid #1b2d40;
          border-radius: 7px;
          padding: 13px;
          width: 100%;
        }

        .timeline-time {
          color: #55c2ff;
          font-size: 8px;
          font-weight: 900;
        }

        .timeline-title {
          margin-top: 6px;
          font-size: 10px;
          font-weight: 900;
        }

        .timeline-meta {
          color: #64788c;
          font-size: 8px;
          margin-top: 4px;
        }

        /* ===============================================
           ANALYTICS
        =============================================== */

        .analytics-grid {
          display: grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(170px, 1fr)
            );
          gap: 15px;
        }

        .analytics-card {
          background: #0b1827;
          border: 1px solid #1b2d40;
          border-radius: 8px;
          padding: 22px;
        }

        .analytics-number {
          font-size: 30px;
          font-weight: 900;
          color: #55c2ff;
        }

        .analytics-label {
          margin-top: 6px;
          color: #63788d;
          font-size: 8px;
          font-weight: 900;
        }

        /* ===============================================
           RESPONSIVE
        =============================================== */

        @media (
          max-width: 1050px
        ) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }

          .side-column {
            display: grid;
            grid-template-columns:
              repeat(
                2,
                1fr
              );
          }
        }

        @media (
          max-width: 760px
        ) {
          .sidebar {
            width: 65px;
          }

          .brand {
            justify-content: center;
            padding: 10px;
          }

          .brand > div:last-child {
            display: none;
          }

          .nav-item {
            justify-content: center;
          }

          .nav-item span:last-child {
            display: none;
          }

          .main {
            margin-left: 65px;
            width: calc(
              100% - 65px
            );
          }

          .topbar {
            padding: 0 15px;
          }

          .page-subtitle,
          .connection {
            display: none;
          }

          .content {
            padding: 15px;
          }

          .side-column {
            display: flex;
          }

          .camera-footer {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .incident-details {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .detection-info {
            display: none;
          }
        }

      `}</style>
    </>
  );
}
