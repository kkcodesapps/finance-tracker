-- Create trading_settings table
CREATE TABLE IF NOT EXISTS trading_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  average_risk_amount DECIMAL(10,2) NOT NULL DEFAULT 500.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE trading_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access their own settings
CREATE POLICY "Users can access their own trading settings"
  ON trading_settings
  FOR ALL
  USING (auth.uid() = user_id); 