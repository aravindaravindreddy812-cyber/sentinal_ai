import { useEffect, useMemo, useRef, useState } from 'react'

const API = 'https://sentinel-ai-uoug.onrender.com'

const demoIncident = {
  id: 101,
  type: 'Restricted-Zone Intrusion',
  camera: 'C04',
  zone: 'Restricted Zone B',
  person_id: 1,
  movement: 'STATIONARY',
  duration: 2,
  risk_score: 60,
  risk_level: 'MEDIUM',
  created_at: '21:56:49',
  status: 'Awaiting Verification'
}

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
        <h1>{page === 'dashboard' ? 'Overview' : page[0].toUpperCase() + page.slice(1)}</h1>
      </div>
      <div className="top-actions">
        <div className="clock">{new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})}</div>
        <div className="system-pill"><span className="dot"></span> SYSTEM ONLINE</div>
      </div>
    </header>
  )
}

function RiskPanel({ incident }) {
  const score = incident?.risk_score ?? 0
  const level = score >= 61 ? 'HIGH' : score >= 31 ? 'MEDIUM' : 'LOW'
  return (
    <section className="card risk-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">EXPLAINABLE AI</div>
          <h2>Risk assessment</h2>
        </div>
        <span className={`badge ${level.toLowerCase()}`}>{level}</span>
      </div>

      <div className="risk-score">
        <div className="score-number">{score}</div>
        <div className="score-total">/100</div>
      </div>

      <div className="risk-meter">
        <div style={{ width: `${score}%` }} />
      </div>

      <div className="risk-factors">
        <RiskFactor label="Restricted zone" value="+40" />
        <RiskFactor label="Night context" value={score >= 60 ? "+20" : "+0"} />
        <RiskFactor label="Persistence" value={incident?.duration >= 10 ? "+15" : "+0"} />
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

function LiveCamera() {
  const videoRef = useRef(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')

  const startCamera = async () => {
    try {
      setCameraError('')

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access is not supported by this browser.')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
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
      }
    } catch (error) {
      console.error('Camera access error:', error)
      setCameraError(
        error.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access.'
          : 'Unable to access the camera.'
      )
    }
  }

  useEffect(() => {
    startCamera()

    return () => {
      const stream = videoRef.current?.srcObject

      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return (
    <section className="card camera-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">LIVE SURVEILLANCE</div>
          <h2>Camera C04</h2>
        </div>

        <span className="camera-live">
          <span className="dot"></span>
          {cameraOn ? 'LIVE' : 'WAITING'}
        </span>
      </div>

      <div className="video-wrap">

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: cameraOn ? 'block' : 'none'
          }}
        />

        {!cameraOn && (
          <div className="video-overlay">
            <div className="video-icon">◉</div>

            <strong>
              {cameraError || 'Requesting camera access...'}
            </strong>

            {!cameraError && (
              <span>
                Please allow camera permission to start live surveillance.
              </span>
            )}

            {cameraError && (
              <button
                className="btn verify"
                onClick={startCamera}
                style={{ marginTop: '12px' }}
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
          1280 × 720
        </div>

        <div className="camera-overlay bottom-left">
          {cameraOn ? 'CAMERA ACTIVE' : 'CAMERA OFFLINE'}
        </div>

      </div>

      <div className="camera-stats">
        <Stat
          label="STATUS"
          value={cameraOn ? 'ONLINE' : 'WAITING'}
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
          value="BYTE"
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

function IncidentCard({ incident, onAction }) {
  if (!incident) {
    return (
      <section className="card incident-card empty">
        <div className="empty-icon">✓</div>
        <div className="eyebrow">ACTIVE INCIDENT</div>
        <h2>Area secure</h2>
        <p>No active incident is currently being reported by the prototype.</p>
      </section>
    )
  }

  return (
    <section className="card incident-card">
      <div className="incident-top">
        <div>
          <div className="eyebrow">ACTIVE INCIDENT</div>
          <h2>Incident #{incident.id}</h2>
        </div>
        <span className={`badge ${String(incident.risk_level || 'LOW').toLowerCase()}`}>
          {incident.risk_level || 'LOW'}
        </span>
      </div>

      <div className="incident-title">
        <span className="alert-symbol">!</span>
        <div>
          <strong>{incident.type}</strong>
          <span>{incident.camera} • {incident.zone}</span>
        </div>
      </div>

      <div className="detail-grid">
        <Detail label="Person" value={`ID ${incident.person_id}`} />
        <Detail label="Movement" value={incident.movement} />
        <Detail label="Duration" value={`${incident.duration} sec`} />
        <Detail label="Time" value={incident.created_at} />
      </div>

      <div className="incident-actions">
        <button className="btn verify" onClick={() => onAction('verify', incident.id)}>VERIFY INCIDENT</button>
        <button className="btn dismiss" onClick={() => onAction('dismiss', incident.id)}>DISMISS</button>
      </div>
    </section>
  )
}

function Detail({ label, value }) {
  return <div className="detail"><span>{label}</span><strong>{value}</strong></div>
}

function CameraNetwork() {
  return (
    <section className="card network-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">SURVEILLANCE NETWORK</div>
          <h2>Camera network</h2>
        </div>
        <span className="muted">3 nodes</span>
      </div>
      <div className="camera-list">
        <CameraNode id="C04" status="ONLINE" live />
        <CameraNode id="C05" status="STANDBY" />
        <CameraNode id="C07" status="OFFLINE" offline />
      </div>
    </section>
  )
}

function CameraNode({ id, status, live, offline }) {
  return (
    <div className="camera-node">
      <div className="node-icon">▣</div>
      <div className="node-info">
        <strong>{id}</strong>
        <span>{live ? 'Primary webcam' : 'Prototype node'}</span>
      </div>
      <div className={`node-status ${offline ? 'offline' : live ? '' : 'standby'}`}>
        <span className="dot"></span>{status}
      </div>
    </div>
  )
}

function Timeline({ incidents }) {
  const rows = incidents.slice(0, 5)
  return (
    <section className="card timeline-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">EVENT HISTORY</div>
          <h2>Incident timeline</h2>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty-timeline">No incidents recorded yet.</div>
      ) : (
        <div className="timeline">
          {rows.map((item, index) => (
            <div className="timeline-item" key={item.id}>
              <div className="timeline-line"><span className={`timeline-dot ${index === 0 ? 'active' : ''}`}></span></div>
              <div className="timeline-content">
                <span className="timeline-time">{item.created_at}</span>
                <strong>Incident #{item.id} — {item.type}</strong>
                <span>{item.camera} • {item.zone} • Risk {item.risk_score}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Overview({ incidents, activeIncident, onAction }) {
  const stats = useMemo(() => {
    const high = incidents.filter(i => i.risk_level === 'HIGH').length
    const pending = incidents.filter(i => String(i.status).toLowerCase().includes('awaiting')).length
    return { total: incidents.length, high, pending }
  }, [incidents])

  return (
    <>
      <div className="stats-grid">
        <Metric label="TOTAL INCIDENTS" value={stats.total} sub="Recorded in SQLite" />
        <Metric label="HIGH RISK" value={stats.high} sub="Risk score ≥ 61" danger />
        <Metric label="PENDING REVIEW" value={stats.pending} sub="Awaiting verification" />
        <Metric label="ACTIVE CAMERA" value="C04" sub="Webcam connected" />
      </div>

      <div className="main-grid">
        <LiveCamera />
        <IncidentCard incident={activeIncident} onAction={onAction} />
      </div>

      <div className="lower-grid">
        <RiskPanel incident={activeIncident || demoIncident} />
        <CameraNetwork />
      </div>

      <Timeline incidents={incidents} />
    </>
  )
}

function Metric({ label, value, sub, danger }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className={`metric-value ${danger ? 'danger-text' : ''}`}>{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  )
}

function IncidentsPage({ incidents, onAction }) {
  return (
    <section className="card page-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">DATABASE</div>
          <h2>Incident records</h2>
        </div>
        <span className="muted">{incidents.length} records</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>ID</th><th>Camera</th><th>Event</th><th>Risk</th><th>Time</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {incidents.map(i => (
              <tr key={i.id}>
                <td>#{i.id}</td>
                <td>{i.camera}</td>
                <td>{i.type}</td>
                <td><span className={`badge small ${String(i.risk_level || 'LOW').toLowerCase()}`}>{i.risk_score}</span></td>
                <td>{i.created_at}</td>
                <td>{i.status}</td>
                <td>
                  {String(i.status).toLowerCase().includes('awaiting') ? (
                    <div className="table-actions">
                      <button onClick={() => onAction('verify', i.id)}>Verify</button>
                      <button onClick={() => onAction('dismiss', i.id)}>Dismiss</button>
                    </div>
                  ) : <span className="muted">Closed</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CamerasPage() {
  return (
    <div className="camera-page-grid">
      <LiveCamera />
      <CameraNetwork />
      <section className="card page-card">
        <div className="eyebrow">CURRENT CONFIGURATION</div>
        <h2>Camera C04</h2>
        <div className="config-grid">
          <Detail label="Input" value="Webcam 0" />
          <Detail label="Resolution" value="1280 × 720" />
          <Detail label="Model" value="YOLOv8n" />
          <Detail label="Tracker" value="ByteTrack" />
          <Detail label="Zone" value="Restricted Zone B" />
          <Detail label="Confidence" value="0.45" />
        </div>
      </section>
    </div>
  )
}

function TimelinePage({ incidents }) {
  return <Timeline incidents={incidents} />
}

function AnalyticsPage({ incidents }) {
  const high = incidents.filter(i => i.risk_level === 'HIGH').length
  const medium = incidents.filter(i => i.risk_level === 'MEDIUM').length
  const low = incidents.filter(i => i.risk_level === 'LOW').length
  return (
    <div className="analytics-grid">
      <Metric label="TOTAL EVENTS" value={incidents.length} sub="From current database" />
      <Metric label="HIGH RISK" value={high} sub="Risk score ≥ 61" danger />
      <Metric label="MEDIUM RISK" value={medium} sub="Risk score 31–60" />
      <Metric label="LOW RISK" value={low} sub="Risk score ≤ 30" />
      <section className="card page-card chart-card">
        <div className="eyebrow">RISK DISTRIBUTION</div>
        <h2>Current incident profile</h2>
        <div className="bar-row"><span>HIGH</span><div><i style={{width: `${incidents.length ? high/incidents.length*100 : 0}%`}}></i></div><strong>{high}</strong></div>
        <div className="bar-row"><span>MEDIUM</span><div><i style={{width: `${incidents.length ? medium/incidents.length*100 : 0}%`}}></i></div><strong>{medium}</strong></div>
        <div className="bar-row"><span>LOW</span><div><i style={{width: `${incidents.length ? low/incidents.length*100 : 0}%`}}></i></div><strong>{low}</strong></div>
      </section>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [incidents, setIncidents] = useState([])
  const [activeIncident, setActiveIncident] = useState(null)
  const [apiOnline, setApiOnline] = useState(false)

  async function loadIncidents() {
    try {
      const response = await fetch(`${API}/incidents`)
      if (!response.ok) throw new Error('API error')
      const data = await response.json()
      setIncidents(data)
      setActiveIncident(data.find(i => String(i.status).toLowerCase().includes('awaiting')) || null)
      setApiOnline(true)
    } catch {
      setApiOnline(false)
    }
  }

  async function handleAction(action, id) {
    try {
      const response = await fetch(`${API}/incidents/${id}/${action}`, { method: 'PUT' })
      if (!response.ok) throw new Error('Action failed')
      await loadIncidents()
    } catch (error) {
      console.error(error)
      alert('Backend action failed. Make sure FastAPI is running.')
    }
  }

  useEffect(() => {
    loadIncidents()
    const timer = setInterval(loadIncidents, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} />
      <main className="content">
        <Header page={page} />

        <div className="connection-banner">
          <span className={`dot ${apiOnline ? '' : 'amber'}`}></span>
          {apiOnline ? 'FastAPI backend connected • SQLite synchronized' : 'FastAPI backend not connected • showing dashboard shell'}
        </div>

        {page === 'dashboard' && (
          <Overview incidents={incidents} activeIncident={activeIncident} onAction={handleAction} />
        )}
        {page === 'incidents' && (
          <IncidentsPage incidents={incidents} onAction={handleAction} />
        )}
        {page === 'cameras' && <CamerasPage />}
        {page === 'timeline' && <TimelinePage incidents={incidents} />}
        {page === 'analytics' && <AnalyticsPage incidents={incidents} />}
      </main>
    </div>
  )
}
