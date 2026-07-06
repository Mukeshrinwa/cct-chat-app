import { lazy, Suspense } from 'react';
import { Outlet, Navigate } from 'react-router-dom';

import { CONFIG } from 'src/config-global';
import { DashboardLayout } from 'src/layouts/dashboard';

import { LoadingScreen } from 'src/components/loading-screen';

import { AuthGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

// App
const ChatPage = lazy(() => import('src/pages/dashboard/chat'));
const PrivacyPage = lazy(() => import('src/pages/dashboard/privacy'));
const TermsPage = lazy(() => import('src/pages/dashboard/terms'));
const DeleteAccountPage = lazy(() => import('src/pages/dashboard/delete-account'));
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
    path: '/',
    children: [
      {
        element: CONFIG.auth.skip ? <>{layoutContent}</> : <AuthGuard>{layoutContent}</AuthGuard>,
        children: [
          { element: <Navigate to="/chat" replace />, index: true },
     
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
      {
       path: 'delete-account',
        element: 
          <Suspense fallback={<LoadingScreen />}>
            <DeleteAccountPage />
          </Suspense>      
      },
      {
        path: 'privacy-policy',
        element: 
            <Suspense fallback={<LoadingScreen />}>
              <PrivacyPage />
            </Suspense>
         
      },
      {
        path: 'termsandConditions',
        element: 
            <Suspense fallback={<LoadingScreen />}>
              <TermsPage />
            </Suspense>
         
      },
    ],
  },
];
