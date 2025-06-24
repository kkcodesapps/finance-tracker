# Finance Tracker with Trading Journal

A comprehensive personal finance management application built with React, TypeScript, Tailwind CSS, and Supabase. This app combines traditional finance tracking with a dedicated trading journal for crypto and stock trading.

## Features

### 🏦 Finance Tracker

- **CSV Import**: Import transactions from bank statements and financial institutions
- **PDF Import**: Extract transactions from PDF bank statements (supports various formats including Amazon statements)
- **Transaction Management**: View, search, and filter all your transactions
- **Spending Analytics**: Visual charts showing monthly and weekly spending patterns
- **Subscription Tracking**: Automatically identify and track recurring subscriptions
- **Recurring Expenses Analysis**: Analyze spending patterns and identify potential savings
- **Monthly Details**: Drill down into specific months for detailed spending analysis

### 📈 Trading Journal

- **Manual Trade Entry**: Record buy/sell trades with detailed information
- **P&L Tracking**: Track profit and loss for each trade
- **Equity Curve**: Visual representation of your trading performance over time
- **Performance Metrics**: Win rate, total P&L, fees tracking, and more
- **Trade History**: Complete searchable history of all trades
- **Multi-Asset Support**: Trade any symbol (stocks, crypto, forex, etc.)

### 🔐 User Authentication

- **Secure Login/Signup**: Email-based authentication via Supabase Auth
- **User Isolation**: Each user's data is completely separate and secure
- **Session Management**: Automatic session handling and persistence

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Charts**: Recharts for data visualization
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Build Tool**: Vite
- **PDF Processing**: PDF-lib for extracting transaction data
- **CSV Processing**: Papa Parse for CSV file handling

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier available)

### 2. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API to get your credentials
3. Run the SQL script from `database-setup.sql` in your Supabase SQL Editor
4. Enable Email authentication in Authentication > Settings

### 3. Environment Configuration

Create a `.env.local` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd financetracker

# Install dependencies
npm install

# Start development server
npm run dev
```

### 5. Database Migration (For Existing Users)

If you have existing transaction data, you'll need to associate it with a user:

1. Sign up/login to get your user ID
2. Run this SQL in Supabase SQL Editor:

```sql
UPDATE public.transactions
SET user_id = 'your-user-id-here'
WHERE user_id IS NULL;
```

## Usage Guide

### Finance Tracker

1. **Import Data**:

   - Use CSV Import for bank statements
   - Use PDF Import for PDF bank statements
   - The system automatically detects and prevents duplicate imports

2. **View Analytics**:

   - Charts tab shows spending trends over time
   - Click on any month in charts to see detailed breakdown
   - Subscriptions tab identifies recurring payments
   - Recurring Expenses tab analyzes spending patterns

3. **Manage Transactions**:
   - Transactions tab shows all imported data
   - Use search and filters to find specific transactions
   - View spending totals and categorization

### Trading Journal

1. **Add Trades**:

   - Click "Add Trade" to record new positions
   - Fill in symbol, side (buy/sell), quantity, price, fees, and P&L
   - Add optional notes for trade rationale

2. **Track Performance**:

   - Dashboard shows key metrics: total P&L, win rate, fees
   - Equity curve visualizes performance over time
   - Trade history table shows all positions

3. **Analyze Results**:
   - View win/loss ratios
   - Track fees impact on performance
   - Monitor equity curve for consistency

## File Structure

```
src/
├── components/
│   ├── Auth.tsx              # Authentication component
│   ├── CSVImport.tsx         # CSV file import
│   ├── PDFImport.tsx         # PDF file import
│   ├── TransactionList.tsx   # Transaction display
│   ├── SpendingCharts.tsx    # Analytics charts
│   ├── MonthlyDetail.tsx     # Monthly breakdown
│   ├── SubscriptionTracker.tsx # Subscription analysis
│   ├── RecurringExpenses.tsx # Recurring expense analysis
│   └── TradingJournal.tsx    # Trading journal
├── lib/
│   └── supabase.ts           # Supabase configuration
├── App.tsx                   # Main application
└── main.tsx                  # Application entry point
```

## Database Schema

### Transactions Table

```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    type TEXT NOT NULL,
    merchant TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Trades Table

```sql
CREATE TABLE trades (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    date DATE NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT CHECK (side IN ('buy', 'sell')),
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    fees DECIMAL(10,2) DEFAULT 0,
    pnl DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Security Features

- **Row Level Security (RLS)**: Users can only access their own data
- **Authentication Required**: All data operations require valid user session
- **Secure API**: All database operations go through Supabase's secure API
- **Input Validation**: Client-side and server-side validation for all inputs

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Adding New Features

1. Create new components in `src/components/`
2. Add routing logic in `App.tsx`
3. Update database schema if needed
4. Add proper TypeScript types in `src/lib/supabase.ts`

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Check your Supabase URL and API key
2. **Database Errors**: Ensure RLS policies are properly configured
3. **Import Failures**: Check CSV/PDF format compatibility
4. **Build Errors**: Ensure all dependencies are installed

### Support

For issues and questions:

1. Check the browser console for error messages
2. Verify Supabase configuration and database setup
3. Ensure proper authentication flow

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

**Happy tracking!** 📊💰
