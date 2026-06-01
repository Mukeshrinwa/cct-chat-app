import { lazy, Suspense } from 'react';
import { Outlet, Navigate } from 'react-router-dom';

import { CONFIG } from 'src/config-global';
import { DashboardLayout } from 'src/layouts/dashboard';

import { LoadingScreen } from 'src/components/loading-screen';

import { AuthGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

// App
const ChatPage = lazy(() => import('src/pages/dashboard/chat'));

// Test render page by role
// Blank page

// ----------------------------------------------------------------------

const layoutContent = (
  <DashboardLayout>
    <Suspense fallback={<LoadingScreen />}>
      <Outlet />
    </Suspense>
  </DashboardLayout>
);

export const dashboardRoutes = [
  {
    path: 'dashboard',
    children: [
      {
        element: CONFIG.auth.skip ? <>{layoutContent}</> : <AuthGuard>{layoutContent}</AuthGuard>,
        children: [
          { element: <Navigate to="/dashboard/chat" replace />, index: true },
     
        ],
      },
      {
        path: 'chat',
        element: CONFIG.auth.skip ? (
          <Suspense fallback={<LoadingScreen />}>
            <ChatPage />
          </Suspense>
        ) : (
          <AuthGuard>
            <Suspense fallback={<LoadingScreen />}>
              <ChatPage />
            </Suspense>
          </AuthGuard>
        ),
      },
    ],
  },
];
