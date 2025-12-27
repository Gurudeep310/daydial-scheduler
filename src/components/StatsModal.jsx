import React from 'react';
import { X, PieChart, Clock, Activity } from 'lucide-react';

const StatsModal = ({ isOpen, onClose, events, categories, settings }) => {
  if (!isOpen) return null;

// Use settings or defaults
  const capacityHours = settings?.dailyCapacityHours || 8;
  const capacityMinutes = capacityHours * 60;

  // --- Calculate Metrics ---
  const totalEvents = events.length;
  let totalMinutes = 0;
  const distribution = {}; 
  const timeOfDay = { morning: 0, afternoon: 0, evening: 0 }; // Track busy times

  events.forEach(e => {
      const [startH, startM] = e.start.split(':').map(Number);
      const [endH, endM] = e.end.split(':').map(Number);
      
      let duration = (endH * 60 + endM) - (startH * 60 + startM);
      if (duration < 0) duration += 24 * 60;
      totalMinutes += duration;

      // 1. Category Distribution
      let catName = e.category;
      if (!catName) {
          const found = categories.find(c => c.color === e.color);
          catName = found ? found.name : 'General';
      }
      distribution[catName] = (distribution[catName] || 0) + duration;

      // 2. Time of Day Logic
      // Simple heuristic: where does the event START?
      if (startH >= 5 && startH < 12) timeOfDay.morning++;
      else if (startH >= 12 && startH < 17) timeOfDay.afternoon++;
      else timeOfDay.evening++;
  });

  const totalHours = (totalMinutes / 60).toFixed(1);
  const rawPercent = Math.round((totalMinutes / capacityMinutes) * 100);
  const percentOccupied = rawPercent

  // Find Busiest Period
  const busiestPeriod = Object.keys(timeOfDay).reduce((a, b) => timeOfDay[a] > timeOfDay[b] ? a : b);
  const hasEvents = totalEvents > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '24px', maxWidth: '360px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'var(--accent)', padding: '8px', borderRadius: '8px', color: 'white' }}>
                    <Activity size={20} />
                </div>
                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Daily Insights</h2>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-color)' }}>
                <X size={24} />
            </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Key Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: 'var(--bg-color)', padding: '12px', borderRadius: '12px', border: '1px solid var(--clock-border)' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '4px' }}>Total Scheduled</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{totalHours}<span style={{ fontSize: '0.9rem' }}>h</span></div>
                </div>
                <div style={{ background: 'var(--bg-color)', padding: '12px', borderRadius: '12px', border: '1px solid var(--clock-border)' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '4px' }}>Events</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{totalEvents}</div>
                </div>
            </div>

            {/* Utilization Bar */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '6px' }}>
                    <span>Capacity Used ({capacityHours}h goal)</span>
                    <span style={{ fontWeight: 'bold' }}>{percentOccupied}%</span>
                </div>
                <div style={{ width: '100%', height: '12px', background: 'var(--clock-border)', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ 
                        width: `${Math.min(100, percentOccupied)}%`, 
                        height: '100%', 
                        // Turn red if over capacity
                        background: percentOccupied > 100 ? '#ef4444' : (percentOccupied > 50 ? 'var(--occupied)' : 'var(--available)'), 
                        transition: 'width 0.5s' 
                    }}></div>
                </div>
                {percentOccupied > 100 && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px' }}>Over capacity by {percentOccupied - 100}%</div>}
            </div>

            {/* Category Breakdown */}
            <div>
                <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PieChart size={16} /> Time by Category
                </div>
                {Object.keys(distribution).length === 0 ? (
                    <p style={{ fontSize: '0.8rem', opacity: 0.6, fontStyle: 'italic' }}>No events to analyze.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Object.entries(distribution).sort(([, a], [, b]) => b - a).map(([name, mins]) => {
                            const percent = Math.round((mins / totalMinutes) * 100);
                            const cat = categories.find(c => c.name === name) || { color: '#94a3b8' };
                            return (
                                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: cat.color }}></div>
                                    <div style={{ flex: 1, fontSize: '0.85rem' }}>{name}</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{Math.floor(mins/60)}h {mins%60}m</div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.6, width: '30px', textAlign: 'right' }}>{percent}%</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* PEAK ACTIVITY INSIGHT (Restored) */}
            {hasEvents && (
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '16px', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'start', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <Clock size={20} color="var(--accent)" style={{ marginTop: '2px' }} />
                    <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--accent)', marginBottom: '4px' }}>Peak Activity</div>
                        <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                            You are busiest in the <strong>{busiestPeriod}</strong>. 
                            {busiestPeriod === 'morning' ? ' A great start to the day!' : busiestPeriod === 'afternoon' ? ' Power through the slump!' : ' A busy end to the day.'}
                        </div>
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default StatsModal;