import React, { useState, useEffect } from "react";
import { Calendar, DollarSign, RefreshCw, TrendingUp } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Transaction } from "../lib/supabase";

interface SubscriptionPattern {
  merchant: string;
  monthlyAmount: number;
  avgDayOfMonth: number;
  monthsWithActivity: string[];
  totalMonths: number;
  ytdTotal: number;
  lastTransactionDate: string;
  consistency: number; // Percentage of consistent months
  transactions: Transaction[];
}

export const SubscriptionTracker: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<SubscriptionPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSubscription, setExpandedSubscription] = useState<
    string | null
  >(null);

  useEffect(() => {
    analyzeSubscriptions();
  }, []);

  const parseDate = (dateStr: string): Date => {
    let cleanDateStr = dateStr;
    if (dateStr.includes("T")) {
      cleanDateStr = dateStr.split("T")[0];
    }
    const [year, month, day] = cleanDateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const analyzeSubscriptions = async () => {
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

      const subscriptionPatterns: SubscriptionPattern[] = [];

      // Analyze each merchant for subscription patterns
      merchantGroups.forEach((transactions, merchant) => {
        // Only consider merchants with at least 3 transactions
        if (transactions.length < 3) return;

        // Group transactions by month-year
        const monthlyTransactions = new Map<string, Transaction[]>();

        transactions.forEach((transaction) => {
          const date = parseDate(transaction.date);
          const monthYear = `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;

          if (!monthlyTransactions.has(monthYear)) {
            monthlyTransactions.set(monthYear, []);
          }
          monthlyTransactions.get(monthYear)!.push(transaction);
        });

        // Check for subscription patterns
        const monthsWithSingleTransaction = Array.from(
          monthlyTransactions.entries()
        )
          .filter(([, monthTransactions]) => monthTransactions.length === 1)
          .map(([monthYear, monthTransactions]) => ({
            monthYear,
            transaction: monthTransactions[0],
            date: parseDate(monthTransactions[0].date),
            amount: Math.abs(monthTransactions[0].amount),
          }));

        // Need at least 3 months of single transactions to consider as subscription
        if (monthsWithSingleTransaction.length < 3) return;

        // Check amount consistency (within 5% variance)
        const amounts = monthsWithSingleTransaction.map((m) => m.amount);
        const avgAmount =
          amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
        const amountVariance = amounts.every(
          (amt) => Math.abs(amt - avgAmount) / avgAmount <= 0.05
        );

        if (!amountVariance) return;

        // Check date consistency (within 5 days of each other)
        const days = monthsWithSingleTransaction.map((m) => m.date.getDate());
        const avgDay = days.reduce((sum, day) => sum + day, 0) / days.length;
        const dayConsistency = days.every((day) => Math.abs(day - avgDay) <= 5);

        if (!dayConsistency) return;

        // Calculate YTD total for current year
        const currentYear = new Date().getFullYear();
        const ytdTransactions = monthsWithSingleTransaction.filter(
          (m) => m.date.getFullYear() === currentYear
        );
        const ytdTotal = ytdTransactions.reduce((sum, m) => sum + m.amount, 0);

        // Calculate consistency percentage
        const totalPossibleMonths = getTotalMonthsInRange(
          monthsWithSingleTransaction
        );
        const consistency =
          (monthsWithSingleTransaction.length / totalPossibleMonths) * 100;

        // Only include subscriptions with at least 60% consistency
        if (consistency >= 60) {
          subscriptionPatterns.push({
            merchant,
            monthlyAmount: avgAmount,
            avgDayOfMonth: Math.round(avgDay),
            monthsWithActivity: monthsWithSingleTransaction.map(
              (m) => m.monthYear
            ),
            totalMonths: monthsWithSingleTransaction.length,
            ytdTotal,
            lastTransactionDate:
              monthsWithSingleTransaction[0].transaction.date,
            consistency,
            transactions: monthsWithSingleTransaction.map((m) => m.transaction),
          });
        }
      });

      // Sort by YTD total (highest first)
      subscriptionPatterns.sort((a, b) => b.ytdTotal - a.ytdTotal);

      setSubscriptions(subscriptionPatterns);
    } catch (error) {
      console.error("Error analyzing subscriptions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalMonthsInRange = (monthlyData: Array<{ monthYear: string }>) => {
    if (monthlyData.length === 0) return 0;

    const sortedMonths = monthlyData.map((m) => m.monthYear).sort();
    const firstMonth = sortedMonths[0];
    const lastMonth = sortedMonths[sortedMonths.length - 1];

    const [firstYear, firstMonthNum] = firstMonth.split("-").map(Number);
    const [lastYear, lastMonthNum] = lastMonth.split("-").map(Number);

    return (lastYear - firstYear) * 12 + (lastMonthNum - firstMonthNum) + 1;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getConsistencyColor = (consistency: number) => {
    if (consistency >= 90) return "text-green-600 bg-green-50";
    if (consistency >= 75) return "text-blue-600 bg-blue-50";
    if (consistency >= 60) return "text-yellow-600 bg-yellow-50";
    return "text-orange-600 bg-orange-50";
  };

  const totalMonthlySubscriptions = subscriptions.reduce(
    (sum, sub) => sum + sub.monthlyAmount,
    0
  );
  const totalYTDSubscriptions = subscriptions.reduce(
    (sum, sub) => sum + sub.ytdTotal,
    0
  );

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
            <RefreshCw className="h-6 w-6 text-purple-600 mr-2" />
            <h2 className="text-2xl font-semibold text-gray-900">
              Subscription Tracker
            </h2>
          </div>
          <button
            onClick={analyzeSubscriptions}
            className="flex items-center bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Analysis
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <TrendingUp className="h-5 w-5 text-purple-600 mr-2" />
              <span className="text-sm text-purple-600 font-medium">
                Monthly Total
              </span>
            </div>
            <p className="text-2xl font-bold text-purple-800 mt-1">
              {formatCurrency(totalMonthlySubscriptions)}
            </p>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-blue-600 mr-2" />
              <span className="text-sm text-blue-600 font-medium">
                YTD Total
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-800 mt-1">
              {formatCurrency(totalYTDSubscriptions)}
            </p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <DollarSign className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-sm text-green-600 font-medium">
                Active Subscriptions
              </span>
            </div>
            <p className="text-2xl font-bold text-green-800 mt-1">
              {subscriptions.length}
            </p>
          </div>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">
          Identified Subscriptions ({subscriptions.length})
        </h3>

        {subscriptions.length === 0 ? (
          <div className="text-center py-8">
            <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              No subscription patterns found
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Subscriptions require at least 3 months of consistent transactions
              with same amount and similar dates
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((subscription) => (
              <div
                key={subscription.merchant}
                className="border border-gray-200 rounded-lg"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() =>
                    setExpandedSubscription(
                      expandedSubscription === subscription.merchant
                        ? null
                        : subscription.merchant
                    )
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-lg">
                        {subscription.merchant}
                      </h4>
                      <div className="flex items-center mt-2 space-x-4">
                        <span className="text-sm text-gray-600">
                          Usually on day {subscription.avgDayOfMonth} of month
                        </span>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getConsistencyColor(
                            subscription.consistency
                          )}`}
                        >
                          {subscription.consistency.toFixed(0)}% consistent
                        </span>
                        <span className="text-sm text-gray-500">
                          {subscription.totalMonths} months active
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-purple-600">
                        {formatCurrency(subscription.monthlyAmount)}/month
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatCurrency(subscription.ytdTotal)} YTD
                      </div>
                    </div>
                  </div>
                </div>

                {expandedSubscription === subscription.merchant && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    <div className="p-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-3">
                        Transaction History:
                      </h5>
                      <div className="space-y-2">
                        {subscription.transactions
                          .sort(
                            (a, b) =>
                              new Date(b.date).getTime() -
                              new Date(a.date).getTime()
                          )
                          .map((transaction) => (
                            <div
                              key={transaction.id}
                              className="flex items-center justify-between py-2 px-3 bg-white rounded border"
                            >
                              <div className="flex items-center space-x-3">
                                <span className="text-sm text-gray-600">
                                  {(() => {
                                    const date = parseDate(transaction.date);
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
                                    return `${
                                      monthNames[date.getMonth()]
                                    } ${date.getDate()}, ${date.getFullYear()}`;
                                  })()}
                                </span>
                                <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800">
                                  {transaction.type}
                                </span>
                              </div>
                              <span className="text-sm font-medium text-red-600">
                                {formatCurrency(Math.abs(transaction.amount))}
                              </span>
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
