/**
 * Active Call Screen — full-screen call UI
 *
 * Features:
 *  - Local video preview (pip)
 *  - Remote participant video tiles
 *  - Mute / Camera / Screen Share / End Call controls
 *  - Live call timer
 *  - Participant list sidebar
 *  - Reconnection handling
 */

import { Track } from 'livekit-client';
import { useRef, useState, useEffect } from 'react';

import { useCall } from './call-context';

// ----------------------------------------------------------------------
// Timer hook
// ----------------------------------------------------------------------

function useCallTimer(startedAt: number | null) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return undefined;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const hh = Math.floor(elapsed / 3600);
  const mm = Math.floor((elapsed % 3600) / 60);
  const ss = elapsed % 60;

  const formatted = hh
    ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

  return formatted;
}

// ----------------------------------------------------------------------
// Remote video tile
// ----------------------------------------------------------------------

function RemoteVideoTile({
  identity,
  name,
  videoTrack,
  audioTrack,
  isMuted,
  hasCameraOff,
}: {
  identity: string;
  name: string;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  isMuted: boolean;
  hasCameraOff: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current && videoTrack) {
      videoRef.current.srcObject = new MediaStream([videoTrack]);
    }
  }, [videoTrack]);

  useEffect(() => {
    if (audioRef.current && audioTrack) {
      audioRef.current.srcObject = new MediaStream([audioTrack]);
      audioRef.current.play().catch(() => {});
    }
  }, [audioTrack]);

  const initial = name?.[0]?.toUpperCase() || '?';

  return (
    <div style={tileStyle}>
      {!hasCameraOff && videoTrack ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }}
        />
      ) : (
        <div style={avatarTileStyle}>
          <div style={tileAvatarCircle}>{initial}</div>
        </div>
      )}
      {/* Hidden audio */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} autoPlay style={{ display: 'none' }} />

      {/* Name tag */}
      <div style={nameBadgeStyle}>
        {isMuted && <span style={{ marginRight: 4 }}>🔇</span>}
        {name}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Local video pip
// ----------------------------------------------------------------------

function LocalVideoPip({
  livekitRoom,
  callType,
  isMuted,
  isCameraOff,
}: {
  livekitRoom: any;
  callType: string;
  isMuted: boolean;
  isCameraOff: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!livekitRoom || callType !== 'video') return undefined;
    const lp = livekitRoom.localParticipant;

    const attach = () => {
      lp.videoTrackPublications.forEach((pub: any) => {
        if (pub.track && videoRef.current && pub.source === Track.Source.Camera) {
          const ms = new MediaStream();
          ms.addTrack(pub.track.mediaStreamTrack);
          videoRef.current.srcObject = ms;
        }
      });
    };

    attach();
    livekitRoom.on('trackPublished', attach);
    return () => livekitRoom.off('trackPublished', attach);
  }, [livekitRoom, callType]);

  if (callType !== 'video') return null;

  return (
    <div style={pipContainerStyle}>
      {!isCameraOff ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.4)',
            fontSize: 12,
          }}
        >
          Camera off
        </div>
      )}
      {isMuted && (
        <div style={pipBadgeStyle}>🔇</div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Control button
// ----------------------------------------------------------------------

function ControlBtn({
  active,
  danger,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const bg = danger
    ? '#ef4444'
    : active
    ? 'rgba(99,102,241,0.85)'
    : 'rgba(255,255,255,0.12)';

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        border: danger ? 'none' : '1px solid rgba(255,255,255,0.12)',
        background: bg,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        color: '#fff',
        fontSize: 22,
        boxShadow: danger ? '0 8px 24px rgba(239,68,68,0.5)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

// ----------------------------------------------------------------------
// Main active call screen
// ----------------------------------------------------------------------

export function CallScreenActive() {
  const {
    call,
    remoteParticipants,
    isMuted,
    isCameraOff,
    isScreenSharing,
    livekitRoom,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  } = useCall();

  const [showParticipants, setShowParticipants] = useState(false);
  const timer = useCallTimer(call.startedAt);

  if (call.status !== 'connected') return null;

  const isVideoCall = call.callType === 'video';
  const hasRemotes = remoteParticipants.length > 0;

  return (
    <>
      <style>{`
        .ctrl-btn:hover { transform: scale(1.08); }
        .ctrl-btn:active { transform: scale(0.94); }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={screenStyle}>
        {/* Background gradient */}
        <div style={bgGradientStyle} />

        {/* Header */}
        <div style={headerStyle}>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>
              {call.isGroup ? 'Group Call' : remoteParticipants[0]?.name || 'Unknown'}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
              {isVideoCall ? '📹' : '📞'} {timer} •{' '}
              {remoteParticipants.length + 1} participant{remoteParticipants.length !== 0 ? 's' : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowParticipants((p) => !p)}
            style={{
              background: showParticipants ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              color: '#fff',
              padding: '6px 16px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            👥 {remoteParticipants.length + 1}
          </button>
        </div>

        {/* Video grid */}
        <div style={gridStyle(isVideoCall && hasRemotes)}>
          {hasRemotes ? (
            remoteParticipants.map((p) => (
              <RemoteVideoTile key={p.identity} {...p} />
            ))
          ) : (
            /* No remote yet — waiting */
            <div style={waitingStyle}>
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 40,
                  boxShadow: '0 0 40px rgba(99,102,241,0.4)',
                }}
              >
                {isVideoCall ? '📹' : '📞'}
              </div>
              <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: 16, fontSize: 16 }}>
                Waiting for participants...
              </p>
            </div>
          )}
        </div>

        {/* Local PIP */}
        <LocalVideoPip
          livekitRoom={livekitRoom}
          callType={call.callType}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
        />

        {/* Participants sidebar */}
        {showParticipants && (
          <div style={sidebarStyle}>
            <p style={{ color: '#fff', fontWeight: 600, margin: '0 0 12px', fontSize: 15 }}>
              Participants ({remoteParticipants.length + 1})
            </p>
            {/* Local */}
            <div style={participantRowStyle}>
              <div style={participantDotStyle('#6366f1')}>You</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {isMuted && <span style={{ fontSize: 12 }}>🔇</span>}
                {isCameraOff && <span style={{ fontSize: 12 }}>📵</span>}
              </div>
            </div>
            {/* Remote */}
            {remoteParticipants.map((p) => (
              <div key={p.identity} style={participantRowStyle}>
                <div style={participantDotStyle('#8b5cf6')}>{p.name}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {p.isMuted && <span style={{ fontSize: 12 }}>🔇</span>}
                  {p.hasCameraOff && <span style={{ fontSize: 12 }}>📵</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        <div style={controlsBarStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <ControlBtn active={isMuted} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? '🔇' : '🎤'}
            </ControlBtn>
            <span style={ctrlLabelStyle}>{isMuted ? 'Unmute' : 'Mute'}</span>
          </div>

          {isVideoCall && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <ControlBtn active={isCameraOff} onClick={toggleCamera} title={isCameraOff ? 'Start Camera' : 'Stop Camera'}>
                {isCameraOff ? '📵' : '📷'}
              </ControlBtn>
              <span style={ctrlLabelStyle}>{isCameraOff ? 'Start Cam' : 'Stop Cam'}</span>
            </div>
          )}

          {isVideoCall && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <ControlBtn active={isScreenSharing} onClick={toggleScreenShare} title={isScreenSharing ? 'Stop Share' : 'Share Screen'}>
                {isScreenSharing ? '🖥️' : '📺'}
              </ControlBtn>
              <span style={ctrlLabelStyle}>{isScreenSharing ? 'Stop Share' : 'Share'}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <ControlBtn danger onClick={endCall} title="End Call">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" transform="rotate(135 12 12)"/>
              </svg>
            </ControlBtn>
            <span style={ctrlLabelStyle}>End</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------

const screenStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1900,
  background: '#0f172a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  animation: 'slideUp 0.3s ease',
};

const bgGradientStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(ellipse at top, rgba(99,102,241,0.15) 0%, transparent 60%), radial-gradient(ellipse at bottom, rgba(139,92,246,0.10) 0%, transparent 60%)',
  pointerEvents: 'none',
};

const headerStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '20px 24px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
};

const gridStyle = (multiVideo: boolean): React.CSSProperties => ({
  flex: 1,
  display: 'grid',
  gridTemplateColumns: multiVideo ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr',
  gap: 12,
  padding: 16,
  overflowY: 'auto',
  position: 'relative',
  zIndex: 5,
});

const tileStyle: React.CSSProperties = {
  position: 'relative',
  background: '#1e293b',
  borderRadius: 16,
  overflow: 'hidden',
  minHeight: 200,
  border: '1px solid rgba(255,255,255,0.06)',
};

const avatarTileStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #1e293b, #0f172a)',
};

const tileAvatarCircle: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 28,
  color: '#fff',
  fontWeight: 700,
};

const nameBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 10,
  left: 10,
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(4px)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 500,
  padding: '3px 8px',
  borderRadius: 8,
};

const waitingStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 300,
  gap: 8,
};

const pipContainerStyle: React.CSSProperties = {
  position: 'fixed',
  right: 20,
  top: 100,
  width: 120,
  height: 160,
  borderRadius: 12,
  overflow: 'hidden',
  border: '2px solid rgba(255,255,255,0.15)',
  zIndex: 20,
  background: '#1e293b',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};

const pipBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: 6,
  left: 6,
  fontSize: 14,
  background: 'rgba(0,0,0,0.6)',
  borderRadius: 8,
  padding: '2px 4px',
};

const controlsBarStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 20,
  padding: '20px 24px',
  borderTop: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(0,0,0,0.3)',
  backdropFilter: 'blur(10px)',
};

const ctrlLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.45)',
};

const sidebarStyle: React.CSSProperties = {
  position: 'fixed',
  right: 0,
  top: 0,
  bottom: 0,
  width: 240,
  background: 'rgba(15,23,42,0.95)',
  backdropFilter: 'blur(12px)',
  borderLeft: '1px solid rgba(255,255,255,0.08)',
  padding: '80px 16px 16px',
  zIndex: 15,
  overflowY: 'auto',
};

const participantRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 0',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
};

const participantDotStyle = (color: string): React.CSSProperties => ({
  fontSize: 13,
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});
