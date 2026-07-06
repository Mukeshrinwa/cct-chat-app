import { useRef,useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { sendAccountDeactivationOtp, verifyAccountDeactivationOtp } from 'src/api/user';

import { toast } from 'src/components/snackbar';

const isValidPhone = (value: string) => /^\+?\d{10,15}$/.test(value);

export function DeleteView() {
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isOtpOpen, setIsOtpOpen] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [deletionMessage, setDeletionMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(10);
  const [canResend, setCanResend] = useState(false);
  const otpInputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const updateOtpAtIndex = (index: number, value: string) => {
    const nextValue = value.replace(/\D/g, '').slice(0, 1);
    const otpDigits = otp.split('').slice(0, 6);
    otpDigits[index] = nextValue;

    const newOtp = otpDigits.map((digit) => digit || '').join('');
    setOtp(newOtp);

    if (nextValue && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (event: React.KeyboardEvent<HTMLElement>, index: number) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) {
      return;
    }

    const otpDigits = pasted.split('');
    setOtp(otpDigits.join(''));
    const filledIndex = Math.min(otpDigits.length, 6) - 1;
    if (filledIndex >= 0) {
      otpInputsRef.current[filledIndex]?.focus();
    }
  };

  useEffect(() => {
    let timer: number | undefined;

    if (isOtpOpen) {
      setOtpTimer(10);
      setCanResend(false);
      timer = window.setInterval(() => {
        setOtpTimer((prev) => {
          if (prev <= 1) {
            if (timer) {
              window.clearInterval(timer);
            }
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [isOtpOpen]);

  const handlePhoneSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValidPhone(phone)) {
      setPhoneError('Please enter a valid mobile number.');
      return;
    }

    setPhoneError('');
    setIsLoading(true);

    try {
      const message = await sendAccountDeactivationOtp(phone);
      toast.success(message);
      setOtp('');
      setOtpError('');
      setOtpTimer(10);
      setCanResend(false);
      setIsOtpOpen(true);
    } catch (error: any) {
      setPhoneError(error?.message || 'Failed to send OTP.');
      toast.error(error?.message || 'Failed to send OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtp('');
    setOtpError('');
    setOtpTimer(10);
    setCanResend(false);
    setIsLoading(true);

    try {
      const message = await sendAccountDeactivationOtp(phone);
      toast.success(message);
      otpInputsRef.current[0]?.focus();
    } catch (error: any) {
      setOtpError(error?.message || 'Failed to resend OTP.');
      toast.error(error?.message || 'Failed to resend OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (otp.trim().length !== 6) {
      setOtpError('Please enter the 6-digit OTP.');
      return;
    }

    setOtpError('');
    setIsLoading(true);

    try {
      const result = await verifyAccountDeactivationOtp(phone, otp);
      setDeletionMessage(result.message || 'Your account is deleted in 30 days');
      toast.success(result.message || 'Account deactivation scheduled successfully.');
      setIsOtpOpen(false);
      setIsDeleted(true);
    } catch (error: any) {
      setOtpError(error?.message || 'Failed to verify OTP.');
      toast.error(error?.message || 'Failed to verify OTP.');
    } finally {
      setIsLoading(false);
    }
  };

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
      <Container maxWidth="sm">
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            bgcolor: 'background.paper',
            boxShadow: 2,
            p: { xs: 3, md: 4 },
          }}
        >
          <Stack alignItems="center" spacing={2.5} sx={{ mb: 4, textAlign: 'center' }}>
            <Box
              component="img"
              src="/logo/P.png"
              alt="Peopl logo"
              sx={{ width: 60, height: 60, objectFit: 'contain' }}
            />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
                Delete your account
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 520, mx: 'auto' }}>
                Confirm your identity with mobile verification to begin the deletion process.
              </Typography>
            </Box>
          </Stack>

          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'grey.50',
              p: { xs: 3, md: 4 },
              mb: 4,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Delete request verification
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
              Enter the mobile number linked to your account. We’ll send a one-time passcode to verify your request before deletion begins.
            </Typography>
          </Box>

          {!isDeleted ? (
            <Box component="form" onSubmit={handlePhoneSubmit} noValidate>
              <Stack spacing={3}>
                <TextField
                  label="Mobile number"
                  type="tel"
                  placeholder="+911234567890"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    if (phoneError) setPhoneError('');
                  }}
                  error={Boolean(phoneError)}
                  helperText={phoneError || 'A verification code will be sent to this number.'}
                  fullWidth
                />

                <Button type="submit" variant="contained" color="error" size="large" sx={{ py: 1.75 }} disabled={isLoading}>
                  Send OTP
                </Button>

                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 1 }}>
                  You can cancel from your account page before deletion is completed.
                </Typography>
              </Stack>
            </Box>
          ) : (
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'success.main',
                borderRadius: 2,
                bgcolor: 'success.light',
                p: 3,
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.dark' }}>
                {deletionMessage || 'Your account is deleted in 30 days'}
              </Typography>
            </Box>
          )}
        </Box>
      </Container>

      <Dialog
        open={isOtpOpen}
        onClose={() => setIsOtpOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
      >
        <Box component="form" onSubmit={handleOtpSubmit}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              px: 3,
              pt: 3,
              pb: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              gap: 1.5,
            }}
          >
            <Box
              component="img"
              src="/logo/P.png"
              alt="Peopl logo"
              sx={{ width: 48, height: 48, objectFit: 'contain' }}
            />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Verify your Delete Request
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Secure code sent to your phone
              </Typography>
            </Box>
          </Box>

          <DialogContent sx={{ pt: 4, px: 3, pb: 0 }}>
            <Box
              sx={{
                p: 2,
                mb: 2,
                borderRadius: 2,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Enter the 6-digit OTP sent to{' '}
                <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {phone || 'your phone number'}
                </Box>
              </Typography>
            </Box>

            <Stack direction="row" justifyContent="center" spacing={1.5} sx={{ mb: 3 }}>
              {[...Array(6)].map((_, index) => (
                <TextField
                  key={index}
                  inputRef={(el) => {
                    otpInputsRef.current[index] = el;
                  }}
                  value={otp[index] || ''}
                  onChange={(event) => {
                    updateOtpAtIndex(index, event.target.value);
                    if (otpError) setOtpError('');
                  }}
                  onKeyDown={(event) => handleOtpKeyDown(event, index)}
                  onPaste={handleOtpPaste}
                  inputProps={{
                    maxLength: 1,
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                    style: {
                      textAlign: 'center',
                      fontSize: '1.35rem',
                      padding: '12px 12px',
                      width: '40px',
                      height: '40px',
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      bgcolor: 'background.paper',
                      boxShadow: 1,
                    },
                  }}
                />
              ))}
            </Stack>
            {otpError && (
              <Typography variant="body2" color="error" sx={{ textAlign: 'center', mb: 1 }}>
                {otpError}
              </Typography>
            )}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                px: 0,
                mb: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Didn&lsquo;t get the code? {otpTimer > 0 ? `Try again in ${otpTimer}s` : 'You can resend now'}
              </Typography>
              <Button
                type="button"
                onClick={handleResendOtp}
                disabled={!canResend || isLoading}
                size="small"
              >
                Resend OTP
              </Button>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 0 }}>
            <Button onClick={() => setIsOtpOpen(false)} sx={{ minWidth: 96 }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="error" sx={{ minWidth: 132 }}>
              Submit OTP
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
