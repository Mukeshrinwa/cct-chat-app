import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { DeleteView } from 'src/sections/delete-account/view';

// ----------------------------------------------------------------------

const metadata = { title: `Chat | Dashboard - ${CONFIG.site.name}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {metadata.title}</title>
      </Helmet>

      <DeleteView />
    </>
  );
}
