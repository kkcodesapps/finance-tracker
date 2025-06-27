import React, { useState, useEffect } from "react";
import { supabase, type Trade, updateTradeImages } from "../lib/supabase";
import {
  Plus,
  TrendingUp,
  DollarSign,
  Calendar,
  Check,
  X,
  Edit2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Camera,
  Upload,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface NewTrade {
  date: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  timeframe: "1m" | "3m" | "5m" | "15m" | "30m" | "1h";
  pnl: number;
  rr: number;
  risk_percentage: number;
  confidence: number;
  is_win: boolean | null;
  is_loss: boolean | null;
  is_breakeven: boolean | null;
}

interface DailyPnL {
  date: string;
  pnl: number;
  tradeCount: number;
}

export const TradingJournal: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [editingTrade, setEditingTrade] = useState<Partial<Trade>>({});
  const [saving, setSaving] = useState(false);
  const [equityData, setEquityData] = useState<
    Array<{ date: string; equity: number; pnl: number }>
  >([]);
  const [dailyPnL, setDailyPnL] = useState<DailyPnL[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Helper function to get local date string
  const getLocalDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // New trade form state
  const [newTrade, setNewTrade] = useState<NewTrade>({
    date: getLocalDateString(),
    symbol: "",
    side: "buy",
    quantity: 0,
    timeframe: "1m",
    pnl: 0,
    rr: 0,
    risk_percentage: 1,
    confidence: 3,
    is_win: null,
    is_loss: null,
    is_breakeven: null,
  });

  // Image modal state
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [beforeImage, setBeforeImage] = useState<string | null>(null);
  const [duringImage, setDuringImage] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // URL input state for image modal
  const [beforeImageUrl, setBeforeImageUrl] = useState("");
  const [duringImageUrl, setDuringImageUrl] = useState("");
  const [afterImageUrl, setAfterImageUrl] = useState("");

  // Temporary image state for new trades (before they have an ID)
  const [tempBeforeImage, setTempBeforeImage] = useState<string | null>(null);
  const [tempDuringImage, setTempDuringImage] = useState<string | null>(null);
  const [tempAfterImage, setTempAfterImage] = useState<string | null>(null);

  // Fullscreen image viewer state
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tradeToDelete, setTradeToDelete] = useState<string | null>(null);
  const [tradeToDeleteInfo, setTradeToDeleteInfo] = useState<{
    symbol: string;
    date: string;
    pnl: number;
  } | null>(null);

  // Get unique symbols from trades for dropdown
  const getUniqueSymbols = () => {
    const symbols = trades.map((trade) => trade.symbol);
    return Array.from(new Set(symbols)).sort();
  };

  // Get most recent symbol
  const getMostRecentSymbol = () => {
    if (trades.length === 0) return "";
    return trades[0].symbol; // trades are already sorted by date desc
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  useEffect(() => {
    calculateEquityData();
    calculateDailyPnL();
  }, [trades]);

  // Prevent body scrolling when modals are open
  useEffect(() => {
    if (imageModalOpen || fullscreenImage || deleteModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [imageModalOpen, fullscreenImage, deleteModalOpen]);

  // Set most recent symbol when trades are loaded and we're adding a new trade
  useEffect(() => {
    if (trades.length > 0 && newTrade.symbol === "") {
      setNewTrade((prev) => ({ ...prev, symbol: getMostRecentSymbol() }));
    }
  }, [trades, newTrade.symbol]);

  const fetchTrades = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching trades:", error);
        return;
      }

      console.log(
        "Fetched trades with dates:",
        data?.map((t) => ({ id: t.id, date: t.date, symbol: t.symbol }))
      );

      // Debug image URLs
      const tradesWithImages = data?.filter(
        (t) => t.before_image_url || t.after_image_url
      );
      if (tradesWithImages && tradesWithImages.length > 0) {
        console.log(
          "Trades with images from database:",
          tradesWithImages.map((t) => ({
            id: t.id,
            before_image_url: t.before_image_url,
            after_image_url: t.after_image_url,
          }))
        );
      }

      setTrades(data || []);
    } catch (error) {
      console.error("Error fetching trades:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateEquityData = () => {
    if (trades.length === 0) {
      setEquityData([]);
      return;
    }

    const sortedTrades = [...trades].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    let runningEquity = 0;

    const equityPoints = sortedTrades.map((trade) => {
      runningEquity += trade.pnl;
      return {
        date: trade.date,
        equity: runningEquity,
        pnl: trade.pnl,
      };
    });

    setEquityData(equityPoints);
  };

  const calculateDailyPnL = () => {
    if (trades.length === 0) {
      setDailyPnL([]);
      return;
    }

    const dailyMap = new Map<string, { pnl: number; count: number }>();

    trades.forEach((trade) => {
      const date = trade.date;
      const existing = dailyMap.get(date) || { pnl: 0, count: 0 };
      dailyMap.set(date, {
        pnl: existing.pnl + trade.pnl,
        count: existing.count + 1,
      });
    });

    const dailyData: DailyPnL[] = Array.from(dailyMap.entries()).map(
      ([date, data]) => ({
        date,
        pnl: data.pnl,
        tradeCount: data.count,
      })
    );

    setDailyPnL(dailyData);
  };

  const handleAddNew = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Ensure date is properly formatted for database
      const formattedTrade = {
        ...newTrade,
        user_id: user.id,
        symbol: newTrade.symbol.toUpperCase(),
        // Ensure date is in YYYY-MM-DD format for PostgreSQL DATE type
        date: newTrade.date,
      };

      console.log("Inserting trade with data:", formattedTrade);

      const { data, error } = await supabase
        .from("trades")
        .insert([formattedTrade])
        .select();

      if (error) {
        console.error("Database error:", error);
        throw error;
      }

      // If we have temporary images and the trade was created successfully
      if (
        data &&
        data[0] &&
        (tempBeforeImage || tempDuringImage || tempAfterImage)
      ) {
        const tradeId = data[0].id;
        try {
          await updateTradeImages(
            tradeId,
            tempBeforeImage,
            tempDuringImage,
            tempAfterImage
          );
          console.log("Temporary images saved to trade:", tradeId);
        } catch (imageError) {
          console.error("Error saving temporary images:", imageError);
          // Don't throw here - the trade was saved successfully
        }
      }

      // Reset form and temporary images
      setNewTrade({
        date: getLocalDateString(),
        symbol: "",
        side: "buy",
        quantity: 0,
        timeframe: "1m",
        pnl: 0,
        rr: 0,
        risk_percentage: 1,
        confidence: 3,
        is_win: null,
        is_loss: null,
        is_breakeven: null,
      });
      setTempBeforeImage(null);
      setTempDuringImage(null);
      setTempAfterImage(null);
      setIsAddingNew(false);
      await fetchTrades();
    } catch (error) {
      console.error("Error adding trade:", error);
      alert(
        `Error adding trade: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEditTrade = (trade: Trade) => {
    setEditingTradeId(trade.id);
    // Ensure date is properly formatted for HTML date input (YYYY-MM-DD)
    const formattedTrade = {
      ...trade,
      date: trade.date, // Should already be in YYYY-MM-DD format from database
    };
    setEditingTrade(formattedTrade);
  };

  const handleSaveEdit = async () => {
    if (!editingTradeId || !editingTrade) return;

    setSaving(true);
    try {
      // Ensure all fields are properly formatted
      const updateData = {
        date: editingTrade.date,
        symbol: editingTrade.symbol?.toUpperCase(),
        side: editingTrade.side,
        quantity: editingTrade.quantity,
        timeframe: editingTrade.timeframe,
        pnl: editingTrade.pnl,
        rr: editingTrade.rr,
        risk_percentage: editingTrade.risk_percentage,
        confidence: editingTrade.confidence,
        is_win: editingTrade.is_win,
        is_loss: editingTrade.is_loss,
        is_breakeven: editingTrade.is_breakeven,
      };

      console.log("Updating trade with data:", updateData);

      const { error } = await supabase
        .from("trades")
        .update(updateData)
        .eq("id", editingTradeId);

      if (error) {
        console.error("Database error:", error);
        throw error;
      }

      setEditingTradeId(null);
      setEditingTrade({});
      await fetchTrades();
    } catch (error) {
      console.error("Error updating trade:", error);
      alert(
        `Error updating trade: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingTradeId(null);
    setEditingTrade({});
  };

  const handleDelete = async (tradeId: string) => {
    // Find the trade to get its info for the confirmation modal
    const trade = trades.find((t) => t.id === tradeId);
    if (!trade) return;

    // Set the trade info and open the confirmation modal
    setTradeToDelete(tradeId);
    setTradeToDeleteInfo({
      symbol: trade.symbol,
      date: trade.date,
      pnl: trade.pnl,
    });
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!tradeToDelete) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("trades")
        .delete()
        .eq("id", tradeToDelete);

      if (error) {
        console.error("Database error:", error);
        throw error;
      }

      // Close modal and reset state
      setDeleteModalOpen(false);
      setTradeToDelete(null);
      setTradeToDeleteInfo(null);

      await fetchTrades();
    } catch (error) {
      console.error("Error deleting trade:", error);
      alert(
        `Error deleting trade: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  const cancelDelete = () => {
    setDeleteModalOpen(false);
    setTradeToDelete(null);
    setTradeToDeleteInfo(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Get day of week from date string
  const getDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  const formatDate = (dateStr: string) => {
    // Handle date properly to avoid timezone issues
    // For DATE type from PostgreSQL, we want to display it as-is without timezone conversion
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Helper function to format time from created_at timestamp
  const formatTime = (createdAt: string) => {
    try {
      const date = new Date(createdAt);
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false, // 24-hour format
      });
    } catch {
      return "--:--";
    }
  };

  // Helper function to format date for HTML date input (YYYY-MM-DD format)
  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return "";
    // If it's already in YYYY-MM-DD format, return as-is
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }
    // Otherwise, try to parse and format
    const date = new Date(dateStr);
    return date.toISOString().split("T")[0];
  };

  // Calculate summary stats (excluding fees since we removed them)
  const totalPnL = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const winningTrades = trades.filter((trade) => trade.pnl > 0).length;
  const losingTrades = trades.filter((trade) => trade.pnl < 0).length;
  const breakevenTrades = trades.filter((trade) => trade.pnl === 0).length;
  const decidedTrades = winningTrades + losingTrades; // Exclude breakeven trades
  const winRate = decidedTrades > 0 ? (winningTrades / decidedTrades) * 100 : 0;

  // Calculate average win and loss sizes
  const winningTradesPnL = trades.filter((trade) => trade.pnl > 0);
  const losingTradesPnL = trades.filter((trade) => trade.pnl < 0);
  const avgWinSize =
    winningTradesPnL.length > 0
      ? winningTradesPnL.reduce((sum, trade) => sum + trade.pnl, 0) /
        winningTradesPnL.length
      : 0;
  const avgLossSize =
    losingTradesPnL.length > 0
      ? losingTradesPnL.reduce((sum, trade) => sum + trade.pnl, 0) /
        losingTradesPnL.length
      : 0;

  // Filter trades based on selected date
  const filteredTrades = selectedDate
    ? trades.filter((trade) => trade.date === selectedDate)
    : trades;

  // Confidence Progress Bar Component with improved slider
  const ConfidenceBar: React.FC<{
    confidence: number;
    isEditing?: boolean;
    onChange?: (value: number) => void;
  }> = ({ confidence, isEditing = false, onChange }) => {
    const percentage = (confidence / 5) * 100;
    const getColor = (conf: number) => {
      if (conf <= 2) return "bg-red-500";
      if (conf <= 3) return "bg-yellow-500";
      return "bg-green-500";
    };

    const getSliderColor = (conf: number) => {
      if (conf <= 2) return "accent-red-500";
      if (conf <= 3) return "accent-yellow-500";
      return "accent-green-500";
    };

    if (isEditing && onChange) {
      return (
        <div className="flex items-center space-x-2">
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={confidence}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className={`w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider ${getSliderColor(
              confidence
            )}`}
            style={{
              background: `linear-gradient(to right, ${
                confidence <= 2
                  ? "#ef4444"
                  : confidence <= 3
                  ? "#eab308"
                  : "#22c55e"
              } 0%, ${
                confidence <= 2
                  ? "#ef4444"
                  : confidence <= 3
                  ? "#eab308"
                  : "#22c55e"
              } ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`,
            }}
          />
          <span className="text-sm font-medium w-4">{confidence}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-2">
        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${getColor(
              confidence
            )} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm font-medium w-4">{confidence}</span>
      </div>
    );
  };

  // Risk Percentage Circle Component
  const RiskCircle: React.FC<{
    risk: number;
    isEditing?: boolean;
    onChange?: (value: number) => void;
  }> = ({ risk, isEditing = false, onChange }) => {
    const [inputValue, setInputValue] = useState(
      risk === 0 ? "" : risk.toString()
    );

    // Update local state when risk prop changes from outside
    useEffect(() => {
      setInputValue(risk === 0 ? "" : risk.toString());
    }, [risk]);

    const circumference = 2 * Math.PI * 18; // radius = 18
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (risk / 100) * circumference;

    const handleInputChange = (value: string) => {
      // Allow empty string, numbers, and decimal points
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        setInputValue(value);
      }
    };

    const handleInputBlur = () => {
      if (onChange) {
        const numValue = inputValue === "" ? 0 : parseFloat(inputValue);
        if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
          onChange(numValue);
        } else {
          // Reset to current risk value if invalid
          setInputValue(risk === 0 ? "" : risk.toString());
        }
      }
    };

    if (isEditing && onChange) {
      return (
        <div className="flex items-center space-x-2">
          <input
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onBlur={handleInputBlur}
            placeholder="1"
            className="w-16 px-2 py-1 text-xs border rounded"
          />
          <span className="text-xs">%</span>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-2">
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 40 40">
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="3"
            />
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium">
              {risk % 1 === 0
                ? risk.toFixed(0)
                : risk.toFixed(2).replace(/\.?0+$/, "")}
              %
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Checkbox Component for Win/Loss/Breakeven
  const OutcomeCheckbox: React.FC<{
    checked: boolean | null;
    type: "win" | "loss" | "breakeven";
    isEditing?: boolean;
    onChange?: (checked: boolean) => void;
  }> = ({ checked, type, isEditing = false, onChange }) => {
    const getColor = () => {
      switch (type) {
        case "win":
          return checked ? "bg-green-500 border-green-500" : "border-gray-300";
        case "loss":
          return checked ? "bg-red-500 border-red-500" : "border-gray-300";
        case "breakeven":
          return checked ? "bg-gray-500 border-gray-500" : "border-gray-300";
      }
    };

    if (isEditing && onChange) {
      return (
        <input
          type="checkbox"
          checked={checked || false}
          onChange={(e) => onChange(e.target.checked)}
          className={`w-4 h-4 rounded border-2 ${getColor()}`}
        />
      );
    }

    return (
      <div
        className={`w-4 h-4 rounded border-2 flex items-center justify-center ${getColor()}`}
      >
        {checked && <Check className="w-3 h-3 text-white" />}
      </div>
    );
  };

  // Custom Symbol Dropdown Component
  const SymbolDropdown: React.FC<{
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }> = ({ value, onChange, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [customSymbol, setCustomSymbol] = useState("");
    const [isAddingCustom, setIsAddingCustom] = useState(false);

    const symbols = getUniqueSymbols();

    const handleSelect = (symbol: string) => {
      onChange(symbol);
      setIsOpen(false);
    };

    const handleAddCustom = () => {
      if (customSymbol.trim()) {
        onChange(customSymbol.toUpperCase().trim());
        setCustomSymbol("");
        setIsAddingCustom(false);
        setIsOpen(false);
      }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleAddCustom();
      }
    };

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 bg-white text-left flex items-center justify-between"
        >
          <span>{value || "Select symbol"}</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {/* Recent symbols */}
            {symbols.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b">
                  Recent Symbols
                </div>
                {symbols.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    onClick={() => handleSelect(symbol)}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                  >
                    {symbol}
                  </button>
                ))}
              </>
            )}

            {/* Add custom symbol */}
            <div className="border-t border-gray-200">
              {!isAddingCustom ? (
                <button
                  type="button"
                  onClick={() => setIsAddingCustom(true)}
                  className="w-full px-3 py-2 text-sm text-left text-blue-600 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                >
                  + Add new symbol
                </button>
              ) : (
                <div className="p-3 border-t">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={customSymbol}
                      onChange={(e) => setCustomSymbol(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Enter symbol (e.g., BTC)"
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddCustom}
                      className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCustom(false);
                        setCustomSymbol("");
                      }}
                      className="px-2 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Calendar and Equity Chart Side by Side
  const TradingCalendar: React.FC = () => {
    const getDaysInMonth = (date: Date) => {
      return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
      return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const getDayPnL = (day: number) => {
      const dateString = `${currentMonth.getFullYear()}-${String(
        currentMonth.getMonth() + 1
      ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return dailyPnL.find((d) => d.date === dateString);
    };

    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const goToPreviousMonth = () => {
      setCurrentMonth(
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
      );
    };

    const goToNextMonth = () => {
      setCurrentMonth(
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
      );
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Calendar */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Profit & Loss Calendar
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={goToPreviousMonth}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="font-bold text-lg text-gray-900 min-w-[140px] text-center">
                {new Date(currentMonth).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button
                onClick={goToNextMonth}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-4">
            {dayNames.map((day) => (
              <div
                key={day}
                className="p-3 text-center text-sm font-semibold text-gray-500"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {/* Empty cells for days before month starts */}
            {emptyDays.map((day) => (
              <div key={`empty-${day}`} className="h-20"></div>
            ))}

            {/* Days of the month */}
            {days.map((day) => {
              const dayData = getDayPnL(day);
              const isToday =
                new Date().toDateString() ===
                new Date(
                  currentMonth.getFullYear(),
                  currentMonth.getMonth(),
                  day
                ).toDateString();
              const dateString = `${currentMonth.getFullYear()}-${String(
                currentMonth.getMonth() + 1
              ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isSelected = selectedDate === dateString;

              return (
                <div
                  key={day}
                  className={`
                    h-20 p-2 border rounded-lg text-center transition-colors relative flex flex-col justify-between
                    ${
                      isSelected
                        ? "ring-2 ring-black ring-inset border-gray-300"
                        : "border-gray-200"
                    }
                    ${dayData ? "cursor-pointer hover:border-gray-300" : ""}
                    ${
                      dayData?.pnl !== undefined && dayData.pnl > 0
                        ? "bg-green-50"
                        : dayData?.pnl !== undefined && dayData.pnl < 0
                        ? "bg-red-50"
                        : dayData?.pnl !== undefined && dayData.pnl === 0
                        ? "bg-gray-50"
                        : "bg-white"
                    }
                  `}
                  title={
                    dayData
                      ? `${dayData.tradeCount} trade${
                          dayData.tradeCount > 1 ? "s" : ""
                        }: ${formatCurrency(dayData.pnl)}`
                      : ""
                  }
                  onClick={() => {
                    if (dayData) {
                      setSelectedDate(
                        dateString === selectedDate ? null : dateString
                      );
                    }
                  }}
                >
                  {/* Today indicator dot */}
                  {isToday && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-black rounded-full"></div>
                  )}

                  <div className="text-sm font-semibold text-gray-900">
                    {day}
                  </div>
                  {dayData && (
                    <div className="space-y-1">
                      <div
                        className={`
                        text-xs font-bold px-2 py-1 rounded
                        ${
                          dayData.pnl > 0
                            ? "text-green-800"
                            : dayData.pnl < 0
                            ? "text-red-800"
                            : "text-gray-600"
                        }
                      `}
                      >
                        {dayData.pnl >= 0 ? "+" : ""}$
                        {Math.abs(dayData.pnl) >= 1000
                          ? `${(dayData.pnl / 1000).toFixed(1)}k`
                          : `${dayData.pnl.toFixed(0)}`}
                      </div>
                      <div className="text-xs text-gray-600">
                        {dayData.tradeCount} trade
                        {dayData.tradeCount > 1 ? "s" : ""}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Equity Chart */}
        {equityData.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center mb-6">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-2 rounded-lg mr-3">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {selectedDate ? "Daily Trade Performance" : "Equity Curve"}
                </h3>
                <p className="text-gray-600 text-sm">
                  {selectedDate
                    ? `Trade-by-trade performance for ${formatDate(
                        selectedDate
                      )}`
                    : "Your trading performance over time"}
                </p>
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={
                      selectedDate
                        ? filteredTrades
                            .sort(
                              (a, b) =>
                                new Date(a.created_at).getTime() -
                                new Date(b.created_at).getTime()
                            )
                            .map((trade, index) => ({
                              trade: `Trade ${index + 1}`,
                              time: formatTime(trade.created_at),
                              pnl: trade.pnl,
                              symbol: trade.symbol,
                              side: trade.side,
                            }))
                        : equityData
                    }
                    margin={{ top: 15, right: 25, left: 15, bottom: 15 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e7eb"
                      opacity={0.5}
                    />
                    <XAxis
                      dataKey={selectedDate ? "time" : "date"}
                      tickFormatter={
                        selectedDate
                          ? (time) => time
                          : (date) => {
                              // Use same approach as formatDate to avoid timezone issues
                              const d = new Date(date + "T00:00:00");
                              return d.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              });
                            }
                      }
                      stroke="#6b7280"
                      fontSize={11}
                      tickMargin={8}
                    />
                    <YAxis
                      tickFormatter={(value) => formatCurrency(value)}
                      stroke="#6b7280"
                      fontSize={11}
                      tickMargin={8}
                      width={70}
                    />
                    <Tooltip
                      labelFormatter={
                        selectedDate
                          ? (time, payload) => {
                              if (payload && payload[0] && payload[0].payload) {
                                const data = payload[0].payload;
                                return `${
                                  data.symbol
                                } ${data.side.toUpperCase()} at ${time}`;
                              }
                              return time;
                            }
                          : (date) => {
                              // Use same approach as formatDate to avoid timezone issues
                              const d = new Date(date + "T00:00:00");
                              return d.toLocaleDateString("en-US", {
                                weekday: "short",
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              });
                            }
                      }
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        selectedDate
                          ? "Trade P&L"
                          : name === "equity"
                          ? "Total Equity"
                          : "Trade P&L",
                      ]}
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey={selectedDate ? "pnl" : "equity"}
                      stroke="url(#equityGradient)"
                      strokeWidth={3}
                      dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                      activeDot={{
                        r: 6,
                        fill: "#1d4ed8",
                        strokeWidth: 2,
                        stroke: "white",
                      }}
                    />
                    <defs>
                      <linearGradient
                        id="equityGradient"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#1d4ed8" />
                      </linearGradient>
                    </defs>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Custom Dropdown Component for Side
  const SideDropdown: React.FC<{
    value: "buy" | "sell";
    onChange: (value: "buy" | "sell") => void;
    disabled?: boolean;
  }> = ({ value, onChange, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);

    const options = [
      { value: "buy" as const, label: "Buy", color: "green" },
      { value: "sell" as const, label: "Sell", color: "red" },
    ];

    const selectedOption = options.find((opt) => opt.value === value);

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 bg-white text-left flex items-center justify-between"
        >
          <span
            className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${
              selectedOption?.color === "green"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {selectedOption?.label.toUpperCase()}
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none flex items-center"
              >
                <span
                  className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${
                    option.color === "green"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {option.label.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Custom Dropdown Component for Timeframe
  const TimeframeDropdown: React.FC<{
    value: "1m" | "3m" | "5m" | "15m" | "30m" | "1h";
    onChange: (value: "1m" | "3m" | "5m" | "15m" | "30m" | "1h") => void;
    disabled?: boolean;
  }> = ({ value, onChange, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);

    const options = [
      { value: "1m" as const, label: "1m" },
      { value: "3m" as const, label: "3m" },
      { value: "5m" as const, label: "5m" },
      { value: "15m" as const, label: "15m" },
      { value: "30m" as const, label: "30m" },
      { value: "1h" as const, label: "1h" },
    ];

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 bg-white text-left flex items-center justify-between"
        >
          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-800">
            {value}
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none flex items-center"
              >
                <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-800">
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 p-6 rounded-xl">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-none relative">
      {/* Loading Overlay */}
      {saving && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 p-6 rounded-xl flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700 font-medium">Saving changes...</span>
          </div>
        </div>
      )}

      {/* Header with Stats */}
      <div className="bg-white border border-gray-200 p-4 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-2 rounded-lg mr-3">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Trading Journal
              </h2>
              <p className="text-gray-600 text-xs">
                Track your trading performance
              </p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div
            className={`p-3 rounded-lg border ${
              totalPnL >= 0
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center mb-1">
              <div
                className={`p-1.5 rounded-md mr-2 ${
                  totalPnL >= 0 ? "bg-green-100" : "bg-red-100"
                }`}
              >
                <DollarSign
                  className={`h-4 w-4 ${
                    totalPnL >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                />
              </div>
              <span
                className={`text-xs font-semibold ${
                  totalPnL >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                Total P&L
              </span>
            </div>
            <p
              className={`text-xl font-bold ${
                totalPnL >= 0 ? "text-green-800" : "text-red-800"
              }`}
            >
              {formatCurrency(totalPnL)}
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
            <div className="flex items-center mb-1">
              <div className="bg-gray-100 p-1.5 rounded-md mr-2">
                <Calendar className="h-4 w-4 text-gray-600" />
              </div>
              <span className="text-xs text-gray-700 font-semibold">
                Total Trades
              </span>
            </div>
            <p className="text-xl font-bold text-gray-800">{trades.length}</p>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
            <div className="flex items-center mb-1">
              <div className="bg-gray-100 p-1.5 rounded-md mr-2">
                <TrendingUp className="h-4 w-4 text-gray-600" />
              </div>
              <span className="text-xs text-gray-700 font-semibold">
                Win Rate
              </span>
            </div>
            <p className="text-xl font-bold text-gray-800">
              {winRate.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-600 mt-0.5 font-medium">
              {winningTrades}W / {losingTrades}L / {breakevenTrades}BE
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <div className="flex items-center mb-1">
              <div className="bg-blue-100 p-1.5 rounded-md mr-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-xs text-blue-700 font-semibold">
                Avg Win Size
              </span>
            </div>
            <p className="text-xl font-bold text-blue-800">
              {avgWinSize > 0 ? formatCurrency(avgWinSize) : "$0.00"}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <div className="flex items-center mb-1">
              <div className="bg-blue-100 p-1.5 rounded-md mr-2">
                <TrendingUp className="h-4 w-4 text-blue-600 transform rotate-180" />
              </div>
              <span className="text-xs text-blue-700 font-semibold">
                Avg Loss Size
              </span>
            </div>
            <p className="text-xl font-bold text-blue-800">
              {avgLossSize < 0 ? formatCurrency(avgLossSize) : "$0.00"}
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
            <div className="flex items-center mb-1">
              <div className="bg-gray-100 p-1.5 rounded-md mr-2">
                <TrendingUp className="h-4 w-4 text-gray-600" />
              </div>
              <span className="text-xs text-gray-700 font-semibold">
                Avg Confidence
              </span>
            </div>
            <p className="text-xl font-bold text-gray-800">
              {trades.length > 0
                ? (
                    trades.reduce((sum, t) => sum + t.confidence, 0) /
                    trades.length
                  ).toFixed(1)
                : "0"}
              /5
            </p>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <TradingCalendar />

      {/* Trading Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-gradient-to-r from-gray-600 to-gray-700 p-1.5 rounded-lg mr-2">
                <Calendar className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Trading History
                  {selectedDate && (
                    <span className="text-sm font-normal text-blue-600 ml-2">
                      (Filtered by {formatDate(selectedDate)})
                    </span>
                  )}
                </h3>
                <p className="text-gray-600 text-xs">
                  {selectedDate
                    ? `Showing trades for ${formatDate(
                        selectedDate
                      )} - click calendar day again to clear filter`
                    : "Manage and track your trades - click calendar days to filter by date"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsAddingNew(true)}
                disabled={saving}
                className="flex items-center border border-gray-800 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 px-4 py-2 rounded-lg transition-all duration-200 hover:text-blue-800 hover:border-blue-800"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Trade
              </button>
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-white relative">
          <table className="w-full min-w-[1200px] table-fixed">
            <colgroup>
              <col style={{ width: "80px" }} />
              <col style={{ width: "50px" }} />
              <col style={{ width: "60px" }} />
              <col style={{ width: "80px" }} />
              <col style={{ width: "70px" }} />
              <col style={{ width: "80px", minWidth: "80px" }} />
              <col style={{ width: "70px", minWidth: "70px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "60px" }} />
              <col style={{ width: "80px" }} />
              <col style={{ width: "40px" }} />
              <col style={{ width: "40px" }} />
              <col style={{ width: "40px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "50px" }} />
              <col style={{ width: "80px" }} />
            </colgroup>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                  style={{ width: "80px", minWidth: "80px" }}
                >
                  Date
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                  style={{ width: "50px", minWidth: "50px" }}
                >
                  Day
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                  style={{ width: "60px", minWidth: "60px" }}
                >
                  Time
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                  style={{ width: "80px", minWidth: "80px" }}
                >
                  Symbol
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                  style={{ width: "70px", minWidth: "70px" }}
                >
                  Side
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                  style={{ width: "80px", minWidth: "80px" }}
                >
                  Risk Amnt ($)
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                  style={{ width: "70px", minWidth: "70px" }}
                >
                  TF
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                  style={{ width: "100px", minWidth: "100px" }}
                >
                  P&L $
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                  style={{ width: "60px", minWidth: "60px" }}
                >
                  RR
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                  style={{ width: "80px", minWidth: "80px" }}
                >
                  Risk %
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                  style={{ width: "40px", minWidth: "40px" }}
                >
                  W
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                  style={{ width: "40px", minWidth: "40px" }}
                >
                  L
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                  style={{ width: "40px", minWidth: "40px" }}
                >
                  BE
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                  style={{ width: "120px", minWidth: "120px" }}
                >
                  Confidence
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                  style={{ width: "50px", minWidth: "50px" }}
                >
                  Img
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                  style={{ width: "80px", minWidth: "80px" }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {/* Add New Row */}
              {isAddingNew && (
                <tr className="bg-blue-50 border-l-4 border-blue-400">
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      value={newTrade.date}
                      onChange={(e) =>
                        setNewTrade({ ...newTrade, date: e.target.value })
                      }
                      disabled={saving}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-gray-600">
                      {getDayOfWeek(newTrade.date)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-gray-400">
                      --:--
                    </span>
                  </td>
                  <td className="px-4 py-3 relative">
                    <SymbolDropdown
                      value={newTrade.symbol}
                      onChange={(value) =>
                        setNewTrade({ ...newTrade, symbol: value })
                      }
                      disabled={saving}
                    />
                  </td>
                  <td className="px-4 py-3 relative">
                    <SideDropdown
                      value={newTrade.side}
                      onChange={(value) =>
                        setNewTrade({ ...newTrade, side: value })
                      }
                      disabled={saving}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.01"
                      value={newTrade.quantity || ""}
                      onChange={(e) =>
                        setNewTrade({
                          ...newTrade,
                          quantity: parseFloat(e.target.value) || 0,
                        })
                      }
                      disabled={saving}
                      placeholder="0"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-3 relative">
                    <TimeframeDropdown
                      value={newTrade.timeframe}
                      onChange={(value) =>
                        setNewTrade({ ...newTrade, timeframe: value })
                      }
                      disabled={saving}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.01"
                      value={newTrade.pnl || ""}
                      onChange={(e) =>
                        setNewTrade({
                          ...newTrade,
                          pnl: parseFloat(e.target.value) || 0,
                        })
                      }
                      disabled={saving}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.01"
                      value={newTrade.rr || ""}
                      onChange={(e) =>
                        setNewTrade({
                          ...newTrade,
                          rr: parseFloat(e.target.value) || 0,
                        })
                      }
                      disabled={saving}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <RiskCircle
                      risk={newTrade.risk_percentage}
                      isEditing={true}
                      onChange={(value) =>
                        setNewTrade({ ...newTrade, risk_percentage: value })
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <OutcomeCheckbox
                      checked={newTrade.is_win}
                      type="win"
                      isEditing={true}
                      onChange={(checked) =>
                        setNewTrade({
                          ...newTrade,
                          is_win: checked,
                          is_loss: checked ? false : newTrade.is_loss,
                          is_breakeven: checked ? false : newTrade.is_breakeven,
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <OutcomeCheckbox
                      checked={newTrade.is_loss}
                      type="loss"
                      isEditing={true}
                      onChange={(checked) =>
                        setNewTrade({
                          ...newTrade,
                          is_loss: checked,
                          is_win: checked ? false : newTrade.is_win,
                          is_breakeven: checked ? false : newTrade.is_breakeven,
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <OutcomeCheckbox
                      checked={newTrade.is_breakeven}
                      type="breakeven"
                      isEditing={true}
                      onChange={(checked) =>
                        setNewTrade({
                          ...newTrade,
                          is_breakeven: checked,
                          is_win: checked ? false : newTrade.is_win,
                          is_loss: checked ? false : newTrade.is_loss,
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceBar
                      confidence={newTrade.confidence}
                      isEditing={true}
                      onChange={(value) =>
                        setNewTrade({ ...newTrade, confidence: value })
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        console.log("Opening image modal for new trade");
                        setSelectedTradeId("new-trade"); // Special ID for new trades
                        setImageModalOpen(true);
                        // Load temporary images
                        setBeforeImage(tempBeforeImage);
                        setDuringImage(tempDuringImage);
                        setAfterImage(tempAfterImage);
                        // Reset URL inputs
                        setBeforeImageUrl("");
                        setDuringImageUrl("");
                        setAfterImageUrl("");
                      }}
                      disabled={saving}
                      className={`relative inline-flex items-center justify-center w-8 h-8 disabled:opacity-50 disabled:cursor-not-allowed rounded-full border transition-all duration-200 ${
                        tempBeforeImage && tempAfterImage
                          ? "text-blue-600 bg-blue-50 border-blue-300 hover:bg-blue-100"
                          : tempBeforeImage || tempDuringImage || tempAfterImage
                          ? "text-red-600 bg-red-50 border-red-300 hover:bg-red-100"
                          : "text-gray-600 hover:text-blue-600 hover:bg-blue-50 border-gray-200 hover:border-blue-300"
                      }`}
                      title="Add images for this trade"
                    >
                      <Camera className="h-4 w-4" />
                      {/* Indicator dot logic: blue for complete set (before+after), red for incomplete, no dot for none */}
                      {tempBeforeImage && tempAfterImage ? (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></span>
                      ) : tempBeforeImage ||
                        tempDuringImage ||
                        tempAfterImage ? (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                      ) : null}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex space-x-2">
                      <button
                        onClick={handleAddNew}
                        disabled={saving}
                        className="inline-flex items-center justify-center w-8 h-8 text-green-600 hover:text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full border border-green-200 hover:border-green-600 transition-all duration-200 transform hover:scale-105"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingNew(false);
                          setTempBeforeImage(null);
                          setTempDuringImage(null);
                          setTempAfterImage(null);
                        }}
                        disabled={saving}
                        className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full border border-red-200 hover:border-red-600 transition-all duration-200 transform hover:scale-105"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Existing Trades */}
              {filteredTrades.map((trade) => {
                const isEditing = editingTradeId === trade.id;
                const currentTrade = isEditing ? editingTrade : trade;

                // Determine if trade is in progress (no P&L and no outcome)
                const isInProgress =
                  trade.pnl === 0 &&
                  !trade.is_win &&
                  !trade.is_loss &&
                  !trade.is_breakeven;

                return (
                  <tr
                    key={trade.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      isEditing
                        ? "bg-yellow-50 border-l-4 border-yellow-400"
                        : isInProgress
                        ? "bg-blue-50 border-l-4 border-blue-200"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 overflow-hidden">
                      {isEditing ? (
                        <input
                          type="date"
                          value={formatDateForInput(currentTrade.date || "")}
                          onChange={(e) =>
                            setEditingTrade({
                              ...editingTrade,
                              date: e.target.value,
                            })
                          }
                          disabled={saving}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 disabled:opacity-50"
                        />
                      ) : (
                        <span className="text-xs font-medium truncate block">
                          {formatDate(trade.date)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 overflow-hidden">
                      <span className="text-xs font-medium text-gray-600 truncate block">
                        {getDayOfWeek(
                          isEditing
                            ? editingTrade.date || trade.date
                            : trade.date
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 overflow-hidden">
                      <span className="text-xs font-medium text-gray-600 truncate block">
                        {formatTime(trade.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 relative">
                      {isEditing ? (
                        <SymbolDropdown
                          value={currentTrade.symbol || ""}
                          onChange={(value) =>
                            setEditingTrade({
                              ...editingTrade,
                              symbol: value,
                            })
                          }
                          disabled={saving}
                        />
                      ) : (
                        <span className="font-bold text-gray-800 truncate block">
                          {trade.symbol}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 relative">
                      {isEditing ? (
                        <SideDropdown
                          value={currentTrade.side || "buy"}
                          onChange={(value) =>
                            setEditingTrade({
                              ...editingTrade,
                              side: value,
                            })
                          }
                          disabled={saving}
                        />
                      ) : (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${
                            trade.side === "buy"
                              ? "bg-green-100 text-green-800 border border-green-200"
                              : "bg-red-100 text-red-800 border border-red-200"
                          }`}
                        >
                          {trade.side.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 overflow-hidden">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={currentTrade.quantity || ""}
                          onChange={(e) =>
                            setEditingTrade({
                              ...editingTrade,
                              quantity: parseFloat(e.target.value) || 0,
                            })
                          }
                          disabled={saving}
                          placeholder="0"
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 disabled:opacity-50"
                        />
                      ) : (
                        <span className="font-medium truncate block">
                          {trade.quantity}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 relative">
                      {isEditing ? (
                        <TimeframeDropdown
                          value={currentTrade.timeframe || "1m"}
                          onChange={(value) =>
                            setEditingTrade({
                              ...editingTrade,
                              timeframe: value,
                            })
                          }
                          disabled={saving}
                        />
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800 border border-gray-200 whitespace-nowrap">
                          {trade.timeframe}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 overflow-hidden">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={currentTrade.pnl || ""}
                          onChange={(e) =>
                            setEditingTrade({
                              ...editingTrade,
                              pnl: parseFloat(e.target.value) || 0,
                            })
                          }
                          disabled={saving}
                          placeholder="0.00"
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 disabled:opacity-50"
                        />
                      ) : (
                        <span
                          className={`text-sm font-bold px-2 py-1 rounded-full whitespace-nowrap ${
                            trade.pnl >= 0
                              ? "bg-green-100 text-green-800 border border-green-200"
                              : "bg-red-100 text-red-800 border border-red-200"
                          }`}
                        >
                          {trade.pnl >= 0 ? "+" : ""}
                          {formatCurrency(trade.pnl)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 overflow-hidden">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={currentTrade.rr || ""}
                          onChange={(e) =>
                            setEditingTrade({
                              ...editingTrade,
                              rr: parseFloat(e.target.value) || 0,
                            })
                          }
                          disabled={saving}
                          placeholder="0.00"
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 disabled:opacity-50"
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-900 truncate block">
                          {trade.rr.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 overflow-hidden">
                      <RiskCircle
                        risk={currentTrade.risk_percentage || 1}
                        isEditing={isEditing}
                        onChange={
                          isEditing
                            ? (value) =>
                                setEditingTrade({
                                  ...editingTrade,
                                  risk_percentage: value,
                                })
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-4 py-3 overflow-hidden">
                      <OutcomeCheckbox
                        checked={currentTrade.is_win || false}
                        type="win"
                        isEditing={isEditing}
                        onChange={
                          isEditing
                            ? (checked) =>
                                setEditingTrade({
                                  ...editingTrade,
                                  is_win: checked,
                                  is_loss: checked
                                    ? false
                                    : editingTrade.is_loss,
                                  is_breakeven: checked
                                    ? false
                                    : editingTrade.is_breakeven,
                                })
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-4 py-3 overflow-hidden">
                      <OutcomeCheckbox
                        checked={currentTrade.is_loss || false}
                        type="loss"
                        isEditing={isEditing}
                        onChange={
                          isEditing
                            ? (checked) =>
                                setEditingTrade({
                                  ...editingTrade,
                                  is_loss: checked,
                                  is_win: checked ? false : editingTrade.is_win,
                                  is_breakeven: checked
                                    ? false
                                    : editingTrade.is_breakeven,
                                })
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-4 py-3 overflow-hidden">
                      <OutcomeCheckbox
                        checked={currentTrade.is_breakeven || false}
                        type="breakeven"
                        isEditing={isEditing}
                        onChange={
                          isEditing
                            ? (checked) =>
                                setEditingTrade({
                                  ...editingTrade,
                                  is_breakeven: checked,
                                  is_win: checked ? false : editingTrade.is_win,
                                  is_loss: checked
                                    ? false
                                    : editingTrade.is_loss,
                                })
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-4 py-3 overflow-hidden">
                      <ConfidenceBar
                        confidence={currentTrade.confidence || 3}
                        isEditing={isEditing}
                        onChange={
                          isEditing
                            ? (value) =>
                                setEditingTrade({
                                  ...editingTrade,
                                  confidence: value,
                                })
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-4 py-3 overflow-hidden">
                      <button
                        type="button"
                        onClick={async () => {
                          console.log("Opening image modal for trade:", {
                            id: trade.id,
                            before_image_url: trade.before_image_url,
                            during_image_url: trade.during_image_url,
                            after_image_url: trade.after_image_url,
                          });
                          setSelectedTradeId(trade.id);
                          setImageModalOpen(true);
                          // Load existing images for this trade
                          setBeforeImage(trade.before_image_url);
                          setDuringImage(trade.during_image_url);
                          setAfterImage(trade.after_image_url);
                          // Reset URL inputs
                          setBeforeImageUrl("");
                          setDuringImageUrl("");
                          setAfterImageUrl("");
                        }}
                        disabled={saving}
                        className={`relative inline-flex items-center justify-center w-8 h-8 disabled:opacity-50 disabled:cursor-not-allowed rounded-full border transition-all duration-200 ${
                          trade.before_image_url && trade.after_image_url
                            ? "text-blue-600 bg-blue-50 border-blue-300 hover:bg-blue-100"
                            : trade.before_image_url ||
                              trade.during_image_url ||
                              trade.after_image_url
                            ? "text-red-600 bg-red-50 border-red-300 hover:bg-red-100"
                            : "text-gray-600 hover:text-blue-600 hover:bg-blue-50 border-gray-200 hover:border-blue-300"
                        }`}
                      >
                        <Camera className="h-4 w-4" />
                        {/* Indicator dot logic: blue for complete set (before+after), red for incomplete, no dot for none */}
                        {trade.before_image_url && trade.after_image_url ? (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></span>
                        ) : trade.before_image_url ||
                          trade.during_image_url ||
                          trade.after_image_url ? (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                        ) : null}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="inline-flex items-center justify-center w-8 h-8 text-green-600 hover:text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full border border-green-200 hover:border-green-600 transition-all duration-200 transform hover:scale-105"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={saving}
                            className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full border border-red-200 hover:border-red-600 transition-all duration-200 transform hover:scale-105"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditTrade(trade)}
                            disabled={saving}
                            className="inline-flex items-center justify-center w-8 h-8 text-blue-600 hover:text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full border border-blue-200 hover:border-blue-600 transition-all duration-200 transform hover:scale-105"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(trade.id)}
                            disabled={saving}
                            className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full border border-red-200 hover:border-red-600 transition-all duration-200 transform hover:scale-105"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredTrades.length === 0 && !isAddingNew && (
          <div className="p-12 text-center bg-white">
            <div className="bg-gray-100 border border-gray-200 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-gray-500 text-xl font-medium">
              {selectedDate
                ? "No trades found for this date"
                : "No trades recorded yet"}
            </p>
            <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">
              {selectedDate
                ? "Try selecting a different date from the calendar or clear the filter to see all trades"
                : 'Start tracking your trading performance by clicking the "Add Trade" button above'}
            </p>
          </div>
        )}
      </div>

      {/* Image Modal */}
      {imageModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 !mt-0">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  Trade Screenshots{" "}
                  {selectedTradeId &&
                    `(Trade ID: ${selectedTradeId.slice(-8)})`}
                </h3>
                <button
                  onClick={() => {
                    // If it's a new trade, restore the temporary images
                    if (selectedTradeId === "new-trade") {
                      setTempBeforeImage(beforeImage);
                      setTempDuringImage(duringImage);
                      setTempAfterImage(afterImage);
                    }
                    setImageModalOpen(false);
                    setSelectedTradeId(null);
                    setBeforeImage(null);
                    setDuringImage(null);
                    setAfterImage(null);
                    setBeforeImageUrl("");
                    setDuringImageUrl("");
                    setAfterImageUrl("");
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Before Image */}
                <div className="space-y-3">
                  <h4 className="text-lg font-semibold text-gray-800">
                    Before Trade
                  </h4>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    {beforeImage ? (
                      <div className="space-y-3">
                        <img
                          src={beforeImage}
                          alt="Before trade"
                          className="w-full h-80 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setFullscreenImage(beforeImage)}
                          title="Click to view full size"
                        />
                        <button
                          onClick={() => setBeforeImage(null)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove Image
                        </button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-4">
                          Enter image URL for before screenshot
                        </p>

                        {/* URL Input */}
                        <div className="flex space-x-2">
                          <input
                            type="url"
                            value={beforeImageUrl}
                            onChange={(e) => setBeforeImageUrl(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            onClick={() => {
                              if (beforeImageUrl.trim()) {
                                setBeforeImage(beforeImageUrl.trim());
                                setBeforeImageUrl("");
                              }
                            }}
                            disabled={!beforeImageUrl.trim() || uploadingImage}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Add URL
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* During Image */}
                <div className="space-y-3">
                  <h4 className="text-lg font-semibold text-gray-800">
                    During Trade
                  </h4>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    {duringImage ? (
                      <div className="space-y-3">
                        <img
                          src={duringImage}
                          alt="During trade"
                          className="w-full h-80 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setFullscreenImage(duringImage)}
                          title="Click to view full size"
                        />
                        <button
                          onClick={() => setDuringImage(null)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove Image
                        </button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-4">
                          Enter image URL for during screenshot
                        </p>

                        {/* URL Input */}
                        <div className="flex space-x-2">
                          <input
                            type="url"
                            value={duringImageUrl}
                            onChange={(e) => setDuringImageUrl(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            onClick={() => {
                              if (duringImageUrl.trim()) {
                                setDuringImage(duringImageUrl.trim());
                                setDuringImageUrl("");
                              }
                            }}
                            disabled={!duringImageUrl.trim() || uploadingImage}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Add URL
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* After Image */}
                <div className="space-y-3">
                  <h4 className="text-lg font-semibold text-gray-800">
                    After Trade
                  </h4>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    {afterImage ? (
                      <div className="space-y-3">
                        <img
                          src={afterImage}
                          alt="After trade"
                          className="w-full h-80 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setFullscreenImage(afterImage)}
                          title="Click to view full size"
                        />
                        <button
                          onClick={() => setAfterImage(null)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove Image
                        </button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-4">
                          Enter image URL for after screenshot
                        </p>

                        {/* URL Input */}
                        <div className="flex space-x-2">
                          <input
                            type="url"
                            value={afterImageUrl}
                            onChange={(e) => setAfterImageUrl(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            onClick={() => {
                              if (afterImageUrl.trim()) {
                                setAfterImage(afterImageUrl.trim());
                                setAfterImageUrl("");
                              }
                            }}
                            disabled={!afterImageUrl.trim() || uploadingImage}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Add URL
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={async () => {
                    if (selectedTradeId) {
                      try {
                        setUploadingImage(true);

                        if (selectedTradeId === "new-trade") {
                          // For new trades, save to temporary state
                          setTempBeforeImage(beforeImage);
                          setTempDuringImage(duringImage);
                          setTempAfterImage(afterImage);
                          console.log("Temporary images saved for new trade");
                        } else {
                          // For existing trades, save to database
                          await updateTradeImages(
                            selectedTradeId,
                            beforeImage,
                            duringImage,
                            afterImage
                          );
                          // Refresh trades list to show updated data
                          await fetchTrades();
                        }

                        // Close modal
                        setImageModalOpen(false);
                        setSelectedTradeId(null);
                        setBeforeImage(null);
                        setDuringImage(null);
                        setAfterImage(null);
                        setBeforeImageUrl("");
                        setDuringImageUrl("");
                        setAfterImageUrl("");
                      } catch (error) {
                        console.error("Error saving images:", error);
                        alert("Failed to save images. Please try again.");
                      } finally {
                        setUploadingImage(false);
                      }
                    }
                  }}
                  disabled={uploadingImage}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  {uploadingImage
                    ? "Saving..."
                    : selectedTradeId === "new-trade"
                    ? "Save Images"
                    : "Save Images"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4 !mt-0">
          <div className="relative max-w-[95vw] max-h-[95vh]">
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors text-lg font-bold"
              title="Close fullscreen view"
            >
              ✕ Close
            </button>
            <img
              src={fullscreenImage}
              alt="Fullscreen view"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={() => setFullscreenImage(null)}
            />
            <p className="absolute -bottom-8 left-0 text-white text-sm opacity-75">
              Click image or close button to exit
            </p>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && tradeToDeleteInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 !mt-0">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-red-600">Delete Trade</h3>
                <button
                  onClick={cancelDelete}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="bg-red-100 p-3 rounded-full mr-4">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.5 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    Are you sure?
                  </h4>
                  <p className="text-gray-600 text-sm">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Symbol:
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {tradeToDeleteInfo.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Date:
                    </span>
                    <span className="text-sm text-gray-900">
                      {formatDate(tradeToDeleteInfo.date)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      P&L:
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        tradeToDeleteInfo.pnl >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {tradeToDeleteInfo.pnl >= 0 ? "+" : ""}
                      {formatCurrency(tradeToDeleteInfo.pnl)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={cancelDelete}
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    "Delete Trade"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
