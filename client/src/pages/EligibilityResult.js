import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  LinearProgress,
  Divider,
  Alert,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  ArrowBack,
  History,
  TrendingUp,
  TrendingDown,
  AccountBalance,
  Savings,
  Assessment,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

const EligibilityResult = () => {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedResult = sessionStorage.getItem('eligibilityResult');
    if (storedResult) {
      setResult(JSON.parse(storedResult));
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!result) {
    return (
      <Container maxWidth="md" sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="error" gutterBottom>
            No eligibility result found
          </Typography>
          <Button variant="contained" onClick={() => navigate('/apply')} sx={{ mt: 2 }}>
            Start New Application
          </Button>
        </Paper>
      </Container>
    );
  }

  const { eligibility, analysis, personalInfo } = result;
  const isEligible = eligibility.eligible;
  const metrics = eligibility.metrics || {};

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Prepare chart data
  const monthlyChartData = (analysis.monthlyBreakdown || []).map(item => ({
    month: new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short' }),
    Income: Math.round(item.income),
    Expenses: Math.round(item.expenses),
    Savings: Math.round(item.savings),
  }));

  // Metrics radar chart data
  const radarData = [
    {
      subject: 'Income Consistency',
      value: metrics.incomeConsistency || 0,
      fullMark: 100,
    },
    {
      subject: 'Spending Stability',
      value: metrics.spendingVolatility || 0,
      fullMark: 100,
    },
    {
      subject: 'Savings Rate',
      value: Math.min(100, (metrics.savingsRate || 0) * 5), // Scale to 0-100
      fullMark: 100,
    },
    {
      subject: 'Emergency Buffer',
      value: Math.min(100, (metrics.emergencySavingsBuffer || 0) * 10), // Scale to 0-100
      fullMark: 100,
    },
    {
      subject: 'Bill Regularity',
      value: metrics.billPaymentRegularity || 0,
      fullMark: 100,
    },
  ];

  // Risk level colors
  const getRiskColor = (level) => {
    switch (level) {
      case 'very-low': return 'success';
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      default: return 'default';
    }
  };

  // Score breakdown pie chart
  const scoreData = [
    { name: 'Score', value: eligibility.score, color: isEligible ? '#2e7d32' : '#d32f2f' },
    { name: 'Remaining', value: 100 - eligibility.score, color: '#e0e0e0' },
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header Section */}
      <Paper elevation={3} sx={{ p: 4, mb: 3 }}>
        <Box textAlign="center" mb={3}>
          {isEligible ? (
            <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          ) : (
            <Cancel sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
          )}
          <Typography variant="h3" component="h1" gutterBottom>
            {isEligible ? 'Loan Approved' : 'Loan Not Approved'}
          </Typography>
          <Box display="flex" justifyContent="center" gap={2} mt={2}>
            <Chip
              label={`Credit Score: ${eligibility.score}/100`}
              color={isEligible ? 'success' : 'error'}
              sx={{ fontSize: '1.1rem', height: 40, px: 2 }}
            />
            <Chip
              label={`Risk Level: ${eligibility.riskLevel?.toUpperCase() || 'MEDIUM'}`}
              color={getRiskColor(eligibility.riskLevel)}
              sx={{ fontSize: '1.1rem', height: 40, px: 2 }}
            />
          </Box>
        </Box>

        {isEligible && eligibility.recommendedLoanAmount > 0 && (
          <Card sx={{ bgcolor: 'primary.main', color: 'white', mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recommended Loan Amount
              </Typography>
              <Typography variant="h3">
                {formatCurrency(eligibility.recommendedLoanAmount)}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                Based on your financial profile and credit score
              </Typography>
            </CardContent>
          </Card>
        )}
      </Paper>

      {/* Core Metrics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <TrendingUp sx={{ color: 'success.main', mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Avg Monthly Income
                </Typography>
              </Box>
              <Typography variant="h5" color="success.main">
                {formatCurrency(analysis.averageMonthlyIncome)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <TrendingDown sx={{ color: 'error.main', mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Avg Monthly Expenses
                </Typography>
              </Box>
              <Typography variant="h5" color="error.main">
                {formatCurrency(analysis.averageMonthlyExpenses)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Savings sx={{ color: 'primary.main', mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Monthly Savings
                </Typography>
              </Box>
              <Typography variant="h5" color="primary.main">
                {formatCurrency(analysis.savingsPerMonth)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {analysis.savingsRate?.toFixed(1) || 0}% savings rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <AccountBalance sx={{ color: 'info.main', mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Total Savings
                </Typography>
              </Box>
              <Typography variant="h5" color="info.main">
                {formatCurrency(analysis.savings)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {metrics.emergencySavingsBuffer?.toFixed(1) || 0} months buffer
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Monthly Trend Chart */}
      {monthlyChartData.length > 0 && (
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Monthly Income vs Expenses Trend
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="Income" stroke="#2e7d32" strokeWidth={2} />
              <Line type="monotone" dataKey="Expenses" stroke="#d32f2f" strokeWidth={2} />
              <Line type="monotone" dataKey="Savings" stroke="#1976d2" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* Advanced Analytics */}
      <Grid container spacing={3} mb={3}>
        {/* Metrics Radar Chart */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Financial Health Metrics
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke="#1976d2"
                  fill="#1976d2"
                  fillOpacity={0.6}
                />
              </RadarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Score Breakdown */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Credit Score Breakdown
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={scoreData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {scoreData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Detailed Metrics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Key Financial Metrics
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Income Consistency</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {metrics.incomeConsistency?.toFixed(1) || 0}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={metrics.incomeConsistency || 0}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Spending Stability</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {metrics.spendingVolatility?.toFixed(1) || 0}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={metrics.spendingVolatility || 0}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Savings Rate</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {metrics.savingsRate?.toFixed(1) || 0}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, (metrics.savingsRate || 0) * 5)}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Emergency Buffer</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {metrics.emergencySavingsBuffer?.toFixed(1) || 0} months
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, (metrics.emergencySavingsBuffer || 0) * 10)}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Bill Payment Regularity</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {metrics.billPaymentRegularity?.toFixed(1) || 0}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={metrics.billPaymentRegularity || 0}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Account Age</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {Math.round(metrics.accountAgeMonths || 0)} months
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Analysis Summary
            </Typography>
            {eligibility.strengths && eligibility.strengths.length > 0 && (
              <Box mb={2}>
                <Typography variant="subtitle2" color="success.main" gutterBottom>
                  Strengths
                </Typography>
                <List dense>
                  {eligibility.strengths.map((strength, index) => (
                    <ListItem key={index} sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={strength}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            {eligibility.warnings && eligibility.warnings.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="error.main" gutterBottom>
                  Areas for Improvement
                </Typography>
                <List dense>
                  {eligibility.warnings.map((warning, index) => (
                    <ListItem key={index} sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={warning}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            {metrics.monthlyDebtObligations > 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Monthly Debt Obligations: {formatCurrency(metrics.monthlyDebtObligations)}
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Monthly Breakdown Bar Chart */}
      {monthlyChartData.length > 0 && (
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Monthly Financial Breakdown
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="Income" fill="#2e7d32" />
              <Bar dataKey="Expenses" fill="#d32f2f" />
              <Bar dataKey="Savings" fill="#1976d2" />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* Action Buttons */}
      <Box display="flex" justifyContent="space-between" gap={2} mt={3}>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={() => navigate('/')}
          size="large"
        >
          Back to Dashboard
        </Button>
        <Button
          variant="contained"
          startIcon={<History />}
          onClick={() => navigate('/history')}
          size="large"
        >
          View History
        </Button>
      </Box>
    </Container>
  );
};

export default EligibilityResult;
