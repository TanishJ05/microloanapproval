const express = require('express');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
// Handle CORS for all origins in development
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Allow all localhost origins in development
  if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (origin) {
    // For other origins, allow but without credentials
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // No origin header (like direct API calls)
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory storage (replace with MongoDB in production)
let users = [];
let applications = [];

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls', '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed. Only CSV, Excel, PDF, and Image files (JPG, PNG, etc.) are allowed`));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Helper function to parse CSV
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv({
        skipEmptyLines: true,
        skipLinesWithError: true,
        mapHeaders: ({ header }) => header.trim() // Trim whitespace from headers
      }))
      .on('data', (data) => {
        // Only add rows that have at least one non-empty value
        const hasData = Object.values(data).some(val => val && String(val).trim().length > 0);
        if (hasData) {
          results.push(data);
        }
      })
      .on('end', () => {
        if (results.length === 0) {
          reject(new Error('CSV file appears to be empty or has no valid data rows'));
        } else {
          resolve(results);
        }
      })
      .on('error', reject);
  });
}

// Helper function to parse Excel
function parseExcel(filePath) {
  const workbook = xlsx.readFile(filePath);
  if (workbook.SheetNames.length === 0) {
    throw new Error('Excel file has no sheets');
  }
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, {
    defval: '', // Default value for empty cells
    raw: false // Convert all values to strings
  });
  
  // Filter out completely empty rows
  const filteredData = data.filter(row => {
    return Object.values(row).some(val => val && String(val).trim().length > 0);
  });
  
  if (filteredData.length === 0) {
    throw new Error('Excel file appears to be empty or has no valid data rows');
  }
  
  return filteredData;
}

// Helper function to parse PDF
async function parsePDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    const text = data.text;
    
    // Split text into lines
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    const transactions = [];
    const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
    const amountPattern = /([+-]?[\d,]+\.?\d*)/g;
    
    // Try to extract transaction data from PDF text
    // This is a basic parser - can be enhanced based on specific bank statement formats
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip header lines and empty lines
      if (line.toLowerCase().includes('date') || 
          line.toLowerCase().includes('description') ||
          line.toLowerCase().includes('amount') ||
          line.toLowerCase().includes('balance') ||
          line.length < 5) {
        continue;
      }
      
      // Try to find date in the line
      const dateMatch = line.match(datePattern);
      const date = dateMatch ? dateMatch[1] : '';
      
      // Try to find amounts in the line
      const amounts = line.match(amountPattern);
      
      if (amounts && amounts.length > 0) {
        // Usually the last number is the amount or balance
        const amountStr = amounts[amounts.length - 1].replace(/,/g, '');
        const amount = parseFloat(amountStr);
        
        if (!isNaN(amount) && Math.abs(amount) > 0 && Math.abs(amount) < 10000000) {
          // Extract description (text before the amount)
          let description = line;
          if (dateMatch) {
            description = line.replace(dateMatch[0], '').trim();
          }
          // Remove amount from description
          amounts.forEach(amt => {
            description = description.replace(amt, '').trim();
          });
          description = description.replace(/\s+/g, ' ').trim();
          
          if (description.length > 0) {
            transactions.push({
              date: date || 'N/A',
              description: description || 'Transaction',
              amount: amount,
              type: amount > 0 ? 'credit' : 'debit'
            });
          }
        }
      }
    }
    
    // If we didn't find structured data, try a different approach
    // Look for common patterns in bank statements
    if (transactions.length === 0) {
      // Try to find table-like structures
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
        
        // Look for lines with dates and amounts
        if (datePattern.test(line)) {
          const amounts = line.match(amountPattern);
          if (amounts && amounts.length > 0) {
            const amount = parseFloat(amounts[amounts.length - 1].replace(/,/g, ''));
            if (!isNaN(amount) && Math.abs(amount) > 0) {
              transactions.push({
                date: line.match(datePattern)[1],
                description: line.replace(datePattern, '').replace(amountPattern, '').trim() || 'Transaction',
                amount: amount,
                type: amount > 0 ? 'credit' : 'debit'
              });
            }
          }
        }
      }
    }
    
    // Convert to format expected by analyzeTransactions
    return transactions.map(t => ({
      date: t.date,
      description: t.description,
      amount: t.amount.toString(),
      type: t.type
    }));
    
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

// Helper function to parse images using OCR
async function parseImage(filePath) {
  try {
    const worker = await createWorker('eng');
    
    // Perform OCR on the image
    const { data: { text } } = await worker.recognize(filePath);
    await worker.terminate();
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text could be extracted from the image. Please ensure the image is clear and contains readable text.');
    }
    
    // Split text into lines
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    const transactions = [];
    const datePattern = /(\d{1,2}[\/\-]\d{1,2})/; // Match dates like 10/02, 11/09
    const amountPattern = /([\d,]+\.?\d*)/g;
    
    // Find header row to identify column positions
    let headerIndex = -1;
    let hasDebitColumn = false;
    let hasCreditColumn = false;
    
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('debit') && line.includes('credit')) {
        headerIndex = i;
        hasDebitColumn = true;
        hasCreditColumn = true;
        break;
      } else if (line.includes('debit')) {
        hasDebitColumn = true;
      } else if (line.includes('credit')) {
        hasCreditColumn = true;
      }
    }
    
    // Parse transaction rows
    for (let i = (headerIndex >= 0 ? headerIndex + 1 : 0); i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip header-like lines
      if (line.toLowerCase().includes('date') && 
          (line.toLowerCase().includes('description') || line.toLowerCase().includes('debit') || line.toLowerCase().includes('credit'))) {
        continue;
      }
      
      // Skip lines that are too short or don't have a date
      if (!datePattern.test(line) || line.length < 10) {
        continue;
      }
      
      // Extract date
      const dateMatch = line.match(datePattern);
      if (!dateMatch) continue;
      const date = dateMatch[1];
      
      // Extract all amounts from the line
      const amounts = line.match(amountPattern);
      if (!amounts || amounts.length === 0) continue;
      
      // Clean amounts (remove commas, convert to numbers)
      const cleanAmounts = amounts.map(amt => parseFloat(amt.replace(/,/g, ''))).filter(amt => !isNaN(amt) && amt > 0);
      
      if (cleanAmounts.length === 0) continue;
      
      // Extract description (text between date and amounts)
      let description = line;
      description = description.replace(dateMatch[0], '').trim();
      // Remove all amounts from description
      amounts.forEach(amt => {
        description = description.replace(amt, '').trim();
      });
      description = description.replace(/\s+/g, ' ').trim();
      
      // Determine if this is a debit or credit transaction
      // Strategy: If we have debit/credit columns, amounts before the last are likely debit/credit
      // The last amount is usually the balance
      let debitAmount = 0;
      let creditAmount = 0;
      
      if (hasDebitColumn && hasCreditColumn && cleanAmounts.length >= 2) {
        // If we have both columns, try to identify which is which
        // Usually: Date | Description | Debit | Credit | Balance
        // So if we have 3+ amounts: [debit, credit, balance] or [amount1, amount2, balance]
        if (cleanAmounts.length >= 3) {
          // Assume second-to-last is credit, third-to-last is debit, last is balance
          debitAmount = cleanAmounts[cleanAmounts.length - 3] || 0;
          creditAmount = cleanAmounts[cleanAmounts.length - 2] || 0;
        } else if (cleanAmounts.length === 2) {
          // Two amounts: could be [debit, balance] or [credit, balance] or [debit, credit]
          // Check description for hints
          const descLower = description.toLowerCase();
          if (descLower.includes('purchase') || descLower.includes('check') || descLower.includes('withdrawal') || descLower.includes('charge')) {
            debitAmount = cleanAmounts[0];
          } else if (descLower.includes('credit') || descLower.includes('deposit') || descLower.includes('interest')) {
            creditAmount = cleanAmounts[0];
          } else {
            // Default: first is debit, second is balance
            debitAmount = cleanAmounts[0];
          }
        }
      } else {
        // No clear debit/credit columns - use heuristics based on description
        const descLower = description.toLowerCase();
        const amount = cleanAmounts[0];
        
        if (descLower.includes('purchase') || descLower.includes('check') || 
            descLower.includes('withdrawal') || descLower.includes('charge') ||
            descLower.includes('debit') || descLower.includes('payment')) {
          debitAmount = amount;
        } else if (descLower.includes('credit') || descLower.includes('deposit') || 
                   descLower.includes('interest') || descLower.includes('salary') ||
                   descLower.includes('income')) {
          creditAmount = amount;
        } else {
          // Default: assume it's a debit (expense) if we can't determine
          debitAmount = amount;
        }
      }
      
      // Create transaction entries
      if (debitAmount > 0) {
        transactions.push({
          date: date || 'N/A',
          description: description || 'Transaction',
          amount: debitAmount.toString(),
          type: 'debit'
        });
      }
      
      if (creditAmount > 0) {
        transactions.push({
          date: date || 'N/A',
          description: description || 'Transaction',
          amount: creditAmount.toString(),
          type: 'credit'
        });
      }
    }
    
    // If we didn't find structured data, try a simpler approach
    if (transactions.length === 0) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!datePattern.test(line)) continue;
        
        const amounts = line.match(amountPattern);
        if (!amounts || amounts.length === 0) continue;
        
        const amount = parseFloat(amounts[0].replace(/,/g, ''));
        if (isNaN(amount) || amount <= 0) continue;
        
        const descLower = line.toLowerCase();
        const isCredit = descLower.includes('credit') || descLower.includes('deposit') || 
                        descLower.includes('interest') || descLower.includes('salary');
        const isDebit = descLower.includes('purchase') || descLower.includes('check') || 
                       descLower.includes('withdrawal') || descLower.includes('charge');
        
        transactions.push({
          date: line.match(datePattern)[1],
          description: line.replace(datePattern, '').replace(amountPattern, '').trim() || 'Transaction',
          amount: amount.toString(),
          type: isCredit ? 'credit' : (isDebit ? 'debit' : 'debit') // Default to debit
        });
      }
    }
    
    console.log(`Parsed ${transactions.length} transactions from image`);
    console.log(`Debits: ${transactions.filter(t => t.type === 'debit').length}, Credits: ${transactions.filter(t => t.type === 'credit').length}`);
    
    // Convert to format expected by analyzeTransactions
    return transactions.map(t => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.type
    }));
    
  } catch (error) {
    throw new Error(`Failed to parse image: ${error.message}`);
  }
}

// Helper function to analyze transactions
function analyzeTransactions(data) {
  let totalIncome = 0;
  let totalExpenses = 0;
  const transactions = [];

  // Common column names for income/expense detection (expanded list)
  const amountColumns = [
    'amount', 'transaction_amount', 'amount_inr', 'value', 'balance',
    'credit', 'debit', 'deposit', 'withdrawal', 'transaction value',
    'amt', 'amount (inr)', 'transaction amount', 'balance amount'
  ];
  const typeColumns = [
    'type', 'transaction_type', 'category', 'description', 'narration',
    'particulars', 'details', 'transaction description', 'remarks'
  ];
  const dateColumns = [
    'date', 'transaction_date', 'date_time', 'value date',
    'transaction date', 'date of transaction', 'posting date'
  ];

  // Log first row to help debug
  if (data.length > 0) {
    console.log('Sample row keys:', Object.keys(data[0]));
  }

  data.forEach((row, index) => {
    let amount = 0;
    let type = '';
    let date = '';
    let description = '';

    // Find amount column (case-insensitive search)
    for (const col of amountColumns) {
      const keys = Object.keys(row);
      const matchingKey = keys.find(k => k.toLowerCase().trim() === col.toLowerCase().trim());
      if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null && row[matchingKey] !== '') {
        amount = parseFloat(String(row[matchingKey]).replace(/,/g, '')) || 0;
        if (amount !== 0) break;
      }
    }

    // Find type column (case-insensitive search)
    for (const col of typeColumns) {
      const keys = Object.keys(row);
      const matchingKey = keys.find(k => k.toLowerCase().trim() === col.toLowerCase().trim());
      if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null && row[matchingKey] !== '') {
        type = String(row[matchingKey]).toLowerCase();
        description = String(row[matchingKey]); // Use as description too
        break;
      }
    }

    // Find date column (case-insensitive search)
    for (const col of dateColumns) {
      const keys = Object.keys(row);
      const matchingKey = keys.find(k => k.toLowerCase().trim() === col.toLowerCase().trim());
      if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null && row[matchingKey] !== '') {
        date = String(row[matchingKey]);
        break;
      }
    }
    
    // If no description found, try to get it from description column
    if (!description) {
      const descKeys = Object.keys(row).filter(k => 
        k.toLowerCase().includes('description') || 
        k.toLowerCase().includes('narration') ||
        k.toLowerCase().includes('particulars')
      );
      if (descKeys.length > 0) {
        description = String(row[descKeys[0]] || '');
      }
    }

    // If no amount found, try to find any numeric column (excluding row numbers)
    if (amount === 0) {
      for (const key in row) {
        // Skip non-numeric looking columns
        if (key.toLowerCase().includes('date') || key.toLowerCase().includes('id') || key.toLowerCase().includes('no')) {
          continue;
        }
        const value = parseFloat(String(row[key]).replace(/,/g, ''));
        if (!isNaN(value) && Math.abs(value) > 0 && Math.abs(value) < 100000000) {
          amount = value;
          break;
        }
      }
    }

    // Handle format where type might be 'credit' or 'debit'
    // Credits = Income (money coming in)
    // Debits = Expenses (money going out)
    if (row.type === 'credit' || row.type === 'debit') {
      if (row.type === 'credit') {
        // Credit is income - add to totalIncome
        totalIncome += Math.abs(amount);
        transactions.push({
          amount: Math.abs(amount),
          type: 'income',
          description: type || description || 'Transaction',
          date: date || 'N/A'
        });
        return; // Skip the rest of the logic for this row
      } else if (row.type === 'debit') {
        // Debit is expense - add to totalExpenses
        totalExpenses += Math.abs(amount);
        transactions.push({
          amount: Math.abs(amount),
          type: 'expense',
          description: type || description || 'Transaction',
          date: date || 'N/A'
        });
        return; // Skip the rest of the logic for this row
      }
    }

    // For other formats, determine if income or expense
    // Positive amounts are typically income, negative are expenses
    // But we need to be careful - check description for hints
    const descLower = (type || description || '').toLowerCase();
    const isExpense = descLower.includes('purchase') || descLower.includes('check') || 
                     descLower.includes('withdrawal') || descLower.includes('charge') ||
                     descLower.includes('debit') || descLower.includes('payment') ||
                     descLower.includes('fee');
    const isIncome = descLower.includes('credit') || descLower.includes('deposit') || 
                    descLower.includes('interest') || descLower.includes('salary') ||
                    descLower.includes('income') || descLower.includes('preauthorized');
    
    if (isExpense) {
      totalExpenses += Math.abs(amount);
      transactions.push({
        amount: Math.abs(amount),
        type: 'expense',
        description: type || description || 'Transaction',
        date: date || 'N/A'
      });
    } else if (isIncome || amount > 0) {
      totalIncome += Math.abs(amount);
      transactions.push({
        amount: Math.abs(amount),
        type: 'income',
        description: type || description || 'Transaction',
        date: date || 'N/A'
      });
    } else {
      // Default: negative = expense, positive = income
      if (amount < 0) {
        totalExpenses += Math.abs(amount);
        transactions.push({
          amount: Math.abs(amount),
          type: 'expense',
          description: type || description || 'Transaction',
          date: date || 'N/A'
        });
      } else {
        totalIncome += amount;
        transactions.push({
          amount: Math.abs(amount),
          type: 'income',
          description: type || description || 'Transaction',
          date: date || 'N/A'
        });
      }
    }
  });

  const savings = totalIncome - totalExpenses;
  
  // Calculate time-based metrics
  const dateRange = transactions
    .map(t => new Date(t.date))
    .filter(d => !isNaN(d.getTime()));
  
  const minDate = dateRange.length > 0 ? new Date(Math.min(...dateRange.map(d => d.getTime()))) : new Date();
  const maxDate = dateRange.length > 0 ? new Date(Math.max(...dateRange.map(d => d.getTime()))) : new Date();
  const daysDiff = Math.max(1, Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)));
  const monthsDiff = Math.max(1, daysDiff / 30);
  
  const averageMonthlyIncome = totalIncome / monthsDiff;
  const averageMonthlyExpenses = totalExpenses / monthsDiff;
  const savingsPerMonth = averageMonthlyIncome - averageMonthlyExpenses;
  const savingsRate = averageMonthlyIncome > 0 ? (savingsPerMonth / averageMonthlyIncome) * 100 : 0;
  
  // Group transactions by month for pattern analysis
  const monthlyData = {};
  transactions.forEach(t => {
    try {
      const date = new Date(t.date);
      if (!isNaN(date.getTime())) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { income: 0, expenses: 0, count: 0 };
        }
        if (t.type === 'income') {
          monthlyData[monthKey].income += t.amount;
        } else {
          monthlyData[monthKey].expenses += t.amount;
        }
        monthlyData[monthKey].count++;
      }
    } catch (e) {
      // Skip invalid dates
    }
  });
  
  // Income consistency analysis
  const incomeMonths = Object.values(monthlyData).map(m => m.income).filter(i => i > 0);
  const incomeConsistency = incomeMonths.length > 0 
    ? (1 - (calculateStandardDeviation(incomeMonths) / (calculateMean(incomeMonths) || 1))) * 100
    : 0;
  const incomeConsistencyScore = Math.max(0, Math.min(100, incomeConsistency));
  
  // Spending volatility
  const expenseMonths = Object.values(monthlyData).map(m => m.expenses).filter(e => e > 0);
  const spendingVolatility = expenseMonths.length > 0
    ? (calculateStandardDeviation(expenseMonths) / (calculateMean(expenseMonths) || 1)) * 100
    : 0;
  const spendingVolatilityScore = Math.max(0, Math.min(100, 100 - spendingVolatility)); // Lower volatility = higher score
  
  // Emergency savings buffer (months of expenses covered)
  const emergencySavingsBuffer = averageMonthlyExpenses > 0 
    ? (savings / averageMonthlyExpenses) 
    : 0;
  
  // Bill payment regularity (look for recurring transactions)
  const recurringPatterns = detectRecurringPayments(transactions);
  const billPaymentRegularity = recurringPatterns.length > 0 ? 100 : 50;
  
  // Account age (based on transaction date range)
  const accountAgeMonths = monthsDiff;
  
  // Debt obligations (look for loan payments, credit card payments, etc.)
  const debtKeywords = ['loan', 'emi', 'credit card', 'debt', 'repayment', 'installment'];
  const debtTransactions = transactions.filter(t => 
    debtKeywords.some(keyword => t.description.toLowerCase().includes(keyword))
  );
  const totalDebtObligations = debtTransactions.reduce((sum, t) => sum + t.amount, 0);
  const monthlyDebtObligations = totalDebtObligations / monthsDiff;
  
  // Monthly breakdown for charts
  const monthlyBreakdown = Object.keys(monthlyData)
    .sort()
    .map(month => ({
      month,
      income: monthlyData[month].income,
      expenses: monthlyData[month].expenses,
      savings: monthlyData[month].income - monthlyData[month].expenses
    }));
  
  return {
    totalIncome,
    totalExpenses,
    savings,
    averageMonthlyIncome,
    averageMonthlyExpenses,
    savingsPerMonth,
    savingsRate,
    transactionCount: transactions.length,
    transactions: transactions.slice(0, 50), // Return more for analysis
    
    // Advanced metrics
    incomeConsistency: incomeConsistencyScore,
    spendingVolatility: spendingVolatilityScore,
    emergencySavingsBuffer,
    billPaymentRegularity,
    accountAgeMonths,
    monthlyDebtObligations,
    totalDebtObligations,
    
    // Chart data
    monthlyBreakdown,
    dateRange: {
      start: minDate.toISOString(),
      end: maxDate.toISOString(),
      days: daysDiff
    }
  };
}

// Helper function to calculate mean
function calculateMean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

// Helper function to calculate standard deviation
function calculateStandardDeviation(values) {
  if (values.length === 0) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const avgSquaredDiff = calculateMean(squaredDiffs);
  return Math.sqrt(avgSquaredDiff);
}

// Helper function to detect recurring payments
function detectRecurringPayments(transactions) {
  const patterns = {};
  transactions.forEach(t => {
    const desc = t.description.toLowerCase();
    const amount = t.amount;
    const key = `${desc}_${Math.round(amount)}`;
    
    if (!patterns[key]) {
      patterns[key] = { description: t.description, amount, count: 0, dates: [] };
    }
    patterns[key].count++;
    if (t.date) patterns[key].dates.push(t.date);
  });
  
  // Return patterns that appear 2+ times (likely recurring)
  return Object.values(patterns).filter(p => p.count >= 2);
}

// Helper function to check eligibility with advanced scoring
function checkEligibility(analysis) {
  const threshold = 10000; // ₹10,000 threshold
  let score = 0;
  const reasons = [];
  const warnings = [];
  const strengths = [];
  
  // 1. Income vs Expenses (30 points)
  if (analysis.totalIncome > analysis.totalExpenses) {
    score += 30;
    strengths.push('Income exceeds expenses');
    const ratio = (analysis.totalExpenses / analysis.totalIncome) * 100;
    if (ratio < 70) {
      score += 5;
      strengths.push('Low expense-to-income ratio');
    } else if (ratio > 90) {
      warnings.push('High expense-to-income ratio');
    }
  } else {
    warnings.push('Expenses exceed income');
  }
  
  // 2. Monthly Savings (25 points)
  if (analysis.savingsPerMonth > threshold) {
    score += 25;
    strengths.push(`Monthly savings (₹${analysis.savingsPerMonth.toFixed(2)}) exceeds threshold`);
  } else if (analysis.savingsPerMonth > 0) {
    score += 10;
    warnings.push(`Monthly savings (₹${analysis.savingsPerMonth.toFixed(2)}) below threshold`);
  } else {
    warnings.push('Negative monthly savings');
  }
  
  // 3. Savings Rate (15 points)
  if (analysis.savingsRate >= 20) {
    score += 15;
    strengths.push(`High savings rate (${analysis.savingsRate.toFixed(1)}%)`);
  } else if (analysis.savingsRate >= 10) {
    score += 10;
    strengths.push(`Moderate savings rate (${analysis.savingsRate.toFixed(1)}%)`);
  } else if (analysis.savingsRate > 0) {
    score += 5;
    warnings.push(`Low savings rate (${analysis.savingsRate.toFixed(1)}%)`);
  }
  
  // 4. Income Consistency (10 points)
  if (analysis.incomeConsistency >= 80) {
    score += 10;
    strengths.push('Very consistent income pattern');
  } else if (analysis.incomeConsistency >= 60) {
    score += 7;
    strengths.push('Moderately consistent income');
  } else if (analysis.incomeConsistency >= 40) {
    score += 4;
    warnings.push('Irregular income pattern');
  } else {
    warnings.push('Highly irregular income');
  }
  
  // 5. Spending Volatility (10 points)
  if (analysis.spendingVolatility >= 80) {
    score += 10;
    strengths.push('Stable spending patterns');
  } else if (analysis.spendingVolatility >= 60) {
    score += 7;
    strengths.push('Moderately stable spending');
  } else {
    warnings.push('High spending volatility');
  }
  
  // 6. Emergency Savings Buffer (10 points)
  if (analysis.emergencySavingsBuffer >= 6) {
    score += 10;
    strengths.push(`Strong emergency buffer (${analysis.emergencySavingsBuffer.toFixed(1)} months)`);
  } else if (analysis.emergencySavingsBuffer >= 3) {
    score += 7;
    strengths.push(`Adequate emergency buffer (${analysis.emergencySavingsBuffer.toFixed(1)} months)`);
  } else if (analysis.emergencySavingsBuffer > 0) {
    score += 4;
    warnings.push(`Low emergency buffer (${analysis.emergencySavingsBuffer.toFixed(1)} months)`);
  } else {
    warnings.push('No emergency savings buffer');
  }
  
  // 7. Bill Payment Regularity (5 points)
  if (analysis.billPaymentRegularity >= 80) {
    score += 5;
    strengths.push('Regular bill payments detected');
  } else {
    score += 2;
  }
  
  // 8. Account Age (5 points)
  if (analysis.accountAgeMonths >= 12) {
    score += 5;
    strengths.push(`Long account history (${Math.round(analysis.accountAgeMonths)} months)`);
  } else if (analysis.accountAgeMonths >= 6) {
    score += 3;
    strengths.push(`Moderate account history (${Math.round(analysis.accountAgeMonths)} months)`);
  } else {
    warnings.push(`Short account history (${Math.round(analysis.accountAgeMonths)} months)`);
  }
  
  // 9. Debt Obligations (penalty)
  if (analysis.monthlyDebtObligations > 0) {
    const debtRatio = (analysis.monthlyDebtObligations / analysis.averageMonthlyIncome) * 100;
    if (debtRatio > 40) {
      score -= 15;
      warnings.push(`High debt obligations (${debtRatio.toFixed(1)}% of income)`);
    } else if (debtRatio > 20) {
      score -= 8;
      warnings.push(`Moderate debt obligations (${debtRatio.toFixed(1)}% of income)`);
    } else {
      strengths.push(`Low debt obligations (${debtRatio.toFixed(1)}% of income)`);
    }
  }
  
  // Final score adjustment
  score = Math.max(0, Math.min(100, score));
  
  // Eligibility determination
  const eligible = score >= 60 && 
                   analysis.savingsPerMonth > threshold && 
                   analysis.totalIncome > analysis.totalExpenses &&
                   analysis.savingsRate > 5;
  
  // Calculate recommended loan amount
  const baseAmount = analysis.savingsPerMonth * 3;
  const scoreMultiplier = score / 100;
  const recommendedAmount = Math.min(baseAmount * scoreMultiplier, 100000);
  const maxLoanAmount = Math.max(recommendedAmount, 0);
  
  // Risk level
  let riskLevel = 'low';
  if (score < 40) riskLevel = 'high';
  else if (score < 60) riskLevel = 'medium';
  else if (score < 80) riskLevel = 'low';
  else riskLevel = 'very-low';
  
  return {
    eligible,
    score: Math.round(score),
    riskLevel,
    reasons: eligible ? strengths : warnings.length > 0 ? warnings : ['Insufficient criteria met'],
    strengths,
    warnings,
    recommendedLoanAmount: eligible ? Math.round(recommendedAmount) : 0,
    maxLoanAmount: Math.round(maxLoanAmount),
    metrics: {
      savingsRate: analysis.savingsRate,
      incomeConsistency: analysis.incomeConsistency,
      spendingVolatility: analysis.spendingVolatility,
      emergencySavingsBuffer: analysis.emergencySavingsBuffer,
      billPaymentRegularity: analysis.billPaymentRegularity,
      accountAgeMonths: analysis.accountAgeMonths,
      monthlyDebtObligations: analysis.monthlyDebtObligations
    }
  };
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Routes

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user exists
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      name: name || email
    };

    users.push(user);

    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload and analyze statement
app.post('/api/upload', authenticateToken, (req, res, next) => {
  upload.single('statement')(req, res, (err) => {
    if (err) {
      // Handle multer errors
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size too large. Maximum size is 10MB' });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please select a file.' });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    let data = [];

    // Parse file based on extension
    let parseError = null;
    try {
      if (fileExt === '.csv') {
        data = await parseCSV(filePath);
      } else if (fileExt === '.xlsx' || fileExt === '.xls') {
        data = await parseExcel(filePath);
      } else if (fileExt === '.pdf') {
        data = await parsePDF(filePath);
      } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(fileExt)) {
        // Image files - use OCR
        data = await parseImage(filePath);
      } else {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: `Unsupported file format: ${fileExt}` });
      }
    } catch (parseErr) {
      parseError = parseErr.message;
      console.error('Parse error:', parseErr);
    }

    if (data.length === 0) {
      fs.unlinkSync(filePath);
      const errorMsg = parseError 
        ? `Failed to parse file: ${parseError}` 
        : 'File is empty or could not be parsed. Please ensure the file contains transaction data with columns like: date, amount, description, or transaction_type.';
      return res.status(400).json({ error: errorMsg });
    }

    console.log(`Parsed ${data.length} rows from ${fileExt} file`);

    // Analyze transactions
    const analysis = analyzeTransactions(data);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      message: 'File uploaded and analyzed successfully',
      analysis
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to process file' });
  }
});

// Check eligibility
app.post('/api/check-eligibility', authenticateToken, (req, res) => {
  try {
    const { analysis, personalInfo } = req.body;

    if (!analysis) {
      return res.status(400).json({ error: 'Analysis data is required' });
    }

    // Check eligibility
    const eligibility = checkEligibility(analysis);

    // Save application
    const application = {
      id: Date.now().toString(),
      userId: req.user.id,
      personalInfo: personalInfo || {},
      analysis,
      eligibility,
      status: eligibility.eligible ? 'approved' : 'rejected',
      createdAt: new Date().toISOString()
    };

    applications.push(application);

    res.json({
      message: 'Eligibility checked successfully',
      eligibility,
      applicationId: application.id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get application history
app.get('/api/history', authenticateToken, (req, res) => {
  try {
    const userApplications = applications
      .filter(app => app.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(app => ({
        id: app.id,
        status: app.status,
        score: app.eligibility.score,
        eligible: app.eligibility.eligible,
        recommendedLoanAmount: app.eligibility.recommendedLoanAmount,
        createdAt: app.createdAt
      }));

    res.json({
      applications: userApplications
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get application details
app.get('/api/history/:id', authenticateToken, (req, res) => {
  try {
    const application = applications.find(
      app => app.id === req.params.id && app.userId === req.user.id
    );

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ application });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


