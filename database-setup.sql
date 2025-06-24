-- Enable Row Level Security (RLS)
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trades ENABLE ROW LEVEL SECURITY;

-- Create transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    type VARCHAR(100) NOT NULL,
    merchant TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trades table for trading journal
CREATE TABLE IF NOT EXISTS public.trades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,2) NOT NULL,
    pnl DECIMAL(20,2) NOT NULL,
    risk_percentage DECIMAL(5,2) DEFAULT 1.0 NOT NULL,
    confidence INTEGER DEFAULT 3 CHECK (confidence >= 1 AND confidence <= 5),
    is_win BOOLEAN,
    is_loss BOOLEAN,
    is_breakeven BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date);

CREATE INDEX IF NOT EXISTS idx_trades_user_id ON public.trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_date ON public.trades(date);
CREATE INDEX IF NOT EXISTS idx_trades_user_date ON public.trades(user_id, date);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON public.trades(symbol);

-- Row Level Security policies for transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions" ON public.transactions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions
    FOR DELETE USING (auth.uid() = user_id);

-- Row Level Security policies for trades
DROP POLICY IF EXISTS "Users can view own trades" ON public.trades;
CREATE POLICY "Users can view own trades" ON public.trades
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own trades" ON public.trades
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own trades" ON public.trades
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own trades" ON public.trades
    FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.transactions TO authenticated;
GRANT ALL ON public.trades TO authenticated;

-- Add user_id column to existing transactions table if it doesn't exist
-- This is for migrating existing data
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        
        -- You'll need to manually update existing records with a user_id
        -- This is just a placeholder - you should replace with actual user ID
        -- UPDATE public.transactions SET user_id = 'your-user-id' WHERE user_id IS NULL;
    END IF;
END $$; 