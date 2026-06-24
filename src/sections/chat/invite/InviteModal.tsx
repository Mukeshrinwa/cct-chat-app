import type { InviteParams, InviteStatus, InviteResponse } from 'src/actions/invite';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { InviteService } from 'src/actions/invite';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

type Props = {
  open: boolean;
  onClose: () => void;
  roomId: string;
};

export function InviteModal({ open, onClose, roomId }: Props) {
  const [inviteParams, setInviteParams] = useState<InviteParams>({
    roomId,
    role: 'participant',
    singleUse: false,
    maxUses: 10,
    expiresAt: '',
    allowedEmails: [],
    allowedDomains: [],
    redirectUrl: '',
  });

  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [inviteStatus, setInviteStatus] = useState<InviteStatus | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailsText, setEmailsText] = useState('');
  const [domainsText, setDomainsText] = useState('');

  const handleReset = () => {
    setInviteParams({
      roomId,
      role: 'participant',
      singleUse: false,
      maxUses: 10,
      expiresAt: '',
      allowedEmails: [],
      allowedDomains: [],
      redirectUrl: '',
    });
    setGeneratedLink('');
    setInviteStatus(null);
    setError(null);
    setCopySuccess(false);
    setEmailsText('');
    setDomainsText('');
  };

  const handleClose = () => {
    onClose();
    setTimeout(handleReset, 300);
  };

  const buildJoinUrl = (inviteCode: string, token?: string) => {
    const url = new URL(`${window.location.origin}/group/invite/${inviteCode}`);
    if (token) {
      url.searchParams.set('token', token);
    }
    return url.toString();
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);

      const paramsToSubmit = { ...inviteParams };
      if (emailsText.trim()) {
        paramsToSubmit.allowedEmails = emailsText.split(',').map((e) => e.trim()).filter(Boolean);
      }
      if (domainsText.trim()) {
        paramsToSubmit.allowedDomains = domainsText.split(',').map((d) => d.trim()).filter(Boolean);
      }
      if (!paramsToSubmit.expiresAt) {
        paramsToSubmit.expiresAt = null;
      }

      const res: InviteResponse = await InviteService.createInvite(paramsToSubmit);

      const link = buildJoinUrl(res.inviteCode, res.token);
      setGeneratedLink(link);
      setInviteStatus(res.revoked ? 'revoked' : res.isActive ? 'active' : 'expired');
    } catch (err: any) {
      setError(err.message || 'Failed to generate invite link');
      toast.error('Error generating invite link');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopySuccess(true);
    toast.success('Link copied');
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Room',
          text: 'You are invited to join a room',
          url: generatedLink,
        });
      } catch (err) {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Generate Invite Link</DialogTitle>

      <DialogContent sx={{ pb: 3, pt: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {!generatedLink && !generating && (
          <Stack spacing={3}>
            <TextField
              select
              fullWidth
              label="Role"
              value={inviteParams.role}
              onChange={(e) => setInviteParams({ ...inviteParams, role: e.target.value })}
            >
              <MenuItem value="guest">Guest</MenuItem>
              <MenuItem value="participant">Participant</MenuItem>
              <MenuItem value="moderator">Moderator</MenuItem>
            </TextField>

            <FormControlLabel
              control={
                <Checkbox
                  checked={inviteParams.singleUse}
                  onChange={(e) => setInviteParams({ ...inviteParams, singleUse: e.target.checked })}
                />
              }
              label="Single Use Link"
            />

            {!inviteParams.singleUse && (
              <TextField
                type="number"
                label="Max Uses"
                fullWidth
                value={inviteParams.maxUses}
                onChange={(e) => setInviteParams({ ...inviteParams, maxUses: parseInt(e.target.value, 10) || 0 })}
                InputProps={{ inputProps: { min: 1 } }}
              />
            )}

            <TextField
              type="datetime-local"
              label="Expiry Date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={inviteParams.expiresAt || ''}
              onChange={(e) => setInviteParams({ ...inviteParams, expiresAt: e.target.value })}
            />

            <TextField
              label="Allowed Emails (comma separated)"
              fullWidth
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              placeholder="user@example.com, admin@example.com"
            />

            <TextField
              label="Allowed Domains (comma separated)"
              fullWidth
              value={domainsText}
              onChange={(e) => setDomainsText(e.target.value)}
              placeholder="example.com, company.com"
            />

            <TextField
              label="Redirect URL (Optional)"
              fullWidth
              value={inviteParams.redirectUrl || ''}
              onChange={(e) => setInviteParams({ ...inviteParams, redirectUrl: e.target.value })}
            />
          </Stack>
        )}

        {generating && (
          <Box display="flex" justifyContent="center" alignItems="center" height={200}>
            <CircularProgress />
          </Box>
        )}

        {generatedLink && !generating && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              Generated Link (Status: {inviteStatus})
            </Typography>

            <TextField
              fullWidth
              value={generatedLink}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleCopy} color={copySuccess ? 'success' : 'default'}>
                      <Iconify icon={copySuccess ? "eva:checkmark-fill" : "eva:copy-fill"} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button fullWidth variant="contained" onClick={handleShare} startIcon={<Iconify icon="solar:share-bold" />}>
                Share
              </Button>
              <Button fullWidth variant="outlined" onClick={handleReset}>
                Generate Another
              </Button>
            </Stack>
          </Box>
        )}
      </DialogContent>

      {!generatedLink && !generating && (
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" onClick={handleGenerate}>
            Generate Link
          </Button>
        </DialogActions>
      )}

      {generatedLink && !generating && (
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
