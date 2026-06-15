import { z as zod } from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Step from '@mui/material/Step';
import Chip from '@mui/material/Chip';
import Fade from '@mui/material/Fade';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Stepper from '@mui/material/Stepper';
import StepLabel from '@mui/material/StepLabel';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useBoolean } from 'src/hooks/use-boolean';

import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from 'src/auth/hooks';
import { signUp, sendOtp, checkUsername } from 'src/auth/context/jwt';

// ----------------------------------------------------------------------

const STEPS = ['Mobile', 'Verify OTP', 'Profile'];

// Step 1 schema - Mobile number
const MobileSchema = zod.object({
  mobile: zod
    .string()
    .min(1, { message: 'Mobile number is required!' })
    .regex(/^\+?\d{10,15}$/, { message: 'Enter a valid mobile number!' }),
});

// Step 2 schema - OTP
const OtpSchema = zod.object({
  otp: zod
    .string()
    .min(1, { message: 'OTP is required!' })
    .length(6, { message: 'OTP must be 6 digits!' }),
});

// Step 3 schema - Profile details
const ProfileSchema = zod.object({
  name: zod.string().min(1, { message: 'Name is required!' }),
  username: zod
    .string()
    .min(1, { message: 'Username is required!' })
    .min(3, { message: 'Username must be at least 3 characters!' })
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, { message: 'Username cannot start with a number, and must only contain letters, numbers, and underscores!' }),
  password: zod
    .string()
    .min(1, { message: 'Password is required!' })
    .min(6, { message: 'Password must be at least 6 characters!' }),
  about: zod.string().optional(),
});

export type MobileSchemaType = zod.infer<typeof MobileSchema>;
export type OtpSchemaType = zod.infer<typeof OtpSchema>;
export type ProfileSchemaType = zod.infer<typeof ProfileSchema>;

// ----------------------------------------------------------------------

export function JwtSignUpView() {
  const { checkUserSession } = useAuthContext();
  const router = useRouter();
  const password = useBoolean();

  const [activeStep, setActiveStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>(
    'idle'
  );
  const [resendTimer, setResendTimer] = useState(0);

  // Step 1 form
  const mobileForm = useForm<MobileSchemaType>({
    resolver: zodResolver(MobileSchema),
    defaultValues: { mobile: '' },
  });

  // Step 2 form
  const otpForm = useForm<OtpSchemaType>({
    resolver: zodResolver(OtpSchema),
    defaultValues: { otp: '' },
  });

  // Step 3 form
  const profileForm = useForm<ProfileSchemaType>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: { name: '', username: '', password: '', about: '' },
  });

  // Resend timer
  const startResendTimer = useCallback(() => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Step 1: Send OTP
  const handleSendOtp = mobileForm.handleSubmit(async (data) => {
    try {
      setErrorMsg('');
      setSuccessMsg('');

      let mobileNum = data.mobile.trim();
      if (!mobileNum.startsWith('+')) {
        mobileNum = `+91${mobileNum}`;
      }

      await sendOtp(mobileNum);
      setMobile(mobileNum);
      setSuccessMsg('OTP sent successfully!');
      startResendTimer();
      setActiveStep(1);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Failed to send OTP');
    }
  });

  // Step 2: Collect OTP and move to profile step
  // Note: We don't call verify-otp API here because the register endpoint
  // verifies the OTP internally. Calling verify-otp would consume it.
  const handleVerifyOtp = otpForm.handleSubmit(async (data) => {
    setErrorMsg('');
    setSuccessMsg('');
    setOtp(data.otp);
    setSuccessMsg('OTP entered! Complete your profile to finish registration.');
    setActiveStep(2);
  });

  // Resend OTP
  const handleResendOtp = async () => {
    try {
      setErrorMsg('');
      await sendOtp(mobile);
      setSuccessMsg('OTP resent successfully!');
      startResendTimer();
    } catch (error) {
      console.error(error);
      setErrorMsg('Failed to resend OTP');
    }
  };

  // Check username availability (debounced inline)
  const handleCheckUsername = useCallback(
    async (username: string) => {
      if (username.length < 3) {
        setUsernameStatus('idle');
        return;
      }
      setUsernameStatus('checking');
      try {
        const available = await checkUsername(username);
        setUsernameStatus(available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    },
    []
  );

  // Step 3: Register
  const handleRegister = profileForm.handleSubmit(async (data) => {
    try {
      setErrorMsg('');
      setSuccessMsg('');

      if (usernameStatus === 'taken') {
        setErrorMsg('Username is already taken!');
        return;
      }

      await signUp({
        mobile,
        otp,
        name: data.name,
        username: data.username,
        password: data.password,
        about: data.about || 'Hey there! I am using this app.',
      });

      await checkUserSession?.();
      router.push(paths.dashboard.chat);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Registration failed');
    }
  });

  // ---------- Render Functions ----------

  const renderHead = (
    <Stack spacing={1.5} sx={{ mb: 5 }}>
      <Typography variant="h5">Create your account</Typography>

      <Stack direction="row" spacing={0.5}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Already have an account?
        </Typography>

        <Link component={RouterLink} href={paths.auth.jwt.signIn} variant="subtitle2">
          Sign in
        </Link>
      </Stack>
    </Stack>
  );

  const renderStepper = (
    <Stepper
      activeStep={activeStep}
      alternativeLabel
      sx={{
        mb: 4,
        '& .MuiStepConnector-line': {
          borderTopWidth: 2,
        },
        '& .MuiStepLabel-label': {
          typography: 'caption',
          fontWeight: 'fontWeightSemiBold',
        },
      }}
    >
      {STEPS.map((label, index) => (
        <Step key={label} completed={activeStep > index}>
          <StepLabel
            StepIconProps={{
              sx: {
                ...(activeStep >= index && {
                  color: 'primary.main',
                }),
              },
            }}
          >
            {label}
          </StepLabel>
        </Step>
      ))}
    </Stepper>
  );

  // Step 1: Mobile number form
  const renderMobileStep = (
    <Fade in={activeStep === 0} timeout={400}>
      <Box>
        <Form methods={mobileForm} onSubmit={handleSendOtp}>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                Enter your mobile number to receive a verification code
              </Typography>
              <Field.Text
                name="mobile"
                label="Mobile Number"
                placeholder="+91 9876543210"
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Iconify icon="solar:phone-bold" width={22} sx={{ color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>

            <LoadingButton
              fullWidth
              color="inherit"
              size="large"
              type="submit"
              variant="contained"
              loading={mobileForm.formState.isSubmitting}
              loadingIndicator="Sending OTP..."
            >
              Send OTP
            </LoadingButton>
          </Stack>
        </Form>
      </Box>
    </Fade>
  );

  // Step 2: OTP verification form
  const renderOtpStep = (
    <Fade in={activeStep === 1} timeout={400}>
      <Box>
        <Form methods={otpForm} onSubmit={handleVerifyOtp}>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                We sent a 6-digit code to{' '}
                <Box component="span" sx={{ fontWeight: 'fontWeightBold', color: 'text.primary' }}>
                  {mobile}
                </Box>
              </Typography>

              <Field.Text
                name="otp"
                label="Verification Code"
                placeholder="Enter 6-digit OTP"
                InputLabelProps={{ shrink: true }}
                inputProps={{ maxLength: 6 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Iconify
                        icon="solar:lock-keyhole-bold"
                        width={22}
                        sx={{ color: 'text.disabled' }}
                      />
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Didn&apos;t receive the code?
              </Typography>

              {resendTimer > 0 ? (
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                  Resend in {resendTimer}s
                </Typography>
              ) : (
                <Link
                  variant="subtitle2"
                  onClick={handleResendOtp}
                  sx={{ cursor: 'pointer' }}
                >
                  Resend OTP
                </Link>
              )}
            </Stack>

            <LoadingButton
              fullWidth
              color="inherit"
              size="large"
              type="submit"
              variant="contained"
              loading={otpForm.formState.isSubmitting}
              loadingIndicator="Verifying..."
            >
              Verify OTP
            </LoadingButton>

            <Link
              variant="body2"
              color="inherit"
              onClick={() => {
                setActiveStep(0);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              sx={{
                alignSelf: 'center',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <Iconify icon="solar:arrow-left-linear" width={16} />
              Change number
            </Link>
          </Stack>
        </Form>
      </Box>
    </Fade>
  );

  // Username status adornment
  const renderUsernameAdornment = () => {
    if (usernameStatus === 'checking') {
      return (
        <InputAdornment position="end">
          <CircularProgress size={20} />
        </InputAdornment>
      );
    }
    if (usernameStatus === 'available') {
      return (
        <InputAdornment position="end">
          <Chip
            label="Available"
            size="small"
            color="success"
            variant="soft"
            icon={<Iconify icon="solar:check-circle-bold" />}
          />
        </InputAdornment>
      );
    }
    if (usernameStatus === 'taken') {
      return (
        <InputAdornment position="end">
          <Chip
            label="Taken"
            size="small"
            color="error"
            variant="soft"
            icon={<Iconify icon="solar:close-circle-bold" />}
          />
        </InputAdornment>
      );
    }
    return null;
  };

  // Step 3: Profile form
  const renderProfileStep = (
    <Fade in={activeStep === 2} timeout={400}>
      <Box>
        <Form methods={profileForm} onSubmit={handleRegister}>
          <Stack spacing={3}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: -1 }}>
              Complete your profile to get started
            </Typography>

            <Field.Text
              name="name"
              label="Full Name"
              placeholder="Enter your full name"
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify
                      icon="solar:user-bold"
                      width={22}
                      sx={{ color: 'text.disabled' }}
                    />
                  </InputAdornment>
                ),
              }}
            />

            <Field.Text
              name="username"
              label="Username"
              placeholder="Choose a unique username"
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography sx={{ color: 'text.disabled', fontWeight: 600 }}>@</Typography>
                  </InputAdornment>
                ),
                endAdornment: renderUsernameAdornment(),
              }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                profileForm.setValue('username', e.target.value, { shouldValidate: true });
                handleCheckUsername(e.target.value);
              }}
            />

            <Field.Text
              name="password"
              label="Password"
              placeholder="6+ characters"
              type={password.value ? 'text' : 'password'}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify
                      icon="solar:lock-bold"
                      width={22}
                      sx={{ color: 'text.disabled' }}
                    />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={password.onToggle} edge="end">
                      <Iconify
                        icon={password.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'}
                      />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Field.Text
              name="about"
              label="About (Optional)"
              placeholder="Tell us about yourself..."
              multiline
              rows={3}
              InputLabelProps={{ shrink: true }}
            />

            <LoadingButton
              fullWidth
              color="inherit"
              size="large"
              type="submit"
              variant="contained"
              loading={profileForm.formState.isSubmitting}
              loadingIndicator="Creating account..."
              disabled={usernameStatus === 'taken'}
            >
              Create Account
            </LoadingButton>
          </Stack>
        </Form>
      </Box>
    </Fade>
  );

  const renderTerms = (
    <Typography
      component="div"
      sx={{
        mt: 3,
        textAlign: 'center',
        typography: 'caption',
        color: 'text.secondary',
      }}
    >
      {'By signing up, I agree to '}
      <Link underline="always" color="text.primary">
        Terms of service
      </Link>
      {' and '}
      <Link underline="always" color="text.primary">
        Privacy policy
      </Link>
      .
    </Typography>
  );

  return (
    <>
      {renderHead}

      {renderStepper}

      {!!errorMsg && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setErrorMsg('')}>
          {errorMsg}
        </Alert>
      )}

      {!!successMsg && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      )}

      {activeStep === 0 && renderMobileStep}
      {activeStep === 1 && renderOtpStep}
      {activeStep === 2 && renderProfileStep}

      {renderTerms}
    </>
  );
}
