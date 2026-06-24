import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  name: string;
  avatarUrl?: string;
};

export function ChatAvatarPreviewDialog({ open, onClose, name, avatarUrl }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          boxShadow: (theme) => theme.customShadows?.z24,
        },
      }}
    >
      <DialogTitle
        sx={{
          m: 0,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
          {name}
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <Iconify icon="mingcute:close-line" width={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent 
        sx={{ 
          p: 0, 
          bgcolor: 'background.neutral', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          overflow: 'hidden',
          aspectRatio: '1/1',
          width: 1,
        }}
      >
        {avatarUrl ? (
          <Box
            component="img"
            src={avatarUrl}
            alt={name}
            sx={{
              width: 1,
              height: 1,
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <Avatar
            sx={{
              width: 1,
              height: 1,
              borderRadius: 0,
              fontSize: 80,
              fontWeight: 700,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            {name?.charAt(0)?.toUpperCase()}
          </Avatar>
        )}
      </DialogContent>
    </Dialog>
  );
}
