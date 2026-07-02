import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

const sections = [
  {
    title: '1. Eligibility',
    items: [
      'Be at least 18 years of age or the minimum legal age in your jurisdiction.',
      'Have the authority to create or join a workspace.',
      'Provide accurate and complete account information.',
      'Comply with all applicable laws and regulations.',
    ],
  },
  {
    title: '2. User Accounts',
    text: 'You are responsible for maintaining the confidentiality of your login credentials, all activities that occur under your account, keeping your account information up to date, and immediately notifying us of any unauthorized use of your account. We reserve the right to suspend or terminate accounts that violate these Terms.',
  },
  {
    title: '3. Acceptable Use',
    text: 'You agree to use Peopl only for lawful and professional purposes. You must not upload or share illegal, harmful, or offensive content, harass or abuse other users, distribute malware, interfere with the security of the Services, impersonate others, use the Services for spam, or violate intellectual property rights.',
  },
  {
    title: '4. Workspace Administration',
    text: 'Workspace owners and administrators may invite or remove members, manage user permissions and roles, configure workspace settings, access administrative tools and reports, and apply data retention policies. Users acknowledge that administrators may manage workspace content and accounts according to their organization’s policies.',
  },
  {
    title: '5. User Content',
    text: 'You retain ownership of the content you create or upload to Peopl, including messages, files, images, and documents. By using the Services, you grant Peopl a limited license to host, store, process, and transmit your content solely for the purpose of providing and improving the Services. You are responsible for ensuring that your content does not violate any laws or third-party rights.',
  },
  {
    title: '6. Intellectual Property',
    text: 'All software, designs, trademarks, logos, branding, and other intellectual property associated with Peopl are owned by Peopl or its licensors. You may not copy or reproduce the software, reverse engineer or modify the platform, or sell, distribute, or sublicense any part of the Services without written permission.',
  },
  {
    title: '7. Service Availability',
    text: 'We strive to provide reliable Services but do not guarantee uninterrupted or error-free operation. Maintenance, updates, technical issues, or events beyond our control may occasionally affect service availability.',
  },
  {
    title: '8. Third-Party Integrations',
    text: 'Peopl may support integrations with third-party applications and services. Your use of third-party services is governed by their respective terms and privacy policies. Peopl is not responsible for the content, functionality, or practices of third-party services.',
  },
  {
    title: '9. Subscription and Payments',
    text: 'If you purchase a paid plan, fees are billed according to your selected subscription, payments are non-refundable unless required by applicable law, failure to pay may result in suspension or termination, and prices may change with prior notice.',
  },
  {
    title: '10. Account Suspension and Termination',
    text: 'We may suspend or terminate your account if you violate these Terms, engage in fraudulent or illegal activities, compromise the security or integrity of the Services, or misuse the platform and disrupt other users. You may stop using the Services or request account deletion at any time, subject to your organization’s data retention policies.',
  },
  {
    title: '11. Disclaimer of Warranties',
    text: 'Peopl is provided on an “as is” and “as available” basis. To the fullest extent permitted by law, we disclaim all warranties, including warranties of merchantability, fitness for a particular purpose, and non-infringement.',
  },
  {
    title: '12. Limitation of Liability',
    text: 'To the maximum extent permitted by law, Peopl shall not be liable for any indirect, incidental, consequential, special, or punitive damages arising from your use of the Services. Our total liability shall not exceed the amount you paid for the Services during the preceding twelve months, where applicable.',
  },
  {
    title: '13. Indemnification',
    text: 'You agree to indemnify and hold harmless Peopl, its affiliates, employees, and partners from any claims, damages, liabilities, or expenses arising from your use of the Services, your violation of these Terms, or your infringement of any third-party rights.',
  },
  {
    title: '14. Changes to the Services',
    text: 'We may modify, update, suspend, or discontinue any part of the Services at any time without prior notice. We may also update these Terms periodically. Continued use of the Services after changes become effective constitutes your acceptance of the revised Terms.',
  },
  {
    title: '15. Governing Law',
    text: 'These Terms shall be governed by and interpreted in accordance with the laws of the jurisdiction in which Peopl operates, without regard to conflict of law principles. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the competent courts in that jurisdiction.',
  },
];

export function TermsView() {
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
              Terms & Conditions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Effective Date: July 2, 2026
            </Typography>
            <Typography variant="body1" sx={{ mt: 2, lineHeight: 1.8 }}>
              Welcome to <Box component="span" fontWeight={700}>Peopl</Box>. These Terms & Conditions govern your access to and use of the Peopl website, desktop application, mobile application, and related services.
            </Typography>
            <Typography variant="body1" sx={{ mt: 1.5, lineHeight: 1.8 }}>
              By accessing or using Peopl, you agree to be bound by these Terms. If you do not agree with these Terms, please do not use our Services.
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

              {section.items && (
                <Box component="ul" sx={{ pl: 3, m: 0 }}>
                  {section.items.map((item) => (
                    <Box component="li" key={item} sx={{ mb: 0.75 }}>
                      <Typography variant="body2" color="text.secondary">
                        {item}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

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
              16. Contact Us
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              If you have any questions regarding these Terms & Conditions, please contact us.
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
            By creating an account, accessing, or using Peopl, you confirm that you have read, understood, and agreed to these Terms & Conditions.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
