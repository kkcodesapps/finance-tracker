import React, { useState } from "react";
import { CSVImport } from "./components/CSVImport";
import { TransactionList } from "./components/TransactionList";
import { SpendingCharts } from "./components/SpendingCharts";
import { MonthlyDetail } from "./components/MonthlyDetail";
import { supabase } from "./lib/supabase";
import { Trash2, TrendingUp } from "lucide-react";

function App() {
  const [activeTab, setActiveTab] = useState<
    "import" | "transactions" | "charts" | "monthly"
  >("import");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  const handleImportComplete = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleDeleteAllData = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete ALL transaction data? This action cannot be undone."
    );

    if (!confirmed) return;

    const deleteConfirmation = window.prompt(
      'Type "DELETE" to confirm you want to permanently delete all data:'
    );

    if (deleteConfirmation !== "DELETE") {
      alert('Deletion cancelled. You must type "DELETE" exactly.');
      return;
    }

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all rows

      if (error) {
        console.error("Error deleting data:", error);
        alert("Error deleting data. Please check the console.");
      } else {
        alert("All transaction data has been deleted.");
        setRefreshKey((prev) => prev + 1);
        setActiveTab("import");
      }
    } catch (error) {
      console.error("Error deleting data:", error);
      alert("Error deleting data.");
    }
  };

  const handleMonthClick = (month: string) => {
    setSelectedMonth(month);
    setActiveTab("monthly");
  };

  const handleBackToCharts = () => {
    setActiveTab("charts");
    setSelectedMonth("");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-3xl font-bold text-gray-900">
                Finance Tracker
              </h1>
            </div>
            <button
              onClick={handleDeleteAllData}
              className="flex items-center bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Data
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        {activeTab !== "monthly" && (
          <div className="bg-white rounded-lg shadow-md mb-6">
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab("import")}
                className={`px-6 py-3 font-medium ${
                  activeTab === "import"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Import CSV
              </button>
              <button
                onClick={() => setActiveTab("transactions")}
                className={`px-6 py-3 font-medium ${
                  activeTab === "transactions"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Transactions
              </button>
              <button
                onClick={() => setActiveTab("charts")}
                className={`px-6 py-3 font-medium ${
                  activeTab === "charts"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Charts
              </button>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === "import" && (
          <CSVImport onImportComplete={handleImportComplete} />
        )}

        {activeTab === "transactions" && (
          <TransactionList refreshKey={refreshKey} />
        )}

        {activeTab === "charts" && (
          <SpendingCharts
            refreshKey={refreshKey}
            onMonthClick={handleMonthClick}
          />
        )}

        {activeTab === "monthly" && selectedMonth && (
          <MonthlyDetail month={selectedMonth} onBack={handleBackToCharts} />
        )}
      </div>
    </div>
  );
}

export default App;
