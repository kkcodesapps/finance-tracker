import React, { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Transaction } from "../lib/supabase";

interface TransactionListProps {
  refreshKey?: number;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  refreshKey,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  useEffect(() => {
    fetchTransactions();
  }, [refreshKey]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (error) {
        console.error("Error fetching transactions:", error);
      } else {
        setTransactions(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
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

    // Define color schemes for different transaction types
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

  // Get unique months from transactions for the filter dropdown
  const getUniqueMonths = () => {
    const months = transactions.map((transaction) => {
      let dateStr = transaction.date;
      if (dateStr.includes("T")) {
        dateStr = dateStr.split("T")[0];
      }
      const [year, month] = dateStr.split("-");
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
      return {
        value: `${year}-${month}`,
        label: `${monthNames[parseInt(month) - 1]} ${year}`,
      };
    });

    // Remove duplicates and sort by date (newest first)
    const uniqueMonths = Array.from(
      new Map(months.map((m) => [m.value, m])).values()
    ).sort((a, b) => b.value.localeCompare(a.value));

    return uniqueMonths;
  };

  // Filter transactions based on search term and selected month
  const filteredTransactions = transactions.filter((transaction) => {
    // Month filter
    if (selectedMonth) {
      let dateStr = transaction.date;
      if (dateStr.includes("T")) {
        dateStr = dateStr.split("T")[0];
      }
      const [year, month] = dateStr.split("-");
      const transactionMonth = `${year}-${month}`;
      if (transactionMonth !== selectedMonth) {
        return false;
      }
    }

    // Search filter
    if (!searchTerm.trim()) return true;

    const search = searchTerm.toLowerCase();
    const merchant = transaction.merchant.toLowerCase();
    const type = transaction.type.toLowerCase();
    const amount = transaction.amount.toString();

    return (
      merchant.includes(search) ||
      type.includes(search) ||
      amount.includes(search)
    );
  });

  const clearSearch = () => {
    setSearchTerm("");
  };

  const clearMonth = () => {
    setSelectedMonth("");
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          Transactions ({filteredTransactions.length}
          {searchTerm && transactions.length !== filteredTransactions.length
            ? ` of ${transactions.length}`
            : ""}
          )
        </h2>
        {transactions.length > 0 &&
          (() => {
            // Filter out payment transactions for spending calculation
            const spendingTransactions = filteredTransactions.filter(
              (t) => t.type.toLowerCase() !== "payment"
            );
            const totalSpending = spendingTransactions.reduce(
              (sum, t) => sum + Math.abs(t.amount),
              0
            );

            return (
              <div className="flex items-center bg-red-50 px-4 py-2 rounded-lg">
                <span className="text-sm text-red-600 mr-2">
                  Total Spending:
                </span>
                <span className="text-lg font-semibold text-red-800">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(totalSpending)}
                </span>
              </div>
            );
          })()}
      </div>

      {/* Search and Filter Bar */}
      {transactions.length > 0 && (
        <div className="mb-4 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by merchant, type, or amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Month Filter */}
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Months</option>
                {getUniqueMonths().map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
            {selectedMonth && (
              <button
                onClick={clearMonth}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Status */}
          {(searchTerm || selectedMonth) && (
            <p className="text-sm text-gray-600">
              {filteredTransactions.length === 0
                ? "No transactions found matching your filters."
                : `Showing ${filteredTransactions.length} transaction${
                    filteredTransactions.length !== 1 ? "s" : ""
                  } 
                   ${searchTerm ? `matching "${searchTerm}"` : ""}
                   ${searchTerm && selectedMonth ? " in " : ""}
                   ${
                     selectedMonth
                       ? `${
                           getUniqueMonths().find(
                             (m) => m.value === selectedMonth
                           )?.label
                         }`
                       : ""
                   }`}
            </p>
          )}
        </div>
      )}

      {transactions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No transactions found. Import a CSV file to get started.
        </p>
      ) : filteredTransactions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No transactions match your search criteria.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-24 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Merchant
                </th>
                <th className="w-20 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="w-24 px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(() => {
                      // Handle date string directly to avoid timezone issues
                      let dateStr = transaction.date;
                      if (dateStr.includes("T")) {
                        dateStr = dateStr.split("T")[0]; // Extract date part if it's a timestamp
                      }
                      const [year, month, day] = dateStr.split("-");
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
                      return `${monthNames[parseInt(month) - 1]} ${parseInt(
                        day
                      )}, ${year}`;
                    })()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 break-words">
                    {transaction.merchant}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeChipColor(
                        transaction.type
                      )}`}
                    >
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <span
                      className={`font-medium ${
                        transaction.amount < 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {transaction.amount < 0 ? "-" : "+"}
                      {formatCurrency(transaction.amount)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
