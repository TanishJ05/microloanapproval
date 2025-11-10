import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  CloudUpload,
  Description,
  Person,
} from '@mui/icons-material';
import { loanAPI } from '../services/api';

const steps = ['Personal Information', 'Upload Statement', 'Review & Submit'];

const LoanApplication = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [personalInfo, setPersonalInfo] = useState({
    name: '',
    phone: '',
    address: '',
    employment: '',
    monthlyIncome: '',
  });

  const handlePersonalInfoChange = (e) => {
    setPersonalInfo({ ...personalInfo, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const allowedTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/webp',
      ];
      const allowedExtensions = ['.csv', '.xlsx', '.xls', '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
      const fileExt = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
      
      if (allowedTypes.includes(selectedFile.type) || allowedExtensions.includes(fileExt)) {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Please upload a CSV, Excel, PDF, or Image file (JPG, PNG, etc.)');
      }
    }
  };

  const handleFileUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await loanAPI.uploadStatement(file);
      setAnalysis(response.data.analysis);
      setActiveStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'File upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!analysis) {
      setError('Please upload and analyze your statement first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await loanAPI.checkEligibility({
        analysis,
        personalInfo,
      });
      
      // Store result in sessionStorage for result page
      sessionStorage.setItem('eligibilityResult', JSON.stringify({
        eligibility: response.data.eligibility,
        analysis,
        personalInfo,
        applicationId: response.data.applicationId,
      }));
      
      navigate('/result');
    } catch (err) {
      setError(err.response?.data?.error || 'Eligibility check failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    } else {
      navigate('/');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Loan Application
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mt: 4, mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {activeStep === 0 && (
          <Box>
            <Box display="flex" alignItems="center" mb={3}>
              <Person sx={{ mr: 2, fontSize: 32 }} />
              <Typography variant="h6">Personal Information</Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Full Name"
                  name="name"
                  value={personalInfo.name}
                  onChange={handlePersonalInfoChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  name="phone"
                  value={personalInfo.phone}
                  onChange={handlePersonalInfoChange}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  name="address"
                  value={personalInfo.address}
                  onChange={handlePersonalInfoChange}
                  multiline
                  rows={3}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Employment Status"
                  name="employment"
                  value={personalInfo.employment}
                  onChange={handlePersonalInfoChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Monthly Income (₹)"
                  name="monthlyIncome"
                  type="number"
                  value={personalInfo.monthlyIncome}
                  onChange={handlePersonalInfoChange}
                  required
                />
              </Grid>
            </Grid>
            <Box display="flex" justifyContent="space-between" mt={4}>
              <Button onClick={handleBack}>Back</Button>
              <Button variant="contained" onClick={() => setActiveStep(1)}>
                Next
              </Button>
            </Box>
          </Box>
        )}

        {activeStep === 1 && (
          <Box>
            <Box display="flex" alignItems="center" mb={3}>
              <CloudUpload sx={{ mr: 2, fontSize: 32 }} />
              <Typography variant="h6">Upload Bank Statement (CSV, Excel, PDF, or Image)</Typography>
            </Box>
            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'primary.main',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                mb: 2,
              }}
            >
              <input
                accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                style={{ display: 'none' }}
                id="file-upload"
                type="file"
                onChange={handleFileChange}
              />
              <label htmlFor="file-upload">
                <Button variant="outlined" component="span" startIcon={<CloudUpload />}>
                  Choose File
                </Button>
              </label>
              {file && (
                <Box mt={2}>
                  <Description sx={{ mr: 1 }} />
                  <Typography variant="body1">{file.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {(file.size / 1024).toFixed(2)} KB
                  </Typography>
                </Box>
              )}
            </Box>
            <Box display="flex" justifyContent="space-between" mt={4}>
              <Button onClick={handleBack}>Back</Button>
              <Button
                variant="contained"
                onClick={handleFileUpload}
                disabled={!file || loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Upload & Analyze'}
              </Button>
            </Box>
          </Box>
        )}

        {activeStep === 2 && analysis && (
          <Box>
            <Box display="flex" alignItems="center" mb={3}>
              <Description sx={{ mr: 2, fontSize: 32 }} />
              <Typography variant="h6">Transaction Summary</Typography>
            </Box>
            <Grid container spacing={2} mb={3}>
              <Grid item xs={12} sm={6}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Total Income
                    </Typography>
                    <Typography variant="h5" color="success.main">
                      {formatCurrency(analysis.totalIncome)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Total Expenses
                    </Typography>
                    <Typography variant="h5" color="error.main">
                      {formatCurrency(analysis.totalExpenses)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Total Savings
                    </Typography>
                    <Typography variant="h5" color="primary.main">
                      {formatCurrency(analysis.savings)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Monthly Savings
                    </Typography>
                    <Typography variant="h5" color="primary.main">
                      {formatCurrency(analysis.savingsPerMonth)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
            <Box display="flex" justifyContent="space-between" mt={4}>
              <Button onClick={handleBack}>Back</Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={loading}
                size="large"
              >
                {loading ? <CircularProgress size={24} /> : 'Check Eligibility'}
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default LoanApplication;

