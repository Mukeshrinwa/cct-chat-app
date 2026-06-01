import type { IChatParticipant } from 'src/types/chat';

import { useRef, useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';

import { searchUsers } from 'src/api/user';
import { varAlpha } from 'src/theme/styles';

import { Iconify } from 'src/components/iconify';
import { SearchNotFound } from 'src/components/search-not-found';

// ----------------------------------------------------------------------

type Props = {
  contacts: IChatParticipant[];
  onAddRecipients: (selected: IChatParticipant[]) => void;
  recipients: IChatParticipant[];
};

export function ChatHeaderCompose({ contacts, onAddRecipients, recipients }: Props) {
  const [searchRecipients, setSearchRecipients] = useState('');
  const [options, setOptions] = useState<IChatParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAddRecipients = useCallback(
    (selected: IChatParticipant | null) => {
      setSearchRecipients('');
      if (selected) {
        onAddRecipients([selected]);
      } else {
        onAddRecipients([]);
      }
    },
    [onAddRecipients]
  );

  const handleInputChange = useCallback(
    (event: any, newValue: string) => {
      setSearchRecipients(newValue);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!newValue.trim()) {
        setOptions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const users = await searchUsers(newValue);
          const mapped = users.map((u) => ({
            id: u._id,
            name: u.name,
            username: u.username,
            role: u.role || 'user',
            email: '',
            address: '',
            avatarUrl: u.avatar || '',
            phoneNumber: '',
            lastActivity: u.lastSeen || new Date().toISOString(),
            status: u.isOnline ? ('online' as const) : ('offline' as const),
          }));
          setOptions(mapped);
        } catch (error) {
          console.error('Failed to search users globally:', error);
          setOptions([]);
        } finally {
          setLoading(false);
        }
      }, 400);
    },
    []
  );

  const value = recipients[0] || null;

  const autocompleteOptions = useMemo(() => {
    if (!searchRecipients.trim() && value) {
      return [value];
    }
    return options;
  }, [options, searchRecipients, value]);

  return (
    <Autocomplete
      sx={{ minWidth: { md: 320 }, flexGrow: { xs: 1, md: 'unset' } }}
      popupIcon={null}
      noOptionsText={loading ? 'Searching...' : <SearchNotFound query={searchRecipients} />}
      onChange={(event, newValue) => handleAddRecipients(newValue)}
      onInputChange={handleInputChange}
      options={autocompleteOptions}
      value={value}
      getOptionLabel={(recipient) => recipient.name}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Search user..."
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, recipient, { selected }) => (
        <li {...props} key={recipient.id}>
          <Box
            sx={{
              mr: 1,
              width: 32,
              height: 32,
              overflow: 'hidden',
              borderRadius: '50%',
              position: 'relative',
            }}
          >
            <Avatar alt={recipient.name} src={recipient.avatarUrl} sx={{ width: 1, height: 1 }} />
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{
                top: 0,
                left: 0,
                width: 1,
                height: 1,
                opacity: 0,
                position: 'absolute',
                bgcolor: (theme) => varAlpha(theme.vars.palette.grey['900Channel'], 0.8),
                transition: (theme) =>
                  theme.transitions.create(['opacity'], {
                    easing: theme.transitions.easing.easeInOut,
                    duration: theme.transitions.duration.shorter,
                  }),
                ...(selected && { opacity: 1, color: 'primary.main' }),
              }}
            >
              <Iconify icon="eva:checkmark-fill" />
            </Stack>
          </Box>

          <Box>
            <Typography variant="body2">{recipient.name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              @{recipient.username || recipient.name}
            </Typography>
          </Box>
        </li>
      )}
    />
  );
}
