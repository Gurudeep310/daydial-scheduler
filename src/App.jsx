import React, { useState, useEffect, useRef } from 'react';
import Clock from './components/Clock';
import EventModal from './components/EventModal';
import StatsModal from './components/StatsModal';
import DataModal from './components/DataModal';
import CollapsibleCalendar from './components/CollapsibleCalendar';
import SyncModal from './components/SyncModal';
import { 
    Calendar as CalendarIcon, ChevronLeft, ChevronRight, BarChart2, 
    PlayCircle, PauseCircle, CheckSquare, CheckCircle, GripVertical, Trash2, Plus, 
    Square, Check, Menu, X, List, Moon, Sun, Settings, RefreshCw, Circle
} from 'lucide-react';

const formatDate = (date) => {
    const d = new Date(date);
    const month = '' + (d.getMonth() + 1);
    const day = '' + d.getDate();
    const year = d.getFullYear();
    return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
};

const formatTime12 = (time24) => {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
};

const vibrate = (ms = 50) => { if (navigator.vibrate) navigator.vibrate(ms); };

// --- DEFAULT CATEGORIES ---
const DEFAULT_CATEGORIES = [
    { id: 'cat_1', name: 'General', color: '#f97316' },
    { id: 'cat_2', name: 'Work / Focus', color: '#3b82f6' },
    { id: 'cat_3', name: 'Health / Personal', color: '#22c55e' },
    { id: 'cat_4', name: 'Creative', color: '#a855f7' },
    { id: 'cat_5', name: 'Critical', color: '#ef4444' }
];

// --- NATIVE HOOKS ---
const useBackButton = (isOpen, onClose) => {
    useEffect(() => {
        if (isOpen) {
            window.history.pushState({ modal: true }, '');
            const handlePopState = () => onClose();
            window.addEventListener('popstate', handlePopState);
            return () => window.removeEventListener('popstate', handlePopState);
        }
    }, [isOpen, onClose]);
};

const useThemeColor = (theme) => {
    useEffect(() => {
        const meta = document.querySelector("meta[name=theme-color]") || document.createElement('meta');
        meta.name = "theme-color";
        meta.content = theme === 'dark' ? '#0f172a' : '#f8fafc';
        document.head.appendChild(meta);
    }, [theme]);
};

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  useThemeColor(theme);

  const [userSettings, setUserSettings] = useState(() => 
    JSON.parse(localStorage.getItem('scheduler_settings') || JSON.stringify({
        dailyCapacityHours: 8,
        sleepStart: '23:00',
        sleepEnd: '07:00'
    }))
   );
   useEffect(() => {
        localStorage.setItem('scheduler_settings', JSON.stringify(userSettings));
    }, [userSettings]);

   const handleUpdateSettings = (newSettings) => {
        setUserSettings({ ...userSettings, ...newSettings });
    };

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('theme', theme); }, [theme]);
  const toggleTheme = () => { vibrate(30); setTheme(prev => prev === 'light' ? 'dark' : 'light'); };

  const [events, setEvents] = useState(() => JSON.parse(localStorage.getItem('scheduler_events') || '[]'));
  const [todos, setTodos] = useState(() => JSON.parse(localStorage.getItem('scheduler_todos') || JSON.stringify([
      { id: 't1', title: 'Buy Groceries', completed: false },
      { id: 't2', title: 'Call Mom', completed: false }
  ])));
  
  // NEW: Categories State
  const [categories, setCategories] = useState(() => JSON.parse(localStorage.getItem('scheduler_categories') || JSON.stringify(DEFAULT_CATEGORIES)));

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [focusEvent, setFocusEvent] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedEventIds, setSelectedEventIds] = useState(new Set());
  
  useBackButton(isModalOpen, () => setIsModalOpen(false));
  useBackButton(isStatsOpen, () => setIsStatsOpen(false));
  useBackButton(isDataModalOpen, () => setIsDataModalOpen(false));
  useBackButton(isTaskDrawerOpen, () => setIsTaskDrawerOpen(false));
  
  const clockRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { localStorage.setItem('scheduler_events', JSON.stringify(events)); }, [events]);
  useEffect(() => { localStorage.setItem('scheduler_todos', JSON.stringify(todos)); }, [todos]);
  useEffect(() => { localStorage.setItem('scheduler_categories', JSON.stringify(categories)); }, [categories]);

  // --- Handlers ---
  const toggleEventSelection = (id) => {
    const newSet = new Set(selectedEventIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedEventIds(newSet);
  };

  const deleteSelectedEvents = () => {
    if (selectedEventIds.size === 0) return;
    if (confirm(`Delete ${selectedEventIds.size} events?`)) {
        setEvents(events.filter(e => !selectedEventIds.has(e.id)));
        setSelectedEventIds(new Set());
    }
  };

  const toggleEventComplete = (e, id) => {
      e.stopPropagation();
      setEvents(events.map(ev => ev.id === id ? { ...ev, completed: !ev.completed } : ev));
      vibrate(20);
  };

  const clearCompletedTodos = () => {
      const completedCount = todos.filter(t => t.completed).length;
      if (completedCount === 0) return;
      if (confirm(`Clear ${completedCount} completed tasks?`)) {
          setTodos(todos.filter(t => !t.completed));
          vibrate(50);
      }
  };

  const handleSyncComplete = (incomingData) => {
        // REPLACE OPERATION:
        // Directly overwrite local state with incoming data.
        if (incomingData.events) setEvents(incomingData.events);
        if (incomingData.todos) setTodos(incomingData.todos);
        if (incomingData.categories) setCategories(incomingData.categories);
        
        vibrate(100);
  };

  const handleRestoreData = (data) => {
      if (Array.isArray(data)) setEvents(data);
      else {
          if (data.events) setEvents(data.events);
          if (data.todos) setTodos(data.todos);
          if (data.categories) setCategories(data.categories);
      }
      alert('Data restored successfully!');
  };

  const handleCleanup = (months) => {
      if (!months) { if(confirm('Reset all?')) { setEvents([]); setTodos([]); setCategories(DEFAULT_CATEGORIES); } return; }
      const d = new Date(); d.setMonth(d.getMonth() - months);
      const str = formatDate(d);
      setEvents(events.filter(e => e.date > str || e.recurrence !== 'none'));
      alert('Cleanup done.');
  };

  const handleAddCategory = (newCat) => {
      setCategories([...categories, { ...newCat, id: Date.now().toString() }]);
  };

  const handleSlotClick = (hour24, existingEvent = null) => {
    vibrate(50);
    if (selectedEventIds.size > 0 && existingEvent) {
        toggleEventSelection(existingEvent.id);
        return;
    }

    if (existingEvent) {
      setEditingEvent(existingEvent);
      setIsModalOpen(true);
      return;
    }

    const startStr = `${hour24.toString().padStart(2, '0')}:00`;
    const endStr = `${((hour24 + 1) % 24).toString().padStart(2, '0')}:00`;

    if (selectedTaskId) {
        const task = todos.find(t => t.id === selectedTaskId);
        if (task) {
            const newEvent = {
                id: Date.now().toString(), title: task.title, 
                color: categories[1].color, category: categories[1].name, // Default to 2nd cat
                date: formatDate(selectedDate), start: startStr, end: endStr,
                description: 'Scheduled from Task List', recurrence: 'none'
            };
            setEvents([...events, newEvent]);
            setTodos(todos.map(t => t.id === selectedTaskId ? { ...t, completed: true } : t));
            setSelectedTaskId(null); vibrate(100);
            return;
        }
    }
    setEditingEvent({ 
        id: null, title: '', 
        color: categories[0].color, category: categories[0].name, 
        date: formatDate(selectedDate), start: startStr, end: endStr, description: '', recurrence: 'none' 
    });
    setIsModalOpen(true);
  };

  const handleSaveEvent = (data) => {
    if (data.id) setEvents(events.map(e => e.id === data.id ? data : e));
    else setEvents([...events, { ...data, id: Date.now().toString() }]);
    setIsModalOpen(false); window.history.back(); 
  };

  const handleDeleteEvent = (id) => {
    setEvents(events.filter(e => e.id !== id));
    setIsModalOpen(false); window.history.back();
    if (focusEvent?.id === id) setFocusEvent(null);
  };

  const addTodo = (title) => { if (title.trim()) setTodos([...todos, { id: Date.now().toString(), title, completed: false }]); };
  const toggleTodo = (id) => { vibrate(30); setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t)); };
  const deleteTodo = (id) => { setTodos(todos.filter(t => t.id !== id)); if (selectedTaskId === id) setSelectedTaskId(null); };
  const handleTaskSelect = (id) => { vibrate(50); if (selectedTaskId === id) setSelectedTaskId(null); else { setSelectedTaskId(id); setIsTaskDrawerOpen(false); } };
  
  const handleDropOnClock = (e) => {
      e.preventDefault(); const todoTitle = e.dataTransfer.getData("todoTitle"); const todoId = e.dataTransfer.getData("todoId"); if (!todoTitle || !clockRef.current) return;
      setEditingEvent({ id: null, title: todoTitle, color: categories[1].color, category: categories[1].name, date: formatDate(selectedDate), start: "12:00", end: "13:00", description: 'Imported', recurrence: 'none' });
      setIsModalOpen(true);
      if (todoId) { setTodos(prev => prev.map(t => t.id === todoId ? { ...t, completed: true } : t)); setSelectedTaskId(null); }
  };

  const handleTimeRangeSelect = ({ start, end }) => {
      vibrate(50);
      setEditingEvent({ 
        id: null, 
        title: '', 
        color: categories[0].color, 
        category: categories[0].name, 
        date: formatDate(selectedDate), 
        start: start, 
        end: end, 
        description: '', 
        recurrence: 'none' 
    });
    setIsModalOpen(true);
  };

  const getDisplayEventsForDate = (targetDate, allEvents) => {
      const targetStr = formatDate(targetDate); // YYYY-MM-DD
      const targetStart = new Date(`${targetStr}T00:00:00`);
      const targetEnd = new Date(`${targetStr}T23:59:59`);

      return allEvents.map(e => {
          // 1. Calculate specific Event Start/End DateTimes
          // If e.end < e.start, we assume it ends the next day.
          const eStartBase = new Date(`${e.date}T${e.start}:00`);
          let eEndBase = new Date(`${e.date}T${e.end}:00`);
          
          if (eEndBase < eStartBase) {
              eEndBase.setDate(eEndBase.getDate() + 1);
          }

          // Handle Recurrence (Simple Projection)
          // Ideally, a recurrence library handles this, but for this simpler app:
          // We only check if the *recurrence rule* lands on 'targetDate'.
          
          let effectiveStart = eStartBase;
          let effectiveEnd = eEndBase;
          let isRelevant = false;

          // Check Recurrence matches Target Date
          if (e.recurrence === 'daily') {
             isRelevant = true; // Happens every day
             // Project times to target date
             effectiveStart = new Date(`${targetStr}T${e.start}:00`);
             effectiveEnd = new Date(`${targetStr}T${e.end}:00`);
             if (effectiveEnd < effectiveStart) effectiveEnd.setDate(effectiveEnd.getDate() + 1);
          } 
          else if (e.recurrence === 'weekly' && eStartBase.getDay() === targetDate.getDay()) {
             isRelevant = true;
             effectiveStart = new Date(`${targetStr}T${e.start}:00`);
             effectiveEnd = new Date(`${targetStr}T${e.end}:00`);
             if (effectiveEnd < effectiveStart) effectiveEnd.setDate(effectiveEnd.getDate() + 1);
          }
          else if (e.date === targetStr) {
             isRelevant = true; // Is exactly today
          }
          // Check "Yesterday's" spillover for non-recurring
          else {
             // If event started yesterday (target - 1) and ends after targetStart
             // (Simple check: is target inside the event range?)
             if (effectiveStart < targetEnd && effectiveEnd > targetStart) {
                 isRelevant = true;
             }
          }

          if (!isRelevant) return null;

          // 2. CLIP Logic: Slice the event to fit onto the Target Day's Clock
          // The Clock component only understands 00:00 to 24:00 for the current view.
          
          // Intersection Start
          const showStart = effectiveStart < targetStart ? targetStart : effectiveStart;
          // Intersection End
          const showEnd = effectiveEnd > targetEnd ? targetEnd : effectiveEnd;

          // If intersection is invalid (e.g. event is completely in past/future of this day), skip
          if (showStart >= showEnd) return null;

          // Format back to HH:MM for the Clock
          const toHHMM = (d) => `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;

          return {
              ...e,
              date: targetStr, // Fake date for display match
              start: toHHMM(showStart),
              end: toHHMM(showEnd)
          };
      }).filter(Boolean).sort((a,b) => a.start.localeCompare(b.start));
  };

  const currentDayEvents = getDisplayEventsForDate(selectedDate, events);
  const visibleEvents = currentDayEvents; // Reuse for the list view

  const TaskList = ({ isMobile }) => {
      const hasCompleted = todos.some(t => t.completed);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {/* BULK DELETE BUTTON FOR TODOS */}
          {hasCompleted && (
              <button 
                onClick={clearCompletedTodos}
                style={{ 
                    marginBottom: '8px', padding: '8px', fontSize: '0.8rem', 
                    color: '#ef4444', border: '1px solid #ef4444', 
                    background: 'rgba(239,68,68,0.1)', borderRadius: '6px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' 
                }}
              >
                <Trash2 size={14} /> Clear Completed
              </button>
          )}

          {todos.map(todo => (
              <div key={todo.id} draggable={!isMobile} onDragStart={(e) => { e.dataTransfer.setData("todoId", todo.id); e.dataTransfer.setData("todoTitle", todo.title); }} onClick={() => handleTaskSelect(todo.id)} className="task-item" style={{ padding: '12px', background: selectedTaskId === todo.id ? (theme === 'dark' ? '#1e3a8a' : '#e0f2fe') : (todo.completed ? 'var(--bg-color)' : 'var(--bg-color)'), borderRadius: '8px', border: selectedTaskId === todo.id ? '1px solid var(--accent)' : '1px solid var(--clock-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', opacity: todo.completed ? 0.6 : 1, transition: 'all 0.2s', touchAction: 'manipulation' }}>
                  {!isMobile && <GripVertical size={16} style={{ color: 'var(--text-color)', opacity: 0.5 }} />}
                  <button onClick={(e) => { e.stopPropagation(); toggleTodo(todo.id); }} style={{ background: 'none', border: 'none', padding: 0, color: todo.completed ? 'var(--available)' : 'var(--text-color)', opacity: todo.completed ? 1 : 0.3 }}>{todo.completed ? <Check size={20} /> : <Square size={20} />}</button>
                  <span style={{ fontSize: '0.95rem', flex: 1, textDecoration: todo.completed ? 'line-through' : 'none' }}>{todo.title}</span>
                  <button onClick={(e) => { e.stopPropagation(); deleteTodo(todo.id); }} style={{ background: 'none', border: 'none', padding: 0, color: '#ef4444', opacity: 0.6 }}><Trash2 size={16} /></button>
              </div>
          ))}
          <div style={{ position: 'relative', marginTop: '8px' }}>
              <input type="text" placeholder="Add new task..." onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value.trim()) { addTodo(e.target.value); e.target.value = ''; } }} style={{ width: '100%', boxSizing: 'border-box', padding: '12px', paddingRight: '40px', borderRadius: '8px', border: '1px solid var(--clock-border)', background: 'transparent', fontSize: '1rem', color: 'var(--text-color)' }} />
              <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }}><Plus size={20} /></div>
          </div>
      </div>
    );
  };

  return (
    <>
      <style>{`@media (max-width: 768px) {.desktop-sidebar { display: none !important; }.mobile-fab { display: flex !important; }.mobile-fab { display: none; }.mobile-menu-btn { display: none; }.task-item:active { transform: scale(0.98); background: var(--clock-border); }button:active { opacity: 0.7; transform: scale(0.95); transition: transform 0.1s; }`}</style>

      <header style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '20px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'var(--accent)', padding: '8px', borderRadius: '8px', color: 'white' }}><CalendarIcon size={20} /></div>
            <h1 style={{ fontSize: '1.2rem', margin: 0 }}>DayDial</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={toggleTheme} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color)', padding: '8px' }}>{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
            <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setIsStatsOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color)' }}><BarChart2 size={20} /></button>
                <button onClick={() => setIsDataModalOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color)' }}><Settings size={20} /></button>
                <button onClick={() => setIsSyncOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color)' }}><RefreshCw size={20} /></button>      
            </div>
        </div>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', width: '100%', justifyContent: 'center', paddingBottom: '80px' }}>
          <main style={{ flex: '1', minWidth: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
           <CollapsibleCalendar 
                selectedDate={selectedDate}
                onDateSelect={(date) => { setSelectedDate(date); vibrate(20); }}
                events={events}
            />

            <div ref={clockRef} onDragOver={(e) => e.preventDefault()} onDrop={handleDropOnClock} style={{ width: '100%', maxWidth: 320, aspectRatio: '1/1', border: selectedTaskId ? '2px dashed var(--accent)' : 'none', borderRadius: '50%', transition: 'border 0.3s', position: 'relative', touchAction: 'none' }}>
                <Clock events={currentDayEvents} onSlotClick={handleSlotClick} onTimeRangeSelect={handleTimeRangeSelect} focusEvent={focusEvent} settings={userSettings}/>
            </div>
            {selectedTaskId && <div style={{ background: 'var(--accent)', color: 'white', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '-10px', animation: 'bounce 1s infinite' }}>Tap a time slot to schedule!</div>}
            
            <div style={{ width: '100%', maxWidth: '400px', marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--clock-border)', paddingBottom: '10px', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Today's Schedule</h3>
                    {selectedEventIds.size > 0 && (
                        <button onClick={deleteSelectedEvents} style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Trash2 size={14} /> Delete ({selectedEventIds.size})
                        </button>
                    )}
                </div>
                {visibleEvents.length === 0 ? <p style={{ color: 'var(--text-color)', opacity: 0.6, fontSize: '0.9rem', fontStyle: 'italic' }}>No events scheduled.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {visibleEvents.map(e => (
                            <div key={e.id} style={{ padding: '12px', background: 'var(--clock-face)', border: '1px solid var(--clock-border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {/* SELECTION CHECKBOX */}
                                <div onClick={() => toggleEventSelection(e.id)} style={{ padding: '8px', cursor: 'pointer', marginRight: '4px' }}>
                                    {selectedEventIds.has(e.id) ? <CheckSquare size={20} color="var(--accent)" /> : <Square size={20} color="var(--text-color)" opacity={0.3} />}
                                </div>
                                <div onClick={() => handleSlotClick(null, e)} style={{ cursor: 'pointer', flex: 1 }}>
                                    <div style={{ fontWeight: '600' }}>{e.title}</div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                                        {formatTime12(e.start)} - {formatTime12(e.end)}
                                        {e.category && <span style={{ marginLeft: '8px', fontSize: '0.7rem', background: e.color, color: 'white', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle' }}>{e.category}</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    {/* COMPLETED TOGGLE */}
                                    <button onClick={(evt) => toggleEventComplete(evt, e.id)} style={{ background: 'none', border: 'none', padding: 0, color: e.completed ? 'var(--available)' : 'var(--text-color)', opacity: e.completed ? 1 : 0.2 }}>
                                        {e.completed ? <CheckCircle size={20} /> : <Circle size={20} />}
                                    </button>
                                    <button onClick={() => setFocusEvent(focusEvent?.id === e.id ? null : e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: focusEvent?.id === e.id ? 'var(--occupied)' : 'var(--text-color)', opacity: 0.8 }}>{focusEvent?.id === e.id ? <PauseCircle size={20} /> : <PlayCircle size={20} />}</button>
                                    <div style={{ width: 4, height: 30, background: e.color || 'var(--occupied)', borderRadius: 2 }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </main>

          <aside className="desktop-sidebar" style={{ width: '100%', maxWidth: '300px', background: 'var(--clock-face)', borderRadius: '16px', padding: '16px', height: 'fit-content', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><CheckSquare size={20} color="var(--accent)" /><h3 style={{ margin: 0, fontSize: '1rem' }}>Tasks</h3></div>
              <TaskList isMobile={false} />
          </aside>
      </div>

      <footer style={{ 
          width: '100%', 
          textAlign: 'center', 
          padding: '24px', 
          marginTop: 'auto', 
          borderTop: '1px solid var(--clock-border)',
          color: 'var(--text-color)', 
          opacity: 0.8,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          alignItems: 'center',
          fontSize: '0.9rem'
      }}>
          <div style={{ fontWeight: '600' }}>
              DayDial &copy; {new Date().getFullYear()}
          </div>
          
          <p style={{ margin: 0, fontStyle: 'italic', opacity: 0.7 }}>
              "Plan your day, own your time."
          </p>

          <div style={{ 
              marginTop: '8px', 
              fontSize: '0.75rem', 
              opacity: 0.6, 
              background: 'var(--clock-border)', 
              padding: '4px 10px', 
              borderRadius: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
          }}>
             ✨ Made with AI
          </div>
      </footer>
      {/* ----------------------- */}

      {!isModalOpen && !isStatsOpen && !isDataModalOpen && (
          <button className="mobile-fab" onClick={() => { setIsTaskDrawerOpen(true); vibrate(30); }} style={{ position: 'fixed', bottom: '20px', right: '20px', width: '56px', height: '56px', borderRadius: '50%', background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, cursor: 'pointer' }}>
              <List size={24} />
              {todos.filter(t => !t.completed).length > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: 'white', fontSize: '0.75rem', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{todos.filter(t => !t.completed).length}</span>}
          </button>
      )}

      {isTaskDrawerOpen && (
          <div className="modal-overlay" onClick={() => setIsTaskDrawerOpen(false)} style={{ alignItems: 'flex-end' }}>
              <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '80vh', background: 'var(--bg-color)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', padding: '20px', boxSizing: 'border-box', overflowY: 'auto', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}><h3 style={{ margin: 0 }}>My Tasks</h3><button onClick={() => setIsTaskDrawerOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-color)' }}><X size={24} /></button></div>
                  <TaskList isMobile={true} />
              </div>
          </div>
      )}
      <SyncModal isOpen={isSyncOpen} onClose={() => setIsSyncOpen(false)} localData={{ events, todos, categories }} onSyncComplete={handleSyncComplete} />
      <EventModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveEvent} onDelete={handleDeleteEvent} initialData={editingEvent} categories={categories} onAddCategory={handleAddCategory} />
      <StatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} events={currentDayEvents} categories={categories} settings={userSettings}/>
      <DataModal isOpen={isDataModalOpen} onClose={() => setIsDataModalOpen(false)} data={{ events, todos, categories }} onRestore={handleRestoreData} onCleanup={handleCleanup} settings={userSettings} onUpdateSettings={handleUpdateSettings}/>
    </>
  );
}

export default App;