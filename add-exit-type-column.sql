-- Add exit_type column to trades table
ALTER TABLE trades ADD COLUMN exit_type VARCHAR(20) CHECK (exit_type IN ('manual_close', 'take_profit', 'trailing_stop', 'stop_loss'));

-- Add comment to describe the column
COMMENT ON COLUMN trades.exit_type IS 'How the trade was closed: manual_close, take_profit, trailing_stop, or stop_loss'; 