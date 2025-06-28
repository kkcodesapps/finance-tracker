import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { TrendingUp, Save, DollarSign, Settings } from "lucide-react";

interface TradingSettings {
  averageRiskAmount: number;
  userId: string;
}

export const TradingSettings: React.FC = () => {
  const [settings, setSettings] = useState<TradingSettings>({
    averageRiskAmount: 500,
    userId: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Check if trading_settings table exists and fetch settings
      const { data, error } = await supabase
        .from("trading_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "not found" error
        console.error("Error fetching settings:", error);
        return;
      }

      if (data) {
        setSettings({
          averageRiskAmount: data.average_risk_amount,
          userId: user.id,
        });
      } else {
        // No settings found, use defaults but set user ID
        setSettings((prev) => ({ ...prev, userId: user.id }));
      }
    } catch (error) {
      console.error("Error fetching trading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMessage({
          type: "error",
          text: "User not authenticated. Please log in again.",
        });
        return;
      }

      console.log("Saving settings for user:", user.id);
      console.log("Settings data:", settings);

      // First, test if we can access the table
      const { data: tableData, error: testError } = await supabase
        .from("trading_settings")
        .select("*")
        .eq("user_id", user.id);

      console.log("Table access test:", { tableData, testError });

      const settingsData = {
        user_id: user.id,
        average_risk_amount: settings.averageRiskAmount,
      };

      console.log("Attempting to upsert:", settingsData);

      // Test with explicit ID first
      const testData = {
        id: crypto.randomUUID(),
        user_id: user.id,
        average_risk_amount: settings.averageRiskAmount,
      };

      console.log("Attempting insert with explicit ID:", testData);

      // Try to insert first
      const { data: insertData, error: insertError } = await supabase
        .from("trading_settings")
        .insert(testData)
        .select();

      console.log("Insert result:", { insertData, insertError });

      if (insertError) {
        // If insert failed due to unique constraint, try update
        if (insertError.code === "23505") {
          console.log("Record exists, attempting update...");
          const { data: updateData, error: updateError } = await supabase
            .from("trading_settings")
            .update({ average_risk_amount: settings.averageRiskAmount })
            .eq("user_id", user.id)
            .select();

          console.log("Update result:", { updateData, updateError });

          if (updateError) {
            console.error("Error updating settings:", updateError);
            setMessage({
              type: "error",
              text: `Failed to update settings: ${updateError.message}`,
            });
            return;
          }

          console.log("Settings updated successfully:", updateData);
          setMessage({
            type: "success",
            text: "Settings updated successfully!",
          });
        } else {
          console.error("Error inserting settings:", insertError);
          setMessage({
            type: "error",
            text: `Failed to save settings: ${insertError.message}`,
          });
          return;
        }
      } else {
        console.log("Settings inserted successfully:", insertData);
        setMessage({ type: "success", text: "Settings saved successfully!" });
      }

      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error saving trading settings:", error);
      setMessage({
        type: "error",
        text: `An unexpected error occurred: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRiskAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    if (numValue >= 0) {
      setSettings((prev) => ({ ...prev, averageRiskAmount: numValue }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-none">
        <div className="bg-white border border-gray-200 p-6 rounded-xl">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="bg-white border border-gray-200 p-6 rounded-xl">
        <div className="flex items-center mb-4">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-2 rounded-lg mr-3">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Trading Settings
            </h2>
            <p className="text-gray-600 text-sm">
              Configure your trading preferences and risk parameters
            </p>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-white border border-gray-200 p-6 rounded-xl">
        <div className="space-y-6">
          {/* Average Risk Amount */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Average Risk Amount per Trade
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={settings.averageRiskAmount}
                onChange={(e) => handleRiskAmountChange(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="500.00"
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              This amount is used to calculate color intensity in the calendar:
            </p>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-50 border border-green-200 rounded mr-2"></div>
                <span className="text-gray-600">
                  Small wins: 1-4x risk amount (${settings.averageRiskAmount} -
                  ${(settings.averageRiskAmount * 4).toFixed(0)})
                </span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-100 border border-green-300 rounded mr-2"></div>
                <span className="text-gray-600">
                  Good wins: 4-10x risk amount ($
                  {(settings.averageRiskAmount * 4).toFixed(0)} - $
                  {(settings.averageRiskAmount * 10).toFixed(0)})
                </span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-200 border border-green-400 rounded mr-2"></div>
                <span className="text-gray-600">
                  Big wins: 10x+ risk amount ($
                  {(settings.averageRiskAmount * 10).toFixed(0)}+)
                </span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <div>
              {message && (
                <div
                  className={`text-sm font-medium ${
                    message.type === "success"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {message.text}
                </div>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Information */}
      <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl">
        <div className="flex items-start">
          <div className="bg-blue-100 p-2 rounded-lg mr-3 mt-0.5">
            <TrendingUp className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              How Color Intensity Works
            </h3>
            <div className="text-blue-800 text-sm space-y-2">
              <p>
                The calendar colors automatically adjust based on your average
                risk amount to provide meaningful visual feedback:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  <strong>Small wins/losses:</strong> 1-4x your risk amount
                </li>
                <li>
                  <strong>Good wins/losses:</strong> 4-10x your risk amount
                </li>
                <li>
                  <strong>Big wins/losses:</strong> 10x+ your risk amount
                </li>
              </ul>
              <p className="mt-3">
                This ensures the colors reflect performance relative to your
                trading style and risk management approach.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
