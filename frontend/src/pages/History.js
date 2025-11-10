import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ArrowBack,
  Visibility,
} from '@mui/icons-material';
import { loanAPI } from '../services/api';

const History = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await loanAPI.getHistory();
      setApplications(response.data.applications);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch history');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewDetails = async (id) => {
    try {
      const response = await loanAPI.getApplicationDetails(id);
      sessionStorage.setItem('eligibilityResult', JSON.stringify({
        eligibility: response.data.application.eligibility,
        analysis: response.data.application.analysis,
        personalInfo: response.data.application.personalInfo,
        applicationId: response.data.application.id,
      }));
      navigate('/result');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch application details');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Application History
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={() => navigate('/')}
        >
          Back to Dashboard
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {applications.length === 0 ? (
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No applications found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Start your first loan application to see it here.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/apply')}>
            Apply for Loan
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={3}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Application ID</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Score</TableCell>
                <TableCell align="right">Recommended Amount</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {applications.map((app) => (
                <TableRow key={app.id} hover>
                  <TableCell>{app.id.substring(0, 8)}...</TableCell>
                  <TableCell>{formatDate(app.createdAt)}</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={app.status}
                      color={app.eligible ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight="bold">
                      {app.score}/100
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {app.recommendedLoanAmount > 0
                      ? formatCurrency(app.recommendedLoanAmount)
                      : '-'}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Visibility />}
                      onClick={() => handleViewDetails(app.id)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
};

export default History;

