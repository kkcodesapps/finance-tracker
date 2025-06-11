import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  addDays,
} from "date-fns";
import { supabase } from "../lib/supabase";

interface MonthlySpending {
  month: string;
  spending: number;
  income: number;
  net: number;
}

interface WeeklySpending {
  week: string;
  weekStart: Date;
  spending: number;
  income: number;
  net: number;
}

interface RecurringTransaction {
  merchant: string;
  monthlyFrequency: number;
  totalMonths: number;
  averageAmount: number;
  totalSpending: number;
  transactionCount: number;
}

interface SpendingChartsProps {
  refreshKey?: number;
  onMonthClick?: (month: string) => void;
}

export const SpendingCharts: React.FC<SpendingChartsProps> = ({
  refreshKey,
  onMonthClick,
}) => {
  const [monthlyData, setMonthlyData] = useState<MonthlySpending[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklySpending[]>([]);
  const [recurringData, setRecurringData] = useState<RecurringTransaction[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"monthly" | "weekly">("monthly");

  useEffect(() => {
    fetchSpendingData();
  }, [refreshKey]);

  const fetchSpendingData = async () => {
    setLoading(true);
    try {
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: true });

      if (error) {
        console.error("Error fetching transactions:", error);
        return;
      }

      console.log(
        "Fetched transactions for charts:",
        transactions?.length || 0
      );

      if (!transactions || transactions.length === 0) {
        setLoading(false);
        return;
      }

      // Filter out payment transactions from all calculations
      const filteredTransactions = transactions.filter(
        (t) => t.type.toLowerCase() !== "payment"
      );

      console.log(
        "Transactions after filtering out payments:",
        filteredTransactions.length
      );
      console.log(
        "Filtered out payment transactions:",
        transactions.length - filteredTransactions.length
      );

      if (filteredTransactions.length === 0) {
        setLoading(false);
        return;
      }

      // Get the date range from the filtered transactions
      const firstTransaction = filteredTransactions[0];
      const lastTransaction =
        filteredTransactions[filteredTransactions.length - 1];

      // Parse dates safely without timezone issues
      const parseDate = (dateStr: string): Date => {
        let cleanDateStr = dateStr;
        if (dateStr.includes("T")) {
          cleanDateStr = dateStr.split("T")[0];
        }
        const [year, month, day] = cleanDateStr.split("-").map(Number);
        return new Date(year, month - 1, day); // month is 0-indexed in Date constructor
      };

      const firstDate = parseDate(firstTransaction.date);
      const lastDate = parseDate(lastTransaction.date);

      console.log("Date range:", firstDate, "to", lastDate);

      // Generate all months in the range
      const months = eachMonthOfInterval({
        start: startOfMonth(firstDate),
        end: endOfMonth(lastDate),
      });

      // Generate all weeks in the range
      const weeks = eachWeekOfInterval({
        start: startOfWeek(firstDate, { weekStartsOn: 1 }), // Start on Monday
        end: endOfWeek(lastDate, { weekStartsOn: 1 }),
      });

      // Process monthly data
      const monthlySpending: MonthlySpending[] = months.map((month) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);

        const monthTransactions = filteredTransactions.filter((t) => {
          const transactionDate = parseDate(t.date);
          return transactionDate >= monthStart && transactionDate <= monthEnd;
        });

        // For credit card transactions:
        // - Positive amounts are typically spending/charges
        // - Negative amounts are typically credits/refunds (rare, but should count as negative spending)
        const spending = monthTransactions
          .filter((t) => t.amount > 0) // Positive amounts are spending for credit cards
          .reduce((sum, t) => sum + t.amount, 0);

        // Credits/refunds (negative amounts) - these reduce spending
        const credits = monthTransactions
          .filter((t) => t.amount < 0)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        // Net spending is spending minus any credits/refunds
        const netSpending = spending - credits;

        // For credit cards, there's typically no "income" in the traditional sense
        // Income would be payments TO the card, but we've filtered those out
        const income = 0;

        return {
          month: format(month, "MMM yyyy"),
          spending: netSpending,
          income,
          net: income - netSpending, // This will be negative (spending more than earning)
        };
      });

      // Process weekly data
      const weeklySpending: WeeklySpending[] = weeks.map((week) => {
        const weekStart = startOfWeek(week, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(week, { weekStartsOn: 1 });

        const weekTransactions = filteredTransactions.filter((t) => {
          const transactionDate = parseDate(t.date);
          return transactionDate >= weekStart && transactionDate <= weekEnd;
        });

        const spending = weekTransactions
          .filter((t) => t.amount > 0)
          .reduce((sum, t) => sum + t.amount, 0);

        const credits = weekTransactions
          .filter((t) => t.amount < 0)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const netSpending = spending - credits;
        const income = 0;

        return {
          week:
            format(weekStart, "MMM d") +
            " - " +
            format(addDays(weekStart, 6), "MMM d"),
          weekStart,
          spending: netSpending,
          income,
          net: income - netSpending,
        };
      });

      console.log("Monthly data:", monthlySpending);
      console.log("Weekly data:", weeklySpending);
      setMonthlyData(monthlySpending);
      setWeeklyData(weeklySpending);

      // Calculate recurring transactions (only for monthly view)
      if (filteredTransactions.length > 0) {
        // Group transactions by merchant and month
        const merchantMonthMap = new Map<string, Set<string>>();
        const merchantTotals = new Map<
          string,
          { total: number; count: number }
        >();

        filteredTransactions.forEach((transaction) => {
          const merchant = transaction.merchant;
          const transactionDate = parseDate(transaction.date);
          const monthKey = format(transactionDate, "yyyy-MM");

          // Track which months each merchant appears in
          if (!merchantMonthMap.has(merchant)) {
            merchantMonthMap.set(merchant, new Set());
          }
          merchantMonthMap.get(merchant)!.add(monthKey);

          // Track total spending per merchant
          if (!merchantTotals.has(merchant)) {
            merchantTotals.set(merchant, { total: 0, count: 0 });
          }
          const current = merchantTotals.get(merchant)!;
          current.total += Math.abs(transaction.amount);
          current.count += 1;
        });

        // Calculate recurring patterns
        const recurringTransactions: RecurringTransaction[] = [];
        for (const [merchant, monthsSet] of merchantMonthMap.entries()) {
          const monthsAppeared = monthsSet.size;
          const totalMonthsInRange = months.length;
          const frequency = monthsAppeared / totalMonthsInRange;

          // Only consider merchants that appear in at least 2 months and have frequency > 0.3
          if (monthsAppeared >= 2 && frequency >= 0.3) {
            const totals = merchantTotals.get(merchant)!;
            const averageAmount = totals.total / totals.count;

            recurringTransactions.push({
              merchant,
              monthlyFrequency: frequency,
              totalMonths: monthsAppeared,
              averageAmount,
              totalSpending: totals.total,
              transactionCount: totals.count,
            });
          }
        }

        // Sort by frequency (most recurring first), then by total spending
        recurringTransactions.sort((a, b) => {
          if (Math.abs(a.monthlyFrequency - b.monthlyFrequency) < 0.01) {
            return b.totalSpending - a.totalSpending;
          }
          return b.monthlyFrequency - a.monthlyFrequency;
        });

        // Take top 10
        setRecurringData(recurringTransactions.slice(0, 10));
      }
    } catch (error) {
      console.error("Error processing spending data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleBarClick = (data: MonthlySpending | WeeklySpending) => {
    if (
      activeView === "monthly" &&
      data &&
      "month" in data &&
      data.month &&
      onMonthClick
    ) {
      onMonthClick(data.month);
    }
    // Note: Weekly click functionality could be added later if needed
  };

  const currentData = activeView === "monthly" ? monthlyData : weeklyData;
  const dataKey = activeView === "monthly" ? "month" : "week";

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (monthlyData.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Spending Charts</h2>
        <p className="text-gray-500 text-center py-8">
          No data available. Import transactions to see spending charts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Credit Card Analysis
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              Positive amounts are treated as spending (charges). Negative
              amounts are credits/refunds. Payment transactions are excluded.
              {activeView === "monthly" && (
                <span className="font-medium">
                  {" "}
                  Click on any bar to view detailed transactions for that month.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Spending Charts with Tabs */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        {/* Tab Navigation */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Spending Overview</h2>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveView("monthly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === "monthly"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Monthly View
            </button>
            <button
              onClick={() => setActiveView("weekly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === "weekly"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Weekly View
            </button>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={currentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={dataKey}
                angle={activeView === "weekly" ? -45 : 0}
                textAnchor={activeView === "weekly" ? "end" : "middle"}
                height={activeView === "weekly" ? 80 : 60}
                fontSize={12}
              />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar
                dataKey="spending"
                name="Net Spending"
                style={{
                  cursor: activeView === "monthly" ? "pointer" : "default",
                }}
              >
                {currentData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill="#ef4444"
                    onClick={() => handleBarClick(entry)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {activeView === "monthly" && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            💡 Click on any bar to view detailed transactions for that month
          </p>
        )}
      </div>

      {/* Spending Trend */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">
          {activeView === "monthly" ? "Monthly" : "Weekly"} Spending Trend
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={currentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={dataKey}
                angle={activeView === "weekly" ? -45 : 0}
                textAnchor={activeView === "weekly" ? "end" : "middle"}
                height={activeView === "weekly" ? 80 : 60}
                fontSize={12}
              />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Line
                type="monotone"
                dataKey="spending"
                stroke="#ef4444"
                strokeWidth={2}
                name={`${
                  activeView === "monthly" ? "Monthly" : "Weekly"
                } Spending`}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 10 Recurring Monthly Transactions - Only show for monthly view */}
      {activeView === "monthly" && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">
            Top 10 Recurring Monthly Transactions
          </h2>
          {recurringData.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No recurring transaction patterns found. Need at least 2 months of
              data.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Merchants that appear regularly across multiple months
                (frequency ≥ 30%)
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Merchant
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Frequency
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Months
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Amount
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Spent
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transactions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recurringData.map((item, index) => (
                      <tr key={item.merchant} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 text-xs font-medium rounded-full mr-3">
                              {index + 1}
                            </span>
                            <span className="font-medium text-gray-900">
                              {item.merchant}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              item.monthlyFrequency >= 0.8
                                ? "bg-green-100 text-green-800"
                                : item.monthlyFrequency >= 0.5
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-orange-100 text-orange-800"
                            }`}
                          >
                            {Math.round(item.monthlyFrequency * 100)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-900">
                          {item.totalMonths}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 font-medium">
                          {formatCurrency(item.averageAmount)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 font-semibold">
                          {formatCurrency(item.totalSpending)}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-900">
                          {item.transactionCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
