import React, { useState } from "react";
import { CSVImport } from "./components/CSVImport";
import { TransactionList } from "./components/TransactionList";
import { SpendingCharts } from "./components/SpendingCharts";
import { DollarSign, Upload, BarChart3, List, Trash2 } from "lucide-react";
import { supabase } from "./lib/supabase";

function App() {
  const [activeTab, setActiveTab] = useState<
    "import" | "transactions" | "charts"
  >("import");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleImportComplete = () => {
    setRefreshKey((prev) => prev + 1);
    setActiveTab("transactions");
  };

  const handleDeleteAllTransactions = async () => {
    const confirmMessage =
      "Are you sure you want to delete ALL transaction data? This action cannot be undone.";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    // Double confirmation for safety
    const doubleConfirm =
      'This will permanently delete all your financial data. Type "DELETE" to confirm:';
    const userInput = window.prompt(doubleConfirm);

    if (userInput !== "DELETE") {
      alert('Deletion cancelled. You must type "DELETE" exactly to confirm.');
      return;
    }

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all rows

      if (error) {
        console.error("Error deleting transactions:", error);
        alert("Error deleting transactions. Please check the console.");
      } else {
        alert("All transaction data has been successfully deleted.");
        setRefreshKey((prev) => prev + 1); // Refresh all components
        setActiveTab("import"); // Navigate back to import tab
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred while deleting transactions.");
    } finally {
      setIsDeleting(false);
    }
  };

  const tabs = [
    { id: "import" as const, label: "Import CSV", icon: Upload },
    { id: "transactions" as const, label: "Transactions", icon: List },
    { id: "charts" as const, label: "Charts", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-blue-600" />
              <h1 className="ml-2 text-xl font-semibold text-gray-900">
                Finance Tracker
              </h1>
            </div>

            {/* Delete All Button */}
            <div className="flex items-center">
              <button
                onClick={handleDeleteAllTransactions}
                disabled={isDeleting}
                className="flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete all transaction data"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {isDeleting ? "Deleting..." : "Delete All Data"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "import" && (
          <CSVImport onImportComplete={handleImportComplete} />
        )}

        {activeTab === "transactions" && (
          <TransactionList refreshKey={refreshKey} />
        )}

        {activeTab === "charts" && <SpendingCharts refreshKey={refreshKey} />}
      </main>
    </div>
  );
}

export default App;
