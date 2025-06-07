import React, { useState, useEffect } from "react";
import { format } from "date-fns";
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

  useEffect(() => {
    fetchTransactions();
  }, [refreshKey]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
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
      <h2 className="text-xl font-semibold mb-4">
        Transactions ({transactions.length})
      </h2>

      {transactions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No transactions found. Import a CSV file to get started.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Merchant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(transaction.date), "MMM dd, yyyy")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
