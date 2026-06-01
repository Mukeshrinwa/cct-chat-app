import type { IChatParticipant } from 'src/types/chat';

import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
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
};

export function ChatHeaderCompose({ contacts, onAddRecipients }: Props) {
  const [searchRecipients, setSearchRecipients] = useState('');
  const [options, setOptions] = useState<IChatParticipant[]>(contacts);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync options when contacts list updates initially
  useEffect(() => {
    setOptions(contacts);
  }, [contacts]);

  const handleAddRecipients = useCallback(
    (selected: IChatParticipant[]) => {
      setSearchRecipients('');
      onAddRecipients(selected);
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
        setOptions(contacts);
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
    [contacts]
  );

  return (
    <>
      <Typography variant="subtitle2" sx={{ color: 'text.primary', mr: 2 }}>
        To:
      </Typography>

      <Autocomplete
        sx={{ minWidth: { md: 320 }, flexGrow: { xs: 1, md: 'unset' } }}
        multiple
        limitTags={3}
        popupIcon={null}
        defaultValue={[]}
        disableCloseOnSelect
        noOptionsText={loading ? 'Searching...' : <SearchNotFound query={searchRecipients} />}
        onChange={(event, newValue) => handleAddRecipients(newValue)}
        onInputChange={handleInputChange}
        options={options}
        getOptionLabel={(recipient) => recipient.name}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="+ Recipients"
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
              key={recipient.id}
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
        renderTags={(selected, getTagProps) =>
          selected.map((recipient, index) => (
            <Chip
              {...getTagProps({ index })}
              key={recipient.id}
              label={recipient.name}
              avatar={<Avatar alt={recipient.name} src={recipient.avatarUrl} />}
              size="small"
              variant="soft"
            />
          ))
        }
      />
    </>
  );
}
