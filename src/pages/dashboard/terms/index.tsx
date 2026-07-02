import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { TermsView } from 'src/sections/terms/view';

// ----------------------------------------------------------------------

const metadata = { title: `Terms & Conditions | Dashboard - ${CONFIG.site.name}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {metadata.title}</title>
      </Helmet>

      <TermsView />
    </>
  );
}
