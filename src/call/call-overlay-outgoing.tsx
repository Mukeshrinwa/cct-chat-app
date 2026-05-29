/**
 * Outgoing Call Overlay — shown while calling/ringing/missed/rejected/ended
 */

import { useCall } from './call-context';

// ----------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.65)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  animation: 'fadeIn 0.3s ease',
};

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #0f3460 100%)',
  borderRadius: 24,
  padding: '48px 40px',
  minWidth: 320,
  maxWidth: 400,
  width: '90vw',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 16,
  boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
};

const rippleContainerStyle: React.CSSProperties = {
  position: 'relative',
  width: 120,
  height: 120,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const rippleStyle = (delay: number): React.CSSProperties => ({
  position: 'absolute',
  borderRadius: '50%',
  border: '2px solid rgba(99,102,241,0.4)',
  animation: `ripple 2s linear ${delay}s infinite`,
});

const avatarStyle: React.CSSProperties = {
  width: 96,
  height: 96,
  borderRadius: '50%',
  objectFit: 'cover',
  border: '3px solid rgba(255,255,255,0.15)',
  position: 'relative',
  zIndex: 2,
};

const avatarPlaceholderStyle: React.CSSProperties = {
  ...avatarStyle,
  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 36,
  color: '#fff',
  fontWeight: 700,
};

const statusMessages: Record<string, string> = {
  calling: 'Calling...',
  ringing: 'Ringing...',
  rejected: 'Call Declined',
  missed: 'No Answer',
  ended: 'Call Ended',
};

const statusColors: Record<string, string> = {
  calling: 'rgba(255,255,255,0.5)',
  ringing: '#a78bfa',
  rejected: '#f87171',
  missed: '#fb923c',
  ended: 'rgba(255,255,255,0.4)',
};

export function CallOverlayOutgoing() {
  const { call, endCall } = useCall();

  const visible = ['calling', 'ringing', 'rejected', 'missed', 'ended'].includes(call.status);
  if (!visible) return null;

  const { caller, callType, status } = call;
  const initial = caller?.name?.[0]?.toUpperCase() || 'U';
  const statusText = statusMessages[status] || '';
  const statusColor = statusColors[status] || 'rgba(255,255,255,0.5)';

  const isActive = status === 'calling' || status === 'ringing';

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }
        @keyframes ripple {
          0% { width:96px; height:96px; opacity:0.6; }
          100% { width:200px; height:200px; opacity:0; }
        }
        .call-btn:hover { transform: scale(1.08) !important; }
        .call-btn:active { transform: scale(0.94) !important; }
      `}</style>

      <div style={overlayStyle}>
        <div style={cardStyle}>
          {/* Ripple + avatar */}
          <div style={rippleContainerStyle}>
            {isActive && (
              <>
                <div style={{ ...rippleStyle(0), width: 96, height: 96 }} />
                <div style={{ ...rippleStyle(0.6), width: 96, height: 96 }} />
                <div style={{ ...rippleStyle(1.2), width: 96, height: 96 }} />
              </>
            )}
            {caller?.avatar ? (
              <img src={caller.avatar} alt={caller.name} style={avatarStyle} />
            ) : (
              <div style={avatarPlaceholderStyle}>{initial}</div>
            )}
          </div>

          {/* Callee info */}
          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#fff',
                margin: 0,
                letterSpacing: '-0.3px',
              }}
            >
              {caller?.name || 'Unknown'}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>
              {callType === 'video' ? '📹 Video call' : '📞 Audio call'}
            </p>
          </div>

          {/* Status */}
          <p
            style={{
              fontSize: 15,
              color: statusColor,
              margin: 0,
              letterSpacing: '0.3px',
              fontWeight: 500,
            }}
          >
            {statusText}
          </p>

          {/* End call button (visible only while active) */}
          {isActive && (
            <button
              type="button"
              className="call-btn"
              onClick={endCall}
              style={{
                marginTop: 16,
                width: 64,
                height: 64,
                borderRadius: '50%',
                border: 'none',
                background: '#ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(239,68,68,0.5)',
                transition: 'transform 0.15s ease',
              }}
              title="Cancel call"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" transform="rotate(135 12 12)"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
