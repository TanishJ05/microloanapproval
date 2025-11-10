import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import {
  AccountBalance,
  Assessment,
  History,
} from '@mui/icons-material';
import { clearAuth, getUser } from '../utils/auth';

const Dashboard = () => {
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Welcome, {user?.name || 'User'}!
        </Typography>
        <Button variant="outlined" color="error" onClick={handleLogout}>
          Logout
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <AccountBalance sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h5" component="h2" gutterBottom>
                Apply for Loan
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upload your bank statement and check your loan eligibility instantly.
              </Typography>
            </CardContent>
            <CardActions>
              <Button
                size="large"
                variant="contained"
                fullWidth
                onClick={() => navigate('/apply')}
              >
                Start Application
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <History sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h5" component="h2" gutterBottom>
                Application History
              </Typography>
              <Typography variant="body2" color="text.secondary">
                View your previous loan applications and their status.
              </Typography>
            </CardContent>
            <CardActions>
              <Button
                size="large"
                variant="outlined"
                fullWidth
                onClick={() => navigate('/history')}
              >
                View History
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Assessment sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h5" component="h2" gutterBottom>
                How It Works
              </Typography>
              <Typography variant="body2" color="text.secondary">
                1. Upload your bank statement (CSV/Excel)
                <br />
                2. We analyze your transactions
                <br />
                3. Get instant eligibility results
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;

