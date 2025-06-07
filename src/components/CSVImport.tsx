import React, { useRef, useState } from "react";
import Papa from "papaparse";
import { Upload, CheckCircle, AlertCircle, Info } from "lucide-react";
import { supabase } from "../lib/supabase";

interface CSVImportProps {
  onImportComplete: () => void;
}

interface CSVRow {
  [key: string]: string;
}

interface ColumnMapping {
  date: string;
  amount: string;
  type: string;
  merchant: string;
  status?: string;
}

export const CSVImport: React.FC<CSVImportProps> = ({ onImportComplete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    date: "",
    amount: "",
    type: "",
    merchant: "",
    status: "",
  });
  const [showMapping, setShowMapping] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Common column name patterns
  const columnPatterns = {
    date: [
      "date",
      "transaction date",
      "posted date",
      "trans date",
      "transaction_date",
      "posted_date",
    ],
    amount: [
      "amount",
      "transaction amount",
      "debit",
      "credit",
      "transaction_amount",
      "trans_amount",
    ],
    type: [
      "type",
      "transaction type",
      "category",
      "trans type",
      "transaction_type",
      "trans_type",
    ],
    merchant: [
      "merchant",
      "description",
      "payee",
      "vendor",
      "business",
      "transaction_description",
      "desc",
    ],
    status: [
      "status",
      "transaction status",
      "state",
      "trans status",
      "transaction_status",
    ],
  };

  const findBestMatch = (
    availableColumns: string[],
    patterns: string[]
  ): string => {
    const lowerColumns = availableColumns.map((col) => col.toLowerCase());

    for (const pattern of patterns) {
      const match = lowerColumns.find((col) => col.includes(pattern));
      if (match) {
        return availableColumns[lowerColumns.indexOf(match)];
      }
    }
    return "";
  };

  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please select a CSV file.");
      return;
    }

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        try {
          const data = results.data as CSVRow[];
          const filteredData = data.filter((row) =>
            Object.values(row).some((value) => value && value.trim() !== "")
          );

          if (filteredData.length === 0) {
            alert("No valid data found in CSV file.");
            return;
          }

          const detectedColumns = Object.keys(filteredData[0]);

          // Auto-detect column mappings
          const autoMapping: ColumnMapping = {
            date: findBestMatch(detectedColumns, columnPatterns.date),
            amount: findBestMatch(detectedColumns, columnPatterns.amount),
            type: findBestMatch(detectedColumns, columnPatterns.type),
            merchant: findBestMatch(detectedColumns, columnPatterns.merchant),
            status: findBestMatch(detectedColumns, columnPatterns.status),
          };

          setCsvData(filteredData);
          setColumns(detectedColumns);
          setColumnMapping(autoMapping);
          setShowMapping(true);
        } catch (error) {
          console.error("Error processing CSV:", error);
          alert("Error processing CSV file.");
        }
      },
      error: (error) => {
        console.error("CSV parsing error:", error);
        alert("Error parsing CSV file.");
      },
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    processFile(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      processFile(file);
    }
  };

  const handleImport = async () => {
    if (!csvData.length) return;

    const { date, amount, type, merchant, status } = columnMapping;

    if (!date || !amount || !type || !merchant) {
      alert("Please map all required columns before importing.");
      return;
    }

    setImporting(true);

    try {
      let filteredTransactions = csvData.filter(
        (row) => row[date] && row[amount] && row[type] && row[merchant]
      );

      // Filter out declined transactions if status column is mapped
      let declinedCount = 0;
      if (status && status.trim() !== "") {
        const beforeFilter = filteredTransactions.length;
        filteredTransactions = filteredTransactions.filter((row) => {
          const statusValue = row[status]?.toLowerCase().trim();
          return (
            statusValue !== "declined" &&
            statusValue !== "rejected" &&
            statusValue !== "failed"
          );
        });
        declinedCount = beforeFilter - filteredTransactions.length;
      }

      const transactions = filteredTransactions
        .map((row) => {
          let amountValue = parseFloat(row[amount].replace(/[,$]/g, ""));

          // Handle negative amounts in parentheses (e.g., "(100.00)")
          if (row[amount].includes("(") && row[amount].includes(")")) {
            amountValue = -Math.abs(amountValue);
          }

          return {
            date: row[date],
            amount: amountValue,
            type: row[type],
            merchant: row[merchant],
          };
        })
        .filter((t) => !isNaN(t.amount));

      if (transactions.length === 0) {
        alert(
          "No valid transactions found after processing. Please check your column mappings."
        );
        setImporting(false);
        return;
      }

      const { error } = await supabase
        .from("transactions")
        .insert(transactions);

      if (error) {
        console.error("Error inserting transactions:", error);
        alert("Error importing transactions. Please check the console.");
      } else {
        let message = `Successfully imported ${transactions.length} transactions!`;
        if (declinedCount > 0) {
          message += ` (${declinedCount} declined transactions were excluded)`;
        }
        alert(message);
        onImportComplete();
        setShowMapping(false);
        setCsvData([]);
        setColumns([]);
      }
    } catch (error) {
      console.error("Error processing transactions:", error);
      alert("Error processing transactions.");
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setShowMapping(false);
    setCsvData([]);
    setColumns([]);
    setColumnMapping({
      date: "",
      amount: "",
      type: "",
      merchant: "",
      status: "",
    });
  };

  const getPreviewStats = () => {
    if (!csvData.length) return null;

    const { status } = columnMapping;
    let declinedCount = 0;
    let validCount = csvData.length;

    if (status && status.trim() !== "") {
      declinedCount = csvData.filter((row) => {
        const statusValue = row[status]?.toLowerCase().trim();
        return (
          statusValue === "declined" ||
          statusValue === "rejected" ||
          statusValue === "failed"
        );
      }).length;
      validCount = csvData.length - declinedCount;
    }

    return {
      total: csvData.length,
      declined: declinedCount,
      valid: validCount,
    };
  };

  if (showMapping) {
    const stats = getPreviewStats();

    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Map CSV Columns</h2>
        <p className="text-gray-600 mb-6">
          Found {csvData.length} rows. Please map your CSV columns to the
          required fields:
        </p>

        {stats && stats.declined > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
            <div className="flex">
              <Info className="h-5 w-5 text-yellow-400 mr-2 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  Status Filter Active
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  {stats.declined} declined/rejected transactions will be
                  excluded.
                  {stats.valid} valid transactions will be imported.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {Object.entries(columnMapping).map(([field, value]) => {
            const isRequired = field !== "status";
            return (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                  {field}
                  {!isRequired && (
                    <span className="text-gray-500 text-xs ml-1">
                      (optional)
                    </span>
                  )}
                  {value ? (
                    <CheckCircle className="inline h-4 w-4 text-green-500 ml-1" />
                  ) : isRequired ? (
                    <AlertCircle className="inline h-4 w-4 text-red-500 ml-1" />
                  ) : null}
                </label>
                <select
                  value={value}
                  onChange={(e) =>
                    setColumnMapping((prev) => ({
                      ...prev,
                      [field]: e.target.value,
                    }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select column...</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        {csvData.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Preview (first 3 rows):
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.slice(0, 6).map((col) => (
                      <th key={col} className="px-2 py-1 text-left border-b">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 3).map((row, idx) => (
                    <tr key={idx}>
                      {columns.slice(0, 6).map((col) => (
                        <td key={col} className="px-2 py-1 border-b">
                          {row[col]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            onClick={handleImport}
            disabled={
              importing ||
              !columnMapping.date ||
              !columnMapping.amount ||
              !columnMapping.type ||
              !columnMapping.merchant
            }
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded transition-colors"
          >
            {importing ? "Importing..." : "Import Transactions"}
          </button>
          <button
            onClick={resetImport}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Import Transactions</h2>
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload
          className={`mx-auto h-12 w-12 mb-4 ${
            isDragOver ? "text-blue-500" : "text-gray-400"
          }`}
        />
        <p className={`mb-4 ${isDragOver ? "text-blue-700" : "text-gray-600"}`}>
          {isDragOver
            ? "Drop your CSV file here!"
            : "Drag and drop a CSV file here, or click to browse"}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="hidden"
          id="csv-upload"
        />
        <label
          htmlFor="csv-upload"
          className={`px-4 py-2 rounded cursor-pointer inline-block transition-colors ${
            isDragOver
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          Choose CSV File
        </label>
      </div>
    </div>
  );
};
