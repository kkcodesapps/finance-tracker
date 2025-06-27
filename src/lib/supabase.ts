import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Transaction = {
  id: string;
  date: string;
  amount: number;
  type: string;
  merchant: string;
  created_at: string;
  user_id?: string;
};

export type Trade = {
  id: string;
  user_id: string;
  date: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  timeframe: "1m" | "3m" | "5m" | "15m" | "30m" | "1h";
  pnl: number;
  rr: number;
  risk_percentage: number;
  confidence: number; // 1-5 scale
  is_win: boolean | null;
  is_loss: boolean | null;
  is_breakeven: boolean | null;
  before_image_url: string | null;
  during_image_url: string | null;
  after_image_url: string | null;
  created_at: string;
};

export type User = {
  id: string;
  email: string;
  created_at: string;
};

// Test function to verify bucket access
export const testBucketAccess = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.storage
      .from("trade-images")
      .list("", {
        limit: 1,
      });

    if (error) {
      console.error("Bucket access test failed:", error);
      return false;
    }

    console.log("Bucket access test successful:", data);
    return true;
  } catch (error) {
    console.error("Bucket access test error:", error);
    return false;
  }
};

// Image upload utilities for trade screenshots
export const uploadTradeImage = async (
  file: File,
  tradeId: string,
  imageType: "before" | "after"
): Promise<string> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // Generate unique filename
  const fileExt = file.name.split(".").pop();
  const fileName = `${
    user.id
  }/${tradeId}_${imageType}_${Date.now()}.${fileExt}`;

  // Upload file to storage
  const { data, error } = await supabase.storage
    .from("trade-images")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    console.error("Upload error:", error);
    throw error;
  }

  // Get signed URL for private bucket (expires in 1 year)
  const { data: urlData, error: urlError } = await supabase.storage
    .from("trade-images")
    .createSignedUrl(data.path, 31536000); // 1 year expiry

  if (urlError) {
    console.error("Error creating signed URL:", urlError);
    throw urlError;
  }

  return urlData.signedUrl;
};

export const deleteTradeImage = async (imageUrl: string): Promise<void> => {
  if (!imageUrl) return;

  // Extract file path from URL
  const urlParts = imageUrl.split("/");
  const bucketIndex = urlParts.findIndex((part) => part === "trade-images");
  if (bucketIndex === -1) return;

  const filePath = urlParts.slice(bucketIndex + 1).join("/");

  const { error } = await supabase.storage
    .from("trade-images")
    .remove([filePath]);

  if (error) throw error;
};

export const updateTradeImages = async (
  tradeId: string,
  beforeImageUrl: string | null,
  duringImageUrl: string | null,
  afterImageUrl: string | null
): Promise<void> => {
  const { error } = await supabase
    .from("trades")
    .update({
      before_image_url: beforeImageUrl,
      during_image_url: duringImageUrl,
      after_image_url: afterImageUrl,
    })
    .eq("id", tradeId);

  if (error) {
    console.error("Error updating trade images:", error);
    throw error;
  }
};

export const getSignedImageUrl = async (storedUrl: string): Promise<string> => {
  if (!storedUrl) return "";

  // Extract the file path from the stored URL
  // Handle both public URLs and signed URLs
  let filePath = "";

  if (storedUrl.includes("/object/public/trade-images/")) {
    // Extract path from public URL format
    const parts = storedUrl.split("/object/public/trade-images/");
    filePath = parts[1];
  } else if (storedUrl.includes("/object/sign/trade-images/")) {
    // Extract path from signed URL format
    const parts = storedUrl.split("/object/sign/trade-images/");
    const pathWithQuery = parts[1];
    filePath = pathWithQuery.split("?")[0]; // Remove query parameters
  } else {
    // Assume it's already a file path
    filePath = storedUrl;
  }

  if (!filePath) return storedUrl; // Return original if we can't parse it

  // Create a fresh signed URL
  const { data, error } = await supabase.storage
    .from("trade-images")
    .createSignedUrl(filePath, 31536000); // 1 year expiry

  if (error) {
    console.error("Error creating signed URL for existing image:", error);
    return storedUrl; // Return original URL if signing fails
  }

  return data.signedUrl;
};
