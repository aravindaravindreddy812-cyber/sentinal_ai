import { useEffect, useMemo, useRef, useState } from 'react'

const API = 'https://sentinel-ai-uoug.onrender.com'

function Icon({ children }) {
  return <span className="icon">{children}</span>
}

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
          <div className="brand-name">SENTINEL<span>AI</span></div>
          <div className="brand-sub">BORDER INTELLIGENCE</div>
        </div>
      </div>

      <div className="nav-label">COMMAND CENTER</div>

      <nav>
        {items.map(([key, label, icon]) => (
          <button
            key={key}
            className={`nav-item ${page === key ? 'active' : ''}`}
            onClick={() => setPage(key)}
          >
            <Icon>{icon}</Icon>
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="mini-status">
          <div className="mini-status-title">SYSTEM STATUS</div>
          <StatusRow label="AI ENGINE" />
          <StatusRow label="TRACKING" />
          <StatusRow label="RISK ENGINE" />
          <StatusRow label="DATABASE" />
        </div>

        <div className="version">PROTOTYPE BUILD • 1.0</div>
      </div>
    </aside>
  )
}

function StatusRow({ label, warning = false }) {
  return (
    <div className="status-row">
      <span className={`dot ${warning ? 'amber' : ''}`}></span>
      <span>{label}</span>
      <strong>{warning ? 'CHECK' : 'ONLINE'}</strong>
    </div>
  )
}

function Header({ page }) {
  return (
    <header className="topbar">
      <div>
        <div className="page-kicker">SENTINELAI / COMMAND CENTER</div>

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

function RiskPanel({ incident }) {
  const score = incident?.risk_score ?? 0

  const level =
    score >= 61
      ? 'HIGH'
      : score >= 31
        ? 'MEDIUM'
        : 'LOW'

  return (
    <section className="card risk-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">EXPLAINABLE AI</div>
          <h2>Risk assessment</h2>
        </div>

        <span className={`badge ${level.toLowerCase()}`}>
          {incident ? level : 'NO EVENT'}
        </span>
      </div>

      <div className="risk-score">
        <div className="score-number">{score}</div>
        <div className="score-total">/100</div>
      </div>

      <div className="risk-meter">
        <div style={{ width: `${score}%` }} />
      </div>

      <div className="risk-factors">
        <RiskFactor
          label="Restricted zone"
          value={incident ? '+40' : '+0'}
        />

        <RiskFactor
          label="Night context"
          value={incident && score >= 60 ? '+20' : '+0'}
        />

        <RiskFactor
          label="Persistence"
          value={incident?.duration >= 10 ? '+15' : '+0'}
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
   LIVE CAMERA + YOLO DETECTION
   ========================================================= */

function LiveCamera() {
  const videoRef = useRef(null)
  const overlayRef = useRef(null)
  const detectingRef = useRef(false)
  const violationRef = useRef(false)

  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [detections, setDetections] = useState([])
  const [detectionStatus, setDetectionStatus] = useState('WAITING')
  const [fenceViolation, setFenceViolation] = useState(false)

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
      console.error('Camera access error:', error)

      setCameraError(
        error.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access.'
          : 'Unable to access the camera.'
      )

      setCameraOn(false)
    }
  }

  const detectFrame = async () => {
    if (!videoRef.current) return

    const video = videoRef.current

    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      return
    }

    if (detectingRef.current) return

    detectingRef.current = true
    setDetectionStatus('PROCESSING')

    const canvas =
      document.createElement('canvas')

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')

    if (!ctx) {
      detectingRef.current = false
      setDetectionStatus('WAITING')
      return
    }

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    )

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          detectingRef.current = false
          setDetectionStatus('WAITING')
          return
        }

        try {
          const response = await fetch(
            `${API}/detect`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'image/jpeg'
              },
              body: blob
            }
          )

          if (!response.ok) {
            throw new Error(
              `Detection API returned ${response.status}`
            )
          }

          const data = await response.json()

          if (!data.success) {
            console.error(
              'YOLO detection failed:',
              data.error
            )

            setDetectionStatus('ONLINE')
            return
          }

          const newDetections =
            Array.isArray(data.detections)
              ? data.detections
              : []

          setDetections(newDetections)
          setDetectionStatus('ONLINE')

          /*
           * =========================================
           * VIRTUAL FENCE
           * =========================================
           *
           * Coordinates are based on the ORIGINAL
           * webcam frame returned to YOLO.
           *
           * Restricted zone:
           *
           * X: 25% -> 75%
           * Y: 20% -> 85%
           */

          const frameWidth =
            video.videoWidth

          const frameHeight =
            video.videoHeight

          const fence = {
            x1: frameWidth * 0.25,
            y1: frameHeight * 0.20,
            x2: frameWidth * 0.75,
            y2: frameHeight * 0.85
          }

          let violation = false

          newDetections.forEach(
            (detection) => {

              if (
                detection.label !== 'person'
              ) {
                return
              }

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

              /*
               * Use the bottom-center of the
               * person's bounding box.
               *
               * This is generally more useful
               * for a virtual ground/floor zone
               * than using the center of the body.
               */

              const personX =
                (x1 + x2) / 2

              const personY =
                y2

              const insideFence =
                personX >= fence.x1 &&
                personX <= fence.x2 &&
                personY >= fence.y1 &&
                personY <= fence.y2

              if (insideFence) {
                violation = true
              }
            }
          )

          violationRef.current =
            violation

          setFenceViolation(
            violation
          )

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
      0.7
    )
  }

  /*
   * =========================================
   * CAMERA + DETECTION LOOP
   * =========================================
   */

  useEffect(() => {
    startCamera()

    const detectionTimer =
      setInterval(() => {
        detectFrame()
      }, 3000)

    return () => {
      clearInterval(
        detectionTimer
      )

      const stream =
        videoRef.current?.srcObject

      if (stream) {
        stream
          .getTracks()
          .forEach(
            track =>
              track.stop()
          )
      }
    }
  }, [])

  /*
   * =========================================
   * DRAW YOLO + VIRTUAL FENCE
   * =========================================
   */

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
       * =========================================
       * VIDEO OBJECT-FIT: COVER CALCULATION
       * =========================================
       *
       * Your existing video uses objectFit:
       * cover.
       *
       * Therefore the visible video can be
       * cropped. We calculate the correct scale
       * and offset so YOLO boxes line up with
       * the visible webcam image.
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
          value * scale +
          offsetX

      const toDisplayY =
        value =>
          value * scale +
          offsetY

      /*
       * =========================================
       * VIRTUAL FENCE
       * =========================================
       */

      const fenceX1 =
        toDisplayX(
          videoWidth * 0.25
        )

      const fenceY1 =
        toDisplayY(
          videoHeight * 0.20
        )

      const fenceX2 =
        toDisplayX(
          videoWidth * 0.75
        )

      const fenceY2 =
        toDisplayY(
          videoHeight * 0.85
        )

      const fenceWidth =
        fenceX2 - fenceX1

      const fenceHeight =
        fenceY2 - fenceY1

      ctx.save()

      ctx.lineWidth = 4

      ctx.setLineDash([
        12,
        8
      ])

      ctx.strokeStyle =
        fenceViolation
          ? '#ef4444'
          : '#22c55e'

      ctx.fillStyle =
        fenceViolation
          ? 'rgba(239,68,68,0.08)'
          : 'rgba(34,197,94,0.06)'

      ctx.fillRect(
        fenceX1,
        fenceY1,
        fenceWidth,
        fenceHeight
      )

      ctx.strokeRect(
        fenceX1,
        fenceY1,
        fenceWidth,
        fenceHeight
      )

      ctx.setLineDash([])

      /*
       * Fence label
       */

      const fenceLabel =
        fenceViolation
          ? 'INTRUSION ZONE'
          : 'RESTRICTED ZONE'

      ctx.font =
        'bold 15px Arial'

      const labelWidth =
        ctx.measureText(
          fenceLabel
        ).width

      ctx.fillStyle =
        fenceViolation
          ? '#ef4444'
          : '#22c55e'

      ctx.fillRect(
        fenceX1,
        Math.max(
          0,
          fenceY1 - 30
        ),
        labelWidth + 20,
        28
      )

      ctx.fillStyle =
        '#ffffff'

      ctx.fillText(
        fenceLabel,
        fenceX1 + 10,
        Math.max(
          19,
          fenceY1 - 11
        )
      )

      /*
       * =========================================
       * YOLO BOUNDING BOXES
       * =========================================
       */

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

          const isPerson =
            detection.label ===
            'person'

          /*
           * Determine whether THIS
           * person is inside the fence.
           */

          let personInside =
            false

          if (isPerson) {

            const personX =
              (x1 + x2) / 2

            const personY =
              y2

            personInside =
              personX >=
                videoWidth * 0.25 &&
              personX <=
                videoWidth * 0.75 &&
              personY >=
                videoHeight * 0.20 &&
              personY <=
                videoHeight * 0.85
          }

          ctx.strokeStyle =
            personInside
              ? '#ef4444'
              : '#00e5ff'

          ctx.lineWidth = 3

          ctx.strokeRect(
            boxX1,
            boxY1,
            boxWidth,
            boxHeight
          )

          /*
           * Detection label
           */

          const confidence =
            Math.round(
              Number(
                detection.confidence
              ) * 100
            )

          const label =
            `${detection.label} ${confidence}%`

          ctx.font =
            'bold 14px Arial'

          const textWidth =
            ctx.measureText(
              label
            ).width

          const labelY =
            Math.max(
              0,
              boxY1 - 26
            )

          ctx.fillStyle =
            personInside
              ? '#ef4444'
              : '#00a8cc'

          ctx.fillRect(
            boxX1,
            labelY,
            textWidth + 14,
            25
          )

          ctx.fillStyle =
            '#ffffff'

          ctx.fillText(
            label,
            boxX1 + 7,
            labelY + 17
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

    return () => {
      cancelAnimationFrame(
        animationFrame
      )
    }

  }, [
    detections,
    fenceViolation
  ])

  /*
   * =========================================
   * UI
   * =========================================
   */

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

        {/* YOLO + VIRTUAL FENCE OVERLAY */}

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

        {/* CAMERA LABELS */}

        <div className="camera-overlay top-left">
          CAM C04
        </div>

        <div className="camera-overlay top-right">
          1280 × 720
        </div>

        <div className="camera-overlay bottom-left">
          {cameraOn
            ? 'CAMERA ACTIVE'
            : 'CAMERA OFFLINE'}
        </div>

        {/* YOLO STATUS */}

        {cameraOn && (
          <div
            style={{
              position: 'absolute',
              top: '50px',
              left: '12px',
              zIndex: 20,
              background:
                'rgba(0,0,0,0.80)',
              color: '#fff',
              padding:
                '10px 14px',
              borderRadius: '8px',
              minWidth: '170px',
              fontSize: '13px',
              backdropFilter:
                'blur(4px)'
            }}
          >

            <div
              style={{
                fontWeight: 700,
                marginBottom: '6px'
              }}
            >
              YOLO DETECTION
            </div>

            <div
              style={{
                fontSize: '11px',
                opacity: 0.75,
                marginBottom: '7px'
              }}
            >
              STATUS: {detectionStatus}
            </div>

            {detections.length === 0 ? (

              <div
                style={{
                  opacity: 0.8
                }}
              >
                No objects detected
              </div>

            ) : (

              detections.map(
                (detection, index) => (

                  <div
                    key={index}
                    style={{
                      marginTop: '4px'
                    }}
                  >

                    <strong>
                      {detection.label}
                    </strong>

                    {' — '}

                    {(
                      Number(
                        detection.confidence
                      ) * 100
                    ).toFixed(1)}

                    %

                  </div>

                )
              )

            )}

          </div>
        )}

        {/* VIRTUAL FENCE STATUS */}

        {cameraOn && (
          <div
            style={{
              position: 'absolute',
              top: '50px',
              right: '12px',
              zIndex: 20,
              padding:
                '9px 13px',
              borderRadius: '8px',
              background:
                fenceViolation
                  ? 'rgba(239,68,68,0.95)'
                  : 'rgba(34,197,94,0.95)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '12px',
              boxShadow:
                '0 4px 12px rgba(0,0,0,0.25)'
            }}
          >

            {fenceViolation
              ? '🚨 INTRUSION DETECTED'
              : '🟢 ZONE SECURE'}

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
          label="DETECTION"
          value={detectionStatus}
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

        <h2>Area secure</h2>

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
            {incident.camera} •{' '}
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
          label="Time"
          value={incident.created_at}
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

          <h2>Camera network</h2>
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
  const rows = incidents.slice(0, 5)

  return (
    <section className="card timeline-card">

      <div className="section-head">

        <div>
          <div className="eyebrow">
            EVENT HISTORY
          </div>

          <h2>Incident timeline</h2>
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
                    Incident #{item.id} —{' '}
                    {item.type}
                  </strong>

                  <span>
                    {item.camera} •{' '}
                    {item.zone} • Risk{' '}
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
        i => i.risk_level === 'HIGH'
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
          sub="Risk score ≥ 61"
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
                      i.risk_level || 'LOW'
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
                    .includes('awaiting') ? (

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
   ANALYTICS PAGE
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
        sub="Risk score ≥ 61"
        danger
      />

      <Metric
        label="MEDIUM RISK"
        value={medium}
        sub="Risk score 31–60"
      />

      <Metric
        label="LOW RISK"
        value={low}
        sub="Risk score ≤ 30"
      />

      <section className="card page-card chart-card">

        <div className="eyebrow">
          RISK DISTRIBUTION
        </div>

        <h2>
          Current incident profile
        </h2>

        <div className="bar-row">

          <span>HIGH</span>

          <div>
            <i
              style={{
                width: `${
                  incidents.length
                    ? high /
                      incidents.length *
                      100
                    : 0
                }%`
              }}
            ></i>
          </div>

          <strong>{high}</strong>

        </div>

        <div className="bar-row">

          <span>MEDIUM</span>

          <div>
            <i
              style={{
                width: `${
                  incidents.length
                    ? medium /
                      incidents.length *
                      100
                    : 0
                }%`
              }}
            ></i>
          </div>

          <strong>{medium}</strong>

        </div>

        <div className="bar-row">

          <span>LOW</span>

          <div>
            <i
              style={{
                width: `${
                  incidents.length
                    ? low /
                      incidents.length *
                      100
                    : 0
                }%`
              }}
            ></i>
          </div>

          <strong>{low}</strong>

        </div>

      </section>

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

      setIncidents(data)

      setActiveIncident(
        data.find(
          i =>
            String(i.status)
              .toLowerCase()
              .includes(
                'awaiting'
              )
        ) || null
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
        'Backend action failed. Make sure FastAPI is running.'
      )
    }
  }

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
            : 'FastAPI backend not connected • showing dashboard shell'}

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
