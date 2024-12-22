import { useState, useEffect } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Snackbar,
    Alert
} from '@mui/material';
import axios from 'axios';

export const HubspotIntegration = ({ user, org, integrationParams, setIntegrationParams }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState(null);

    const handleCloseError = () => setError(null);

    // Function to open OAuth in a new window
    const handleConnectClick = async () => {
        try {
            setIsConnecting(true);
            setError(null);
            
            const formData = new FormData();
            formData.append('user_id', user);
            formData.append('org_id', org);
            
            const response = await axios.post(
                `http://localhost:8000/integrations/hubspot/authorize`, 
                formData
            );
            
            const authURL = response?.data;
            if (!authURL) {
                throw new Error('No authorization URL received');
            }

            const newWindow = window.open(authURL, 'Hubspot Authorization', 'width=600,height=600');
            
            if (!newWindow) {
                throw new Error('Popup blocked. Please allow popups for this site.');
            }

            // Polling for the window to close
            const pollTimer = window.setInterval(() => {
                if (newWindow.closed) { 
                    window.clearInterval(pollTimer);
                    handleWindowClosed();
                }
            }, 200);

        } catch (e) {
            setIsConnecting(false);
            setError(e?.response?.data?.detail || e.message || 'Connection failed');
        }
    }

    // Function to handle logic when the OAuth window closes
    const handleWindowClosed = async () => {
        try {
            const formData = new FormData();
            formData.append('user_id', user);
            formData.append('org_id', org);
            
            const response = await axios.post(
                `http://localhost:8000/integrations/hubspot/credentials`, 
                formData
            );
            
            const credentials = response.data;
            if (credentials) {
                setIsConnecting(false);
                setIsConnected(true);
                setIntegrationParams(prev => ({ 
                    ...prev, 
                    credentials: credentials, 
                    type: 'Hubspot' 
                }));
            } else {
                throw new Error('No credentials received');
            }
        } catch (e) {
            setIsConnecting(false);
            setError(e?.response?.data?.detail || e.message || 'Failed to get credentials');
        }
    }

    useEffect(() => {
        setIsConnected(!!integrationParams?.credentials);
    }, [integrationParams]);

    return (
        <>
            <Box sx={{mt: 2}}>
                <Box display='flex' alignItems='center' justifyContent='center' sx={{mt: 2}}>
                    <Button 
                        variant='contained' 
                        onClick={isConnected ? () => {} : handleConnectClick}
                        color={isConnected ? 'success' : 'primary'}
                        disabled={isConnecting}
                        style={{
                            pointerEvents: isConnected ? 'none' : 'auto',
                            cursor: isConnected ? 'default' : 'pointer',
                            opacity: isConnected ? 1 : undefined
                        }}
                    >
                        {isConnected ? 'HUBSPOT CONNECTED' : 
                         isConnecting ? <CircularProgress size={20} color="inherit" /> : 
                         'Connect to Hubspot'}
                    </Button>
                </Box>
            </Box>

            <Snackbar 
                open={!!error} 
                autoHideDuration={6000} 
                onClose={handleCloseError}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
                    {error}
                </Alert>
            </Snackbar>
        </>
    );
} 