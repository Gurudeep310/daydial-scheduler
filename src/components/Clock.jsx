import React, { useState, useEffect } from 'react';

// --- Math Helpers ---
const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

const describeArc = (x, y, radius, startAngle, endAngle) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  let angleDiff = endAngle - startAngle;
  if (angleDiff < 0) angleDiff += 360;
  const largeArcFlag = angleDiff <= 180 ? "0" : "1";
  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");
};

// Modified to support "Donut" slices (innerRadius -> outerRadius)
const describeDonutSlice = (x, y, innerRadius, outerRadius, startAngle, endAngle) => {
    const startOuter = polarToCartesian(x, y, outerRadius, endAngle);
    const endOuter = polarToCartesian(x, y, outerRadius, startAngle);
    const startInner = polarToCartesian(x, y, innerRadius, endAngle);
    const endInner = polarToCartesian(x, y, innerRadius, startAngle);
    
    let angleDiff = endAngle - startAngle;
    if (angleDiff < 0) angleDiff += 360;
    const largeArcFlag = angleDiff <= 180 ? "0" : "1";

    return [
      "M", startOuter.x, startOuter.y,
      "A", outerRadius, outerRadius, 0, largeArcFlag, 0, endOuter.x, endOuter.y,
      "L", endInner.x, endInner.y,
      "A", innerRadius, innerRadius, 0, largeArcFlag, 1, startInner.x, startInner.y, // Sweep flag 1 for inner arc reverse
      "Z"
    ].join(" ");
}

// --- Overlap Logic ---
const doIntervalsOverlap = (aStart, aEnd, bStart, bEnd) => {
    const isAngleBetween = (target, start, end) => {
        if (end < start) return target >= start || target <= end;
        return target >= start && target < end;
    };
    return isAngleBetween(aStart + 0.1, bStart, bEnd) || 
           isAngleBetween(aEnd - 0.1, bStart, bEnd) ||
           isAngleBetween(bStart + 0.1, aStart, aEnd) ||
           isAngleBetween(bEnd - 0.1, aStart, aEnd);
};

const assignTracks = (events) => {
    const processed = [];
    const sorted = [...events].sort((a, b) => a.startAngle - b.startAngle);
    for (let event of sorted) {
        let track = 0;
        let placed = false;
        while (!placed) {
            const collision = processed.find(p => p.track === track && doIntervalsOverlap(event.startAngle, event.endAngle, p.startAngle, p.endAngle));
            if (!collision) {
                processed.push({ ...event, track });
                placed = true;
            } else {
                track++;
            }
        }
    }
    return processed;
};

const Clock = ({ events, onSlotClick, focusEvent }) => {
  // SVG Config
  const size = 400; 
  const center = size / 2;
  
  // RADIUS CONFIGURATION
  // Inner Ring (AM)
  const amBaseRadius = 85; 
  const amClickInner = 40;
  const amClickOuter = 110;
  
  // Outer Ring (PM) - Pushed outside the numbers
  const pmBaseRadius = 145; 
  const pmClickInner = 130;
  const pmClickOuter = 190;

  // Face (Ticks & Numbers) sits between 110 and 130
  
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Render Interaction Zones ---
  const renderClickSegments = () => {
    return (
      <>
        {/* AM Segments (Inner) */}
        {Array.from({ length: 12 }).map((_, i) => {
          const startAngle = i * 30;
          const endAngle = (i + 1) * 30;
          return (
            <path
              key={`am-${i}`}
              d={describeDonutSlice(center, center, amClickInner, amClickOuter, startAngle, endAngle)}
              fill="transparent"
              stroke="none"
              style={{ cursor: 'pointer', pointerEvents: 'all' }}
              onClick={() => onSlotClick(i)} // Passes 0-11
            >
                <title>{i === 0 ? 12 : i} AM</title>
            </path>
          );
        })}
        {/* PM Segments (Outer) */}
        {Array.from({ length: 12 }).map((_, i) => {
          const startAngle = i * 30;
          const endAngle = (i + 1) * 30;
          return (
            <path
              key={`pm-${i}`}
              d={describeDonutSlice(center, center, pmClickInner, pmClickOuter, startAngle, endAngle)}
              fill="transparent"
              stroke="none"
              style={{ cursor: 'pointer', pointerEvents: 'all' }}
              onClick={() => onSlotClick(i + 12)} // Passes 12-23
            >
                <title>{i === 0 ? 12 : i} PM</title>
            </path>
          );
        })}
      </>
    );
  };

  // --- Render Events (Split AM/PM) ---
  const renderEvents = () => {
    // 1. Process Event Data to get Angles
    const processedEvents = events.map(event => {
        let [h, m] = event.start.split(':').map(Number);
        let [endH, endM] = event.end.split(':').map(Number);
        
        const isPM = h >= 12; // Start time determines ring
        
        // Normalize angle to 0-360 on 12h face
        const displayH = h % 12;
        const displayEndH = endH % 12;
        
        let startAngle = (displayH * 30) + (m * 0.5);
        let endAngle = (displayEndH * 30) + (endM * 0.5);
        
        if (endAngle <= startAngle) endAngle += 360;
        
        return { ...event, startAngle, endAngle, isPM };
    });

    // 2. Split and Track Assign
    const amEvents = assignTracks(processedEvents.filter(e => !e.isPM));
    const pmEvents = assignTracks(processedEvents.filter(e => e.isPM));

    // 3. Render Helper
    const drawEventPath = (event, baseR) => {
        // Push overlapping events outward
        const trackOffset = event.track * 12;
        const r = baseR + trackOffset;
        
        const isFocused = focusEvent && focusEvent.id === event.id;
        const opacity = focusEvent ? (isFocused ? 1 : 0.1) : 0.9;
        const strokeWidth = isFocused ? "14" : "10";

        return (
            <path
                key={event.id}
                d={describeArc(center, center, r, event.startAngle, event.endAngle)}
                fill="none"
                stroke={event.color || "var(--occupied)"}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                onClick={(e) => { e.stopPropagation(); onSlotClick(null, event); }}
                style={{ cursor: 'pointer', opacity, transition: 'all 0.3s' }}
            >
                <title>{event.title}</title>
            </path>
        );
    };

    return (
        <>
            {amEvents.map(e => drawEventPath(e, amBaseRadius))}
            {pmEvents.map(e => drawEventPath(e, pmBaseRadius))}
        </>
    );
  };

  const renderFace = () => {
    const markers = [];
    const tickStart = 112; // Adjusted to sit between AM/PM rings
    const tickEnd = 120;
    const numberRadius = 135; // Numbers slightly inside PM ring start

    for (let i = 0; i < 12; i++) {
        const angle = i * 30;
        const start = polarToCartesian(center, center, tickStart, angle);
        const end = polarToCartesian(center, center, tickEnd, angle);
        const numPos = polarToCartesian(center, center, 122, angle); // Numbers in the gap
        
        markers.push(
            <line
                key={`tick-${i}`}
                x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                stroke="#a1a1aa" strokeWidth={i % 3 === 0 ? "2" : "1"}
            />
        );
        markers.push(
            <text
                key={`num-${i}`}
                x={numPos.x} y={numPos.y}
                textAnchor="middle" dominantBaseline="middle"
                fill="var(--text-color)" fontSize="11" fontWeight="600"
            >
                {i === 0 ? 12 : i}
            </text>
        );
    }
    return markers;
  };

  const renderHands = () => {
    const h = time.getHours();
    const m = time.getMinutes();
    const s = time.getSeconds();
    
    // Calculate angle on 12h face
    const hAngle = (h % 12) * 30 + (m * 0.5);
    const mAngle = m * 6 + (s * 0.1);
    const sAngle = s * 6;

    // Hand styling
    const handStyle = { stroke: 'var(--hand-color)', strokeLinecap: 'round' };

    return (
      <>
        {/* Hour Hand */}
        <line x1={center} y1={center} x2={polarToCartesian(center, center, 70, hAngle).x} y2={polarToCartesian(center, center, 70, hAngle).y} {...handStyle} strokeWidth="5" />
        {/* Minute Hand */}
        <line x1={center} y1={center} x2={polarToCartesian(center, center, 95, mAngle).x} y2={polarToCartesian(center, center, 95, mAngle).y} {...handStyle} strokeWidth="3" />
        {/* Second Hand */}
        <line x1={center} y1={center} x2={polarToCartesian(center, center, 100, sAngle).x} y2={polarToCartesian(center, center, 100, sAngle).y} stroke="var(--second-hand-color)" strokeWidth="2" />
      </>
    );
  };

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      {/* Background Circles for Context */}
      <circle cx={center} cy={center} r={pmClickOuter} fill="var(--clock-face)" opacity="0.1" />
      <circle cx={center} cy={center} r={amClickOuter} fill="var(--clock-face)" opacity="0.1" />
      
      {/* Rings Visual Guide (Optional - Dashed line separating AM/PM) */}
      <circle cx={center} cy={center} r="115" fill="none" stroke="var(--clock-border)" strokeWidth="1" strokeDasharray="4 4" />

      {renderEvents()}
      {renderFace()}
      {renderHands()}
      
      <circle cx={center} cy={center} r="4" fill="var(--clock-face)" stroke="var(--hand-color)" strokeWidth="2" />
      
      {renderClickSegments()}
      
      {/* AM/PM Labels for Clarity */}
      <text x={center} y={center - 55} textAnchor="middle" fontSize="10" fill="var(--text-color)" opacity="0.4" pointerEvents="none">AM</text>
      <text x={center} y={center - 160} textAnchor="middle" fontSize="10" fill="var(--text-color)" opacity="0.4" pointerEvents="none">PM</text>

      {focusEvent && (
        <text x="50%" y="70%" textAnchor="middle" fill="var(--accent)" fontSize="12" fontWeight="bold" style={{ pointerEvents: 'none' }}>
            FOCUS MODE
        </text>
      )}
    </svg>
  );
};

export default Clock;