import { useState } from 'react';
import {
    Box,
    TextField,
    Button,
    Typography,
    Paper,
    CircularProgress,
} from '@mui/material';
import axios from 'axios';

const endpointMapping = {
    'Notion': 'notion',
    'Airtable': 'airtable',
    'Hubspot': 'hubspot',
};

export const DataForm = ({ integrationType, credentials }) => {
    const [loadedData, setLoadedData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);    
    const endpoint = endpointMapping[integrationType];

    const handleLoad = async () => {
        try {
            setIsLoading(true);
            const formData = new FormData();
            formData.append('credentials', JSON.stringify(credentials));
            const response = await axios.post(`http://localhost:8000/integrations/${endpoint}/load`, formData);
            const data = response.data;
            console.log('Raw response data:', data);
            console.log('Stringified data:', JSON.stringify(data, null, 2));

            setLoadedData(data);
        } catch (e) {
            console.error('Error:', e);
            alert(e?.response?.data?.detail);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Box display='flex' justifyContent='center' alignItems='center' flexDirection='column' width='100%'>
            <Box display='flex' flexDirection='column' width='100%' position="relative">
                {isLoading && (
                    <Box
                        position="absolute"
                        top={0}
                        left={0}
                        right={0}
                        bottom={0}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        bgcolor="rgba(255, 255, 255, 0.7)"
                        zIndex={1}
                    >
                        <CircularProgress />
                    </Box>
                )}
                <TextField
                    label="Loaded Data"
                    value={loadedData || ''}
                    sx={{mt: 2}}
                    InputLabelProps={{ shrink: true }}
                    disabled
                />
                <Button
                    onClick={handleLoad}
                    sx={{mt: 2}}
                    variant='contained'
                    disabled={isLoading}
                >
                    {isLoading ? 'Loading...' : 'Load Data'}
                </Button>
                <Button
                    onClick={() => setLoadedData(null)}
                    sx={{mt: 1}}
                    variant='contained'
                    disabled={isLoading}
                >
                    Clear Data
                </Button>
            </Box>
        </Box>
    );
}
