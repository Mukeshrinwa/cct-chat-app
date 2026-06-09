import type { InviteResponse } from 'src/actions/invite';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { fDateTime } from 'src/utils/format-time';

import { useGetInvites, InviteService } from 'src/actions/invite';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

type Props = {
  roomId: string;
};

export function InviteList({ roomId }: Props) {
  const { inviteList, invitesLoading, invitesError } = useGetInvites(roomId);
  
  const [selectedInvite, setSelectedInvite] = useState<InviteResponse | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const buildJoinUrl = (inviteCode: string, token?: string) => {
    const url = new URL(`${window.location.origin}/group/invite/${inviteCode}`);
    if (token) {
      url.searchParams.set('token', token);
    }
    return url.toString();
  };

  const handleCopy = (invite: InviteResponse) => {
    const link = buildJoinUrl(invite.inviteCode, invite.token);
    navigator.clipboard.writeText(link);
    toast.success('Link copied');
  };

  const handleShare = async (invite: InviteResponse) => {
    const link = buildJoinUrl(invite.inviteCode, invite.token);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Room',
          text: 'You are invited to join a room',
          url: link,
        });
      } catch (err) {
        handleCopy(invite);
      }
    } else {
      handleCopy(invite);
    }
  };

  const handleRevokeClick = (invite: InviteResponse) => {
    setSelectedInvite(invite);
    setRevokeDialogOpen(true);
  };

  const handleConfirmRevoke = async () => {
    if (!selectedInvite) return;
    try {
      setRevoking(true);
      await InviteService.revokeInvite(selectedInvite._id, roomId);
      toast.success('Invite revoked successfully');
      setRevokeDialogOpen(false);
      setSelectedInvite(null);
    } catch (error) {
      toast.error('Failed to revoke invite');
    } finally {
      setRevoking(false);
    }
  };

  if (invitesLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={100}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (invitesError) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 3 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          Advanced invites are not available yet or the backend returned an error.
        </Typography>
      </Stack>
    );
  }

  if (!inviteList || inviteList.length === 0) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 5 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No advanced invite links found.
        </Typography>
      </Stack>
    );
  }

  return (
    <>
      <Card>
        <TableContainer component={Scrollbar}>
          <Table sx={{ minWidth: 600 }}>
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Uses</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {inviteList.map((invite) => {
                let status = 'active';
                if (invite.revoked) status = 'revoked';
                else if (!invite.isActive) status = 'usedUp';
                else if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) status = 'expired';

                const isActive = status === 'active';
                
                return (
                  <TableRow key={invite._id}>
                    <TableCell>
                      <Label
                        color={
                          (status === 'active' && 'success') ||
                          (status === 'revoked' && 'error') ||
                          (status === 'expired' && 'warning') ||
                          'default'
                        }
                      >
                        {status}
                      </Label>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {invite.type.replace('_', ' ')}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      {invite.type === 'single_use' ? (
                         `${invite.currentUses} / 1`
                      ) : invite.maxUses ? (
                         `${invite.currentUses} / ${invite.maxUses}`
                      ) : (
                         `${invite.currentUses} / ∞`
                      )}
                    </TableCell>

                    <TableCell>
                      {invite.expiresAt ? fDateTime(invite.expiresAt) : 'Never'}
                    </TableCell>

                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" spacing={1}>
                        <Tooltip title="Copy Link">
                          <IconButton onClick={() => handleCopy(invite)} disabled={!isActive}>
                            <Iconify icon="eva:copy-fill" />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Share">
                          <IconButton onClick={() => handleShare(invite)} disabled={!isActive}>
                            <Iconify icon="solar:share-bold" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Revoke">
                          <IconButton 
                            color="error" 
                            onClick={() => handleRevokeClick(invite)}
                            disabled={!isActive}
                          >
                            <Iconify icon="eva:trash-2-outline" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={revokeDialogOpen} onClose={() => !revoking && setRevokeDialogOpen(false)}>
        <DialogTitle>Revoke Invite</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to revoke this invite link? Users will no longer be able to use it to join.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeDialogOpen(false)} disabled={revoking}>Cancel</Button>
          <Button onClick={handleConfirmRevoke} color="error" variant="contained" disabled={revoking}>
            {revoking ? 'Revoking...' : 'Revoke'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
