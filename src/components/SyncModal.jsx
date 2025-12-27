import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, ArrowRight, Check, Wifi, Loader } from 'lucide-react';
import Peer from 'peerjs';

// Helper to generate a random 4-digit code
const generateShortCode = () => Math.floor(1000 + Math.random() * 9000).toString();

const SyncModal = ({ isOpen, onClose, localData, onSyncComplete }) => {
  const [peer, setPeer] = useState(null);
  const [myCode, setMyCode] = useState('');
  const [remoteCode, setRemoteCode] = useState('');
  const [status, setStatus] = useState('idle'); // idle, connecting, connected, syncing, completed, error
  const [logs, setLogs] = useState('Ready to sync.');
  
  const localDataRef = useRef(localData);
  useEffect(() => { localDataRef.current = localData; }, [localData]);

  const connRef = useRef(null);

  // 1. Initialize Peer on Mount
  useEffect(() => {
    if (isOpen && !peer) {
      const initPeer = (attempts = 0) => {
        if (attempts > 5) {
          setStatus('error');
          setLogs('Could not generate a unique code. Try again.');
          return;
        }

        const code = generateShortCode();
        const id = `daydial-sync-${code}`;
        
        const newPeer = new Peer(id);

        newPeer.on('open', (id) => {
          setMyCode(code);
          setPeer(newPeer);
          setStatus('idle');
          setLogs('Waiting for connection...');
        });

        // Handle Incoming Connections (I am the Receiver)
        newPeer.on('connection', (conn) => {
          setupListeners(conn);
          conn.on('open', () => handleOpen(conn, true));
        });

        newPeer.on('error', (err) => {
          console.error(err);
          if (status !== 'completed') {
             if (err.type === 'unavailable-id') {
                initPeer(attempts + 1);
             } else {
                setStatus('error');
                setLogs('Connection error. Check internet.');
             }
          }
        });
      };

      initPeer();
    }
    
    // Cleanup
    return () => {
      // FIX: Removed the (!isOpen) check so cleanup always runs when component unmounts
      if (peer) {
        peer.destroy();
        setPeer(null);
        setMyCode('');
        setStatus('idle');
        setRemoteCode('');
        connRef.current = null;
      }
    };
  }, [isOpen]);

  // 2. Setup Listeners
  const setupListeners = (conn) => {
    connRef.current = conn;

    conn.on('data', (data) => {
      // CASE 1: I am the Receiver (Follower)
      if (data.type === 'SYNC_DATA') {
        setLogs('Received data. Overwriting local...');
        
        // 1. Update my app
        processIncomingData(data.payload);

        // 2. Tell the sender I finished
        conn.send({ type: 'SYNC_ACK' });
      }
      // CASE 2: I am the Sender (Leader) and Receiver finished
      else if (data.type === 'SYNC_ACK') {
        setStatus('completed');
        setLogs('Transfer Complete!');
        setTimeout(onClose, 2000);
      }
    });

    conn.on('close', () => {
        if (status !== 'completed') {
            setStatus('idle');
            setLogs('Disconnected.');
            connRef.current = null;
        }
    });

    conn.on('error', () => {
        setStatus('error');
        setLogs('Connection lost.');
    });
  };

  // 3. Handle Connection Open
  const handleOpen = (conn, isIncoming) => {
      setStatus('connected');
      
      if (isIncoming) {
          // I am receiving; just wait.
          setLogs('Device connected! Waiting for data...');
      } else {
          // I initiated; SEND MY DATA immediately.
          setLogs('Connected! Sending data...');
          sendData(conn);
      }
  };

  // 4. Dial Out (Initiator)
  const connectToPeer = () => {
    if (!peer || !remoteCode) return;
    setStatus('connecting');
    setLogs(`Dialing ${remoteCode}...`);
    
    const conn = peer.connect(`daydial-sync-${remoteCode}`);
    setupListeners(conn);
    conn.on('open', () => handleOpen(conn, false));
  };

  const sendData = (conn = connRef.current) => {
    if (!conn) return;
    setStatus('syncing');
    
    conn.send({
      type: 'SYNC_DATA',
      payload: localDataRef.current
    });
    
    setLogs('Sent data. Waiting for confirmation...');
  };

  const processIncomingData = (incoming) => {
    // Artificial delay for UX
    setTimeout(() => {
        onSyncComplete(incoming);
        setStatus('completed');
        setLogs('Sync Successful!');
        setTimeout(onClose, 2000);
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '350px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'var(--accent)', padding: '8px', borderRadius: '8px', color: 'white' }}>
                    <RefreshCw size={20} className={status === 'syncing' ? 'spin' : ''} />
                </div>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Sync Devices</h2>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-color)' }}><X size={24} /></button>
        </div>

        {/* Status Area */}
        <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-color)', borderRadius: '12px', border: '1px solid var(--clock-border)', marginBottom: '20px' }}>
            {status === 'completed' ? (
                <div style={{ color: 'var(--available)' }}><Check size={40} style={{ margin: '0 auto' }} /><p>Sync Successful!</p></div>
            ) : (
                <>
                    <p style={{ fontSize: '0.9rem', opacity: 0.7, margin: '0 0 8px 0' }}>Your Code</p>
                    <div style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '2px', fontFamily: 'monospace', color: 'var(--accent)' }}>
                        {myCode || <Loader className="spin" />}
                    </div>
                </>
            )}
            <p style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '8px' }}>{logs}</p>
        </div>

        {/* Connect Form */}
        {status !== 'completed' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '6px' }}>Enter Partner Code</label>
                    <input 
                        type="tel" 
                        maxLength="4"
                        placeholder="0000"
                        value={remoteCode}
                        onChange={e => setRemoteCode(e.target.value)}
                        style={{ width: '100%', padding: '12px', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '2px', borderRadius: '8px', border: '1px solid var(--clock-border)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
                    />
                </div>
                <button 
                    onClick={connectToPeer}
                    disabled={!remoteCode || status === 'connecting' || status === 'connected' || status === 'syncing'}
                    style={{ height: '52px', padding: '0 20px', background: status === 'connected' ? 'var(--available)' : 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    {status === 'connected' ? <Wifi size={24} /> : <ArrowRight size={24} />}
                </button>
            </div>
        )}

        <style>{`
            .spin { animation: spin 1s linear infinite; }
            @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>

      </div>
    </div>
  );
};

export default SyncModal;