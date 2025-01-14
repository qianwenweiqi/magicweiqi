import { useAuth } from '../context/AuthContext';
import { Button, Typography } from '@mui/material';

const Header = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div>
      {isAuthenticated ? (
        <Typography>
          Welcome, {user.username}!
        </Typography>
      ) : (
        <div>
          <Button href="/login">Login</Button>
          <Button href="/register">Register</Button>
        </div>
      )}
    </div>
  );
};

export default Header;
