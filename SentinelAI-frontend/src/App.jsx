import { useEffect, useMemo, useRef, useState } from 'react'

const API = 'https://sentinel-ai-uoug.onrender.com'

/* =========================================================
   ICON
   ========================================================= */

function Icon({ children }) {
  return <span className="icon">{children}</span>
}

/* =========================================================
   SIDEBAR
   ========================================================= */

function Sidebar({ page, setPage }) {
  const items = [
    ['dashboard', 'Overview', '⌂'],
    ['cameras', 'Live Cameras', '▣'],
    ['incidents', 'Incidents', '⚠'],
    ['timeline', 'Timeline', '◷'],
    ['analytics', 'Analytics', '◈'],
  ]

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">S</div>

        <div>
          <div className="brand-name">
            SENTINEL<span>AI</span>
          </div>

          <div className="brand-sub">
            BORDER INTELLIGENCE
          </div>
        </div>
      </div>

      <div className="nav-label">
        COMMAND CENTER
      </div>

      <nav>
        {items.map(([key, label, icon]) => (
          <button
            key={key}
            className={`nav-item ${
              page === key ? 'active' : ''
            }`}
            onClick={() => setPage(key)}
          >
            <Icon>{icon}</Icon>
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="mini-status">
          <div className="mini-status-title">
            SYSTEM STATUS
          </div>

          <StatusRow label="AI ENGINE" />
          <StatusRow label="TRACKING" />
          <StatusRow label="RISK ENGINE" />
          <StatusRow label="DATABASE" />
        </div>

        <div className="version">
          PROTOTYPE BUILD • 2.0
        </div>
      </div>
    </aside>
  )
}

function StatusRow({ label }) {
  return (
    <div className="status-row">
      <span className="dot"></span>
      <span>{label}</span>
      <strong>ONLINE</strong>
    </div>
  )
}

/* =========================================================
   HEADER
   ========================================================= */

function Header({ page }) {
  return (
    <header className="topbar">
      <div>
        <div className="page-kicker">
          SENTINELAI / COMMAND CENTER
        </div>

        <h1>
          {page === 'dashboard'
            ? 'Overview'
            : page[0].toUpperCase() + page.slice(1)}
        </h1>
      </div>

      <div className="top-actions">
        <div className="clock">
          {new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </div>

        <div className="system-pill">
          <span className="dot"></span>
          SYSTEM ONLINE
        </div>
      </div>
    </header>
  )
}

/* =========================================================
   RISK PANEL
   ========================================================= */

function RiskPanel({ incident }) {
  const score = Number(incident?.risk_score || 0)

  const level =
    score >= 70
      ? 'HIGH'
      : score >= 50
        ? 'MEDIUM'
        : 'LOW'

  return (
    <section className="card risk-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">
            EXPLAINABLE AI
          </div>

          <h2>Risk assessment</h2>
        </div>

        <span className={`badge ${level.toLowerCase()}`}>
          {incident ? level : 'NO EVENT'}
        </span>
      </div>

      <div className="risk-score">
        <div className="score-number">
          {score}
        </div>

        <div className="score-total">
          /100
        </div>
      </div>

      <div className="risk-meter">
        <div
          style={{
            width: `${score}%`
          }}
        />
      </div>

      <div className="risk-factors">
        <RiskFactor
          label="Restricted zone"
          value={incident ? '+40' : '+0'}
        />

        <RiskFactor
          label="Night context"
          value={
            incident?.risk_score >= 60
              ? '+20'
              : '+0'
          }
        />

        <RiskFactor
          label="Persistence"
          value={
            Number(incident?.duration || 0) >= 10
              ? '+15'
              : '+0'
          }
        />
      </div>
    </section>
  )
}

function RiskFactor({ label, value }) {
  return (
    <div className="factor">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

/* =========================================================
   LIVE CAMERA
   ========================================================= */

function LiveCamera() {
  const videoRef = useRef(null)
  const overlayRef = useRef(null)
  const detectingRef = useRef(false)

  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [detections, setDetections] = useState([])
  const [detectionStatus, setDetectionStatus] =
    useState('WAITING')

  const [zone, setZone] = useState(null)
  const [intrusion, setIntrusion] = useState(false)

  /* ---------------------------------------------------------
     CAMERA
     --------------------------------------------------------- */

  const startCamera = async () => {
    try {
      setCameraError('')

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError(
          'Camera access is not supported by this browser.'
        )
        return
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: false
        })

      if (videoRef.current) {
        videoRef.current.srcObject = stream

        await videoRef.current.play()

        setCameraOn(true)
        setDetectionStatus('WAITING')
      }
    } catch (error) {
      console.error(
        'Camera access error:',
        error
      )

      setCameraError(
        error.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access.'
          : 'Unable to access the camera.'
      )

      setCameraOn(false)
    }
  }

  /* ---------------------------------------------------------
     SEND FRAME TO BACKEND
     --------------------------------------------------------- */

```javascript
const detectFrame = async () => {
  const video = videoRef.current

  if (!video) return

  if (
    video.videoWidth === 0 ||
    video.videoHeight === 0
  ) {
    return
  }

  // Prevent overlapping YOLO requests
  if (detectingRef.current) return

  detectingRef.current = true
  setDetectionStatus('PROCESSING')

  /*
   * Keep the webcam itself at its normal resolution.
   * Only resize the frame sent to YOLO.
   *
   * 1280x720 webcam
   *       ↓
   * 640x360 AI frame
   */
  const MAX_AI_WIDTH = 640
  const MAX_AI_HEIGHT = 360

  const scale = Math.min(
    MAX_AI_WIDTH / video.videoWidth,
    MAX_AI_HEIGHT / video.videoHeight,
    1
  )

  const aiWidth = Math.round(
    video.videoWidth * scale
  )

  const aiHeight = Math.round(
    video.videoHeight * scale
  )

  const canvas =
    document.createElement('canvas')

  canvas.width = aiWidth
  canvas.height = aiHeight

  const ctx = canvas.getContext('2d')

  if (!ctx) {
    detectingRef.current = false
    return
  }

  // Draw the smaller AI frame
  ctx.drawImage(
    video,
    0,
    0,
    aiWidth,
    aiHeight
  )

  canvas.toBlob(
    async blob => {
      if (!blob) {
        detectingRef.current = false
        return
      }

      try {
        const response =
          await fetch(`${API}/detect`, {
            method: 'POST',
            headers: {
              'Content-Type':
                'image/jpeg'
            },
            body: blob
          })

        if (!response.ok) {
          throw new Error(
            `Detection API returned ${response.status}`
          )
        }

        const data =
          await response.json()

        if (data.success) {
          setDetections(
            Array.isArray(data.detections)
              ? data.detections
              : []
          )

          if (data.zone) {
            setZone(data.zone)
          }

          setIntrusion(
            Boolean(
              data.intrusion_detected
            )
          )

          setDetectionStatus('ONLINE')
        }
      } catch (error) {
        console.error(
          'YOLO detection error:',
          error
        )
      } finally {
        detectingRef.current = false
      }
    },
    'image/jpeg',
    0.65
  )
}
```


  /* ---------------------------------------------------------
     CAMERA + DETECTION LOOP
     --------------------------------------------------------- */

  useEffect(() => {
    startCamera()

    /*
      1000ms gives a much better balance between:
      webcam responsiveness and Render/YOLO processing.
    */
    const timer =
      setInterval(() => {
        detectFrame()
      }, 3000)

    return () => {
      clearInterval(timer)

      const stream =
        videoRef.current?.srcObject

      if (stream) {
        stream
          .getTracks()
          .forEach(track =>
            track.stop()
          )
      }
    }
  }, [])

  /* ---------------------------------------------------------
     DRAW OVERLAY
     --------------------------------------------------------- */

  useEffect(() => {
    let animationFrame

    const drawOverlay = () => {
      const video =
        videoRef.current

      const canvas =
        overlayRef.current

      if (!video || !canvas) {
        animationFrame =
          requestAnimationFrame(
            drawOverlay
          )
        return
      }

      const displayWidth =
        video.clientWidth

      const displayHeight =
        video.clientHeight

      const videoWidth =
        video.videoWidth

      const videoHeight =
        video.videoHeight

      if (
        !displayWidth ||
        !displayHeight ||
        !videoWidth ||
        !videoHeight
      ) {
        animationFrame =
          requestAnimationFrame(
            drawOverlay
          )
        return
      }

      canvas.width =
        displayWidth

      canvas.height =
        displayHeight

      const ctx =
        canvas.getContext('2d')

      if (!ctx) return

      ctx.clearRect(
        0,
        0,
        displayWidth,
        displayHeight
      )

      /*
        Video uses object-fit: cover.
      */

      const scale =
        Math.max(
          displayWidth / videoWidth,
          displayHeight / videoHeight
        )

      const renderedWidth =
        videoWidth * scale

      const renderedHeight =
        videoHeight * scale

      const offsetX =
        (displayWidth -
          renderedWidth) / 2

      const offsetY =
        (displayHeight -
          renderedHeight) / 2

      const toDisplayX =
        value =>
          value * scale + offsetX

      const toDisplayY =
        value =>
          value * scale + offsetY

      ctx.save()

      /* -------------------------------------------------------
         RESTRICTED ZONE
      ------------------------------------------------------- */

      if (zone) {
        const zx1 =
          toDisplayX(zone.x1)

        const zy1 =
          toDisplayY(zone.y1)

        const zx2 =
          toDisplayX(zone.x2)

        const zy2 =
          toDisplayY(zone.y2)

        const zoneWidth =
          zx2 - zx1

        const zoneHeight =
          zy2 - zy1

        ctx.lineWidth = 4

        ctx.setLineDash([
          12,
          8
        ])

        ctx.strokeStyle =
          intrusion
            ? '#ef4444'
            : '#22c55e'

        ctx.fillStyle =
          intrusion
            ? 'rgba(239,68,68,0.10)'
            : 'rgba(34,197,94,0.06)'

        ctx.fillRect(
          zx1,
          zy1,
          zoneWidth,
          zoneHeight
        )

        ctx.strokeRect(
          zx1,
          zy1,
          zoneWidth,
          zoneHeight
        )

        ctx.setLineDash([])

        const zoneLabel =
          intrusion
            ? '⚠ INTRUSION ZONE'
            : 'RESTRICTED ZONE'

        ctx.font =
          'bold 15px Arial'

        const labelWidth =
          ctx.measureText(
            zoneLabel
          ).width

        ctx.fillStyle =
          intrusion
            ? '#ef4444'
            : '#22c55e'

        ctx.fillRect(
          zx1,
          Math.max(
            0,
            zy1 - 30
          ),
          labelWidth + 24,
          28
        )

        ctx.fillStyle =
          '#ffffff'

        ctx.fillText(
          zoneLabel,
          zx1 + 10,
          Math.max(
            19,
            zy1 - 11
          )
        )
      }

      /* -------------------------------------------------------
         PERSON BOXES
      ------------------------------------------------------- */

      detections.forEach(
        detection => {
          if (
            !Array.isArray(
              detection.box
            )
          ) {
            return
          }

          const [
            x1,
            y1,
            x2,
            y2
          ] = detection.box

          const boxX1 =
            toDisplayX(x1)

          const boxY1 =
            toDisplayY(y1)

          const boxX2 =
            toDisplayX(x2)

          const boxY2 =
            toDisplayY(y2)

          const boxWidth =
            boxX2 - boxX1

          const boxHeight =
            boxY2 - boxY1

          const status =
            String(
              detection.zone_status ||
              'OUTSIDE'
            ).toUpperCase()

          const isDanger =
            status === 'ENTERED' ||
            status === 'INSIDE'

          const isApproaching =
            status === 'APPROACHING'

          let boxColor =
            '#00e5ff'

          if (isDanger) {
            boxColor = '#ef4444'
          } else if (
            isApproaching
          ) {
            boxColor = '#f59e0b'
          } else if (
            status === 'EXITED'
          ) {
            boxColor = '#22c55e'
          }

          ctx.lineWidth = 3
          ctx.strokeStyle =
            boxColor

          ctx.strokeRect(
            boxX1,
            boxY1,
            boxWidth,
            boxHeight
          )

          /* ---------------------------------------------------
             PERSON LABEL
          --------------------------------------------------- */

          const confidence =
            Math.round(
              Number(
                detection.confidence
              ) * 100
            )

          const track =
            detection.track_id ??
            '?'

          const personLabel =
            `PERSON #${track} • ${confidence}%`

          ctx.font =
            'bold 13px Arial'

          const personTextWidth =
            ctx.measureText(
              personLabel
            ).width

          const labelY =
            Math.max(
              0,
              boxY1 - 29
            )

          ctx.fillStyle =
            boxColor

          ctx.fillRect(
            boxX1,
            labelY,
            personTextWidth + 14,
            25
          )

          ctx.fillStyle =
            '#ffffff'

          ctx.fillText(
            personLabel,
            boxX1 + 7,
            labelY + 17
          )

          /* ---------------------------------------------------
             ZONE STATUS LABEL
          --------------------------------------------------- */

          let statusText =
            '✓ OUTSIDE RESTRICTED ZONE'

          if (
            status === 'APPROACHING'
          ) {
            statusText =
              '⚠ APPROACHING ZONE'
          }

          if (
            status === 'ENTERED'
          ) {
            statusText =
              '🚨 ENTERED RESTRICTED ZONE'
          }

          if (
            status === 'INSIDE'
          ) {
            statusText =
              '🚨 INSIDE RESTRICTED ZONE'
          }

          if (
            status === 'EXITED'
          ) {
            statusText =
              '✓ EXITED RESTRICTED ZONE'
          }

          ctx.font =
            'bold 12px Arial'

          const statusWidth =
            ctx.measureText(
              statusText
            ).width

          const statusY =
            Math.min(
              displayHeight - 24,
              boxY2 + 5
            )

          ctx.fillStyle =
            boxColor

          ctx.fillRect(
            boxX1,
            statusY,
            statusWidth + 14,
            21
          )

          ctx.fillStyle =
            '#ffffff'

          ctx.fillText(
            statusText,
            boxX1 + 7,
            statusY + 15
          )
        }
      )

      ctx.restore()

      animationFrame =
        requestAnimationFrame(
          drawOverlay
        )
    }

    animationFrame =
      requestAnimationFrame(
        drawOverlay
      )

    return () =>
      cancelAnimationFrame(
        animationFrame
      )
  }, [
    detections,
    zone,
    intrusion
  ])

  /* ---------------------------------------------------------
     CURRENT EVENT SUMMARY
  --------------------------------------------------------- */

  const importantDetection =
    detections.find(
      d =>
        d.zone_status ===
          'ENTERED' ||
        d.zone_status ===
          'INSIDE' ||
        d.zone_status ===
          'APPROACHING' ||
        d.zone_status ===
          'EXITED'
    )

  return (
    <section className="card camera-card">

      <div className="section-head">
        <div>
          <div className="eyebrow">
            LIVE SURVEILLANCE
          </div>

          <h2>
            Camera C04
          </h2>
        </div>

        <span className="camera-live">
          <span className="dot"></span>

          {cameraOn
            ? 'LIVE'
            : 'WAITING'}
        </span>
      </div>

      <div
        className="video-wrap"
        style={{
          position: 'relative',
          overflow: 'hidden'
        }}
      >

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: cameraOn
              ? 'block'
              : 'none'
          }}
        />

        <canvas
          ref={overlayRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 10
          }}
        />

        {!cameraOn && (
          <div className="video-overlay">
            <div className="video-icon">
              ◉
            </div>

            <strong>
              {cameraError ||
                'Requesting camera access...'}
            </strong>

            {!cameraError && (
              <span>
                Please allow camera permission
                to start live surveillance.
              </span>
            )}

            {cameraError && (
              <button
                className="btn verify"
                onClick={startCamera}
                style={{
                  marginTop: '12px'
                }}
              >
                ALLOW CAMERA
              </button>
            )}
          </div>
        )}

        <div className="camera-overlay top-left">
          CAM C04
        </div>

        <div className="camera-overlay top-right">
          {videoRef.current?.videoWidth || 1280}
          {' × '}
          {videoRef.current?.videoHeight || 720}
        </div>

        <div className="camera-overlay bottom-left">
          {cameraOn
            ? 'CAMERA ACTIVE'
            : 'CAMERA OFFLINE'}
        </div>

        {/* AI STATUS */}

        {cameraOn && (
          <div
            style={{
              position: 'absolute',
              top: '50px',
              left: '12px',
              zIndex: 20,
              background:
                'rgba(0,0,0,0.82)',
              color: '#fff',
              padding:
                '10px 14px',
              borderRadius: '8px',
              minWidth: '190px',
              fontSize: '12px',
              backdropFilter:
                'blur(5px)'
            }}
          >

            <div
              style={{
                fontWeight: 800,
                marginBottom: '7px'
              }}
            >
              SENTINEL AI
            </div>

            <div
              style={{
                opacity: 0.75,
                marginBottom: '8px'
              }}
            >
              YOLOv8n • ByteTrack
            </div>

            <div>
              STATUS:{' '}
              <strong>
                {detectionStatus}
              </strong>
            </div>

            <div>
              PERSONS:{' '}
              <strong>
                {detections.length}
              </strong>
            </div>

          </div>
        )}

        {/* EVENT PANEL */}

        {cameraOn && (
          <div
            style={{
              position: 'absolute',
              right: '12px',
              top: '50px',
              zIndex: 20,
              background:
                importantDetection
                  ? importantDetection.zone_status ===
                      'ENTERED' ||
                    importantDetection.zone_status ===
                      'INSIDE'
                    ? 'rgba(180,0,0,0.94)'
                    : 'rgba(160,100,0,0.94)'
                  : 'rgba(0,100,60,0.92)',
              color: '#fff',
              padding:
                '10px 13px',
              borderRadius: '8px',
              minWidth: '190px',
              fontSize: '12px',
              boxShadow:
                '0 5px 18px rgba(0,0,0,0.25)'
            }}
          >

            <div
              style={{
                fontWeight: 900,
                marginBottom: '6px'
              }}
            >
              {importantDetection
                ? importantDetection.zone_status ===
                    'ENTERED'
                  ? '🚨 ENTRY DETECTED'
                  : importantDetection.zone_status ===
                      'INSIDE'
                    ? '🚨 INTRUSION ACTIVE'
                    : importantDetection.zone_status ===
                        'APPROACHING'
                      ? '⚠ APPROACHING'
                      : '✓ EXIT DETECTED'
                : '✓ ZONE SECURE'}
            </div>

            {importantDetection && (
              <>
                <div>
                  PERSON #
                  {importantDetection.track_id}
                </div>

                <div>
                  MOVEMENT:{' '}
                  {importantDetection.movement}
                </div>

                <div>
                  DURATION:{' '}
                  {importantDetection.duration}s
                </div>

                <div>
                  RISK:{' '}
                  {importantDetection.risk_score}
                  {' '}
                  ({importantDetection.risk_level})
                </div>
              </>
            )}

          </div>
        )}

        {/* OBJECT COUNT */}

        {cameraOn && (
          <div
            style={{
              position: 'absolute',
              right: '12px',
              bottom: '42px',
              zIndex: 20,
              background:
                'rgba(0,0,0,0.75)',
              color: '#fff',
              padding:
                '7px 10px',
              borderRadius: '6px',
              fontSize: '12px'
            }}
          >
            OBJECTS: {detections.length}
          </div>
        )}

      </div>

      {/* LIVE DETECTION DETAILS */}

      {detections.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit,minmax(180px,1fr))',
            gap: '8px',
            marginTop: '12px'
          }}
        >

          {detections.map(
            detection => (
              <div
                key={
                  detection.track_id
                }
                style={{
                  border:
                    '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  padding: '9px 10px',
                  background:
                    'rgba(0,0,0,0.12)'
                }}
              >

                <strong>
                  PERSON #
                  {detection.track_id}
                </strong>

                <div
                  style={{
                    fontSize: '11px',
                    marginTop: '4px'
                  }}
                >
                  STATE:{' '}
                  {detection.zone_status}
                </div>

                <div
                  style={{
                    fontSize: '11px'
                  }}
                >
                  MOVEMENT:{' '}
                  {detection.movement}
                </div>

                <div
                  style={{
                    fontSize: '11px'
                  }}
                >
                  TIME:{' '}
                  {detection.duration}s
                </div>

                <div
                  style={{
                    fontSize: '11px'
                  }}
                >
                  RISK:{' '}
                  {detection.risk_score}
                  {' '}
                  {detection.risk_level}
                </div>

              </div>
            )
          )}

        </div>
      )}

      <div className="camera-stats">

        <Stat
          label="STATUS"
          value={
            cameraOn
              ? 'ONLINE'
              : 'WAITING'
          }
        />

        <Stat
          label="SOURCE"
          value="BROWSER WEBCAM"
        />

        <Stat
          label="MODEL"
          value="YOLOv8n"
        />

        <Stat
          label="TRACKER"
          value="ByteTrack"
        />

      </div>

    </section>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

/* =========================================================
   INCIDENT CARD
   ========================================================= */

function IncidentCard({
  incident,
  onAction
}) {
  if (!incident) {
    return (
      <section className="card incident-card empty">
        <div className="empty-icon">
          ✓
        </div>

        <div className="eyebrow">
          ACTIVE INCIDENT
        </div>

        <h2>
          Area secure
        </h2>

        <p>
          No active incident is currently
          being reported by the backend.
        </p>
      </section>
    )
  }

  return (
    <section className="card incident-card">

      <div className="incident-top">

        <div>
          <div className="eyebrow">
            ACTIVE INCIDENT
          </div>

          <h2>
            Incident #{incident.id}
          </h2>
        </div>

        <span
          className={`badge ${String(
            incident.risk_level || 'LOW'
          ).toLowerCase()}`}
        >
          {incident.risk_level || 'LOW'}
        </span>

      </div>

      <div className="incident-title">

        <span className="alert-symbol">
          !
        </span>

        <div>
          <strong>
            {incident.type}
          </strong>

          <span>
            {incident.camera}
            {' • '}
            {incident.zone}
          </span>
        </div>

      </div>

      <div className="detail-grid">

        <Detail
          label="Person"
          value={`ID ${incident.person_id}`}
        />

        <Detail
          label="Movement"
          value={incident.movement}
        />

        <Detail
          label="Duration"
          value={`${incident.duration} sec`}
        />

        <Detail
          label="Risk"
          value={`${incident.risk_score}/100`}
        />

        <Detail
          label="Time"
          value={incident.created_at}
        />

        <Detail
          label="Status"
          value={incident.status}
        />

      </div>

      <div className="incident-actions">

        <button
          className="btn verify"
          onClick={() =>
            onAction(
              'verify',
              incident.id
            )
          }
        >
          VERIFY INCIDENT
        </button>

        <button
          className="btn dismiss"
          onClick={() =>
            onAction(
              'dismiss',
              incident.id
            )
          }
        >
          DISMISS
        </button>

      </div>

    </section>
  )
}

function Detail({ label, value }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

/* =========================================================
   CAMERA NETWORK
   ========================================================= */

function CameraNetwork() {
  return (
    <section className="card network-card">

      <div className="section-head">
        <div>
          <div className="eyebrow">
            SURVEILLANCE NETWORK
          </div>

          <h2>
            Camera network
          </h2>
        </div>

        <span className="muted">
          3 nodes
        </span>
      </div>

      <div className="camera-list">

        <CameraNode
          id="C04"
          status="ONLINE"
          live
        />

        <CameraNode
          id="C05"
          status="STANDBY"
        />

        <CameraNode
          id="C07"
          status="OFFLINE"
          offline
        />

      </div>

    </section>
  )
}

function CameraNode({
  id,
  status,
  live,
  offline
}) {
  return (
    <div className="camera-node">

      <div className="node-icon">
        ▣
      </div>

      <div className="node-info">
        <strong>{id}</strong>

        <span>
          {live
            ? 'Primary browser webcam'
            : 'Prototype node'}
        </span>
      </div>

      <div
        className={`node-status ${
          offline
            ? 'offline'
            : live
              ? ''
              : 'standby'
        }`}
      >
        <span className="dot"></span>
        {status}
      </div>

    </div>
  )
}

/* =========================================================
   TIMELINE
   ========================================================= */

function Timeline({ incidents }) {
  const rows =
    incidents.slice(0, 5)

  return (
    <section className="card timeline-card">

      <div className="section-head">
        <div>
          <div className="eyebrow">
            EVENT HISTORY
          </div>

          <h2>
            Incident timeline
          </h2>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty-timeline">
          No incidents recorded yet.
        </div>
      ) : (
        <div className="timeline">

          {rows.map(
            (item, index) => (
              <div
                className="timeline-item"
                key={item.id}
              >

                <div className="timeline-line">
                  <span
                    className={`timeline-dot ${
                      index === 0
                        ? 'active'
                        : ''
                    }`}
                  ></span>
                </div>

                <div className="timeline-content">

                  <span className="timeline-time">
                    {item.created_at}
                  </span>

                  <strong>
                    Incident #{item.id}
                    {' — '}
                    {item.type}
                  </strong>

                  <span>
                    {item.camera}
                    {' • '}
                    {item.zone}
                    {' • Risk '}
                    {item.risk_score}
                  </span>

                </div>

              </div>
            )
          )}

        </div>
      )}

    </section>
  )
}

/* =========================================================
   OVERVIEW
   ========================================================= */

function Overview({
  incidents,
  activeIncident,
  onAction
}) {
  const stats = useMemo(() => {

    const high =
      incidents.filter(
        i =>
          i.risk_level === 'HIGH'
      ).length

    const pending =
      incidents.filter(
        i =>
          String(i.status)
            .toLowerCase()
            .includes('awaiting')
      ).length

    return {
      total: incidents.length,
      high,
      pending
    }

  }, [incidents])

  return (
    <>
      <div className="stats-grid">

        <Metric
          label="TOTAL INCIDENTS"
          value={stats.total}
          sub="Recorded in SQLite"
        />

        <Metric
          label="HIGH RISK"
          value={stats.high}
          sub="Risk score ≥ 70"
          danger
        />

        <Metric
          label="PENDING REVIEW"
          value={stats.pending}
          sub="Awaiting verification"
        />

        <Metric
          label="ACTIVE CAMERA"
          value="C04"
          sub="Browser webcam connected"
        />

      </div>

      <div className="main-grid">

        <LiveCamera />

        <IncidentCard
          incident={activeIncident}
          onAction={onAction}
        />

      </div>

      <div className="lower-grid">

        <RiskPanel
          incident={activeIncident}
        />

        <CameraNetwork />

      </div>

      <Timeline
        incidents={incidents}
      />
    </>
  )
}

function Metric({
  label,
  value,
  sub,
  danger
}) {
  return (
    <div className="metric">

      <div className="metric-label">
        {label}
      </div>

      <div
        className={`metric-value ${
          danger
            ? 'danger-text'
            : ''
        }`}
      >
        {value}
      </div>

      <div className="metric-sub">
        {sub}
      </div>

    </div>
  )
}

/* =========================================================
   INCIDENTS PAGE
   ========================================================= */

function IncidentsPage({
  incidents,
  onAction
}) {
  return (
    <section className="card page-card">

      <div className="section-head">

        <div>
          <div className="eyebrow">
            DATABASE
          </div>

          <h2>
            Incident records
          </h2>
        </div>

        <span className="muted">
          {incidents.length} records
        </span>

      </div>

      <div className="table-wrap">

        <table>

          <thead>
            <tr>
              <th>ID</th>
              <th>Camera</th>
              <th>Event</th>
              <th>Risk</th>
              <th>Time</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>

            {incidents.map(i => (
              <tr key={i.id}>

                <td>
                  #{i.id}
                </td>

                <td>
                  {i.camera}
                </td>

                <td>
                  {i.type}
                </td>

                <td>
                  <span
                    className={`badge small ${String(
                      i.risk_level ||
                      'LOW'
                    ).toLowerCase()}`}
                  >
                    {i.risk_score}
                  </span>
                </td>

                <td>
                  {i.created_at}
                </td>

                <td>
                  {i.status}
                </td>

                <td>

                  {String(i.status)
                    .toLowerCase()
                    .includes(
                      'awaiting'
                    ) ? (

                    <div className="table-actions">

                      <button
                        onClick={() =>
                          onAction(
                            'verify',
                            i.id
                          )
                        }
                      >
                        Verify
                      </button>

                      <button
                        onClick={() =>
                          onAction(
                            'dismiss',
                            i.id
                          )
                        }
                      >
                        Dismiss
                      </button>

                    </div>

                  ) : (
                    <span className="muted">
                      Closed
                    </span>
                  )}

                </td>

              </tr>
            ))}

          </tbody>

        </table>

      </div>

    </section>
  )
}

/* =========================================================
   CAMERAS PAGE
   ========================================================= */

function CamerasPage() {
  return (
    <div className="camera-page-grid">

      <LiveCamera />

      <CameraNetwork />

      <section className="card page-card">

        <div className="eyebrow">
          CURRENT CONFIGURATION
        </div>

        <h2>
          Camera C04
        </h2>

        <div className="config-grid">

          <Detail
            label="Input"
            value="Browser Webcam"
          />

          <Detail
            label="Resolution"
            value="1280 × 720"
          />

          <Detail
            label="Model"
            value="YOLOv8n"
          />

          <Detail
            label="Tracker"
            value="ByteTrack"
          />

          <Detail
            label="Zone"
            value="Restricted Zone B"
          />

          <Detail
            label="Confidence"
            value="0.45"
          />

        </div>

      </section>

    </div>
  )
}

/* =========================================================
   TIMELINE PAGE
   ========================================================= */

function TimelinePage({
  incidents
}) {
  return (
    <Timeline
      incidents={incidents}
    />
  )
}

/* =========================================================
   ANALYTICS
   ========================================================= */

function AnalyticsPage({
  incidents
}) {
  const high =
    incidents.filter(
      i => i.risk_level === 'HIGH'
    ).length

  const medium =
    incidents.filter(
      i => i.risk_level === 'MEDIUM'
    ).length

  const low =
    incidents.filter(
      i => i.risk_level === 'LOW'
    ).length

  return (
    <div className="analytics-grid">

      <Metric
        label="TOTAL EVENTS"
        value={incidents.length}
        sub="From current database"
      />

      <Metric
        label="HIGH RISK"
        value={high}
        sub="Risk score ≥ 70"
        danger
      />

      <Metric
        label="MEDIUM RISK"
        value={medium}
        sub="Risk score 50–69"
      />

      <Metric
        label="LOW RISK"
        value={low}
        sub="Risk score < 50"
      />

      <section className="card page-card chart-card">

        <div className="eyebrow">
          RISK DISTRIBUTION
        </div>

        <h2>
          Current incident profile
        </h2>

        <RiskBar
          label="HIGH"
          value={high}
          total={incidents.length}
        />

        <RiskBar
          label="MEDIUM"
          value={medium}
          total={incidents.length}
        />

        <RiskBar
          label="LOW"
          value={low}
          total={incidents.length}
        />

      </section>

    </div>
  )
}

function RiskBar({
  label,
  value,
  total
}) {
  const percentage =
    total
      ? (value / total) * 100
      : 0

  return (
    <div className="bar-row">

      <span>
        {label}
      </span>

      <div>
        <i
          style={{
            width: `${percentage}%`
          }}
        ></i>
      </div>

      <strong>
        {value}
      </strong>

    </div>
  )
}

/* =========================================================
   MAIN APP
   ========================================================= */

export default function App() {

  const [page, setPage] =
    useState('dashboard')

  const [incidents, setIncidents] =
    useState([])

  const [activeIncident, setActiveIncident] =
    useState(null)

  const [apiOnline, setApiOnline] =
    useState(false)

  /* ---------------------------------------------------------
     LOAD REAL INCIDENTS
  --------------------------------------------------------- */

  async function loadIncidents() {

    try {

      const response =
        await fetch(
          `${API}/incidents`
        )

      if (!response.ok) {
        throw new Error(
          'API error'
        )
      }

      const data =
        await response.json()

      setIncidents(
        Array.isArray(data)
          ? data
          : []
      )

      /*
        Most recent pending incident.
      */

      const pending =
        data.find(
          i =>
            String(i.status)
              .toLowerCase()
              .includes(
                'awaiting'
              )
        )

      setActiveIncident(
        pending || null
      )

      setApiOnline(true)

    } catch (error) {

      console.error(
        'Incident API error:',
        error
      )

      setApiOnline(false)

    }
  }

  /* ---------------------------------------------------------
     VERIFY / DISMISS
  --------------------------------------------------------- */

  async function handleAction(
    action,
    id
  ) {

    try {

      const response =
        await fetch(
          `${API}/incidents/${id}/${action}`,
          {
            method: 'PUT'
          }
        )

      if (!response.ok) {
        throw new Error(
          'Action failed'
        )
      }

      await loadIncidents()

    } catch (error) {

      console.error(error)

      alert(
        'Backend action failed.'
      )
    }
  }

  /* ---------------------------------------------------------
     DATABASE POLLING
  --------------------------------------------------------- */

  useEffect(() => {

    loadIncidents()

    const timer =
      setInterval(
        loadIncidents,
        3000
      )

    return () =>
      clearInterval(timer)

  }, [])

  /* ---------------------------------------------------------
     UI
  --------------------------------------------------------- */

  return (
    <div className="app-shell">

      <Sidebar
        page={page}
        setPage={setPage}
      />

      <main className="content">

        <Header
          page={page}
        />

        <div className="connection-banner">

          <span
            className={`dot ${
              apiOnline
                ? ''
                : 'amber'
            }`}
          ></span>

          {apiOnline
            ? 'FastAPI backend connected • SQLite synchronized'
            : 'FastAPI backend not connected'}

        </div>

        {page === 'dashboard' && (
          <Overview
            incidents={incidents}
            activeIncident={activeIncident}
            onAction={handleAction}
          />
        )}

        {page === 'incidents' && (
          <IncidentsPage
            incidents={incidents}
            onAction={handleAction}
          />
        )}

        {page === 'cameras' && (
          <CamerasPage />
        )}

        {page === 'timeline' && (
          <TimelinePage
            incidents={incidents}
          />
        )}

        {page === 'analytics' && (
          <AnalyticsPage
            incidents={incidents}
          />
        )}

      </main>

    </div>
  )
}
