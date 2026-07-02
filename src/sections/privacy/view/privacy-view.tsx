import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

const sections = [
  {
    title: '1. Information We Collect',
    blocks: [
      {
        heading: 'Account Information',
        items: [
          'Full Name',
          'Email Address',
          'Profile Photo',
          'Phone Number (optional)',
          'Job Title',
          'Department',
          'Company Name',
        ],
      },
      {
        heading: 'Workspace Information',
        items: [
          'Organization Name',
          'Workspace Settings',
          'Team Structure',
          'Member Information',
        ],
      },
      {
        heading: 'Communication Data',
        items: [
          'Direct Messages',
          'Group Conversations',
          'Channel Messages',
          'Shared Files',
          'Images',
          'Documents',
          'Voice Notes (if available)',
          'Meeting Information',
          'Comments and Reactions',
        ],
      },
      {
        heading: 'Device Information',
        items: [
          'IP Address',
          'Device Type',
          'Operating System',
          'Browser Information',
          'App Version',
          'Device Identifier',
          'Time Zone',
          'Language Settings',
        ],
      },
      {
        heading: 'Usage Information',
        items: [
          'Login Activity',
          'Feature Usage',
          'Search History within the Workspace',
          'Notification Preferences',
          'Session Duration',
          'Error Reports',
          'Performance Logs',
        ],
      },
    ],
  },
  {
    title: '2. How We Use Your Information',
    text: 'We use your information to create and manage your account, provide secure team communication, deliver messages and notifications, enable collaboration, improve application performance, detect misuse, provide customer support, maintain platform security, analyze product usage, and comply with legal obligations.',
  },
  {
    title: '3. File Storage',
    text: 'Files shared through Peopl may include images, PDFs, office documents, videos, audio files, and other supported attachments. These files are stored securely to enable collaboration within your workspace. Only authorized members can access shared files unless your organization configures otherwise.',
  },
  {
    title: '4. Message Privacy',
    text: 'Messages sent through Peopl are intended for communication within your organization. Workspace administrators may have administrative capabilities depending on your organization’s settings, including user management, workspace configuration, account administration, and data retention policies. Peopl does not monitor private conversations except where required for security, legal compliance, or troubleshooting.',
  },
  {
    title: '5. Cookies and Similar Technologies',
    text: 'We use cookies and similar technologies to keep you logged in, remember your preferences, improve performance, enhance security, and analyze usage trends. You may manage cookie preferences through your browser settings.',
  },
  {
    title: '6. Data Security',
    text: 'We take reasonable technical and organizational measures to protect your information, including secure data storage, encrypted data transmission, access controls, authentication mechanisms, regular security monitoring, backup systems, and infrastructure security practices. While we strive to protect your data, no online system can guarantee absolute security.',
  },
  {
    title: '7. Data Retention',
    text: 'We retain your information only for as long as necessary to provide our services, comply with legal obligations, resolve disputes, and enforce our agreements. Workspace administrators may also determine retention periods for organizational data.',
  },
  {
    title: '8. Sharing of Information',
    text: 'We do not sell your personal information. We may share information with your organization or workspace administrator, trusted service providers, when required by law, to protect our legal rights, or during business transfers such as mergers or acquisitions.',
  },
  {
    title: '9. Your Rights',
    text: 'Depending on applicable laws, you may have the right to access your personal information, correct inaccurate information, request deletion of your account, request data portability, withdraw consent where applicable, and object to certain processing activities. Requests may be subject to verification and legal requirements.',
  },
  {
    title: '10. Children’s Privacy',
    text: 'Peopl is designed for workplace collaboration and is not intended for individuals under the age of 13, or the minimum legal age in your jurisdiction. We do not knowingly collect personal information from children.',
  },
  {
    title: '11. Third-Party Services',
    text: 'Peopl may integrate with third-party services such as calendar applications, cloud storage providers, video conferencing platforms, productivity tools, and authentication providers. These services operate under their own privacy policies.',
  },
  {
    title: '12. International Data Transfers',
    text: 'Your information may be processed or stored in countries other than your own where our infrastructure or service providers operate. We implement appropriate safeguards to protect transferred data where required by law.',
  },
  {
    title: '13. Changes to This Privacy Policy',
    text: 'We may update this Privacy Policy from time to time. When significant changes are made, we will update the effective date and may notify users through the application or other appropriate channels. Continued use of Peopl after changes become effective constitutes acceptance of the updated Privacy Policy.',
  },
];

export function PrivacyView() {
  return (
    <Box
      sx={{
        display: 'flex',
        flex: '1 1 auto',
        flexDirection: 'column',
        height: { xs: 'calc(100dvh - 64px)', md: 'calc(100dvh - 72px)' },
        overflowY: 'auto',
        bgcolor: 'grey.50',
        py: { xs: 3, md: 5 },
      }}
    >
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              bgcolor: 'background.paper',
              boxShadow: 2,
              p: { xs: 3, md: 4 },
              position: 'relative',
            }}
          >
            <Box
              component="img"
              src="/logo/P.png"
              alt="Peopl logo"
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: { xs: 36, md: 48 },
                height: 'auto',
                objectFit: 'contain',
              }}
            />
            <Typography variant="h3" sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 700, pr: { xs: 5, md: 7 } }}>
              Privacy Policy
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Effective Date: July 2, 2026
            </Typography>
            <Typography variant="body1" sx={{ mt: 2, lineHeight: 1.8 }}>
              Welcome to <Box component="span" fontWeight={700}>Peopl</Box>. Your privacy is important to us. This Privacy Policy explains how Peopl collects, uses, stores, and protects your information when you use our workplace communication platform, website, desktop application, or mobile application.
            </Typography>
            <Typography variant="body1" sx={{ mt: 1.5, lineHeight: 1.8 }}>
              By using Peopl, you agree to the practices described in this Privacy Policy.
            </Typography>
          </Box>

          {sections.map((section) => (
            <Box
              key={section.title}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                bgcolor: 'background.paper',
                boxShadow: 1,
                p: { xs: 3, md: 4 },
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
                {section.title}
              </Typography>

              {section.blocks?.map((block) => (
                <Box key={block.heading} sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.75 }}>
                    {block.heading}
                  </Typography>
                  <Box component="ul" sx={{ pl: 3, m: 0 }}>
                    {block.items.map((item) => (
                      <Box component="li" key={item} sx={{ mb: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          {item}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ))}

              {section.text && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.8 }}>
                  {section.text}
                </Typography>
              )}
            </Box>
          ))}

          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              bgcolor: 'background.paper',
              boxShadow: 1,
              p: { xs: 3, md: 4 },
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
              14. Contact Us
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              If you have any questions about this Privacy Policy or our data practices, please contact us.
            </Typography>
            <Typography variant="body1" sx={{ mt: 1.5, fontWeight: 600 }}>
              Peopl
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              <Link href="mailto:support@peopl.com">Email: support@peopl.com</Link>
              <Link href="https://peopl.com/" target="_blank" rel="noreferrer">
                Website: https://peopl.com
              </Link>
            </Stack>
          </Box>

          <Divider />

          <Typography variant="body2" color="text.secondary" sx={{ px: { xs: 1, md: 0 }, pb: 2 }}>
            By accessing or using Peopl, you acknowledge that you have read, understood, and agreed to this Privacy Policy.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
