# 📸 Supabase Image Storage Setup Guide

This guide walks you through setting up image storage for trade screenshots in your finance tracker.

## 🚀 Implementation Steps

### **Step 1: Database Migration**

Run the following SQL script in your **Supabase SQL Editor**:

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the content from `database-schema-update.sql`
4. Click **Run** to execute the migration

This will:

- Add `before_image_url` and `after_image_url` columns to your trades table
- Create a `trade-images` storage bucket

### **Step 2: Create Storage Policies (Manual Setup)**

Since storage policies require special permissions, you'll need to create them manually through the Supabase dashboard:

1. Go to **Storage** in your Supabase dashboard
2. Click on the **trade-images** bucket
3. Go to the **Policies** tab
4. Click **"New Policy"** and create the following 4 policies:

#### **Policy 1: SELECT (View Images)**

- **Name**: `Users can view own images`
- **Allowed operation**: `SELECT`
- **Target roles**: `authenticated`
- **USING expression** (copy this exactly):
  ```sql
  auth.uid()::text = (storage.foldername(name))[1]
  ```

#### **Policy 2: INSERT (Upload Images)**

- **Name**: `Users can upload images`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **WITH CHECK expression** (copy this exactly):
  ```sql
  auth.uid()::text = (storage.foldername(name))[1]
  ```

#### **Policy 3: UPDATE (Modify Images)**

- **Name**: `Users can update own images`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **USING expression** (copy this exactly):
  ```sql
  auth.uid()::text = (storage.foldername(name))[1]
  ```

#### **Policy 4: DELETE (Remove Images)**

- **Name**: `Users can delete own images`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **USING expression** (copy this exactly):
  ```sql
  auth.uid()::text = (storage.foldername(name))[1]
  ```

> **Important**: When creating policies in the Supabase Dashboard, **DO NOT** include `bucket_id =` in the expressions. Just copy the exact SQL expressions shown above.

### **Step 3: Verify Storage Setup**

1. Go to **Storage** in your Supabase dashboard
2. You should see a new bucket called `trade-images`
3. Verify the bucket settings:
   - **Public**: No (private bucket)
   - **File size limit**: 10MB
   - **Allowed file types**: JPEG, PNG, WebP, GIF

### **Step 4: Test the Functionality**

1. Start your development server: `npm run dev`
2. Navigate to the Trading Journal
3. Add a new trade or click the camera icon on an existing trade
4. Upload before/after screenshots
5. Click "Save Images" to store them

## 🔧 How It Works

### **File Upload Process**

1. **User uploads image** → File is uploaded to Supabase storage bucket
2. **Generate public URL** → Supabase provides a permanent URL for the image
3. **Save URL to database** → The URL is stored in the trade record
4. **Display images** → Images are loaded from Supabase URLs

### **Security Features**

- **User isolation**: Each user can only access their own images
- **Folder structure**: Images are organized by user ID
- **File naming**: `{userId}/{tradeId}_{before|after}_{timestamp}.{ext}`
- **Row Level Security**: Database policies prevent cross-user access

### **Storage Structure**

```
trade-images/
├── user-id-1/
│   ├── trade-id-1_before_1703123456789.jpg
│   ├── trade-id-1_after_1703123456790.jpg
│   └── trade-id-2_before_1703123456791.png
└── user-id-2/
    ├── trade-id-3_before_1703123456792.jpg
    └── trade-id-3_after_1703123456793.jpg
```

## 📋 Features Implemented

✅ **Upload Images**: Before and after trade screenshots  
✅ **Storage Management**: Automatic file organization  
✅ **Image Replacement**: Old images are deleted when new ones are uploaded  
✅ **URL Storage**: Image URLs saved to trade records  
✅ **Security**: User-isolated storage with RLS policies  
✅ **File Validation**: Only image files allowed (JPEG, PNG, WebP, GIF)  
✅ **Size Limits**: 10MB maximum file size  
✅ **Error Handling**: Proper error messages and rollback

## 🔍 Troubleshooting

### **Common Issues**

1. **"Failed to upload image" Error**

   - Check that the storage bucket exists
   - Verify the storage policies are correctly set
   - Ensure user is authenticated

2. **Images Not Loading**

   - Check browser console for CORS errors
   - Verify the public URL generation
   - Ensure storage bucket is properly configured

3. **Permission Denied**
   - Verify the user authentication
   - Check that RLS policies are correctly applied
   - Ensure user ID matches folder structure

### **Database Queries for Debugging**

```sql
-- Check if image columns exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'trades'
AND column_name IN ('before_image_url', 'after_image_url');

-- View storage policies
SELECT * FROM storage.policies WHERE bucket_id = 'trade-images';

-- Check bucket configuration
SELECT * FROM storage.buckets WHERE id = 'trade-images';
```

## 💡 Next Steps

### **Potential Enhancements**

- **Image compression**: Reduce file sizes automatically
- **Multiple images**: Support for more than 2 images per trade
- **Image annotations**: Add drawing/markup capabilities
- **Bulk upload**: Upload multiple images at once
- **Image gallery**: Browse all trade images in a gallery view

### **Performance Optimizations**

- **Image thumbnails**: Generate smaller previews
- **Lazy loading**: Load images only when needed
- **CDN integration**: Use Supabase CDN for faster delivery
- **Caching**: Implement proper cache headers

## ✅ Verification Checklist

- [ ] Database migration completed successfully
- [ ] Storage bucket `trade-images` exists and is configured
- [ ] Storage policies are active
- [ ] Can upload before/after images
- [ ] Images are saved to database
- [ ] Images load properly in modal
- [ ] Can delete/replace images
- [ ] Error handling works correctly

---

**🎉 Congratulations!** Your trading journal now supports image storage for trade screenshots. Users can upload before and after images to document their trading setups and results.
