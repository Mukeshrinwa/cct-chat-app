/**
 * CallRoot — Wraps the app with CallProvider and mounts all call overlays.
 *
 * Usage in app.tsx:
 *   <CallRoot>
 *     <Router />
 *   </CallRoot>
 */

import { CallProvider } from './call-context';
import { CallScreenActive } from './call-screen-active';
import { CallOverlayIncoming } from './call-overlay-incoming';
import { CallOverlayOutgoing } from './call-overlay-outgoing';

// ----------------------------------------------------------------------

export function CallRoot({ children }: { children: React.ReactNode }) {
  return (
    <CallProvider>
      {children}

      {/* Global overlays — rendered above everything */}
      <CallOverlayIncoming />
      <CallOverlayOutgoing />
      <CallScreenActive />
    </CallProvider>
  );
}
