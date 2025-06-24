-- Add image URL columns to trades table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.trades 
ADD COLUMN IF NOT EXISTS before_image_url TEXT,
ADD COLUMN IF NOT EXISTS after_image_url TEXT;

-- Table update complete! 