import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { CONFIG } from 'src/config-global';
import { DashboardLayout } from 'src/layouts/dashboard';

import { LoadingScreen } from 'src/components/loading-screen';

import { AuthGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

// Overview
const IndexPage = lazy(() => import('src/pages/dashboard'));

// User
const UserProfilePage = lazy(() => import('src/pages/dashboard/user/profile'));
const UserCardsPage = lazy(() => import('src/pages/dashboard/user/cards'));
const UserListPage = lazy(() => import('src/pages/dashboard/user/list'));
const UserAccountPage = lazy(() => import('src/pages/dashboard/user/account'));
const UserCreatePage = lazy(() => import('src/pages/dashboard/user/new'));
const UserEditPage = lazy(() => import('src/pages/dashboard/user/edit'));

// App
const ChatPage = lazy(() => import('src/pages/dashboard/chat'));

// Test render page by role
const PermissionDeniedPage = lazy(() => import('src/pages/dashboard/permission'));
// Blank page
const ParamsPage = lazy(() => import('src/pages/dashboard/params'));
const BlankPage = lazy(() => import('src/pages/dashboard/blank'));

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
          { element: <IndexPage />, index: true },
          {
            path: 'user',
            children: [
              { element: <UserProfilePage />, index: true },
              { path: 'profile', element: <UserProfilePage /> },
              { path: 'cards', element: <UserCardsPage /> },
              { path: 'list', element: <UserListPage /> },
              { path: 'new', element: <UserCreatePage /> },
              { path: ':id/edit', element: <UserEditPage /> },
              { path: 'account', element: <UserAccountPage /> },
            ],
          },
          { path: 'permission', element: <PermissionDeniedPage /> },
          { path: 'params', element: <ParamsPage /> },
          { path: 'blank', element: <BlankPage /> },
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
