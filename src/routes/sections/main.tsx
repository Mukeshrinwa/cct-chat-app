import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { MainLayout } from 'src/layouts/main';
import { SimpleLayout } from 'src/layouts/simple';

import { SplashScreen } from 'src/components/loading-screen';

// ----------------------------------------------------------------------

const ContactPage = lazy(() => import('src/pages/contact-us'));
const ComingSoonPage = lazy(() => import('src/pages/coming-soon'));
// Product
// Blog
// Error
const Page500 = lazy(() => import('src/pages/error/500'));
const Page403 = lazy(() => import('src/pages/error/403'));
const Page404 = lazy(() => import('src/pages/error/404'));
// Blank
const BlankPage = lazy(() => import('src/pages/blank'));

const GroupInvitePage = lazy(() => import('src/pages/group-invite'));
const JoinPage = lazy(() => import('src/pages/join'));

// ----------------------------------------------------------------------

export const mainRoutes = [
  {
    element: (
      <Suspense fallback={<SplashScreen />}>
        <Outlet />
      </Suspense>
    ),
    children: [
      {
        element: (
          <MainLayout>
            <Outlet />
          </MainLayout>
        ),
        children: [
         
          {
            path: 'contact-us',
            element: <ContactPage />,
          },
        
          {
            path: 'blank',
            element: <BlankPage />,
          },
        ],
      },
     
      
      {
        path: 'coming-soon',
        element: (
          <SimpleLayout content={{ compact: true }}>
            <ComingSoonPage />
          </SimpleLayout>
        ),
      },
      {
        path: 'group/invite/:code',
        element: (
          <SimpleLayout content={{ compact: true }}>
            <GroupInvitePage />
          </SimpleLayout>
        ),
      },
      {
        path: 'join',
        element: (
          <SimpleLayout content={{ compact: true }}>
            <JoinPage />
          </SimpleLayout>
        ),
      },
      
      { path: '500', element: <Page500 /> },
      { path: '404', element: <Page404 /> },
      { path: '403', element: <Page403 /> },
    ],
  },
];
