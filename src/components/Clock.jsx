import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Lock, Unlock } from 'lucide-react';

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

const getFreeIntervals = (events) => {
    // 1. Create simple [start, end] intervals from events
    let intervals = events.map(e => ({ start: e.startAngle, end: e.endAngle }));
    
    // Sort by start time
    intervals.sort((a, b) => a.start - b.start);

    // 2. Merge overlapping intervals to get clear "Busy" blocks
    const merged = [];
    if (intervals.length > 0) {
        let curr = intervals[0];
        for (let i = 1; i < intervals.length; i++) {
            const next = intervals[i];
            // If overlap, extend current block
            if (next.start < curr.end) {
                 curr.end = Math.max(curr.end, next.end);
            } else {
                merged.push(curr);
                curr = next;
            }
        }
        merged.push(curr);
    }

    // 3. Invert merged blocks to find Gaps (0 to 360 degrees)
    const gaps = [];
    let currentAngle = 0;

    for (let interval of merged) {
        // If there is space between current position and next event
        if (interval.start > currentAngle) {
            gaps.push({ start: currentAngle, end: interval.start });
        }
        // Move current position to end of this event
        currentAngle = Math.max(currentAngle, interval.end);
    }

    // Check for remaining time after last event until end of circle (360)
    // Note: If an event wraps past 360 (e.g. 11pm-1am), currentAngle will be > 360, so this won't run.
    if (currentAngle < 360) {
        gaps.push({ start: currentAngle, end: 360 });
    }

    return gaps;
};

// Convert Mouse Coordinates to Clock Angle (0-360) and Ring ('am' | 'pm')
const getPointDetails = (x, y, center, amRadius, pmRadius) => {
    const dx = x - center;
    const dy = y - center;
    const dist = Math.sqrt(dx*dx + dy*dy);
    let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    if (angle < 0) angle += 360;

    // Determine Ring based on distance
    // Threshold is roughly halfway between the two centers
    const midPoint = (amRadius + pmRadius) / 2;
    const type = dist > midPoint ? 'pm' : 'am';

    return { angle, type };
};

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

const splitEventToSegments = (event) => {
    // 1. Parse times to minutes (0 - 1440)
    const [sH, sM] = event.start.split(':').map(Number);
    const [eH, eM] = event.end.split(':').map(Number);
    
    let startMin = sH * 60 + sM;
    let endMin = eH * 60 + eM;
    
    // Handle wrap-around (e.g., 11:00 PM to 6:00 AM) by creating two raw intervals
    const intervals = [];
    if (endMin <= startMin) {
        intervals.push({ start: startMin, end: 1440 }); // Start to Midnight
        intervals.push({ start: 0, end: endMin });      // Midnight to End
    } else {
        intervals.push({ start: startMin, end: endMin });
    }

    const segments = [];

    // Helper to convert minutes to clock angle (0-360)
    // 720 minutes in 12 hours. (m / 720) * 360
    const toAngle = (m) => ((m % 720) / 720) * 360;

    intervals.forEach(inv => {
        // --- Intersect with AM (0 - 720) ---
        const amS = Math.max(inv.start, 0);
        const amE = Math.min(inv.end, 720);
        if (amS < amE) {
            segments.push({
                ...event,
                ring: 'am', // Mark as AM
                startAngle: toAngle(amS),
                endAngle: toAngle(amE)
            });
        }

        // --- Intersect with PM (720 - 1440) ---
        const pmS = Math.max(inv.start, 720);
        const pmE = Math.min(inv.end, 1440);
        if (pmS < pmE) {
            segments.push({
                ...event,
                ring: 'pm', // Mark as PM
                startAngle: toAngle(pmS),
                endAngle: toAngle(pmE)
            });
        }
    });

    return segments;
};

const getSleepSegments = (startStr, endStr) => {
    const [sH, sM] = startStr.split(':').map(Number);
    const [eH, eM] = endStr.split(':').map(Number);
    
    const startMin = sH * 60 + sM;
    const endMin = eH * 60 + eM;
    
    const segments = [];

    // Helper to add segment
    const addSeg = (start, end, ring) => {
        // Convert minutes to degrees (30 deg per hour, 0.5 deg per min)
        // Need to normalize to 0-12h cycle for the clock face
        
        // Ring logic:
        // 0-720 min (00:00 - 12:00) -> AM Ring
        // 720-1440 min (12:00 - 24:00) -> PM Ring
        
        // We might be spanning multiple phases, so we process minute-by-minute or chunks
        // Simplification: Process the interval.
        
        let s = start;
        let e = end;
        
        // Normalize 12h angles
        const getAngle = (m) => ((m % 720) / 720) * 360;
        
        segments.push({
            startAngle: getAngle(s),
            endAngle: getAngle(e),
            ring: ring
        });
    };

    // Handle wrap around (e.g. 23:00 to 07:00)
    let intervals = [];
    if (endMin < startMin) {
        intervals.push({ s: startMin, e: 1440 }); // Start to midnight
        intervals.push({ s: 0, e: endMin });      // Midnight to end
    } else {
        intervals.push({ s: startMin, e: endMin });
    }

    intervals.forEach(inv => {
        // Split interval into AM (0-720) and PM (720-1440) parts
        
        // 1. Check for AM overlap
        const amStart = 0; const amEnd = 720;
        const overlapStart = Math.max(inv.s, amStart);
        const overlapEnd = Math.min(inv.e, amEnd);
        
        if (overlapStart < overlapEnd) {
            addSeg(overlapStart, overlapEnd, 'am');
        }

        // 2. Check for PM overlap
        const pmStart = 720; const pmEnd = 1440;
        const pOverlapStart = Math.max(inv.s, pmStart);
        const pOverlapEnd = Math.min(inv.e, pmEnd);
        
        if (pOverlapStart < pOverlapEnd) {
            addSeg(pOverlapStart, pOverlapEnd, 'pm');
        }
    });

    return segments;
};

const Clock = ({ events, onSlotClick, onTimeRangeSelect, focusEvent, settings }) => {  const size = 400; 
  const center = size / 2;
  const svgRef = useRef(null);
  const [isLocked, setIsLocked] = useState(true);
  
  // RADIUS CONFIG
  const amBaseRadius = 85; 
  const pmBaseRadius = 145; 
  const pmClickOuter = 190;
  const gaugeRadius = 30; // Small circle in center
  const [time, setTime] = useState(new Date());
  
  // DRAG STATE
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null); // { angle, type }
  const [dragCurrent, setDragCurrent] = useState(null); // { angle, type }

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 100);
    return () => clearInterval(timer);
  }, []);

  // --- Interaction Handlers ---
  const handlePointerDown = (e) => {
      if (isLocked) return;
      e.preventDefault();
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Scale coordinates to SVG viewBox
      const scaleX = size / rect.width;
      const scaleY = size / rect.height;
      
      const point = getPointDetails(x * scaleX, y * scaleY, center, amBaseRadius, pmBaseRadius);
      
      // Snap to nearest 15m (7.5 degrees) for cleaner UX
      point.angle = Math.round(point.angle / 7.5) * 7.5;
      
      setIsDragging(true);
      setDragStart(point);
      setDragCurrent(point);
  };

  const handlePointerMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const scaleX = size / rect.width;
      const scaleY = size / rect.height;

      const point = getPointDetails(x * scaleX, y * scaleY, center, amBaseRadius, pmBaseRadius);
      point.angle = Math.round(point.angle / 7.5) * 7.5; // Snap

      // Force current type to match start type (can't drag from AM to PM easily)
      setDragCurrent(point);
  };

  const handlePointerUp = () => {
      if (!isDragging) return;
      setIsDragging(false);

      // Determine Start/End Times
      if (dragStart && dragCurrent) {
          // Check for single click (essentially same start/end)
          if (Math.abs(dragStart.angle - dragCurrent.angle) < 2) {
              // It's a click
              const hour = Math.floor(dragStart.angle / 30);
              const hour24 = dragStart.type === 'pm' ? hour + 12 : hour;
              onSlotClick(hour24 === 24 ? 0 : hour24);
          } else {
              // It's a drag - calculate range
              let startAngle = dragStart.angle;
              let endAngle = dragCurrent.angle;
            
              const angleToTime = (angle, type) => {
                  let h = Math.floor(angle / 30);
                  let m = Math.round((angle % 30) * 2);
                  if (type === 'pm') h += 12;
                  if (h === 24) h = 0;
                  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
              };
              
              // Normalize for callback
              // Let's just pass the raw calculated times.
              const t1 = angleToTime(startAngle, dragStart.type);
              const t2 = angleToTime(endAngle, dragStart.type);
              
              if (onTimeRangeSelect) onTimeRangeSelect({ start: t1, end: t2 });
          }
      }
      setDragStart(null);
      setDragCurrent(null);
  };

  // --- Render Events ---
  const renderEvents = () => {
    const allSegments = events.flatMap(splitEventToSegments);
    const rawAmEvents = allSegments.filter(s => s.ring === 'am');
    const rawPmEvents = allSegments.filter(s => s.ring === 'pm');
    const amEvents = assignTracks(rawAmEvents);
    const pmEvents = assignTracks(rawPmEvents);
    const amGaps = getFreeIntervals(rawAmEvents);
    const pmGaps = getFreeIntervals(rawPmEvents);

    // const processedEvents = events.map(event => {
    //     let [h, m] = event.start.split(':').map(Number);
    //     let [endH, endM] = event.end.split(':').map(Number);
    //     const isPM = h >= 12;
        
    //     const displayH = h % 12;
    //     const displayEndH = endH % 12;
        
    //     let startAngle = (displayH * 30) + (m * 0.5);
    //     let endAngle = (displayEndH * 30) + (endM * 0.5);
        
    //     if (endAngle <= startAngle) endAngle += 360;
        
    //     return { ...event, startAngle, endAngle, isPM };
    // });

    // const rawAmEvents = processedEvents.filter(e => !e.isPM);
    // const rawPmEvents = processedEvents.filter(e => e.isPM);

    // const amEvents = assignTracks(processedEvents.filter(e => !e.isPM));
    // const pmEvents = assignTracks(processedEvents.filter(e => e.isPM));

    // const amGaps = getFreeIntervals(rawAmEvents);
    // const pmGaps = getFreeIntervals(rawPmEvents);

    const drawGap = (gap, radius) => (
      <path
          key={`gap-${radius}-${gap.start}`}
          d={describeArc(center, center, radius, gap.start, gap.end)}
          fill="none"
          stroke="var(--available)" /* Uses the green defined in index.css */
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.1" /* Low opacity to keep it subtle */
          style={{ pointerEvents: 'none' }}
      />
    );

    const drawEventPath = (event, baseR) => {
        const trackOffset = event.track * 12;
        const r = baseR + trackOffset;
        const isFocused = focusEvent && focusEvent.id === event.id;
        
        const opacity = event.completed ? 0.3 : (focusEvent ? (isFocused ? 1 : 0.1) : 1);
        const filter = isFocused ? "url(#neonGlowHigh)" : (event.completed ? "none" : "url(#neonGlow)");

        return (
            <path
                key={event.id}
                d={describeArc(center, center, r, event.startAngle, event.endAngle)}
                fill="none"
                stroke={event.color || "var(--occupied)"}
                strokeWidth={isFocused ? "10" : "6"}
                strokeLinecap="round"
                filter={filter}
                style={{ pointerEvents: 'none', opacity, transition: 'all 0.3s' }}
            />
        );
    };

    return (
      <g>
        {amGaps.map(g => drawGap(g, amBaseRadius))}
        {pmGaps.map(g => drawGap(g, pmBaseRadius))}
        {amEvents.map(e => drawEventPath(e, amBaseRadius))}
        {pmEvents.map(e => drawEventPath(e, pmBaseRadius))}
      </g>
    );
  };

  const renderActiveSelection = () => {
      if (!isDragging || !dragStart || !dragCurrent) return null;
      
      const isPM = dragStart.type === 'pm';
      const r = isPM ? pmBaseRadius : amBaseRadius;
      
      // Calculate arc path
      // Determine direction (always shortest path visually or strictly clockwise)
      // We will do strictly clockwise for scheduler
      let start = dragStart.angle;
      let end = dragCurrent.angle;
      
      // Visual feedback: If end is "behind" start, we assume wrap-around
      // But for simple drag, let's just draw min to max
      // const mn = Math.min(start, end);
      // const mx = Math.max(start, end);
      // If we want directional dragging:
      
      return (
        <path 
            d={describeArc(center, center, r, start, end)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.5"
            filter="url(#neonGlowHigh)"
        />
      );
  };

  const renderFace = () => {
    const markers = [];
    const tickStart = 114;
    const tickEnd = 120;
    const numberRadius = 128;

    for (let i = 0; i < 60; i++) {
        const angle = i * 6;
        const isHour = i % 5 === 0;
        
        const start = polarToCartesian(center, center, isHour ? tickStart : tickStart + 3, angle);
        const end = polarToCartesian(center, center, tickEnd, angle);
        
        markers.push(
            <line
                key={`tick-${i}`}
                x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                stroke={isHour ? "var(--text-color)" : "var(--clock-border)"} 
                strokeWidth={isHour ? "2" : "1"}
                strokeLinecap="round"
                opacity={isHour ? 0.9 : 0.4}
            />
        );

        if (isHour) {
             const h = i / 5;
             const numPos = polarToCartesian(center, center, numberRadius, angle);
             markers.push(
                <text
                    key={`num-${h}`}
                    x={numPos.x} y={numPos.y}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="var(--text-color)" 
                    fontSize="12" 
                    fontWeight="600"
                    style={{ fontVariantNumeric: "tabular-nums", fontFamily: 'system-ui, sans-serif' }}
                >
                    {h === 0 ? 12 : h}
                </text>
            );
        }
    }
    return markers;
  };

  const renderHands = () => {
    if (isDragging) return null; // Hide hands when selecting to show HUD

    const h = time.getHours();
    const m = time.getMinutes();
    const s = time.getSeconds();
    const ms = time.getMilliseconds();
    
    const hAngle = (h % 12) * 30 + (m * 0.5);
    const mAngle = m * 6 + (s * 0.1);
    const sAngle = s * 6 + (ms * 0.006);

    return (
      <g filter="url(#handShadow)">
        <g transform={`rotate(${hAngle}, ${center}, ${center})`}>
            <rect x={center - 4} y={center - 60} width="8" height="75" rx="4" fill="var(--text-color)" />
            <rect x={center - 1.5} y={center - 55} width="3" height="40" rx="1.5" fill="var(--bg-color)" opacity="0.8" />
        </g>
        <g transform={`rotate(${mAngle}, ${center}, ${center})`}>
            <rect x={center - 3} y={center - 90} width="6" height="105" rx="3" fill="var(--text-color)" />
            <rect x={center - 1} y={center - 85} width="2" height="60" rx="1" fill="var(--bg-color)" opacity="0.8" />
        </g>
        <g transform={`rotate(${sAngle}, ${center}, ${center})`}>
            <line x1={center} y1={center + 20} x2={center} y2={center - 110} stroke="var(--second-hand-color)" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx={center} cy={center - 110} r="2" fill="var(--second-hand-color)" />
            <circle cx={center} cy={center} r="3" fill="var(--bg-color)" stroke="var(--second-hand-color)" strokeWidth="2" />
        </g>
      </g>
    );
  };

  const renderHUD = () => {
      if (!isDragging || !dragStart || !dragCurrent) return null;
      
      const angleToTimeStr = (angle, type) => {
          let h = Math.floor(angle / 30);
          let m = Math.floor((angle % 30) * 2);
          // snap minutes to 00, 15, 30, 45 visual
          m = Math.round(m / 15) * 15;
          if (m === 60) { m = 0; h++; }
          
          if (h === 0) h = 12;
          return `${h}:${m.toString().padStart(2, '0')}`;
      };

      const t1 = angleToTimeStr(dragStart.angle, dragStart.type);
      const t2 = angleToTimeStr(dragCurrent.angle, dragStart.type);
      const period = dragStart.type.toUpperCase();

      return (
          <g>
              <circle cx={center} cy={center} r="45" fill="var(--bg-color)" stroke="var(--accent)" strokeWidth="2" opacity="0.9" />
              <text x={center} y={center - 10} textAnchor="middle" fontSize="10" fill="var(--text-color)" opacity="0.7">SCHEDULING</text>
              <text x={center} y={center + 8} textAnchor="middle" fontSize="14" fontWeight="bold" fill="var(--text-color)">
                  {t1} - {t2}
              </text>
              <text x={center} y={center + 22} textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--accent)">{period}</text>
          </g>
      );
  };

  // Circular "Complication" for Date
  const renderComplication = () => {
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dayName = days[time.getDay()];
      const dayNum = time.getDate();
      const cx = center + 55;
      const cy = center;

      return (
          <g transform={`translate(${cx}, ${cy})`}>
              <circle r="14" fill="var(--bg-color)" stroke="var(--clock-border)" strokeWidth="1" />
              <text y="-3" textAnchor="middle" fontSize="6" fontWeight="bold" fill="var(--text-color)" opacity="0.6">{dayName}</text>
              <text y="7" textAnchor="middle" fontSize="9" fontWeight="bold" fill="var(--text-color)">{dayNum}</text>
          </g>
      );
  };

  const renderSleep = () => {
    if (!settings) return null;
    const segments = getSleepSegments(settings.sleepStart, settings.sleepEnd);

    return segments.map((seg, i) => (
        <path
        key={`sleep-${i}`}
        d={describeArc(center, center, seg.ring === 'am' ? amBaseRadius : pmBaseRadius, seg.startAngle, seg.endAngle)}
        fill="none"
        stroke="var(--clock-face)" // Or a specific sleep color
        strokeWidth="24"            // Wide enough to cover the track
        strokeLinecap="butt"
        opacity="0.8"               // High opacity to look "blocked"
        filter="brightness(0.8)"    // Darken it slightly
        style={{ pointerEvents: 'none' }}
        />
    ));
  };

   // --- Render Utilization Gauge (Center) ---
  const renderUtilizationGauge = () => {
    if (!settings) return null;
    
    // Calculate Total Minutes Used
    let totalMinutes = 0;
    events.forEach(e => {
    let [h, m] = e.start.split(':').map(Number);
    let [endH, endM] = e.end.split(':').map(Number);
    let dur = (endH * 60 + endM) - (h * 60 + m);
    if (dur < 0) dur += 1440;
    totalMinutes += dur;
    });

    const capacityMinutes = settings.dailyCapacityHours * 60;
    // Cap at 100% for the arc, but maybe change color if over
    const percentage = Math.min(1, totalMinutes / capacityMinutes);
    const isOver = totalMinutes > capacityMinutes;
    
    const startAngle = 0;
    const endAngle = percentage * 360;

    return (
        <g>
            {/* Background Track */}
            <circle cx={center} cy={center} r={gaugeRadius} fill="none" stroke="var(--clock-border)" strokeWidth="4" opacity="0.3" />
            
            {/* Active Arc */}
            {percentage > 0 && (
                <path
                d={describeArc(center, center, gaugeRadius, 0, endAngle)}
                fill="none"
                stroke={isOver ? "#ef4444" : "var(--accent)"} // Red if over capacity
                strokeWidth="4"
                strokeLinecap="round"
                transform={`rotate(180, ${center}, ${center})`} // Start from bottom (6 o'clock) or top? 180 makes it start bottom like a gauge
                opacity="0.8"
                />
            )}
            
            {/* Optional: Text Label inside */}
            {/* <text x={center} y={center + 45} textAnchor="middle" fontSize="10" fill="var(--text-color)" opacity="0.6">{Math.round(percentage*100)}%</text> */}
        </g>
    );
  };

  return (
    <svg 
        ref={svgRef}
        width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} 
        style={{ 
            display: 'block', 
            userSelect: 'none', 
            touchAction: isLocked ? 'pan-y' : 'none',
            cursor: isLocked ? 'default' : 'pointer'
        }}        
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
    >
      <defs>
        <filter id="handShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="2" dy="3" result="offsetblur" />
            <feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feComponentTransfer in="coloredBlur" result="glowAlpha"><feFuncA type="linear" slope="0.5"/></feComponentTransfer>
            <feMerge><feMergeNode in="glowAlpha"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
         <filter id="neonGlowHigh" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="bezelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />    {/* Darker Silver */}
            <stop offset="50%" stopColor="#64748b" />   {/* Steel Gray */}
            <stop offset="100%" stopColor="#475569" />  {/* Dark Slate */}
        </linearGradient>
        <radialGradient id="faceGradient" cx="50%" cy="50%" r="50%">
            <stop offset="80%" stopColor="var(--clock-face)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.1)" />
        </radialGradient>
      </defs>

      {/* --- CHASSIS --- */}
      <circle cx={center} cy={center} r={pmClickOuter} fill="url(#bezelGradient)" />
      <circle cx={center} cy={center} r={pmClickOuter - 4} fill="url(#faceGradient)" stroke="var(--clock-border)" strokeWidth="1" />
      
      {/* --- MARKINGS --- */}
      <circle cx={center} cy={center} r={amBaseRadius} fill="none" stroke="var(--clock-border)" strokeWidth="1" opacity="0.1" strokeDasharray="1 3" />
      <circle cx={center} cy={center} r={pmBaseRadius} fill="none" stroke="var(--clock-border)" strokeWidth="1" opacity="0.1" strokeDasharray="1 3" />

      <text x={center} y={center - 45} textAnchor="middle" fontSize="8" fontWeight="800" fill="var(--text-color)" opacity="0.15" letterSpacing="1px">AM</text>
      <text x={center} y={center - 155} textAnchor="middle" fontSize="8" fontWeight="800" fill="var(--text-color)" opacity="0.15" letterSpacing="1px">PM</text>

      {/* --- CONTENT --- */}
      {renderSleep()}
      {renderEvents()}
      {renderActiveSelection()}
      {renderFace()}
      {renderComplication()}
      {renderUtilizationGauge()}
      {renderHands()}
      {renderHUD()}
        <g 
            onClick={(e) => { 
                e.stopPropagation(); // Prevent triggering other click logic
                setIsLocked(!isLocked); 
                if (navigator.vibrate) navigator.vibrate(20); 
            }} 
            // Stop pointer down propagation so clicking the button doesn't trigger 'handlePointerDown' logic if unlocked
            onPointerDown={(e) => e.stopPropagation()}
            style={{ cursor: 'pointer' }} 
            transform={`translate(${size - 50}, 50)`} // Positioned top-right
        >
            <circle r="20" fill="var(--bg-color)" stroke="var(--clock-border)" strokeWidth="1" opacity="0.9" />
            {/* Embed the Icon components inside a foreignObject or render them if they are SVGs. 
                Since lucide-react icons are SVGs, we can wrap them in a container 
                or strictly position them. 
                However, direct rendering of React Components inside SVG works in React. 
                We center them by adjusting x/y offsets (icons are usually 24x24).
            */}
            <g transform="translate(-12, -12)">
                {isLocked ? 
                    <Lock size={24} color="var(--text-color)" opacity={0.5} /> : 
                    <Unlock size={24} color="var(--accent)" />
                }
            </g>
        </g>
    </svg>
  );
};

export default Clock;