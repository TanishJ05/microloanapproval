# Quick Setup Guide

## Step 1: Install Backend Dependencies

```bash
cd backend
npm install
```

## Step 2: Start Backend Server

```bash
npm start
```

The backend will run on `http://localhost:5000`

## Step 3: Install Frontend Dependencies (in a new terminal)

```bash
cd frontend
npm install
```

## Step 4: Start Frontend Development Server

```bash
npm start
```

The frontend will automatically open in your browser at `http://localhost:3000`

## Testing the Application

1. **Register a new account** at `/register`
2. **Login** with your credentials
3. **Click "Start Application"** on the dashboard
4. **Fill in personal information** (Step 1)
5. **Upload a bank statement** (Step 2)
   - You can use the sample CSV file: `backend/sample-statement.csv`
   - Or create your own CSV/Excel file with transaction data
6. **Review the transaction summary** (Step 3)
7. **Click "Check Eligibility"** to see results

## Sample CSV Format

The system expects CSV files with columns like:
- `date` or `transaction_date`
- `amount` or `transaction_amount`
- `description` or `type`

Positive amounts = Income
Negative amounts = Expenses

See `backend/sample-statement.csv` for an example.

## Troubleshooting

- **Backend not starting**: Make sure port 5000 is not in use
- **Frontend not connecting**: Check that backend is running on port 5000
- **File upload fails**: Ensure file is CSV or Excel format
- **Authentication errors**: Clear browser localStorage and try again

