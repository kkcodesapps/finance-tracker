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
} from "recharts";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
} from "date-fns";
import { supabase } from "../lib/supabase";

interface MonthlySpending {
  month: string;
  spending: number;
  income: number;
  net: number;
}

interface SpendingChartsProps {
  refreshKey?: number;
}

export const SpendingCharts: React.FC<SpendingChartsProps> = ({
  refreshKey,
}) => {
  const [monthlyData, setMonthlyData] = useState<MonthlySpending[]>([]);
  const [loading, setLoading] = useState(true);

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
      const firstDate = parseISO(filteredTransactions[0].date);
      const lastDate = parseISO(
        filteredTransactions[filteredTransactions.length - 1].date
      );

      console.log("Date range:", firstDate, "to", lastDate);

      // Generate all months in the range
      const months = eachMonthOfInterval({
        start: startOfMonth(firstDate),
        end: endOfMonth(lastDate),
      });

      const monthlySpending: MonthlySpending[] = months.map((month) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);

        const monthTransactions = filteredTransactions.filter((t) => {
          const transactionDate = parseISO(t.date);
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

      console.log("Monthly data:", monthlySpending);
      setMonthlyData(monthlySpending);
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
        <h2 className="text-xl font-semibold mb-4">Monthly Spending</h2>
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
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Spending Bar Chart */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Monthly Spending</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="spending" fill="#ef4444" name="Net Spending" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Spending Trend */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Spending Trend</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Line
                type="monotone"
                dataKey="spending"
                stroke="#ef4444"
                strokeWidth={2}
                name="Monthly Spending"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
