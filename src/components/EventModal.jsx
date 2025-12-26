import React, { useState, useEffect } from 'react';
import { X, Trash2, Plus } from 'lucide-react';

const RECURRENCE_OPTIONS = [
    { value: 'none', label: 'Does not repeat' },
    { value: 'daily', label: 'Every Day' },
    { value: 'weekly', label: 'Every Week' },
    { value: 'monthly', label: 'Every Month' }
];

const EventModal = ({ isOpen, onClose, onSave, onDelete, initialData, categories, onAddCategory }) => {
  const [formData, setFormData] = useState({
    title: '', date: '', start: '', end: '', description: '',
    color: categories[0].color, category: categories[0].name,
    recurrence: 'none'
  });
  
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3b82f6');

  useEffect(() => {
    if (initialData) {
      setFormData({
          ...initialData,
          color: initialData.color || categories[0].color,
          category: initialData.category || categories[0].name,
          date: initialData.date || new Date().toISOString().split('T')[0],
          recurrence: initialData.recurrence || 'none'
      });
    }
  }, [initialData, categories]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleCreateCategory = () => {
      if (!newCatName.trim()) return;
      onAddCategory({ name: newCatName, color: newCatColor });
      setFormData({ ...formData, category: newCatName, color: newCatColor });
      setIsAddingCat(false);
      setNewCatName('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', paddingBottom: '12px' }}>
            <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'var(--clock-border)' }}></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{initialData?.id ? 'Edit Event' : 'New Event'}</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-color)', padding: '8px', marginRight: '-8px' }}><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Event Title</label>
            <input required className="form-input" type="text" placeholder="Meeting, Gym, etc." value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} autoFocus={!initialData?.id} />
          </div>

          {/* CATEGORY SELECTOR */}
          <div className="form-group">
            <label>Category</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {categories.map(cat => (
                    <button
                        type="button"
                        key={cat.id}
                        onClick={() => setFormData({ ...formData, category: cat.name, color: cat.color })}
                        style={{
                            padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem',
                            border: formData.category === cat.name ? `2px solid ${cat.color}` : '1px solid var(--clock-border)',
                            background: formData.category === cat.name ? cat.color : 'transparent',
                            color: formData.category === cat.name ? 'white' : 'var(--text-color)',
                            transition: 'all 0.2s'
                        }}
                    >
                        {cat.name}
                    </button>
                ))}
                <button type="button" onClick={() => setIsAddingCat(!isAddingCat)} style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', border: '1px dashed var(--clock-border)', background: 'transparent', color: 'var(--text-color)' }}>
                    + New
                </button>
            </div>
            
            {/* ADD CUSTOM CATEGORY UI */}
            {isAddingCat && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-color)', padding: '8px', borderRadius: '8px', border: '1px solid var(--clock-border)' }}>
                    <input type="text" placeholder="Category Name" value={newCatName} onChange={e => setNewCatName(e.target.value)} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid var(--clock-border)', fontSize: '0.9rem' }} />
                    <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} style={{ width: '30px', height: '30px', border: 'none', background: 'none' }} />
                    <button type="button" onClick={handleCreateCategory} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 10px', fontSize: '0.8rem' }}>Add</button>
                </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
             <div className="form-group" style={{ flex: 1 }}>
                <label>Date</label>
                <input required className="form-input" type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
             </div>
             <div className="form-group" style={{ flex: 1 }}>
                <label>Repeats</label>
                <select className="form-input" value={formData.recurrence} onChange={e => setFormData({ ...formData, recurrence: e.target.value })}>
                    {RECURRENCE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
             </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Start</label>
              <input required className="form-input" type="time" value={formData.start} onChange={e => setFormData({ ...formData, start: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>End</label>
              <input required className="form-input" type="time" value={formData.end} onChange={e => setFormData({ ...formData, end: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label>Notes (Optional)</label>
            <textarea className="form-input" rows="3" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" style={{ flex: 1, background: 'var(--accent)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '600', fontSize: '1rem' }}>Save</button>
            {initialData?.id && (
                <button type="button" onClick={() => onDelete(initialData.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={20} />
                </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal;