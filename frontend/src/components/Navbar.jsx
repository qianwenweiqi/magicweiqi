import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated, login, logout } from '../authUtils';

function Navbar() {
    const navigate = useNavigate();

    const handleLogin = async () => {
        const username = prompt('Enter your username:');
        const password = prompt('Enter your password:');
        try {
            await login(username, password);
            alert('Login successful!');
            navigate('/profile');
        } catch (error) {
            alert(`Login failed: ${error.message}`);
        }
    };

    const handleLogout = () => {
        logout();
        alert('Logged out successfully!');
        navigate('/');
    };

    return (
        <AppBar position="static">
            <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1, cursor: 'pointer' }} onClick={() => navigate('/')}>
                    Magic Weiqi
                </Typography>
                {isAuthenticated() ? (
                    <Box>
                        <Button color="inherit" onClick={() => navigate('/game/sample')}>Game</Button>
                        <Button color="inherit" onClick={() => navigate('/profile')}>Profile</Button>
                        <Button color="inherit" onClick={handleLogout}>Logout</Button>
                    </Box>
                ) : (
                    <Box>
                        <Button color="inherit" onClick={handleLogin}>Login</Button>
                        <Button color="inherit" onClick={() => navigate('/register')}>Register</Button>
                    </Box>
                )}
            </Toolbar>
        </AppBar>
    );
}

export default Navbar;
