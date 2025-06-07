import React, { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ArrowLeft, Calendar, DollarSign } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Transaction } from "../lib/supabase";

interface MonthlyDetailProps {
  month: string;
  onBack: () => void;
}

interface MerchantGroup {
  merchant: string;
  totalAmount: number;
  transactionCount: number;
  transactions: Transaction[];
  types: string[];
}

export const MonthlyDetail: React.FC<MonthlyDetailProps> = ({
  month,
  onBack,
}) => {
  const [merchantGroups, setMerchantGroups] = useState<MerchantGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMerchant, setExpandedMerchant] = useState<string | null>(null);

  useEffect(() => {
    fetchMonthlyTransactions();
  }, [month]);

  const fetchMonthlyTransactions = async () => {
    setLoading(true);
    try {
      // Parse the month string (e.g., "Jan 2024")
      const monthDate = new Date(`${month} 01`);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("date", monthStart.toISOString().split("T")[0])
        .lte("date", monthEnd.toISOString().split("T")[0])
        .order("date", { ascending: false });

      if (error) {
        console.error("Error fetching monthly transactions:", error);
        return;
      }

      if (!transactions) {
        setLoading(false);
        return;
      }

      // Filter out payment transactions
      const filteredTransactions = transactions.filter(
        (t) => t.type.toLowerCase() !== "payment"
      );

      // Group transactions by merchant
      const merchantMap = new Map<string, MerchantGroup>();

      filteredTransactions.forEach((transaction) => {
        const merchant = transaction.merchant;

        if (merchantMap.has(merchant)) {
          const group = merchantMap.get(merchant)!;
          group.totalAmount += transaction.amount;
          group.transactionCount += 1;
          group.transactions.push(transaction);
          if (!group.types.includes(transaction.type)) {
            group.types.push(transaction.type);
          }
        } else {
          merchantMap.set(merchant, {
            merchant,
            totalAmount: transaction.amount,
            transactionCount: 1,
            transactions: [transaction],
            types: [transaction.type],
          });
        }
      });

      // Convert to array and sort by total amount (highest spending first)
      const groups = Array.from(merchantMap.values()).sort(
        (a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount)
      );

      setMerchantGroups(groups);
    } catch (error) {
      console.error("Error processing monthly transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Math.abs(amount));
  };

  const getTypeChipColor = (type: string) => {
    const lowerType = type.toLowerCase();

    switch (lowerType) {
      case "payment":
        return "bg-green-100 text-green-800";
      case "purchase":
      case "sale":
        return "bg-blue-100 text-blue-800";
      case "refund":
      case "return":
        return "bg-purple-100 text-purple-800";
      case "fee":
      case "charge":
        return "bg-red-100 text-red-800";
      case "transfer":
        return "bg-yellow-100 text-yellow-800";
      case "deposit":
        return "bg-emerald-100 text-emerald-800";
      case "withdrawal":
        return "bg-orange-100 text-orange-800";
      case "interest":
        return "bg-indigo-100 text-indigo-800";
      case "dividend":
        return "bg-teal-100 text-teal-800";
      case "adjustment":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const totalSpending = merchantGroups.reduce(
    (sum, group) => sum + Math.abs(group.totalAmount),
    0
  );

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
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
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-gray-800 mr-4"
            >
              <ArrowLeft className="h-5 w-5 mr-1" />
              Back to Charts
            </button>
            <div className="flex items-center">
              <Calendar className="h-6 w-6 text-blue-600 mr-2" />
              <h1 className="text-2xl font-semibold text-gray-900">
                {month} Details
              </h1>
            </div>
          </div>
          <div className="flex items-center bg-blue-50 px-4 py-2 rounded-lg">
            <DollarSign className="h-5 w-5 text-blue-600 mr-1" />
            <span className="text-lg font-semibold text-blue-800">
              {formatCurrency(totalSpending)} Total
            </span>
          </div>
        </div>
      </div>

      {/* Merchant Groups */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">
          Spending by Merchant ({merchantGroups.length} merchants)
        </h2>

        {merchantGroups.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No transactions found for this month.
          </p>
        ) : (
          <div className="space-y-3">
            {merchantGroups.map((group) => (
              <div
                key={group.merchant}
                className="border border-gray-200 rounded-lg"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() =>
                    setExpandedMerchant(
                      expandedMerchant === group.merchant
                        ? null
                        : group.merchant
                    )
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {group.merchant}
                      </h3>
                      <div className="flex items-center mt-1 space-x-2">
                        <span className="text-sm text-gray-500">
                          {group.transactionCount} transaction
                          {group.transactionCount !== 1 ? "s" : ""}
                        </span>
                        <div className="flex space-x-1">
                          {group.types.map((type) => (
                            <span
                              key={type}
                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${getTypeChipColor(
                                type
                              )}`}
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-lg font-semibold ${
                          group.totalAmount < 0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {group.totalAmount < 0 ? "-" : "+"}
                        {formatCurrency(group.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {expandedMerchant === group.merchant && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    <div className="p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">
                        Individual Transactions:
                      </h4>
                      <div className="space-y-2">
                        {group.transactions.map((transaction) => (
                          <div
                            key={transaction.id}
                            className="flex items-center justify-between py-2 px-3 bg-white rounded border"
                          >
                            <div className="flex items-center space-x-3">
                              <span className="text-sm text-gray-600">
                                {format(new Date(transaction.date), "MMM dd")}
                              </span>
                              <span
                                className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${getTypeChipColor(
                                  transaction.type
                                )}`}
                              >
                                {transaction.type}
                              </span>
                            </div>
                            <span
                              className={`text-sm font-medium ${
                                transaction.amount < 0
                                  ? "text-red-600"
                                  : "text-green-600"
                              }`}
                            >
                              {transaction.amount < 0 ? "-" : "+"}
                              {formatCurrency(transaction.amount)}
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
