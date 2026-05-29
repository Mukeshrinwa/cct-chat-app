/**
 * Incoming Call Overlay — WhatsApp/Telegram style incoming call screen
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
  background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  borderRadius: 24,
  padding: '40px 32px',
  minWidth: 320,
  maxWidth: 400,
  width: '90vw',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 20,
  boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)',
};

const avatarStyle: React.CSSProperties = {
  width: 96,
  height: 96,
  borderRadius: '50%',
  objectFit: 'cover',
  border: '3px solid rgba(255,255,255,0.2)',
  boxShadow: '0 0 0 8px rgba(99,102,241,0.15)',
  animation: 'pulse 2s ease-in-out infinite',
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

const callerNameStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  color: '#fff',
  margin: 0,
  letterSpacing: '-0.5px',
};

const callTypeStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'rgba(255,255,255,0.55)',
  margin: 0,
  textTransform: 'capitalize',
  letterSpacing: '0.5px',
};

const ringingDotsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
};

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 32,
  marginTop: 8,
};

const actionBtnStyle = (color: string): React.CSSProperties => ({
  width: 70,
  height: 70,
  borderRadius: '50%',
  border: 'none',
  background: color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: `0 8px 24px ${color}80`,
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  flexDirection: 'column',
  gap: 4,
});

const btnLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#fff',
  marginTop: 6,
  textAlign: 'center',
};

export function CallOverlayIncoming() {
  const { call, acceptCall, rejectCall } = useCall();

  if (call.status !== 'incoming') return null;

  const { caller, callType } = call;
  const initial = caller?.name?.[0]?.toUpperCase() || '?';

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 8px rgba(99,102,241,0.15); }
          50% { box-shadow: 0 0 0 16px rgba(99,102,241,0.08); }
        }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        .call-btn:hover { transform: scale(1.08) !important; }
        .call-btn:active { transform: scale(0.94) !important; }
      `}</style>

      <div style={overlayStyle}>
        <div style={cardStyle}>
          {/* Avatar */}
          {caller?.avatar ? (
            <img src={caller.avatar} alt={caller.name} style={avatarStyle} />
          ) : (
            <div style={avatarPlaceholderStyle}>{initial}</div>
          )}

          {/* Caller info */}
          <div style={{ textAlign: 'center' }}>
            <p style={callerNameStyle}>{caller?.name || 'Unknown'}</p>
            <p style={callTypeStyle}>
              {callType === 'video' ? '📹 Incoming video call' : '📞 Incoming audio call'}
            </p>
          </div>

          {/* Ringing animation */}
          <div style={ringingDotsStyle}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.5)',
                  animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div style={buttonRowStyle}>
            {/* Reject */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                type="button"
                className="call-btn"
                style={actionBtnStyle('#ef4444')}
                onClick={rejectCall}
                title="Decline"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" transform="rotate(135 12 12)"/>
                </svg>
              </button>
              <span style={btnLabelStyle}>Decline</span>
            </div>

            {/* Accept */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                type="button"
                className="call-btn"
                style={actionBtnStyle('#22c55e')}
                onClick={acceptCall}
                title="Accept"
              >
                {callType === 'video' ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                    <path d="M15 8v8H5V8h10m1-2H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4V7c0-.55-.45-1-1-1z"/>
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                  </svg>
                )}
              </button>
              <span style={btnLabelStyle}>Accept</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
