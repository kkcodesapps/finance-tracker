import React, { useRef, useState } from "react";
import { FileText, AlertCircle, Check, Shield, X, Info } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { supabase } from "../lib/supabase";

// Set up PDF.js worker using local file
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

interface PDFImportProps {
  onImportComplete: () => void;
}

interface ExtractedTransaction {
  date: string;
  amount: number;
  description: string;
  type: string;
  balance?: number;
}

interface SuccessMessage {
  imported: number;
  duplicates: number;
  failed: number;
}

export const PDFImport: React.FC<PDFImportProps> = ({ onImportComplete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extractedTransactions, setExtractedTransactions] = useState<
    ExtractedTransaction[]
  >([]);
  const [showPreview, setShowPreview] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [successMessage, setSuccessMessage] = useState<SuccessMessage | null>(
    null
  );
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const datePatterns = [
    // MM/DD/YYYY or MM/DD/YY
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
    // MM/DD (current year assumed)
    /(\d{1,2})\/(\d{1,2})$/,
    // YYYY-MM-DD
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
  ];

  const parseAmount = (amountStr: string): number => {
    console.log("Original amount string:", amountStr);

    if (!amountStr || typeof amountStr !== "string") {
      console.log("Invalid amount string:", amountStr);
      return 0;
    }

    // Remove currency symbols and commas, but preserve decimal points
    let cleanAmount = amountStr.replace(/[$,]/g, "").trim();
    console.log("After removing $ and commas:", cleanAmount);

    // Handle parentheses for negative amounts
    if (cleanAmount.includes("(") && cleanAmount.includes(")")) {
      cleanAmount = "-" + cleanAmount.replace(/[()]/g, "");
    }

    // Handle negative signs - fix the logic here
    if (cleanAmount.startsWith("-")) {
      // Already has negative sign, keep it
    } else if (cleanAmount.endsWith("-")) {
      // Move trailing negative to front
      cleanAmount = "-" + cleanAmount.slice(0, -1);
    }

    console.log("After handling negatives:", cleanAmount);

    // Validate that we have a proper number format
    if (!/^-?\d+(\.\d{1,2})?$/.test(cleanAmount)) {
      console.log("Invalid number format:", cleanAmount);
      return 0;
    }

    // Parse the float
    const result = parseFloat(cleanAmount) || 0;
    console.log("Final parsed amount:", result);

    // Sanity check - if the result is unreasonably large, return 0
    if (Math.abs(result) > 1000000) {
      console.log("Amount too large, likely parsing error:", result);
      return 0;
    }

    return result;
  };

  const normalizeDate = (dateStr: string): string => {
    const currentYear = new Date().getFullYear();

    for (const pattern of datePatterns) {
      const match = dateStr.match(pattern);
      if (match) {
        if (pattern.source.includes("YYYY")) {
          // YYYY-MM-DD format
          const [, year, month, day] = match;
          return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        } else if (match.length === 4) {
          // MM/DD/YYYY or MM/DD/YY
          const [, month, day, year] = match;
          const fullYear =
            year.length === 2
              ? parseInt(year) > 50
                ? `19${year}`
                : `20${year}`
              : year;
          return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(
            2,
            "0"
          )}`;
        } else if (match.length === 3) {
          // MM/DD (assume current year)
          const [, month, day] = match;
          return `${currentYear}-${month.padStart(2, "0")}-${day.padStart(
            2,
            "0"
          )}`;
        }
      }
    }

    return dateStr; // Return original if no pattern matches
  };

  const determineTransactionType = (
    description: string,
    amount: number
  ): string => {
    const desc = description.toLowerCase();

    if (amount > 0) {
      if (
        desc.includes("deposit") ||
        desc.includes("credit") ||
        desc.includes("refund")
      ) {
        return "deposit";
      }
      return "credit";
    } else {
      if (desc.includes("fee") || desc.includes("charge")) {
        return "fee";
      }
      if (desc.includes("withdrawal") || desc.includes("atm")) {
        return "withdrawal";
      }
      if (desc.includes("payment") || desc.includes("transfer")) {
        return "payment";
      }
      if (desc.includes("purchase") || desc.includes("pos")) {
        return "purchase";
      }
      return "debit";
    }
  };

  const extractTransactionsFromText = (
    text: string
  ): ExtractedTransaction[] => {
    const transactions: ExtractedTransaction[] = [];

    console.log("Original PDF text:", text);

    // Split text into ATM and Electronic sections
    const atmSectionMatch = text.match(
      /ATM & DEBIT CARD WITHDRAWALS[\s\S]*?(?=ELECTRONIC WITHDRAWALS|Total ATM)/
    );
    const electronicSectionMatch = text.match(
      /ELECTRONIC WITHDRAWALS[\s\S]*?(?=Total Electronic|IN CASE OF ERRORS)/
    );

    console.log("ATM section found:", !!atmSectionMatch);
    console.log("Electronic section found:", !!electronicSectionMatch);

    // Process ATM section
    if (atmSectionMatch) {
      const atmSection = atmSectionMatch[0];
      console.log("Processing ATM section:", atmSection);

      const atmTransactions = extractATMTransactions(atmSection);
      transactions.push(...atmTransactions);
      console.log(`Found ${atmTransactions.length} ATM transactions`);
    }

    // Process Electronic section
    if (electronicSectionMatch) {
      const electronicSection = electronicSectionMatch[0];
      console.log("Processing Electronic section:", electronicSection);

      const electronicTransactions =
        extractElectronicTransactions(electronicSection);
      transactions.push(...electronicTransactions);
      console.log(
        `Found ${electronicTransactions.length} Electronic transactions`
      );
    }

    console.log("All extracted transactions:", transactions);

    return transactions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  const extractATMTransactions = (
    atmSection: string
  ): ExtractedTransaction[] => {
    const transactions: ExtractedTransaction[] = [];

    // Pattern for Card Purchase With Pin transactions
    const atmPattern =
      /(\d{1,2}\/\d{1,2})\s+Card Purchase With Pin\s+\d{1,2}\/\d{1,2}\s+(.+?)\s+Card\s+\d+\s+\$?([+-]?\d+\.?\d{0,2})/g;

    let match;
    while ((match = atmPattern.exec(atmSection)) !== null) {
      const [, date, description, amountStr] = match;
      console.log("ATM transaction match:", { date, description, amountStr });

      const amount = parseAmount(amountStr);

      if (amount !== 0) {
        const normalizedDate = normalizeDate(date);
        const cleanDescription = `Card Purchase With Pin ${description.trim()}`;
        const type = determineTransactionType(cleanDescription, amount);

        transactions.push({
          date: normalizedDate,
          amount,
          description: cleanDescription,
          type,
        });
      }
    }

    return transactions;
  };

  const extractElectronicTransactions = (
    electronicSection: string
  ): ExtractedTransaction[] => {
    const transactions: ExtractedTransaction[] = [];

    // Split the electronic section into individual transaction lines by looking for date patterns
    // Use a more precise approach - match each transaction individually
    const transactionPatterns = [
      // Pwp transactions (Privacy.com) - ignore TN numbers entirely
      {
        pattern:
          /(\d{1,2}\/\d{1,2})\s+(Pwp\s+[^$]+?)\s+\$?([+-]?\d+\.?\d{0,2})(?=\s+\d{1,2}\/\d{1,2}|\s+Total|\s*$)/g,
        type: "PRIVACY_COM",
      },

      // Applecard transactions
      {
        pattern:
          /(\d{1,2}\/\d{1,2})\s+(Applecard\s+[^$]+?)\s+\$?([+-]?\d+\.?\d{0,2})(?=\s+\d{1,2}\/\d{1,2}|\s+Total|\s*$)/g,
        type: "APPLECARD",
      },

      // Robinhood transactions
      {
        pattern:
          /(\d{1,2}\/\d{1,2})\s+(Robinhood\s+Debits\s+\d+\s+Web ID:\s+\d+)\s+\$?([+-]?[\d,]+\.?\d{0,2})(?=\s+\d{1,2}\/\d{1,2}|\s+Total|\s*$)/g,
        type: "ROBINHOOD",
      },

      // Tesla transactions
      {
        pattern:
          /(\d{1,2}\/\d{1,2})\s+(Tesla Motors\s+Tesla Moto\s+PPD ID:\s+\d+)\s+\$?([+-]?\d+\.?\d{0,2})(?=\s+\d{1,2}\/\d{1,2}|\s+Total|\s*$)/g,
        type: "TESLA",
      },

      // Chase Credit Card Autopay
      {
        pattern:
          /(\d{1,2}\/\d{1,2})\s+(Chase Credit Crd Autopay\s+PPD ID:\s+\d+)\s+\$?([+-]?\d+\.?\d{0,2})(?=\s+\d{1,2}\/\d{1,2}|\s+Total|\s*$)/g,
        type: "CHASE_AUTOPAY",
      },
    ];

    for (const { pattern, type } of transactionPatterns) {
      let match;
      while ((match = pattern.exec(electronicSection)) !== null) {
        const [, date, description, amountStr] = match;

        console.log(`${type} transaction match:`, {
          date,
          description,
          amountStr,
        });

        // Type guards to ensure we have valid values
        if (!date || !description || !amountStr) {
          console.log(`Skipping match due to missing data:`, {
            date,
            description,
            amountStr,
          });
          continue;
        }

        const amount = parseAmount(amountStr);

        if (amount !== 0 && description && description.trim().length > 2) {
          const normalizedDate = normalizeDate(date);
          let cleanDescription = description.trim().replace(/\s+/g, " ");

          // For Privacy.com transactions, clean up the description by removing TN and Web ID info
          if (type === "PRIVACY_COM") {
            cleanDescription = cleanDescription
              .replace(/\s+TN:\s+\d+.*?Web ID:\s+\d+/g, "")
              .trim();
          }

          const transactionType = determineTransactionType(
            cleanDescription,
            amount
          );

          // Check if this exact transaction already exists
          const exists = transactions.some(
            (t) =>
              t.date === normalizedDate &&
              Math.abs(t.amount - amount) < 0.01 &&
              t.description.toLowerCase() === cleanDescription.toLowerCase()
          );

          if (!exists) {
            transactions.push({
              date: normalizedDate,
              amount,
              description: cleanDescription,
              type: transactionType,
            });
          } else {
            console.log(`Skipping duplicate: ${cleanDescription} - ${amount}`);
          }
        }
      }

      // Reset regex for next pattern
      pattern.lastIndex = 0;
    }

    return transactions;
  };

  const processPDFFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setExtractionError("Please select a PDF file.");
      return;
    }

    setProcessing(true);
    setExtractionError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = "";

      // Extract text from all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => (item as { str: string }).str)
          .join(" ");
        fullText += pageText + "\n";
      }

      console.log("Extracted PDF text:", fullText);

      // Extract transactions from the text
      const transactions = extractTransactionsFromText(fullText);

      if (transactions.length === 0) {
        setExtractionError(
          "No transactions found in the PDF. The PDF format might not be supported or the text might not be extractable."
        );
        return;
      }

      console.log("Extracted transactions:", transactions);
      setExtractedTransactions(transactions);
      setShowPreview(true);
    } catch (error) {
      console.error("Error processing PDF:", error);
      setExtractionError(
        "Error processing PDF file. The file might be corrupted or password-protected."
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    processPDFFile(file);

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
      processPDFFile(file);
    }
  };

  const generateTransactionHash = (
    transaction: ExtractedTransaction
  ): string => {
    const normalizedDate = new Date(transaction.date)
      .toISOString()
      .split("T")[0];
    const normalizedAmount = Math.round(transaction.amount * 100) / 100;
    const normalizedDescription = transaction.description.toLowerCase().trim();
    const normalizedType = transaction.type.toLowerCase().trim();

    const hashString = `${normalizedDate}-${normalizedAmount}-${normalizedType}-${normalizedDescription}`;
    console.log("Generated hash for new transaction:", hashString);
    return btoa(hashString);
  };

  const checkForDuplicates = async (transactions: ExtractedTransaction[]) => {
    try {
      const { data: existingTransactions, error } = await supabase
        .from("transactions")
        .select("date, amount, type, merchant");

      if (error) {
        console.error("Error fetching existing transactions:", error);
        return { newTransactions: transactions, duplicateCount: 0 };
      }

      if (!existingTransactions || existingTransactions.length === 0) {
        return { newTransactions: transactions, duplicateCount: 0 };
      }

      const existingHashes = new Set(
        existingTransactions.map((t) => {
          const normalizedDate = new Date(t.date).toISOString().split("T")[0];
          const normalizedAmount = Math.round(t.amount * 100) / 100;
          const normalizedType = t.type.toLowerCase().trim();
          const normalizedMerchant = t.merchant.toLowerCase().trim();

          const hashString = `${normalizedDate}-${normalizedAmount}-${normalizedType}-${normalizedMerchant}`;
          console.log("Generated hash for existing transaction:", hashString);
          return btoa(hashString);
        })
      );

      const newTransactions = transactions.filter((t) => {
        const hash = generateTransactionHash(t);
        return !existingHashes.has(hash);
      });

      const duplicateCount = transactions.length - newTransactions.length;

      return { newTransactions, duplicateCount };
    } catch (error) {
      console.error("Error checking for duplicates:", error);
      return { newTransactions: transactions, duplicateCount: 0 };
    }
  };

  const handleImport = async () => {
    if (!extractedTransactions.length) return;

    setImporting(true);

    try {
      console.log("Starting import with transactions:", extractedTransactions);

      const { newTransactions, duplicateCount } = await checkForDuplicates(
        extractedTransactions
      );

      console.log("After duplicate check - new transactions:", newTransactions);

      if (newTransactions.length === 0) {
        setSuccessMessage({
          imported: 0,
          duplicates: duplicateCount,
          failed: 0,
        });
      } else {
        const transactionsToInsert = newTransactions.map((t) => ({
          date: t.date,
          amount: t.amount,
          type: t.type,
          merchant: t.description,
        }));

        console.log("Transactions to insert:", transactionsToInsert);

        const { error } = await supabase
          .from("transactions")
          .insert(transactionsToInsert);

        if (error) {
          console.error("Error inserting transactions:", error);
          setSuccessMessage({
            imported: 0,
            duplicates: duplicateCount,
            failed: newTransactions.length,
          });
        } else {
          console.log("Successfully inserted transactions");
          setSuccessMessage({
            imported: newTransactions.length,
            duplicates: duplicateCount,
            failed: 0,
          });
        }
      }

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
        onImportComplete();
        setShowPreview(false);
        setExtractedTransactions([]);
      }, 5000);
    } catch (error) {
      console.error("Error processing transactions:", error);
      setSuccessMessage({
        imported: 0,
        duplicates: 0,
        failed: extractedTransactions.length,
      });
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setShowPreview(false);
    setExtractedTransactions([]);
    setExtractionError(null);
    setSuccessMessage(null);
  };

  const dismissSuccess = () => {
    setSuccessMessage(null);
    onImportComplete();
    setShowPreview(false);
    setExtractedTransactions([]);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Success notification component
  if (successMessage) {
    const isAllDuplicates =
      successMessage.imported === 0 && successMessage.duplicates > 0;
    const hasFailures = successMessage.failed > 0;

    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div
          className={`${
            hasFailures
              ? "bg-red-50 border-red-200"
              : isAllDuplicates
              ? "bg-yellow-50 border-yellow-200"
              : "bg-green-50 border-green-200"
          } border rounded-md p-6`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {hasFailures ? (
                <AlertCircle className="h-6 w-6 text-red-600" />
              ) : isAllDuplicates ? (
                <Shield className="h-6 w-6 text-yellow-600" />
              ) : (
                <Check className="h-6 w-6 text-green-600" />
              )}
            </div>
            <div className="ml-3 flex-1">
              <h3
                className={`text-lg font-medium ${
                  hasFailures
                    ? "text-red-800"
                    : isAllDuplicates
                    ? "text-yellow-800"
                    : "text-green-800"
                }`}
              >
                {hasFailures
                  ? "Import Failed!"
                  : isAllDuplicates
                  ? "Duplicates Detected!"
                  : "Import Successful!"}
              </h3>
              <div
                className={`mt-2 text-sm ${
                  hasFailures
                    ? "text-red-700"
                    : isAllDuplicates
                    ? "text-yellow-700"
                    : "text-green-700"
                }`}
              >
                {successMessage.imported > 0 && (
                  <p className="mb-2">
                    Successfully imported{" "}
                    <span className="font-semibold">
                      {successMessage.imported}
                    </span>{" "}
                    transactions from PDF.
                  </p>
                )}
                {successMessage.duplicates > 0 && (
                  <p className="mb-2">
                    <span className="font-semibold">
                      {successMessage.duplicates}
                    </span>{" "}
                    duplicate transactions were skipped.
                  </p>
                )}
                {successMessage.failed > 0 && (
                  <p className="mb-2">
                    <span className="font-semibold">
                      {successMessage.failed}
                    </span>{" "}
                    transactions failed to import.
                  </p>
                )}
                <p
                  className={`text-xs ${
                    hasFailures
                      ? "text-red-600"
                      : isAllDuplicates
                      ? "text-yellow-600"
                      : "text-green-600"
                  }`}
                >
                  This message will auto-close in 5 seconds...
                </p>
              </div>
              <div className="mt-4">
                <button
                  onClick={dismissSuccess}
                  className={`${
                    hasFailures
                      ? "bg-red-600 hover:bg-red-700"
                      : isAllDuplicates
                      ? "bg-yellow-600 hover:bg-yellow-700"
                      : "bg-green-600 hover:bg-green-700"
                  } text-white px-4 py-2 rounded-md text-sm font-medium transition-colors`}
                >
                  {hasFailures
                    ? "Try Again"
                    : isAllDuplicates
                    ? "Continue"
                    : "View Transactions"}
                </button>
              </div>
            </div>
            <div className="ml-4 flex-shrink-0">
              <button
                onClick={dismissSuccess}
                className={`${
                  hasFailures
                    ? "bg-red-50 text-red-400 hover:text-red-600 focus:ring-red-500"
                    : isAllDuplicates
                    ? "bg-yellow-50 text-yellow-400 hover:text-yellow-600 focus:ring-yellow-500"
                    : "bg-green-50 text-green-400 hover:text-green-600 focus:ring-green-500"
                } rounded-md p-1 focus:outline-none focus:ring-2`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showPreview) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">PDF Transaction Preview</h2>
        <p className="text-gray-600 mb-6">
          Found {extractedTransactions.length} transactions in the PDF. Review
          and import:
        </p>

        {/* Duplicate Protection Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <div className="flex">
            <Shield className="h-5 w-5 text-blue-400 mr-2 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">
                Duplicate Protection Enabled
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                The system will automatically detect and skip duplicate
                transactions.
              </p>
            </div>
          </div>
        </div>

        {/* Transaction Preview */}
        <div className="mb-6 max-h-96 overflow-y-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left border-b">Date</th>
                <th className="px-3 py-2 text-left border-b">Amount</th>
                <th className="px-3 py-2 text-left border-b">Type</th>
                <th className="px-3 py-2 text-left border-b">Description</th>
              </tr>
            </thead>
            <tbody>
              {extractedTransactions.map((transaction, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border-b">{transaction.date}</td>
                  <td
                    className={`px-3 py-2 border-b font-medium ${
                      transaction.amount >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatCurrency(transaction.amount)}
                  </td>
                  <td className="px-3 py-2 border-b">
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 border-b">
                    {transaction.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={handleImport}
            disabled={importing}
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
      <h2 className="text-xl font-semibold mb-4">Import PDF Bank Statement</h2>

      {extractionError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">
                Extraction Error
              </h3>
              <p className="text-sm text-red-700 mt-1">{extractionError}</p>
            </div>
          </div>
        </div>
      )}

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
        <FileText
          className={`mx-auto h-12 w-12 mb-4 ${
            isDragOver ? "text-blue-500" : "text-gray-400"
          }`}
        />
        <p className={`mb-4 ${isDragOver ? "text-blue-700" : "text-gray-600"}`}>
          {processing
            ? "Processing PDF..."
            : isDragOver
            ? "Drop your PDF file here!"
            : "Drag and drop a PDF bank statement here, or click to browse"}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="hidden"
          id="pdf-upload"
          disabled={processing}
        />
        <label
          htmlFor="pdf-upload"
          className={`px-4 py-2 rounded cursor-pointer inline-block transition-colors ${
            processing
              ? "bg-gray-400 cursor-not-allowed"
              : isDragOver
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          {processing ? "Processing..." : "Choose PDF File"}
        </label>
      </div>

      {/* Info about PDF support */}
      <div className="mt-4 space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="flex items-center">
            <Info className="h-4 w-4 text-blue-500 mr-2" />
            <p className="text-sm text-blue-700">
              <span className="font-medium">Supported:</span> Most text-based
              PDF bank statements from major banks.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
          <div className="flex items-center">
            <Shield className="h-4 w-4 text-gray-500 mr-2" />
            <p className="text-sm text-gray-600">
              <span className="font-medium">Duplicate Protection:</span>{" "}
              Automatically prevents importing the same transactions twice.
            </p>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-yellow-500 mr-2" />
            <p className="text-sm text-yellow-700">
              <span className="font-medium">Note:</span> Image-based PDFs or
              password-protected files may not work. For best results, use
              text-based PDF statements.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
