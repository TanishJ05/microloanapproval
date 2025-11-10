# Micro Loan Approval System

A basic Gen AI micro loan approval project with a focus on frontend, built with MERN stack. The system allows users to upload bank transaction statements (CSV/Excel) and get instant loan eligibility results based on simple rule-based analysis.

## Features

### Frontend (React + Material UI)
- User authentication (Register/Login)
- Loan application form with personal information
- File upload for bank statements (CSV/Excel)
- Transaction analysis and summary display
- Eligibility check with visual results
- Application history tracking
- Responsive design (mobile/desktop)

### Backend (Node.js + Express)
- RESTful API endpoints
- File upload and parsing (CSV/Excel)
- Simple rule-based eligibility logic
- JWT authentication
- In-memory data storage (can be replaced with MongoDB)

## Eligibility Rules

The system uses simple hardcoded rules:
- **Eligible if:**
  - Monthly savings > ₹10,000
  - Total income > Total expenses
- **Loan Amount:** Recommended amount is calculated as 3x monthly savings (max ₹100,000)

## Project Structure

```
micro-loan-app/
├── backend/
│   ├── server.js          # Express server
│   ├── package.json       # Backend dependencies
│   └── uploads/           # Temporary file storage
├── frontend/
│   ├── src/
│   │   ├── pages/         # React pages
│   │   ├── services/      # API services
│   │   └── utils/         # Utility functions
│   └── package.json       # Frontend dependencies
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

The backend server will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The frontend will run on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/register` - Register a new user
- `POST /api/login` - Login user

### Loan Application
- `POST /api/upload` - Upload bank statement (CSV/Excel)
- `POST /api/check-eligibility` - Check loan eligibility
- `GET /api/history` - Get application history
- `GET /api/history/:id` - Get application details

## Usage

1. **Register/Login**: Create an account or login with existing credentials
2. **Apply for Loan**: Fill in personal information and upload your bank statement
3. **View Results**: See eligibility status, score, and recommended loan amount
4. **Check History**: View all your previous applications

## Bank Statement Format

The system can parse CSV and Excel files. The parser looks for common column names:
- **Amount columns**: `amount`, `transaction_amount`, `amount_inr`, `value`, `balance`
- **Type columns**: `type`, `transaction_type`, `category`, `description`
- **Date columns**: `date`, `transaction_date`, `date_time`

Positive amounts are treated as income, negative amounts as expenses.

## Technologies Used

- **Frontend**: React, Material UI, React Router, Axios
- **Backend**: Node.js, Express, Multer, XLSX, CSV-Parser, JWT, Bcrypt
- **Authentication**: JWT tokens
- **File Processing**: Multer (upload), XLSX (Excel), CSV-Parser (CSV)

## Notes

- This is a basic implementation with in-memory storage
- For production, replace in-memory storage with MongoDB or another database
- File uploads are temporarily stored and deleted after processing
- The eligibility logic is hardcoded and can be replaced with ML models

## License

MIT

