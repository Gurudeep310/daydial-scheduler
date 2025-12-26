import React, { useState, useEffect } from 'react';
import { X, Copy, Download, Upload, Check, Share2, Trash2, Database } from 'lucide-react';

const DataModal = ({ isOpen, onClose, data, onRestore, onCleanup }) => {
  const [mode, setMode] = useState('export'); // 'export' | 'import' | 'manage'
  const [jsonString, setJsonString] = useState('');
  const [importText, setImportText] = useState('');
  const [status, setStatus] = useState('');
  const [dataSize, setDataSize] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const str = JSON.stringify(data, null, 2);
      setJsonString(str);
      // Rough size estimation in KB
      setDataSize((new Blob([str]).size / 1024).toFixed(2));
      setImportText('');
      setStatus('');
      setMode('export');
    }
  }, [isOpen, data]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString).then(() => {
      setStatus('copied');
      setTimeout(() => setStatus(''), 2000);
    });
  };

  const handleShareFile = async () => {
    const fileName = `DayDial_Backup_${new Date().toISOString().split('T')[0]}.json`;
    const blob = new Blob([jsonString], { type: 'application/json' });
    const file = new File([blob], fileName, { type: 'application/json' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ title: 'DayDial Backup', files: [file] }); setStatus('shared'); } 
      catch (err) { console.log('Share canceled'); }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setStatus('downloaded');
    }
  };

  const handleImportSubmit = () => {
    try {
      if (!importText.trim()) return;
      const parsed = JSON.parse(importText);
      if (Array.isArray(parsed) || (parsed.events || parsed.todos)) {
        onRestore(parsed);
        onClose();
      } else throw new Error('Invalid format');
    } catch (err) { alert('Invalid JSON.'); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ display: 'flex', borderBottom: '1px solid var(--clock-border)' }}>
            <button onClick={() => setMode('export')} style={{ flex: 1, padding: '14px', background: 'transparent', border: 'none', borderBottom: mode === 'export' ? '3px solid var(--accent)' : 'none', fontWeight: 'bold', color: 'var(--text-color)', fontSize: '0.9rem' }}>Backup</button>
            <button onClick={() => setMode('import')} style={{ flex: 1, padding: '14px', background: 'transparent', border: 'none', borderBottom: mode === 'import' ? '3px solid var(--accent)' : 'none', fontWeight: 'bold', color: 'var(--text-color)', fontSize: '0.9rem' }}>Restore</button>
            <button onClick={() => setMode('manage')} style={{ flex: 1, padding: '14px', background: 'transparent', border: 'none', borderBottom: mode === 'manage' ? '3px solid var(--accent)' : 'none', fontWeight: 'bold', color: 'var(--text-color)', fontSize: '0.9rem' }}>Manage</button>
            <button onClick={onClose} style={{ padding: '14px', background: 'none', border: 'none', color: 'var(--text-color)' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {mode === 'export' && (
                <>
                    <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>Save all your data.</p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={handleShareFile} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--clock-border)', background: 'var(--bg-color)', color: 'var(--text-color)', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Share2 size={18} /> Share</button>
                        <button onClick={handleCopy} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: status === 'copied' ? 'var(--available)' : 'var(--accent)', color: 'white', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>{status === 'copied' ? <Check size={18} /> : <Copy size={18} />}{status === 'copied' ? 'Copied' : 'Copy Code'}</button>
                    </div>
                    <textarea readOnly value={jsonString} style={{ width: '100%', flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--clock-border)', background: 'var(--bg-color)', color: 'var(--text-color)', fontFamily: 'monospace', fontSize: '0.8rem', resize: 'none', minHeight: '100px' }} />
                </>
            )}

            {mode === 'import' && (
                <>
                    <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>Paste backup code to restore.</p>
                    <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='Paste JSON code here...' style={{ width: '100%', flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--clock-border)', background: 'var(--bg-color)', color: 'var(--text-color)', fontFamily: 'monospace', fontSize: '0.85rem', resize: 'none', minHeight: '150px' }} />
                    <button onClick={handleImportSubmit} disabled={!importText} style={{ padding: '14px', borderRadius: '8px', border: 'none', background: !importText ? '#94a3b8' : 'var(--available)', color: 'white', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Upload size={18} /> Restore</button>
                </>
            )}

            {mode === 'manage' && (
                <>
                    <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: '12px', border: '1px solid var(--clock-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Database size={24} color="var(--accent)" />
                        <div>
                            <div style={{ fontWeight: 'bold' }}>Storage Used</div>
                            <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>{dataSize} KB / 5000 KB</div>
                        </div>
                    </div>

                    <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '8px' }}>Clean Old Data</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => onCleanup(3)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--clock-border)', background: 'transparent', color: 'var(--text-color)' }}>&gt; 3 Months</button>
                            <button onClick={() => onCleanup(6)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--clock-border)', background: 'transparent', color: 'var(--text-color)' }}>&gt; 6 Months</button>
                            <button onClick={() => onCleanup(12)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--clock-border)', background: 'transparent', color: 'var(--text-color)' }}>&gt; 1 Year</button>
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto' }}>
                        <button onClick={() => onCleanup(null)} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <Trash2 size={18} /> Reset All Data
                        </button>
                    </div>
                </>
            )}
        </div>
      </div>
    </div>
  );
};

export default DataModal;