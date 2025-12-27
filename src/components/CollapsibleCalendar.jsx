import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

const formatDate = (date) => {
    const d = new Date(date);
    const month = '' + (d.getMonth() + 1);
    const day = '' + d.getDate();
    const year = d.getFullYear();
    return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
};

const CollapsibleCalendar = ({ selectedDate, onDateSelect, events }) => {
    const [isExpanded, setIsExpanded] = useState(false); // Default to Week View (One Handed Logic)
    const [currentDate, setCurrentDate] = useState(new Date(selectedDate));
    const touchStartX = useRef(null);

    // Sync internal navigation state if parent changes selectedDate externally
    useEffect(() => {
        setCurrentDate(new Date(selectedDate));
    }, [selectedDate]);

    // --- NAVIGATION LOGIC ---
    const handlePrev = () => {
        const newDate = new Date(currentDate);
        if (isExpanded) {
            newDate.setMonth(newDate.getMonth() - 1);
        } else {
            newDate.setDate(newDate.getDate() - 7);
        }
        setCurrentDate(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(currentDate);
        if (isExpanded) {
            newDate.setMonth(newDate.getMonth() + 1);
        } else {
            newDate.setDate(newDate.getDate() + 7);
        }
        setCurrentDate(newDate);
    };

    // --- TOUCH / SWIPE LOGIC ---
    const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
    const handleTouchEnd = (e) => {
        if (!touchStartX.current) return;
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) handleNext();
            else handlePrev();
        }
        touchStartX.current = null;
    };

    // --- DATE GENERATION ---
    const getDaysToRender = () => {
        const days = [];
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        if (isExpanded) {
            // --- MONTH VIEW ---
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const startDay = new Date(year, month, 1).getDay();
            
            // Empty slots
            for (let i = 0; i < startDay; i++) {
                days.push(null);
            }
            // Days
            for (let d = 1; d <= daysInMonth; d++) {
                days.push(new Date(year, month, d));
            }
        } else {
            // --- WEEK VIEW ---
            // Find Sunday of the current week
            const dayOfWeek = currentDate.getDay();
            const startOfWeek = new Date(currentDate);
            startOfWeek.setDate(currentDate.getDate() - dayOfWeek);

            for (let i = 0; i < 7; i++) {
                const d = new Date(startOfWeek);
                d.setDate(startOfWeek.getDate() + i);
                days.push(d);
            }
        }
        return days;
    };

    const renderDays = () => {
        const days = getDaysToRender();
        
        return days.map((dateObj, index) => {
            if (!dateObj) {
                return <div key={`empty-${index}`} style={{ height: 42 }}></div>;
            }

            const dateStr = formatDate(dateObj);
            const isSelected = dateStr === formatDate(selectedDate);
            const isToday = dateStr === formatDate(new Date());

            // --- REUSE YOUR DOT LOGIC ---
            const dayEvents = events.filter(e => {
                const [y, m, d] = e.date.split('-').map(Number);
                const eStartDate = new Date(y, m - 1, d);

                // Recurrence checks (simplified)
                if (e.date === dateStr) return true;
                if (e.recurrence === 'daily') return dateObj >= eStartDate;
                if (e.recurrence === 'weekly') return dateObj >= eStartDate && eStartDate.getDay() === dateObj.getDay();
                if (e.recurrence === 'monthly') return dateObj >= eStartDate && eStartDate.getDate() === dateObj.getDate();
                return false;
            }).sort((a, b) => a.start.localeCompare(b.start));

            const visibleEvents = dayEvents.slice(0, 3);
            const hasOverflow = dayEvents.length > 3;

            return (
                <button 
                    key={index} 
                    onClick={() => { onDateSelect(dateObj); setCurrentDate(dateObj); }} 
                    style={{ 
                        height: 48, // Slightly taller for touch targets
                        background: isSelected ? 'var(--accent)' : 'transparent', 
                        color: isSelected ? 'white' : (isToday ? 'var(--accent)' : 'var(--text-color)'), 
                        border: isToday && !isSelected ? '1px solid var(--accent)' : 'none', 
                        borderRadius: '14px', 
                        boxShadow: isSelected ? '0 4px 14px rgba(59, 130, 246, 0.4)' : 'none',
                        cursor: 'pointer', 
                        position: 'relative', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'
                    }}
                >
                    <span style={{ fontSize: '0.95rem', fontWeight: isSelected || isToday ? '700' : '500', marginBottom: visibleEvents.length ? '4px' : '0' }}>
                        {dateObj.getDate()}
                    </span>
                    
                    {/* Dots */}
                    {visibleEvents.length > 0 && !isSelected && (
                        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', height: '6px' }}>
                            {visibleEvents.map((e, idx) => (
                                <div key={idx} style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: e.color || '#f97316' }} />
                            ))}
                            {hasOverflow && <span style={{ fontSize: '8px', lineHeight: 1, opacity: 0.5 }}>+</span>}
                        </div>
                    )}
                </button>
            );
        });
    };

    return (
        <div 
            onTouchStart={handleTouchStart} 
            onTouchEnd={handleTouchEnd}
            style={{ 
                width: '100%', maxWidth: '340px', 
                background: 'var(--clock-face)', 
                backdropFilter: 'blur(12px)',
                padding: '16px', 
                borderRadius: '26px', 
                boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.05), 0 0 0 1px var(--clock-border)',
                display: 'flex', flexDirection: 'column', gap: '10px',
                transition: 'all 0.3s ease'
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
                <button onClick={handlePrev} style={{ background: 'var(--bg-color)', border: 'none', borderRadius: '50%', padding: '8px', color: 'var(--text-color)' }}><ChevronLeft size={20} /></button>
                <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </div>
                <button onClick={handleNext} style={{ background: 'var(--bg-color)', border: 'none', borderRadius: '50%', padding: '8px', color: 'var(--text-color)' }}><ChevronRight size={20} /></button>
            </div>

            {/* Weekday Labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center' }}>
                {['S','M','T','W','T','F','S'].map((d, i) => (
                    <div key={i} style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-color)', opacity: 0.5 }}>{d}</div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(7, 1fr)', 
                gap: '8px',
                // Animation for height could go here, but conditional rendering is snappier for React
            }}>
                {renderDays()}
            </div>

            {/* Drag Handle / Toggle */}
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                style={{ 
                    width: '100%', height: '20px', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: 'none', color: 'var(--text-color)', opacity: 0.3
                }}
            >
                {isExpanded ? <ChevronUp size={16}/> : <div style={{ width: '40px', height: '4px', background: 'currentColor', borderRadius: '2px' }} />}
            </button>
        </div>
    );
};

export default CollapsibleCalendar;