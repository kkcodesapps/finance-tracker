import React, { useState, useEffect } from "react";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Scissors,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Transaction } from "../lib/supabase";

interface RecurringExpense {
  merchant: string;
  consecutiveMonths: number;
  monthlyData: Array<{
    monthYear: string;
    totalAmount: number;
    transactionCount: number;
    transactions: Transaction[];
  }>;
  averageMonthly: number;
  totalSpent: number;
  trend: "increasing" | "decreasing" | "stable";
  trendPercentage: number;
  lastActive: string;
  potentialMonthlySavings: number;
}

export const RecurringExpenses: React.FC = () => {
  const [recurringExpenses, setRecurringExpenses] = useState<
    RecurringExpense[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [expandedExpense, setExpandedExpense] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"savings" | "amount" | "months">(
    "savings"
  );
  const [trendFilter, setTrendFilter] = useState<
    "all" | "increasing" | "decreasing" | "stable"
  >("all");

  useEffect(() => {
    analyzeRecurringExpenses();
  }, []);

  const parseDate = (dateStr: string): Date => {
    let cleanDateStr = dateStr;
    if (dateStr.includes("T")) {
      cleanDateStr = dateStr.split("T")[0];
    }
    const [year, month, day] = cleanDateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const analyzeRecurringExpenses = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all non-payment transactions
      const { data: allTransactions, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .neq("type", "Payment")
        .order("date", { ascending: false });

      if (error) {
        console.error("Error fetching transactions:", error);
        return;
      }

      if (!allTransactions) {
        setLoading(false);
        return;
      }

      // Group transactions by merchant
      const merchantGroups = new Map<string, Transaction[]>();

      allTransactions.forEach((transaction) => {
        const merchant = transaction.merchant;
        if (!merchantGroups.has(merchant)) {
          merchantGroups.set(merchant, []);
        }
        merchantGroups.get(merchant)!.push(transaction);
      });

      const recurringPatterns: RecurringExpense[] = [];

      // Analyze each merchant for recurring patterns
      merchantGroups.forEach((transactions, merchant) => {
        // Only consider merchants with at least 2 transactions
        if (transactions.length < 2) return;

        // Group transactions by month-year
        const monthlyData = new Map<string, Transaction[]>();

        transactions.forEach((transaction) => {
          const date = parseDate(transaction.date);
          const monthYear = `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;

          if (!monthlyData.has(monthYear)) {
            monthlyData.set(monthYear, []);
          }
          monthlyData.get(monthYear)!.push(transaction);
        });

        // Convert to sorted array by month
        const sortedMonthlyData = Array.from(monthlyData.entries())
          .map(([monthYear, monthTransactions]) => ({
            monthYear,
            totalAmount: monthTransactions.reduce(
              (sum, t) => sum + Math.abs(t.amount),
              0
            ),
            transactionCount: monthTransactions.length,
            transactions: monthTransactions,
          }))
          .sort((a, b) => a.monthYear.localeCompare(b.monthYear));

        // Find consecutive month sequences
        const consecutiveSequences = findConsecutiveMonths(sortedMonthlyData);

        // Only include if there's at least one sequence of 2+ consecutive months
        const longestSequence = Math.max(...consecutiveSequences, 0);
        if (longestSequence >= 2) {
          // Calculate trend
          const amounts = sortedMonthlyData.map((d) => d.totalAmount);
          const trend = calculateTrend(amounts);

          // Calculate average monthly spending
          const totalSpent = sortedMonthlyData.reduce(
            (sum, d) => sum + d.totalAmount,
            0
          );
          const averageMonthly = totalSpent / sortedMonthlyData.length;

          // Estimate potential savings (conservative: 50% of average monthly)
          const potentialMonthlySavings = averageMonthly * 0.5;

          recurringPatterns.push({
            merchant,
            consecutiveMonths: longestSequence,
            monthlyData: sortedMonthlyData,
            averageMonthly,
            totalSpent,
            trend: trend.direction,
            trendPercentage: trend.percentage,
            lastActive:
              sortedMonthlyData[sortedMonthlyData.length - 1].monthYear,
            potentialMonthlySavings,
          });
        }
      });

      // Sort by selected criteria
      sortRecurringExpenses(recurringPatterns, sortBy);

      setRecurringExpenses(recurringPatterns);
    } catch (error) {
      console.error("Error analyzing recurring expenses:", error);
    } finally {
      setLoading(false);
    }
  };

  const findConsecutiveMonths = (monthlyData: Array<{ monthYear: string }>) => {
    if (monthlyData.length === 0) return [];

    const sequences: number[] = [];
    let currentSequence = 1;

    for (let i = 1; i < monthlyData.length; i++) {
      const currentMonth = new Date(monthlyData[i].monthYear + "-01");
      const previousMonth = new Date(monthlyData[i - 1].monthYear + "-01");

      // Check if months are consecutive
      const monthDiff =
        (currentMonth.getFullYear() - previousMonth.getFullYear()) * 12 +
        (currentMonth.getMonth() - previousMonth.getMonth());

      if (monthDiff === 1) {
        currentSequence++;
      } else {
        sequences.push(currentSequence);
        currentSequence = 1;
      }
    }
    sequences.push(currentSequence);

    return sequences;
  };

  const calculateTrend = (amounts: number[]) => {
    if (amounts.length < 2)
      return { direction: "stable" as const, percentage: 0 };

    const firstHalf = amounts.slice(0, Math.floor(amounts.length / 2));
    const secondHalf = amounts.slice(Math.floor(amounts.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, amt) => sum + amt, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, amt) => sum + amt, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (Math.abs(change) < 10)
      return { direction: "stable" as const, percentage: Math.abs(change) };
    return {
      direction: change > 0 ? ("increasing" as const) : ("decreasing" as const),
      percentage: Math.abs(change),
    };
  };

  const sortRecurringExpenses = (
    expenses: RecurringExpense[],
    criteria: string
  ) => {
    expenses.sort((a, b) => {
      switch (criteria) {
        case "savings":
          return b.potentialMonthlySavings - a.potentialMonthlySavings;
        case "amount":
          return b.averageMonthly - a.averageMonthly;
        case "months":
          return b.consecutiveMonths - a.consecutiveMonths;
        default:
          return b.potentialMonthlySavings - a.potentialMonthlySavings;
      }
    });
  };

  const handleSortChange = (criteria: "savings" | "amount" | "months") => {
    setSortBy(criteria);
    const sortedExpenses = [...recurringExpenses];
    sortRecurringExpenses(sortedExpenses, criteria);
    setRecurringExpenses(sortedExpenses);
  };

  const filterExpensesByTrend = (expenses: RecurringExpense[]) => {
    if (trendFilter === "all") return expenses;
    return expenses.filter((expense) => expense.trend === trendFilter);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatMonth = (monthYear: string) => {
    const [year, month] = monthYear.split("-");
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  // Calculate recent spending (last 2 months)
  const calculateRecentSpending = (expenses: RecurringExpense[]) => {
    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;

    // Get previous month
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthYear = `${prevMonth.getFullYear()}-${String(
      prevMonth.getMonth() + 1
    ).padStart(2, "0")}`;

    const recentMonths = [currentMonthYear, prevMonthYear];

    let totalRecentSpending = 0;
    const recentMerchants = new Set();

    expenses.forEach((expense) => {
      let merchantRecentSpending = 0;
      let hasRecentActivity = false;

      expense.monthlyData.forEach((monthData) => {
        if (recentMonths.includes(monthData.monthYear)) {
          merchantRecentSpending += monthData.totalAmount;
          hasRecentActivity = true;
          recentMerchants.add(expense.merchant);
        }
      });

      if (hasRecentActivity) {
        totalRecentSpending += merchantRecentSpending / 2; // Average over 2 months
      }
    });

    return {
      totalRecentSpending,
      recentMerchantCount: recentMerchants.size,
      recentMonths: recentMonths.map((monthYear) => formatMonth(monthYear)),
    };
  };

  const filteredExpenses = filterExpensesByTrend(recurringExpenses);

  // Calculate all metrics
  const totalPotentialSavings = filteredExpenses.reduce(
    (sum, expense) => sum + expense.potentialMonthlySavings,
    0
  );
  const totalCurrentSpending = filteredExpenses.reduce(
    (sum, expense) => sum + expense.averageMonthly,
    0
  );

  const recentSpendingData = calculateRecentSpending(filteredExpenses);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increasing":
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case "decreasing":
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <div className="h-4 w-4 bg-gray-400 rounded-full"></div>;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "increasing":
        return "text-red-600 bg-red-50";
      case "decreasing":
        return "text-green-600 bg-green-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
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
    <div className="space-y-6">
      {/* Header with Summary */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Scissors className="h-6 w-6 text-orange-600 mr-2" />
            <h2 className="text-2xl font-semibold text-gray-900">
              Recurring Expenses Analysis
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={sortBy}
              onChange={(e) =>
                handleSortChange(
                  e.target.value as "savings" | "amount" | "months"
                )
              }
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="savings">Sort by Potential Savings</option>
              <option value="amount">Sort by Monthly Amount</option>
              <option value="months">Sort by Duration</option>
            </select>
          </div>
        </div>

        {/* Trend Filter Tabs */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-4 max-w-md">
          <button
            onClick={() => setTrendFilter("all")}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${
              trendFilter === "all"
                ? "bg-white text-orange-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            All ({recurringExpenses.length})
          </button>
          <button
            onClick={() => setTrendFilter("increasing")}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${
              trendFilter === "increasing"
                ? "bg-white text-red-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Increasing (
            {recurringExpenses.filter((e) => e.trend === "increasing").length})
          </button>
          <button
            onClick={() => setTrendFilter("decreasing")}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${
              trendFilter === "decreasing"
                ? "bg-white text-green-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Decreasing (
            {recurringExpenses.filter((e) => e.trend === "decreasing").length})
          </button>
          <button
            onClick={() => setTrendFilter("stable")}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${
              trendFilter === "stable"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Stable (
            {recurringExpenses.filter((e) => e.trend === "stable").length})
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Scissors className="h-5 w-5 text-orange-600 mr-2" />
              <span className="text-sm text-orange-600 font-medium">
                Potential Monthly Savings
              </span>
            </div>
            <p className="text-2xl font-bold text-orange-800 mt-1">
              {formatCurrency(totalPotentialSavings)}
            </p>
          </div>

          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <DollarSign className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-sm text-red-600 font-medium">
                Average Monthly Spending
              </span>
            </div>
            <p className="text-2xl font-bold text-red-800 mt-1">
              {formatCurrency(totalCurrentSpending)}
            </p>
            <p className="text-xs text-red-600 mt-1">Historical average</p>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-blue-600 mr-2" />
              <span className="text-sm text-blue-600 font-medium">
                {trendFilter === "all"
                  ? "Recurring Merchants"
                  : `${
                      trendFilter.charAt(0).toUpperCase() + trendFilter.slice(1)
                    } Merchants`}
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-800 mt-1">
              {filteredExpenses.length}
            </p>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
              <span className="text-sm text-yellow-600 font-medium">
                Potential Annual Savings
              </span>
            </div>
            <p className="text-2xl font-bold text-yellow-800 mt-1">
              {formatCurrency(totalPotentialSavings * 12)}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Spending Analysis */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-6 w-6 text-green-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">
            Recent Spending Analysis
          </h2>
        </div>
        <p className="text-gray-600 mb-4">
          Analysis based on the most recent 2 months (
          {recentSpendingData.recentMonths.join(" & ")}) for a more current view
          of your spending patterns.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <DollarSign className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-sm text-green-600 font-medium">
                Current Monthly Spending
              </span>
            </div>
            <p className="text-2xl font-bold text-green-800 mt-1">
              {formatCurrency(recentSpendingData.totalRecentSpending)}
            </p>
            <p className="text-xs text-green-600 mt-1">Last 2 months average</p>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-purple-600 mr-2" />
              <span className="text-sm text-purple-600 font-medium">
                Active Merchants
              </span>
            </div>
            <p className="text-2xl font-bold text-purple-800 mt-1">
              {recentSpendingData.recentMerchantCount}
            </p>
            <p className="text-xs text-purple-600 mt-1">Recently active</p>
          </div>

          <div className="bg-indigo-50 p-4 rounded-lg">
            <div className="flex items-center">
              <TrendingUp className="h-5 w-5 text-indigo-600 mr-2" />
              <span className="text-sm text-indigo-600 font-medium">
                Spending Trend
              </span>
            </div>
            <p className="text-lg font-bold text-indigo-800 mt-1">
              {recentSpendingData.totalRecentSpending > totalCurrentSpending ? (
                <span className="text-red-600">↗ Higher</span>
              ) : recentSpendingData.totalRecentSpending <
                totalCurrentSpending ? (
                <span className="text-green-600">↘ Lower</span>
              ) : (
                <span className="text-blue-600">→ Stable</span>
              )}
            </p>
            <p className="text-xs text-indigo-600 mt-1">
              vs historical average
            </p>
            <p className="text-xs text-indigo-500 mt-1">
              {recentSpendingData.totalRecentSpending > totalCurrentSpending
                ? `+${formatCurrency(
                    recentSpendingData.totalRecentSpending -
                      totalCurrentSpending
                  )}`
                : recentSpendingData.totalRecentSpending < totalCurrentSpending
                ? `-${formatCurrency(
                    totalCurrentSpending -
                      recentSpendingData.totalRecentSpending
                  )}`
                : "No change"}
            </p>
          </div>
        </div>
      </div>

      {/* Recurring Expenses List */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">
            {trendFilter === "all"
              ? `Recurring Expenses (${filteredExpenses.length})`
              : `${
                  trendFilter.charAt(0).toUpperCase() + trendFilter.slice(1)
                } Expenses (${filteredExpenses.length})`}
          </h3>
          <p className="text-sm text-gray-600">
            Showing merchants with 2+ consecutive months of activity
          </p>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {trendFilter === "all"
                ? "No recurring expense patterns found"
                : `No ${trendFilter} expense patterns found`}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {trendFilter === "all"
                ? "Import more transaction data to identify recurring spending patterns"
                : `Try selecting a different trend filter or import more data`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredExpenses.map((expense) => (
              <div
                key={expense.merchant}
                className="border border-gray-200 rounded-lg"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() =>
                    setExpandedExpense(
                      expandedExpense === expense.merchant
                        ? null
                        : expense.merchant
                    )
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-lg">
                        {expense.merchant}
                      </h4>
                      <div className="flex items-center mt-2 space-x-4">
                        <span className="text-sm text-gray-600">
                          {expense.consecutiveMonths} consecutive months
                        </span>
                        <div className="flex items-center space-x-1">
                          {getTrendIcon(expense.trend)}
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getTrendColor(
                              expense.trend
                            )}`}
                          >
                            {expense.trend} {expense.trendPercentage.toFixed(0)}
                            %
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          Last: {formatMonth(expense.lastActive)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-red-600">
                        {formatCurrency(expense.averageMonthly)}/month
                      </div>
                      <div className="text-sm text-orange-600 font-medium">
                        Save ~{formatCurrency(expense.potentialMonthlySavings)}
                        /month
                      </div>
                      <div className="text-xs text-gray-500">
                        Total: {formatCurrency(expense.totalSpent)}
                      </div>
                    </div>
                  </div>
                </div>

                {expandedExpense === expense.merchant && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    <div className="p-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-3">
                        Monthly Spending History:
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {expense.monthlyData
                          .sort((a, b) =>
                            b.monthYear.localeCompare(a.monthYear)
                          )
                          .map((monthData) => (
                            <div
                              key={monthData.monthYear}
                              className="bg-white p-3 rounded border"
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-700">
                                  {formatMonth(monthData.monthYear)}
                                </span>
                                <span className="text-sm font-semibold text-red-600">
                                  {formatCurrency(monthData.totalAmount)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {monthData.transactionCount} transaction
                                {monthData.transactionCount !== 1 ? "s" : ""}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
