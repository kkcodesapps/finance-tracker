-- Migration to add image storage support to trades table
-- Run this in your Supabase SQL Editor

-- Add image URL columns to trades table
ALTER TABLE public.trades 
ADD COLUMN IF NOT EXISTS before_image_url TEXT,
ADD COLUMN IF NOT EXISTS after_image_url TEXT;

-- Create storage bucket for trade images (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-images',
  'trade-images', 
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Note: Storage policies need to be created through the Supabase Dashboard
-- Go to Storage > trade-images bucket > Policies tab
-- and create the policies manually using the templates below:

/*
POLICY TEMPLATES (Create these in Supabase Dashboard):

1. SELECT Policy:
Name: Users can view own images
Target roles: authenticated
USING expression: auth.uid()::text = (storage.foldername(name))[1]

2. INSERT Policy: 
Name: Users can upload images
Target roles: authenticated  
WITH CHECK expression: auth.uid()::text = (storage.foldername(name))[1]

3. UPDATE Policy:
Name: Users can update own images
Target roles: authenticated
USING expression: auth.uid()::text = (storage.foldername(name))[1]

4. DELETE Policy:
Name: Users can delete own images  
Target roles: authenticated
USING expression: auth.uid()::text = (storage.foldername(name))[1]
*/ 