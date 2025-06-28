import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from "react-router-dom";
import { CSVImport } from "./components/CSVImport";
import { PDFImport } from "./components/PDFImport";
import { TransactionList } from "./components/TransactionList";
import { SpendingCharts } from "./components/SpendingCharts";
import { MonthlyDetail } from "./components/MonthlyDetail";
import { SubscriptionTracker } from "./components/SubscriptionTracker";
import { RecurringExpenses } from "./components/RecurringExpenses";
import { TradingJournal } from "./components/TradingJournal";
import { TradingSettings } from "./components/TradingSettings";
import { Auth } from "./components/Auth";
import { supabase } from "./lib/supabase";
import {
  Trash2,
  TrendingUp,
  LogOut,
  BarChart3,
  List,
  PieChart,
  Repeat,
  CreditCard,
  Home,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// Sidebar component
const Sidebar: React.FC<{
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}> = ({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  isCollapsed,
  setIsCollapsed,
}) => {
  const location = useLocation();

  const navItems = [
    {
      path: "/",
      icon: Home,
      label: "Dashboard",
      description: "Overview & Import",
      subItems: [
        {
          path: "/transactions",
          icon: List,
          label: "Transactions",
          description: "View all transactions",
        },
        {
          path: "/charts",
          icon: PieChart,
          label: "Analytics",
          description: "Spending insights",
        },
        {
          path: "/subscriptions",
          icon: CreditCard,
          label: "Subscriptions",
          description: "Track recurring payments",
        },
        {
          path: "/recurring",
          icon: Repeat,
          label: "Recurring",
          description: "Expense patterns",
        },
      ],
    },
    {
      path: "/trading",
      icon: BarChart3,
      label: "Trading Journal",
      description: "Track your trades",
      subItems: [
        {
          path: "/trading/settings",
          icon: TrendingUp,
          label: "Settings",
          description: "Configure trading preferences",
        },
      ],
    },
  ];

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const isDashboardAreaActive = () => {
    return [
      "/",
      "/transactions",
      "/charts",
      "/subscriptions",
      "/recurring",
    ].includes(location.pathname);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className={`p-6 border-b border-gray-200 ${isCollapsed ? "px-3" : ""}`}
      >
        <div className="flex items-center">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-2 rounded-lg mr-3">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                FinanceTracker
              </h1>
              <p className="text-xs text-gray-500">Personal Finance Suite</p>
            </div>
          )}
        </div>
        {/* Toggle button - only show on desktop */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex items-center justify-center w-8 h-8 mt-4 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-6 space-y-2 ${isCollapsed ? "px-3" : "px-4"}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const isTradingJournal = item.path === "/trading";
          const isDashboard = item.path === "/";
          const hasSubItems = item.subItems && item.subItems.length > 0;

          return (
            <div key={item.path}>
              {/* Main navigation item */}
              <Link
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center py-3 rounded-lg transition-all duration-200 group ${
                  active || (isDashboard && isDashboardAreaActive())
                    ? isTradingJournal
                      ? "bg-gray-100 text-gray-900 border-l-4 border-gray-800"
                      : "bg-blue-50 text-blue-700 border-l-4 border-blue-500"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                } ${isCollapsed ? "justify-center px-1" : "px-3"}`}
                title={
                  isCollapsed
                    ? `${item.label} - ${item.description}`
                    : undefined
                }
              >
                <Icon
                  className={`h-5 w-5 ${
                    isCollapsed ? "" : "mr-3"
                  } transition-colors ${
                    active || (isDashboard && isDashboardAreaActive())
                      ? isTradingJournal
                        ? "text-gray-800"
                        : "text-blue-600"
                      : "text-gray-400 group-hover:text-gray-600"
                  }`}
                />
                {!isCollapsed && (
                  <div className="flex-1">
                    <div
                      className={`font-medium ${
                        active || (isDashboard && isDashboardAreaActive())
                          ? isTradingJournal
                            ? "text-gray-900"
                            : "text-blue-900"
                          : ""
                      }`}
                    >
                      {item.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {item.description}
                    </div>
                  </div>
                )}
              </Link>

              {/* Sub-navigation items - only show when not collapsed */}
              {hasSubItems && !isCollapsed && (
                <div className="ml-4 mt-2 space-y-1">
                  {item.subItems.map((subItem) => {
                    const SubIcon = subItem.icon;
                    const subActive = isActive(subItem.path);

                    return (
                      <Link
                        key={subItem.path}
                        to={subItem.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 group ${
                          subActive
                            ? "bg-blue-50 text-blue-700 border-l-2 border-blue-500"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        }`}
                      >
                        <SubIcon
                          className={`h-4 w-4 mr-3 transition-colors ${
                            subActive
                              ? "text-blue-600"
                              : "text-gray-400 group-hover:text-gray-600"
                          }`}
                        />
                        <div className="flex-1">
                          <div
                            className={`text-sm font-medium ${
                              subActive ? "text-blue-900" : ""
                            }`}
                          >
                            {subItem.label}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {subItem.description}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:bg-white lg:border-r lg:border-gray-200 transition-all duration-300 ${
          isCollapsed ? "lg:w-16" : "lg:w-64"
        }`}
      >
        {sidebarContent}
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

// Main content wrapper component
const MainContent: React.FC<{
  children: React.ReactNode;
  user: SupabaseUser;
  onSignOut: () => void;
  onDeleteAllData: () => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isCollapsed: boolean;
}> = ({
  children,
  user,
  onSignOut,
  onDeleteAllData,
  setIsMobileMenuOpen,
  isCollapsed,
}) => {
  const location = useLocation();

  const getPageTitle = () => {
    switch (location.pathname) {
      case "/":
        return "Dashboard";
      case "/transactions":
        return "Transactions";
      case "/charts":
        return "Analytics";
      case "/subscriptions":
        return "Subscriptions";
      case "/recurring":
        return "Recurring Expenses";
      case "/trading":
        return "Trading Journal";
      default:
        return "Finance Tracker";
    }
  };

  return (
    <div
      className={`flex flex-col min-h-screen bg-gray-50 transition-all duration-300 ${
        isCollapsed ? "lg:pl-16" : "lg:pl-64"
      }`}
    >
      {/* Mobile header */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="text-gray-600 hover:text-gray-900"
        >
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">
          {getPageTitle()}
        </h1>
        <button
          onClick={onSignOut}
          className="text-gray-600 hover:text-gray-900"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {getPageTitle()}
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              Welcome back, {user.email}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {location.pathname !== "/trading" && (
              <button
                onClick={onDeleteAllData}
                className="flex items-center bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All Data
              </button>
            )}
            <button
              onClick={onSignOut}
              className="flex items-center bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main
        className={`flex-1 ${
          location.pathname === "/trading" ? "px-4 py-6" : "px-8 py-8"
        } max-w-none`}
      >
        {children}
      </main>
    </div>
  );
};

function AppContent() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleImportComplete = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleDeleteAllData = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete ALL your financial data? This action cannot be undone."
      )
    ) {
      return;
    }

    if (
      !window.confirm(
        "This will permanently delete all your transactions, subscriptions, and other data. Are you absolutely sure?"
      )
    ) {
      return;
    }

    try {
      if (!user) return;

      await supabase.from("transactions").delete().eq("user_id", user.id);

      alert("All data has been deleted successfully.");
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Error deleting data:", error);
      alert("Error deleting data. Please try again.");
    }
  };

  const handleMonthClick = (month: string) => {
    setSelectedMonth(month);
  };

  const handleBackToCharts = () => {
    setSelectedMonth("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      <MainContent
        user={user}
        onSignOut={handleSignOut}
        onDeleteAllData={handleDeleteAllData}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isCollapsed={isCollapsed}
      >
        <Routes>
          <Route
            path="/"
            element={
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <CSVImport onImportComplete={handleImportComplete} />
                  <PDFImport onImportComplete={handleImportComplete} />
                </div>
                <TransactionList refreshKey={refreshKey} />
              </div>
            }
          />

          <Route
            path="/transactions"
            element={<TransactionList refreshKey={refreshKey} />}
          />

          <Route
            path="/charts"
            element={
              selectedMonth ? (
                <MonthlyDetail
                  month={selectedMonth}
                  onBack={handleBackToCharts}
                />
              ) : (
                <SpendingCharts
                  refreshKey={refreshKey}
                  onMonthClick={handleMonthClick}
                />
              )
            }
          />

          <Route path="/subscriptions" element={<SubscriptionTracker />} />

          <Route path="/recurring" element={<RecurringExpenses />} />

          <Route path="/trading" element={<TradingJournal />} />

          <Route path="/trading/settings" element={<TradingSettings />} />

          {/* Redirect any unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainContent>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
