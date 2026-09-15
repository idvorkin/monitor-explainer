import { useState, type CSSProperties } from 'react'
import './App.css'

type AspectRatio = '16:9' | '21:9' | '32:9' | '3:2' | '16:18'
type Resolution = '1440p' | '2160p' | '2560p' | '2880p'

interface Monitor {
  diagonal: number
  aspectRatio: AspectRatio
  resolution: Resolution
  width: number // physical width in inches
  height: number // physical height in inches
  resolutionX: number
  resolutionY: number
  name: string
}

const monitors: Monitor[] = [
  // 16:9 Standard
  { diagonal: 27, aspectRatio: '16:9', resolution: '1440p', width: 23.5, height: 13.2, resolutionX: 2560, resolutionY: 1440, name: '27" Standard' },
  { diagonal: 32, aspectRatio: '16:9', resolution: '2160p', width: 27.9, height: 15.7, resolutionX: 3840, resolutionY: 2160, name: '32" Standard' },
  { diagonal: 43, aspectRatio: '16:9', resolution: '2160p', width: 37.5, height: 21.1, resolutionX: 3840, resolutionY: 2160, name: '43" Standard' },

  // 21:9 Ultrawide. Inches come from the labelled aspect, as everywhere else here:
  // 5120x2160 is exactly 64:27 and 3440x1440 exactly 43:18, but every vendor sells
  // both as "21:9", so 21:9 is what the rows are drawn from. Under true 64:27 the
  // 45" would be 41.5 x 17.5 and the 52" 47.9 x 20.2 - a rounding apart, and not
  // worth two conventions in one column.
  { diagonal: 34, aspectRatio: '21:9', resolution: '1440p', width: 31.3, height: 13.4, resolutionX: 3440, resolutionY: 1440, name: '34" Ultrawide' },
  { diagonal: 40, aspectRatio: '21:9', resolution: '2160p', width: 36.8, height: 15.8, resolutionX: 5120, resolutionY: 2160, name: '40" Ultrawide' },
  // These two ship, so they get names. LG 45GX950A: 45" W-OLED, 800R, ~123 PPI.
  // LG UltraGear evo G9 52G930B: 52" VA, 1000R, 240Hz, $1,999 - same 5120x2160
  // stretched over 7 more inches of diagonal, so ~107 PPI.
  { diagonal: 45, aspectRatio: '21:9', resolution: '2160p', width: 41.4, height: 17.7, resolutionX: 5120, resolutionY: 2160, name: '45" 5K2K (LG)' },
  { diagonal: 52, aspectRatio: '21:9', resolution: '2160p', width: 47.8, height: 20.5, resolutionX: 5120, resolutionY: 2160, name: '52" 5K2K (LG)' },

  // 32:9 Super-ultrawide
  { diagonal: 49, aspectRatio: '32:9', resolution: '1440p', width: 47.2, height: 13.3, resolutionX: 5120, resolutionY: 1440, name: '49" Super-wide' },
  { diagonal: 57, aspectRatio: '32:9', resolution: '2160p', width: 54.9, height: 15.4, resolutionX: 7680, resolutionY: 2160, name: '57" Super-wide' },

  // Tall / productivity (physical inches from diagonal: width = D*A/sqrt(A^2+B^2))
  { diagonal: 28.2, aspectRatio: '3:2', resolution: '2560p', width: 23.5, height: 15.6, resolutionX: 3840, resolutionY: 2560, name: '28.2" MateView (3:2)' },
  { diagonal: 27.6, aspectRatio: '16:18', resolution: '2880p', width: 18.3, height: 20.6, resolutionX: 2560, resolutionY: 2880, name: '27.6" DualUp (16:18)' },
]

// Landing selection, by name: positional indices silently pick a different monitor
// the moment a row is inserted above them.
const defaultSelectionNames = ['27" Standard', '34" Ultrawide', '49" Super-wide']

// Column order for the catalog grid and the canvas legend
const aspectColumns: { aspect: AspectRatio; header: string; legend: string }[] = [
  { aspect: '16:9', header: 'Standard (16:9)', legend: '16:9 Standard' },
  { aspect: '21:9', header: 'Ultrawide (21:9)', legend: '21:9 Ultrawide' },
  { aspect: '32:9', header: 'Super-wide (32:9)', legend: '32:9 Super-wide' },
  { aspect: '3:2', header: 'Tall (3:2)', legend: '3:2 Tall' },
  { aspect: '16:18', header: 'Square-ish (16:18)', legend: '16:18 Square-ish' },
]

const aspectColors: Record<AspectRatio, string> = {
  '16:9': '#3b82f6',
  '21:9': '#8b5cf6',
  '32:9': '#ec4899',
  '3:2': '#f59e0b',
  '16:18': '#14b8a6',
}

// Declared low-to-high; iteration order is the canvas group order
const resolutionLabels: Record<Resolution, string> = {
  '1440p': '1440p (2K)',
  '2160p': '2160p (4K)',
  '2560p': '2560p',
  '2880p': '2880p',
}

// Shared by the catalog grid and the canvas so the two can't drift.
// The old 14-20 band held nothing above 15.8"; the 45" 5K2K at 17.7" would have
// been filed under "~16" tall" and read as two inches shorter than it is.
const heightBands: { label: string; min: number; max: number }[] = [
  { label: '~13" tall', min: 0, max: 14 },
  { label: '~16" tall', min: 14, max: 17 },
  { label: '~18" tall', min: 17, max: 20 },
  // Last band stays open-ended: both the grid and the canvas filter through these,
  // so anything above the top band would silently disappear from both.
  { label: '~21" tall', min: 20, max: Infinity },
]

type ViewMode = 'height' | 'resolution' | 'overlay'

function App() {
  const [selectedMonitors, setSelectedMonitors] = useState<Monitor[]>(
    monitors.filter(m => defaultSelectionNames.includes(m.name))
  )
  const [viewMode, setViewMode] = useState<ViewMode>('height')

  // Pan and zoom state
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Monitor positions (for individual dragging)
  const [monitorPositions, setMonitorPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [monitorRotations, setMonitorRotations] = useState<Record<string, number>>({}) // 0, 90, 180, 270
  const [draggingMonitor, setDraggingMonitor] = useState<string | null>(null)
  const [monitorDragStart, setMonitorDragStart] = useState({ x: 0, y: 0 })

  const toggleMonitor = (monitor: Monitor) => {
    setSelectedMonitors(prev => {
      // Always add monitor (allow duplicates)
      return [...prev, monitor]
    })
  }

  const removeMonitor = (index: number) => {
    setSelectedMonitors(prev => prev.filter((_, i) => i !== index))
  }

  // Zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.max(0.5, Math.min(5, prev * delta)))
  }

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPanX(e.clientX - dragStart.x)
    setPanY(e.clientY - dragStart.y)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const resetView = () => {
    setZoom(1)
    setPanX(0)
    setPanY(0)
    setMonitorPositions({})
    setMonitorRotations({})
  }

  const rotateMonitor = (monitorId: string) => {
    setMonitorRotations(prev => {
      const currentRotation = prev[monitorId] || 0
      const nextRotation = (currentRotation + 90) % 360
      return { ...prev, [monitorId]: nextRotation }
    })
  }

  const getRotatedDimensions = (width: number, height: number, rotation: number) => {
    if (rotation === 90 || rotation === 270) {
      return { width: height, height: width } // Swap dimensions
    }
    return { width, height }
  }

  // Monitor drag handlers
  const handleMonitorMouseDown = (e: React.MouseEvent, monitorId: string) => {
    e.stopPropagation() // Prevent canvas pan
    setDraggingMonitor(monitorId)
    const svgRect = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect()
    if (svgRect) {
      setMonitorDragStart({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMonitorMouseMove = (e: React.MouseEvent) => {
    if (!draggingMonitor) return

    const deltaX = (e.clientX - monitorDragStart.x) / zoom
    const deltaY = (e.clientY - monitorDragStart.y) / zoom

    let newX = (monitorPositions[draggingMonitor]?.x || 0) + deltaX
    let newY = (monitorPositions[draggingMonitor]?.y || 0) + deltaY

    // Snapping logic - snap to other monitors within 10px threshold
    const snapThreshold = 10
    selectedMonitors.forEach((monitor, index) => {
      const monitorId = `${monitor.name}-${index}`
      if (monitorId === draggingMonitor) return

      const otherPos = monitorPositions[monitorId] || { x: 0, y: 0 }
      const otherRotation = monitorRotations[monitorId] || 0
      const draggedMonitor = selectedMonitors.find((_, i) => `${selectedMonitors[i].name}-${i}` === draggingMonitor)
      if (!draggedMonitor) return

      const draggedRotation = monitorRotations[draggingMonitor] || 0

      // Get rotated dimensions
      const otherDims = getRotatedDimensions(monitor.width * scale, monitor.height * scale, otherRotation)
      const draggedDims = getRotatedDimensions(draggedMonitor.width * scale, draggedMonitor.height * scale, draggedRotation)

      const otherWidth = otherDims.width
      const otherHeight = otherDims.height
      const draggedWidth = draggedDims.width
      const draggedHeight = draggedDims.height

      // Snap horizontal (right edge to left edge, or left edge to right edge)
      if (Math.abs((newX + draggedWidth) - otherPos.x) < snapThreshold) {
        newX = otherPos.x - draggedWidth
      } else if (Math.abs(newX - (otherPos.x + otherWidth)) < snapThreshold) {
        newX = otherPos.x + otherWidth
      }

      // Snap vertical (bottom edge to top edge, or top edge to bottom edge)
      if (Math.abs((newY + draggedHeight) - otherPos.y) < snapThreshold) {
        newY = otherPos.y - draggedHeight
      } else if (Math.abs(newY - (otherPos.y + otherHeight)) < snapThreshold) {
        newY = otherPos.y + otherHeight
      }

      // Snap to same top edge
      if (Math.abs(newY - otherPos.y) < snapThreshold) {
        newY = otherPos.y
      }

      // Snap to same left edge
      if (Math.abs(newX - otherPos.x) < snapThreshold) {
        newX = otherPos.x
      }
    })

    setMonitorPositions(prev => ({
      ...prev,
      [draggingMonitor]: { x: newX, y: newY }
    }))

    setMonitorDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMonitorMouseUp = () => {
    setDraggingMonitor(null)
  }

  // Scale for visualization - use width for scaling
  const maxWidth = Math.max(...monitors.map(m => m.width))
  const scale = 600 / maxWidth // pixels per inch

  // One entry per selected monitor; the index keeps duplicates of the same
  // model independently draggable
  const entries = selectedMonitors.map((monitor, index) => ({
    monitor,
    index,
    id: `${monitor.name}-${index}`,
  }))
  type Entry = (typeof entries)[number]

  // Space a monitor occupies on the canvas, after any rotation
  const footprintOf = (entry: Entry) =>
    getRotatedDimensions(entry.monitor.width * scale, entry.monitor.height * scale, monitorRotations[entry.id] || 0)

  // Draw one monitor so that its rotated footprint starts at (footprintX, footprintY).
  // The rect is centred on the footprint centre and rotated about that same point,
  // which keeps portrait and near-square panels aligned with their own labels.
  const renderMonitor = (entry: Entry, footprintX: number, footprintY: number, opacity: number, showDetails: boolean) => {
    const { monitor, index, id } = entry
    const baseRectWidth = monitor.width * scale
    const baseRectHeight = monitor.height * scale
    const rotation = monitorRotations[id] || 0
    const footprint = footprintOf(entry)
    const position = monitorPositions[id] || { x: 0, y: 0 }
    const finalX = footprintX + position.x
    const finalY = footprintY + position.y
    const centerX = finalX + footprint.width / 2
    const centerY = finalY + footprint.height / 2

    return (
      <g key={id}>
        <g
          transform={`rotate(${rotation} ${centerX} ${centerY})`}
          style={{ cursor: 'move', transition: draggingMonitor === id ? 'none' : 'all 0.5s ease' }}
          onMouseDown={(e) => handleMonitorMouseDown(e, id)}
        >
          <rect
            x={centerX - baseRectWidth / 2}
            y={centerY - baseRectHeight / 2}
            width={baseRectWidth}
            height={baseRectHeight}
            fill={aspectColors[monitor.aspectRatio]}
            stroke="#1e40af"
            strokeWidth="2"
            opacity={opacity}
          />
          <text
            x={showDetails ? centerX : centerX - baseRectWidth / 2 + 8}
            y={showDetails ? centerY - 10 : centerY + baseRectHeight / 2 - 8}
            textAnchor={showDetails ? 'middle' : 'start'}
            fontSize="14"
            fontWeight="bold"
            fill={showDetails ? 'white' : '#1e293b'}
          >
            {monitor.name}
          </text>
          {showDetails && (
            <>
              <text x={centerX} y={centerY + 10} textAnchor="middle" fontSize="12" fill="white">
                {monitor.resolutionX}×{monitor.resolutionY}
              </text>
              <text x={centerX} y={centerY + 25} textAnchor="middle" fontSize="11" fill="white">
                {monitor.width.toFixed(1)}" × {monitor.height.toFixed(1)}"
              </text>
            </>
          )}
        </g>
        {/* Rotate button */}
        <g
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation()
            rotateMonitor(id)
          }}
        >
          <circle cx={finalX + 10} cy={finalY + 10} r="8" fill="#22c55e" stroke="white" strokeWidth="1" />
          <text
            x={finalX + 10}
            y={finalY + 10}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="10"
            fontWeight="bold"
            fill="white"
          >
            ↻
          </text>
        </g>
        {/* Close button */}
        <g
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation()
            removeMonitor(index)
          }}
        >
          <circle cx={finalX + footprint.width - 10} cy={finalY + 10} r="8" fill="#ef4444" stroke="white" strokeWidth="1" />
          <text
            x={finalX + footprint.width - 10}
            y={finalY + 10}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="12"
            fontWeight="bold"
            fill="white"
          >
            ×
          </text>
        </g>
      </g>
    )
  }

  // Group the canvas by height class or by resolution, then stack the groups top
  // to bottom using each row's tallest footprint, so a 25"-tall or portrait panel
  // can't overlap the row below it.
  const rawGroups =
    viewMode === 'height'
      ? heightBands.map(band => ({
          label: band.label,
          entries: entries.filter(e => e.monitor.height >= band.min && e.monitor.height < band.max),
        }))
      : (Object.keys(resolutionLabels) as Resolution[]).map(resolution => ({
          label: resolutionLabels[resolution],
          entries: entries.filter(e => e.monitor.resolution === resolution),
        }))

  let nextGroupY = 60
  const groups = rawGroups
    .filter(group => group.entries.length > 0)
    .map(group => {
      const y = nextGroupY
      nextGroupY += Math.max(...group.entries.map(e => footprintOf(e).height)) + 40
      return { ...group, y }
    })

  const contentBottom =
    viewMode === 'overlay'
      ? 50 + Math.max(0, ...entries.map(e => footprintOf(e).height))
      : nextGroupY

  // Calculate viewBox based on zoom and pan
  const baseViewBox = { x: 0, y: 0, width: 700, height: Math.max(400, contentBottom + 40) }
  const legendY = baseViewBox.height - 20
  const svgHeight = Math.min(baseViewBox.height, 800)
  const viewBoxWidth = baseViewBox.width / zoom
  const viewBoxHeight = baseViewBox.height / zoom
  const viewBoxX = baseViewBox.x - (panX / zoom)
  const viewBoxY = baseViewBox.y - (panY / zoom)

  return (
    <div className="app">
      <header>
        <h1>Monitor Dimension Explainer</h1>
        <p className="subtitle">Cut through the marketing gobbledygook</p>
      </header>

      <main>
        <section className="intro">
          <p className="intro-text">
            Buying monitors is super confusing because of everyone's diagonal size (27", 34", 49")
            and some number followed by 1080p, 4K, or HD. But this is all <strong>marketing gobbledygook</strong>.
            What we really need to understand are three independent dimensions:
          </p>

          <nav className="toc">
            <h3>Quick Navigation</h3>
            <ul>
              <li><a href="#three-dimensions">The Three Dimensions</a></li>
              <li><a href="#igor-setup">Igor's Setup</a></li>
              <li><a href="#visual-comparison">Visual Comparison</a></li>
              <li><a href="#diagonal-confusion">Why Diagonal Measurements?</a></li>
              <li><a href="#curved-monitors">Curved Monitors</a></li>
              <li><a href="#pixel-density">Pixel Density (PPI)</a></li>
              <li><a href="#panel-type">Panel Type (IPS/VA/TN)</a></li>
              <li><a href="#p-vs-k">The "p" vs "K" Confusion</a></li>
            </ul>
          </nav>
        </section>

        <section className="explainer" id="three-dimensions">
          <h2>The Three Dimensions</h2>
          <div className="dimensions-grid">
            <div className="dimension-card">
              <h3>1. Aspect Ratio</h3>
              <p>How wide vs how tall (horizontal stretch)</p>
              <ul>
                <li><strong>16:9</strong> - Standard</li>
                <li><strong>21:9</strong> - Ultrawide (1.3× wider)</li>
                <li><strong>32:9</strong> - Super-wide (2× wider)</li>
                <li><strong>3:2</strong> - Tall (1.2× taller for the same width)</li>
                <li><strong>16:18</strong> - Taller than it is wide (LG DualUp)</li>
              </ul>
              <p>3:2 buys vertical space for documents and code, at the cost of width for side-by-side windows.</p>
            </div>

            <div className="dimension-card">
              <h3>2. Physical Size</h3>
              <p>Actual height in inches (vertical growth)</p>
              <ul>
                <li><strong>~13" tall</strong> - Smaller class</li>
                <li><strong>~16" tall</strong> - Larger class</li>
              </ul>
            </div>

            <div className="dimension-card">
              <h3>3. Resolution</h3>
              <p>Number of pixels (sharpness)</p>
              <ul>
                <li><strong>1440p</strong> - 2K (1440 pixels tall)</li>
                <li><strong>2160p</strong> - 4K (2160 pixels tall)</li>
                <li><strong>2560p / 2880p</strong> - Tall panels, more pixels of height</li>
              </ul>
            </div>
          </div>

          <div className="warning-box">
            <h3>⚠️ Size ≠ Resolution</h3>
            <p>You can have a 45" monitor at only 1440p (2K). It'll be physically huge but have the same pixel count as a 27" 2K monitor - things will look less sharp!</p>
          </div>
        </section>

        <section className="igor-monitors" id="igor-setup">
          <h2>Igor's Setup</h2>
          <div className="igor-setup-grid">
            <div className="igor-monitor-card">
              <h3>Work: 32" 4K Standard</h3>
              <p>3840×2160 (16:9)</p>
              <button
                className="add-monitor-btn"
                onClick={() => {
                  const monitor = monitors.find(m => m.name === '32" Standard')
                  if (monitor) toggleMonitor(monitor)
                }}
              >
                Add to Comparison
              </button>
            </div>

            <div className="igor-monitor-card">
              <h3>Home: 43" 4K Standard</h3>
              <p>3840×2160 (16:9) - Same pixels as 32", larger</p>
              <button
                className="add-monitor-btn"
                onClick={() => {
                  const monitor = monitors.find(m => m.name === '43" Standard')
                  if (monitor) toggleMonitor(monitor)
                }}
              >
                Add to Comparison
              </button>
            </div>

            <div className="igor-monitor-card">
              <h3>Home: 40" Samsung Odyssey G7</h3>
              <p>5120×2160 (21:9) - Ultrawide</p>
              <button
                className="add-monitor-btn"
                onClick={() => {
                  const monitor = monitors.find(m => m.name === '40" Ultrawide')
                  if (monitor) toggleMonitor(monitor)
                }}
              >
                Add to Comparison
              </button>
            </div>
          </div>
        </section>

        <section className="monitor-selector" id="visual-comparison">
          <h2>Visual Comparison</h2>

          <p>Select monitors to compare (click to add, can add multiple of same model):</p>

          <div
            className="monitor-catalog-grid"
            style={{ '--aspect-cols': aspectColumns.length } as CSSProperties}
          >
            <div className="catalog-header">
              <div className="size-label">Height</div>
              {aspectColumns.map(column => (
                <div className="aspect-label" key={column.aspect}>{column.header}</div>
              ))}
            </div>

            {heightBands.map(band => (
              <div className="catalog-row" key={band.label}>
                <div className="size-label">{band.label}</div>
                {aspectColumns.map(column => {
                  const cellMonitors = monitors.filter(
                    m => m.aspectRatio === column.aspect && m.height >= band.min && m.height < band.max
                  )
                  if (cellMonitors.length === 0) {
                    return <div className="catalog-cell empty" key={column.aspect}>—</div>
                  }
                  return (
                    <div className="catalog-cell" key={column.aspect}>
                      {cellMonitors.map(monitor => (
                        <button key={monitor.name} className="monitor-chip" onClick={() => toggleMonitor(monitor)}>
                          <div>{monitor.name}</div>
                          <span className="chip-details">{monitor.resolutionX}×{monitor.resolutionY}</span>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="view-mode-selector">
            <p>Canvas view mode:</p>
            <div className="view-mode-buttons">
              <button
                className={`view-mode-btn ${viewMode === 'height' ? 'active' : ''}`}
                onClick={() => setViewMode('height')}
              >
                Height Class
              </button>
              <button
                className={`view-mode-btn ${viewMode === 'resolution' ? 'active' : ''}`}
                onClick={() => setViewMode('resolution')}
              >
                Resolution
              </button>
              <button
                className={`view-mode-btn ${viewMode === 'overlay' ? 'active' : ''}`}
                onClick={() => setViewMode('overlay')}
              >
                Overlay (Stacked)
              </button>
            </div>
          </div>

          {selectedMonitors.length > 0 && (
            <div className="selected-monitors-list">
              <p>Selected ({selectedMonitors.length}):</p>
              <div className="selected-chips">
                {selectedMonitors.map((monitor, index) => (
                  <button
                    key={`${monitor.name}-${index}`}
                    className="selected-chip"
                    onClick={() => removeMonitor(index)}
                    title="Click to remove"
                  >
                    {monitor.name} ×
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="visualization">
          <div className="zoom-controls">
            <p>Zoom: {zoom.toFixed(1)}x | Drag canvas to pan, drag monitors to move, click ↻ to rotate, scroll to zoom</p>
            <button onClick={resetView} className="reset-btn">Reset View</button>
          </div>
          <div
            className="monitor-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={(e) => {
              handleMouseMove(e)
              handleMonitorMouseMove(e)
            }}
            onMouseUp={() => {
              handleMouseUp()
              handleMonitorMouseUp()
            }}
            onMouseLeave={() => {
              handleMouseUp()
              handleMonitorMouseUp()
            }}
            style={{ cursor: isDragging ? 'grabbing' : draggingMonitor ? 'grabbing' : 'grab' }}
          >
            <svg
              width="100%"
              height={svgHeight}
              viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
              style={{ border: '1px solid #ccc', background: '#f5f5f5' }}
              onWheel={handleWheel}
            >
              {/* Dynamic grouping based on view mode */}
              {viewMode === 'overlay'
                ? entries.map(entry => renderMonitor(entry, 50, 50, 0.4, false))
                : groups.map(group => {
                    let xOffset = 20
                    return (
                      <g key={group.label}>
                        {/* Group label, above the row so monitors can't cover it */}
                        <text x="10" y={group.y - 6} fontSize="12" fill="#666">
                          {group.label}
                        </text>

                        {/* Monitors in this group */}
                        {group.entries.map(entry => {
                          const rect = renderMonitor(entry, xOffset, group.y, 0.7, true)
                          xOffset += footprintOf(entry).width + 20
                          return rect
                        })}
                      </g>
                    )
                  })}

              {/* Legend */}
              <g transform={`translate(10, ${legendY})`}>
                {aspectColumns.map((column, i) => (
                  <g key={column.aspect} transform={`translate(${i * 140}, 0)`}>
                    <rect x="0" y="0" width="15" height="15" fill={aspectColors[column.aspect]} opacity="0.7" />
                    <text x="20" y="12" fontSize="12">{column.legend}</text>
                  </g>
                ))}
              </g>
            </svg>
          </div>
        </section>

        <section className="key-insights">
          <h2>Key Insights</h2>
          <div className="insight-grid">
            <div className="insight-card">
              <h3>Same Height, Different Width</h3>
              <p>A 27" standard (16:9), 34" ultrawide (21:9), and 49" super-wide (32:9) are all ~13" tall. The diagonal size increases because you're stretching wider!</p>
            </div>

            <div className="insight-card">
              <h3>Resolution Independence</h3>
              <p>A 32" 4K and a 43" 4K have the same pixels (3840×2160), but the 43" spreads them across more space - slightly less sharp.</p>
            </div>

            <div className="insight-card">
              <h3>Same Width, More Height</h3>
              <p>The 28.2" MateView (3:2) is 23.5" × 15.6" - the same width as the 27" 16:9 (23.5" × 13.2"), with 2.4" more height. That's 18% more screen area from the shape alone, off a diagonal only 1.2" bigger.</p>
            </div>

            <div className="insight-card">
              <h3>Refresh Rate</h3>
              <p>How many times per second the screen updates:</p>
              <ul>
                <li>30 Hz - Gives headaches</li>
                <li>60 Hz - Standard, fine</li>
                <li>120 Hz - Noticeably smoother</li>
                <li>240 Hz - Hard to tell from 120 Hz</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="diagonal-confusion" id="diagonal-confusion">
          <h2>Why Are Monitors Measured Diagonally?</h2>

          <div className="warning-box">
            <h3>⚠️ Diagonal measurement hides the real story!</h3>
            <p>Monitors are marketed by diagonal size (27", 34", 49"), but <strong>physical height</strong> is what actually determines viewing area. A 49" super-wide and a 27" standard monitor are both ~13" tall - the 49" is just stretched horizontally!</p>
          </div>

          <div className="examples">
            <h3>The confusion this creates:</h3>
            <ul>
              <li>A <strong>49" super-wide</strong> (32:9) is ~13" tall - same height as a <strong>27" standard</strong> (16:9)</li>
              <li>A <strong>34" ultrawide</strong> (21:9) is ~13" tall - also same height class!</li>
              <li>A <strong>43" standard</strong> (16:9) is ~21" tall - much taller than you'd expect from the diagonal</li>
            </ul>
            <p><strong>Why diagonal?</strong> Historical artifact from CRT TV marketing. It made screens sound bigger and allowed comparing across aspect ratios with one number. But it obscures what matters: actual viewing height!</p>
          </div>
        </section>

        <section className="curved-monitors" id="curved-monitors">
          <h2>Curved Monitors</h2>

          <div className="dimension-card">
            <h3>Curvature Rating (e.g., 1000R, 1800R)</h3>
            <p>The "R" number indicates the radius of the curve in millimeters</p>
            <ul>
              <li><strong>1000R</strong> - Aggressive curve (1 meter radius) - wraps around your vision</li>
              <li><strong>1500R</strong> - Moderate curve (1.5 meter radius) - good for ultrawide</li>
              <li><strong>1800R</strong> - Gentle curve (1.8 meter radius) - subtle immersion</li>
            </ul>
            <p><strong>Lower number = tighter curve.</strong> More curve helps with ultrawide/super-wide monitors by keeping edges equidistant from your eyes.</p>
          </div>

          <div className="warning-box">
            <h3>💡 When does curve matter?</h3>
            <p>Curved screens are most beneficial on ultrawide (21:9) and super-wide (32:9) monitors. On standard 16:9 monitors, the curve is less noticeable and may not add much value. The wider the monitor, the more a curve helps maintain consistent viewing distance across the entire screen.</p>
          </div>
        </section>

        <section className="pixel-density" id="pixel-density">
          <h2>Pixel Density (PPI)</h2>

          <div className="dimension-card">
            <h3>What is PPI?</h3>
            <p><strong>Pixels Per Inch</strong> - How tightly packed the pixels are</p>
            <ul>
              <li><strong>Higher PPI</strong> = Sharper text and images</li>
              <li><strong>Lower PPI</strong> = You can see individual pixels (looks fuzzy)</li>
              <li><strong>Sweet spot</strong>: 100-140 PPI for desktop monitors</li>
            </ul>
          </div>

          <div className="examples">
            <h3>Why PPI matters:</h3>
            <ul>
              <li>A <strong>27" at 1440p</strong> = ~109 PPI (sharp, comfortable)</li>
              <li>A <strong>32" at 1440p</strong> = ~92 PPI (noticeably less sharp)</li>
              <li>A <strong>32" at 2160p</strong> = ~138 PPI (very sharp)</li>
              <li>A <strong>43" at 2160p</strong> = ~103 PPI (same pixels spread over larger area)</li>
            </ul>
            <p><strong>The trade-off:</strong> Bigger physical size at the same resolution means lower PPI. You need more pixels (higher resolution) to maintain sharpness on larger monitors.</p>
          </div>

          <div className="warning-box">
            <h3>⚠️ This is why size ≠ better!</h3>
            <p>A 43" 4K monitor has the exact same pixel count as a 32" 4K monitor - just spread over a larger area. Text and images will be the same size in inches, but less sharp on the 43" because the pixels are physically bigger.</p>
          </div>
        </section>

        <section className="panel-type" id="panel-type">
          <h2>Panel Type (IPS vs VA vs TN)</h2>

          <div className="terminology-grid">
            <div className="term-card">
              <h3>IPS (In-Plane Switching)</h3>
              <p><strong>Best for:</strong> Color accuracy and viewing angles</p>
              <ul>
                <li>✅ Excellent color reproduction</li>
                <li>✅ Wide viewing angles (looks good from the side)</li>
                <li>✅ Best for photo/video editing</li>
                <li>❌ More expensive</li>
                <li>❌ Slower response time (motion blur in fast games)</li>
                <li>❌ Weaker contrast (blacks look grayish)</li>
              </ul>
            </div>

            <div className="term-card">
              <h3>VA (Vertical Alignment)</h3>
              <p><strong>Best for:</strong> Contrast and deep blacks</p>
              <ul>
                <li>✅ Best contrast ratio (deep blacks)</li>
                <li>✅ Good for dark room viewing</li>
                <li>✅ Middle ground price</li>
                <li>❌ Narrower viewing angles than IPS</li>
                <li>❌ Color shifts when viewed from angles</li>
                <li>❌ Slower pixel response (ghosting in games)</li>
              </ul>
            </div>

            <div className="term-card">
              <h3>TN (Twisted Nematic)</h3>
              <p><strong>Best for:</strong> Competitive gaming (speed)</p>
              <ul>
                <li>✅ Fastest response time (1ms)</li>
                <li>✅ High refresh rates (240Hz+)</li>
                <li>✅ Cheapest option</li>
                <li>❌ Poor viewing angles</li>
                <li>❌ Washed out colors</li>
                <li>❌ Not good for color work</li>
              </ul>
            </div>
          </div>

          <div className="examples">
            <h3>Which should you choose?</h3>
            <ul>
              <li><strong>Photo/video editing, design work:</strong> IPS (color accuracy matters most)</li>
              <li><strong>Movies, general use, dark room:</strong> VA (contrast and deep blacks)</li>
              <li><strong>Competitive gaming (CS:GO, Valorant):</strong> TN (speed beats everything)</li>
              <li><strong>General gaming, productivity:</strong> IPS (best all-around, modern IPS has decent response times)</li>
            </ul>
          </div>
        </section>

        <section className="terminology" id="p-vs-k">
          <h2>The "p" vs "K" Confusion</h2>

          <div className="warning-box">
            <h3>⚠️ Neither tells you full dimensions!</h3>
            <p>Both "p" and "K" notation are incomplete - that's why you get weird abbreviations like WQHD, UWQHD, QHD+, etc. You always need to know BOTH resolution AND aspect ratio to understand monitor dimensions.</p>
          </div>

          <div className="terminology-grid">
            <div className="term-card">
              <h3>"p" notation</h3>
              <p>Measures <strong>vertical</strong> pixels (height only)</p>
              <ul>
                <li>1080p = 1080 pixels tall</li>
                <li>1440p = 1440 pixels tall</li>
                <li>2160p = 2160 pixels tall</li>
              </ul>
              <p className="problem">Problem: Doesn't tell you width! Width depends on aspect ratio.</p>
            </div>

            <div className="term-card">
              <h3>"K" notation</h3>
              <p>Measures <strong>horizontal</strong> pixels (width only)</p>
              <ul>
                <li>2K ≈ 2560 pixels wide (16:9)</li>
                <li>4K ≈ 3840 pixels wide (16:9)</li>
                <li>4K ≈ 5120 pixels wide (21:9)</li>
              </ul>
              <p className="problem">Problem: "4K" means different widths depending on aspect ratio!</p>
            </div>
          </div>

          <div className="examples">
            <h3>Why the weird abbreviations?</h3>
            <p>Since neither "p" nor "K" is enough, the industry invented confusing acronyms:</p>
            <ul>
              <li><strong>QHD</strong> (Quad HD) = 2560×1440 (16:9) = 1440p</li>
              <li><strong>WQHD</strong> (Wide QHD) = 3440×1440 (21:9) = 1440p ultrawide</li>
              <li><strong>UWQHD</strong> (Ultra-Wide QHD) = 3440×1440 (21:9) - same as WQHD!</li>
              <li><strong>UHD</strong> (Ultra HD) = 3840×2160 (16:9) = 4K = 2160p</li>
              <li><strong>5K2K</strong> = 5120×2160 (21:9) = 2160p ultrawide</li>
            </ul>
            <p><strong>Bottom line:</strong> Just use the actual resolution (e.g., 3840×2160) to avoid confusion!</p>
          </div>
        </section>
      </main>

      <footer>
        <p>Made with data from <a href="https://idvorkin.github.io/irl#monitors" target="_blank" rel="noopener noreferrer">Igor's IRL blog</a></p>
      </footer>
    </div>
  )
}

export default App
