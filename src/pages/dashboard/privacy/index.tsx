import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { PrivacyView } from 'src/sections/privacy/view';

// ----------------------------------------------------------------------

const metadata = { title: `Privacy Policy | Dashboard - ${CONFIG.site.name}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {metadata.title}</title>
      </Helmet>

      <PrivacyView />
    </>
  );
}
