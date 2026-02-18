import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';
import Papa from 'papaparse';
import './App.css';

// Allowed states for shipping calculation
const ALLOWED_STATES = [
  'KARNATAKA',
  'ANDHRA PRADESH',
  'TELANGANA',
  'TAMIL NADU',
  'KERALA'
];

// Normalize a product name to a base name for matching (strip pack info, trailing dashes/parens)
const normalizeBaseName = (productName) => {
  if (!productName) return '';
  let baseName = productName;
  if (/pack of 2/i.test(baseName)) {
    baseName = baseName.replace(/pack of 2/gi, '').trim();
  } else if (/pack of 1/i.test(baseName)) {
    baseName = baseName.replace(/pack of 1/gi, '').trim();
  }
  baseName = baseName.replace(/\s*-\s*$|^\s*-\s*|\s*\(\s*\)\s*$/, '').trim();
  return baseName;
};

// Admin Context for managing admin state
const AdminContext = createContext();

// Admin Provider Component
const AdminProvider = ({ children }) => {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [featureLocks, setFeatureLocks] = useState({
    uploadFiles: false,
    processOrders: false,
    exportData: false,
    viewResults: false,
  });

  // Admin credentials - in a real app, this would be more secure
  const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'admin123'
  };

  const login = (username, password) => {
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      setIsAdminMode(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAdminMode(false);
  };

  const toggleFeatureLock = (feature) => {
    setFeatureLocks(prev => ({
      ...prev,
      [feature]: !prev[feature]
    }));
  };

  const isFeatureLocked = (feature) => {
    return featureLocks[feature];
  };

  return (
    <AdminContext.Provider value={{
      isAdminMode,
      featureLocks,
      login,
      logout,
      toggleFeatureLock,
      isFeatureLocked
    }}>
      {children}
    </AdminContext.Provider>
  );
};

// Hook to use admin context
const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

// Admin Login Component
const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const { isAdminMode, login, logout } = useAdmin();

  const handleLogin = (e) => {
    e.preventDefault();
    const success = login(username, password);
    if (success) {
      setUsername('');
      setPassword('');
      setError('');
      setShowLogin(false);
    } else {
      setError('Invalid credentials');
    }
  };

  const handleLogout = () => {
    logout();
    setShowLogin(false);
  };

  if (isAdminMode) {
    return (
      <div className="admin-status">
        <span className="admin-badge">🔐 Admin Mode</span>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="admin-login-container">
      {!showLogin ? (
        <button 
          onClick={() => setShowLogin(true)} 
          className="admin-login-trigger"
          title="Admin Login"
        >
          🔐
        </button>
      ) : (
        <div className="admin-login-form">
          <form onSubmit={handleLogin}>
            <div className="form-row">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="admin-input"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="admin-input"
                required
              />
              <button type="submit" className="admin-login-btn">
                Login
              </button>
              <button 
                type="button" 
                onClick={() => setShowLogin(false)}
                className="admin-cancel-btn"
              >
                ✕
              </button>
            </div>
            {error && <div className="admin-error">{error}</div>}
          </form>
        </div>
      )}
    </div>
  );
};

// Admin Panel Component
const AdminPanel = () => {
  const { isAdminMode, featureLocks, toggleFeatureLock } = useAdmin();

  if (!isAdminMode) return null;

  return (
    <div className="admin-panel">
      <h3>🛠️ Admin Panel - Feature Locks</h3>
      <div className="feature-locks">
        <div className="lock-item">
          <label>
            <input
              type="checkbox"
              checked={featureLocks.uploadFiles}
              onChange={() => toggleFeatureLock('uploadFiles')}
            />
            Lock File Upload
          </label>
        </div>
        <div className="lock-item">
          <label>
            <input
              type="checkbox"
              checked={featureLocks.processOrders}
              onChange={() => toggleFeatureLock('processOrders')}
            />
            Lock Order Processing
          </label>
        </div>
        <div className="lock-item">
          <label>
            <input
              type="checkbox"
              checked={featureLocks.exportData}
              onChange={() => toggleFeatureLock('exportData')}
            />
            Lock Data Export
          </label>
        </div>
        <div className="lock-item">
          <label>
            <input
              type="checkbox"
              checked={featureLocks.viewResults}
              onChange={() => toggleFeatureLock('viewResults')}
            />
            Lock Results View
          </label>
        </div>
      </div>
    </div>
  );
};

// Feature Lock Component
const FeatureLocked = ({ feature, children }) => {
  const { isFeatureLocked } = useAdmin();

  if (isFeatureLocked(feature)) {
    return (
      <div className="feature-locked">
        <div className="locked-overlay">
          <div className="locked-message">
            🔒 This feature is currently locked
          </div>
        </div>
        <div className="locked-content">
          {children}
        </div>
      </div>
    );
  }

  return children;
};

// Main App Component
const AppContent = () => {
  const [orderData, setOrderData] = useState([]);
  const [results, setResults] = useState([]);
  const [productSalesData, setProductSalesData] = useState([]);
  const [shippingRevenue, setShippingRevenue] = useState(0);
  const [revenueByStateData, setRevenueByStateData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadStatus, setUploadStatus] = useState({
    orders: false
  });
  const [isShippingTableExpanded, setIsShippingTableExpanded] = useState(false);
  const [isProductSalesTableExpanded, setIsProductSalesTableExpanded] = useState(false);
  const [isRevenueByStateExpanded, setIsRevenueByStateExpanded] = useState(false);
  const [isTopProductsExpanded, setIsTopProductsExpanded] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [paymentStatements, setPaymentStatements] = useState([]);
  const [paymentFileResults, setPaymentFileResults] = useState([]);
  const [paymentUploadStatus, setPaymentUploadStatus] = useState({
    filesUploaded: 0,
    statementsLoaded: 0,
    failedFiles: 0
  });
  const [selectedSettlementId, setSelectedSettlementId] = useState('');
  const [isPaymentsTableExpanded, setIsPaymentsTableExpanded] = useState(true);
  const [isPaymentDetailsExpanded, setIsPaymentDetailsExpanded] = useState(true);

  // Return report state
  const [returnRawData, setReturnRawData] = useState([]);
  const [returnData, setReturnData] = useState([]);
  const [returnSummary, setReturnSummary] = useState(null);
  const [returnUploadStatus, setReturnUploadStatus] = useState(false);
  const [isReturnTableExpanded, setIsReturnTableExpanded] = useState(false);
  const [returnFileInfo, setReturnFileInfo] = useState({
    name: '',
    type: '',
    converted: false
  });

  const [fileInfo, setFileInfo] = useState({
    name: '',
    type: '',
    converted: false
  });
  const [shippingRates, setShippingRates] = useState({});
  const [ratesLoaded, setRatesLoaded] = useState(false);

  const DEFAULT_RATE = 60; // Default rate per kg if state not found
  const TOP_PRODUCTS_COUNT = 5;
  const MONEY_TOLERANCE_PAISE = 1; // 1 paisa

  // Use admin context
  const { isFeatureLocked, isAdminMode } = useAdmin();

  const toPaise = (value) => {
    const numeric = parseFloat(value);
    if (Number.isNaN(numeric)) return 0;
    return Math.round(numeric * 100);
  };

  const fromPaise = (value) => value / 100;

  const formatStatementPeriod = (startDateRaw, endDateRaw) => {
    const clean = (value) => {
      if (!value) return '';
      return value.split(' ')[0].replace(/\./g, '/');
    };
    const start = clean(startDateRaw);
    const end = clean(endDateRaw);
    if (!start || !end) return 'Unknown';
    return `${start} - ${end}`;
  };

  const bucketPaymentRow = (row) => {
    const transactionType = row.transactionType;
    const amountType = row.amountType;

    if (transactionType === 'Order') {
      if (amountType === 'ItemPrice') return 'sales';
      return 'expenses';
    }

    if (transactionType === 'Refund') return 'refunds';
    if (transactionType === 'other-transaction' || transactionType === 'ServiceFee') return 'expenses';
    return 'others';
  };


  // Load shipping rates from CSV file
  const loadShippingRates = useCallback(async () => {
    try {
      const response = await fetch('/state_wise_shipping_rates.csv');
      if (!response.ok) {
        throw new Error('Failed to load shipping rates file');
      }
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rates = {};
          results.data.forEach(row => {
            const state = row.State?.trim().toUpperCase();
            const rate = parseFloat(row.Rate_per_kg);
            if (state && !isNaN(rate)) {
              rates[state] = rate;
            }
          });
          setShippingRates(rates);
          setRatesLoaded(true);
        },
        error: (error) => {
          console.error('Error parsing shipping rates:', error);
          setRatesLoaded(true); // Allow app to continue with default rates
        }
      });
    } catch (error) {
      console.error('Error loading shipping rates:', error);
      setRatesLoaded(true); // Allow app to continue with default rates
    }
  }, []);

  // Load shipping rates on component mount
  useEffect(() => {
    loadShippingRates();
  }, [loadShippingRates]);

  // Parse CSV or TXT files
  const parseFile = useCallback((file, callback) => {
    const fileExtension = file.name.toLowerCase().split('.').pop();
    
    if (fileExtension === 'txt') {
      // Handle TXT file - assume tab-delimited Amazon report format
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length === 0) {
            setError('TXT file appears to be empty');
            return;
          }
          
          // Convert tab-delimited to CSV format
          const csvContent = lines.map((line, index) => {
            // Split by tabs and wrap fields with commas in quotes
            const fields = line.split('\t');
            
            // Basic validation - ensure we have reasonable number of fields
            if (index === 0 && fields.length < 5) {
              throw new Error('TXT file doesn\'t appear to be a valid Amazon order report (too few columns)');
            }
            
            return fields.map(field => {
              field = field.trim();
              // If field contains comma, quote, or newline, quote it
              if (field.includes(',') || field.includes('"') || field.includes('\n')) {
                return `"${field.replace(/"/g, '""')}"`;
              }
              return field;
            }).join(',');
          }).join('\n');
          
          // Create a blob and parse as CSV
          const csvBlob = new Blob([csvContent], { type: 'text/csv' });
          Papa.parse(csvBlob, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.errors.length > 0) {
                setError(`TXT to CSV conversion error: ${results.errors[0].message}`);
                return;
              }
              callback(results.data);
            },
            error: (error) => {
              setError(`Failed to parse converted CSV: ${error.message}`);
            }
          });
        } catch (error) {
          setError(`TXT file processing error: ${error.message}`);
        }
      };
      reader.onerror = () => setError('Failed to read TXT file');
      reader.readAsText(file);
    } else {
      // Handle CSV file normally
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError(`CSV parsing error: ${results.errors[0].message}`);
            return;
          }
          callback(results.data);
        },
        error: (error) => {
          setError(`Failed to parse CSV: ${error.message}`);
        }
      });
    }
  }, []);

  // Handle order file upload
  const handleOrderUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileExtension = file.name.toLowerCase().split('.').pop();
    if (!['txt', 'csv'].includes(fileExtension)) {
      setError('Please upload a TXT or CSV file');
      return;
    }

    setError('');
    setLoading(true);

    setFileInfo({
      name: file.name,
      type: fileExtension.toUpperCase(),
      converted: fileExtension === 'txt'
    });

    parseFile(file, (data) => {
      setOrderData(data);
      setUploadStatus(prev => ({ ...prev, orders: true }));
      setResults([]); // Clear previous results when new file is uploaded
      setProductSalesData([]); // Clear previous product sales data when new file is uploaded
      setShippingRevenue(0); // Clear previous shipping revenue when new file is uploaded
      setRevenueByStateData([]); // Clear previous revenue by state when new file is uploaded
      setLoading(false);
    });
  }, [parseFile]);

  // Parse return report file (supports TSV, TXT, CSV)
  const parseReturnFile = useCallback((file, callback) => {
    const fileExtension = file.name.toLowerCase().split('.').pop();

    if (fileExtension === 'tsv' || fileExtension === 'txt') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split('\n').filter(line => line.trim());
          if (lines.length === 0) {
            setError('Return report file appears to be empty');
            return;
          }
          const csvContent = lines.map((line, index) => {
            const fields = line.split('\t');
            if (index === 0 && fields.length < 5) {
              throw new Error('File doesn\'t appear to be a valid Amazon return report (too few columns)');
            }
            return fields.map(field => {
              field = field.trim();
              if (field.includes(',') || field.includes('"') || field.includes('\n')) {
                return `"${field.replace(/"/g, '""')}"`;
              }
              return field;
            }).join(',');
          }).join('\n');

          const csvBlob = new Blob([csvContent], { type: 'text/csv' });
          Papa.parse(csvBlob, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.errors.length > 0) {
                setError(`Return report parsing error: ${results.errors[0].message}`);
                return;
              }
              callback(results.data);
            },
            error: (error) => {
              setError(`Failed to parse return report: ${error.message}`);
            }
          });
        } catch (error) {
          setError(`Return report processing error: ${error.message}`);
        }
      };
      reader.onerror = () => setError('Failed to read return report file');
      reader.readAsText(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError(`Return report CSV parsing error: ${results.errors[0].message}`);
            return;
          }
          callback(results.data);
        },
        error: (error) => {
          setError(`Failed to parse return report CSV: ${error.message}`);
        }
      });
    }
  }, []);

  // Handle return report file upload
  const handleReturnUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileExtension = file.name.toLowerCase().split('.').pop();
    if (!['txt', 'csv', 'tsv'].includes(fileExtension)) {
      setError('Please upload a TSV, TXT, or CSV file for the return report');
      return;
    }

    setError('');
    setLoading(true);

    setReturnFileInfo({
      name: file.name,
      type: fileExtension.toUpperCase(),
      converted: fileExtension === 'tsv' || fileExtension === 'txt'
    });

    parseReturnFile(file, (data) => {
      setReturnRawData(data);
      setReturnUploadStatus(true);
      setReturnData([]);
      setReturnSummary(null);
      setLoading(false);
    });
  }, [parseReturnFile]);

  const parsePaymentsFile = useCallback((file) => {
    const extension = file.name.toLowerCase().split('.').pop();

    return new Promise((resolve, reject) => {
      const parseRows = (input, options = {}) => {
        Papa.parse(input, {
          header: true,
          skipEmptyLines: true,
          ...options,
          complete: (results) => {
            if (results.errors.length > 0) {
              reject(new Error(results.errors[0].message));
              return;
            }
            resolve(results.data);
          },
          error: (error) => reject(error)
        });
      };

      if (extension === 'txt' || extension === 'tsv') {
        const reader = new FileReader();
        reader.onload = (e) => {
          parseRows(e.target.result, { delimiter: '\t' });
        };
        reader.onerror = () => reject(new Error('Failed to read payments file'));
        reader.readAsText(file);
      } else if (extension === 'csv') {
        parseRows(file);
      } else {
        reject(new Error('Unsupported file type'));
      }
    });
  }, []);

  const buildSettlementSummary = useCallback((rows, sourceFileName) => {
    if (!rows.length) {
      throw new Error('File is empty');
    }

    const headerRow = rows.find(
      (row) => !((row['transaction-type'] || '').trim()) && ((row['total-amount'] || '').trim())
    );

    if (!headerRow) {
      throw new Error('No settlement header found (missing total-amount row)');
    }

    const settlementId = (headerRow['settlement-id'] || '').trim();
    if (!settlementId) {
      throw new Error('Settlement header does not contain settlement-id');
    }

    const payoutAmountPaise = toPaise(headerRow['total-amount']);
    const statementPeriod = formatStatementPeriod(
      headerRow['settlement-start-date'],
      headerRow['settlement-end-date']
    );

    const detailRows = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => (row['transaction-type'] || '').trim())
      .map(({ row, index }) => {
        const amountPaise = toPaise(row.amount);
        const normalized = {
          sourceFileName,
          settlementId: (row['settlement-id'] || settlementId).trim() || settlementId,
          transactionType: (row['transaction-type'] || '').trim(),
          amountType: (row['amount-type'] || '').trim(),
          amountDescription: (row['amount-description'] || '').trim(),
          amountPaise,
          orderId: (row['order-id'] || '').trim(),
          adjustmentId: (row['adjustment-id'] || '').trim(),
          postedDate: (row['posted-date'] || '').trim(),
          postedDateTime: (row['posted-date-time'] || '').trim(),
          sku: (row.sku || '').trim(),
          marketplaceName: (row['marketplace-name'] || '').trim(),
          currency: (row.currency || '').trim() || (headerRow.currency || '').trim(),
          lineNumber: index + 2
        };

        normalized.bucket = bucketPaymentRow(normalized);
        return normalized;
      });

    if (!detailRows.length) {
      throw new Error('No transaction rows found in settlement file');
    }

    const bucketTotals = {
      salesPaise: 0,
      refundsPaise: 0,
      expensesPaise: 0,
      othersPaise: 0
    };

    detailRows.forEach((row) => {
      if (row.bucket === 'sales') bucketTotals.salesPaise += row.amountPaise;
      else if (row.bucket === 'refunds') bucketTotals.refundsPaise += row.amountPaise;
      else if (row.bucket === 'expenses') bucketTotals.expensesPaise += row.amountPaise;
      else bucketTotals.othersPaise += row.amountPaise;
    });

    const computedPayoutPaise = detailRows.reduce((sum, row) => sum + row.amountPaise, 0);
    const reconcileDifferencePaise = computedPayoutPaise - payoutAmountPaise;
    const reconcilePass = Math.abs(reconcileDifferencePaise) <= MONEY_TOLERANCE_PAISE;

    return {
      settlementId,
      sourceFileName,
      statementPeriod,
      settlementStartDate: (headerRow['settlement-start-date'] || '').trim(),
      settlementEndDate: (headerRow['settlement-end-date'] || '').trim(),
      depositDate: (headerRow['deposit-date'] || '').trim(),
      currency: (headerRow.currency || '').trim(),
      beginningBalancePaise: 0,
      payoutAmountPaise,
      computedPayoutPaise,
      reconcileDifferencePaise,
      reconcilePass,
      ...bucketTotals,
      details: detailRows
    };
  }, [MONEY_TOLERANCE_PAISE]);

  const handlePaymentsUpload = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const validExtensions = ['txt', 'csv', 'tsv'];
    const invalid = files.filter((file) => {
      const ext = file.name.toLowerCase().split('.').pop();
      return !validExtensions.includes(ext);
    });

    if (invalid.length > 0) {
      setError(`Unsupported files: ${invalid.map((file) => file.name).join(', ')}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const settledResults = await Promise.allSettled(
        files.map(async (file) => {
          const parsedRows = await parsePaymentsFile(file);
          const statement = buildSettlementSummary(parsedRows, file.name);
          return statement;
        })
      );

      const successfulStatements = [];
      const fileResults = [];

      settledResults.forEach((result, index) => {
        const fileName = files[index].name;
        if (result.status === 'fulfilled') {
          successfulStatements.push(result.value);
          fileResults.push({ fileName, status: 'success', message: '' });
        } else {
          fileResults.push({
            fileName,
            status: 'error',
            message: result.reason?.message || 'Failed to parse file'
          });
        }
      });

      if (!successfulStatements.length) {
        setPaymentStatements([]);
        setSelectedSettlementId('');
        setPaymentUploadStatus({
          filesUploaded: files.length,
          statementsLoaded: 0,
          failedFiles: files.length
        });
        setPaymentFileResults(fileResults);
        setError('Could not parse any payments files. Please check file format.');
        setLoading(false);
        return;
      }

      const dedupedMap = new Map();
      successfulStatements.forEach((statement) => {
        if (!dedupedMap.has(statement.settlementId)) {
          dedupedMap.set(statement.settlementId, statement);
        }
      });

      const dedupedStatements = Array.from(dedupedMap.values()).sort((a, b) => {
        return (b.settlementStartDate || '').localeCompare(a.settlementStartDate || '');
      });

      setPaymentStatements(dedupedStatements);
      setSelectedSettlementId(dedupedStatements[0]?.settlementId || '');
      setPaymentUploadStatus({
        filesUploaded: files.length,
        statementsLoaded: dedupedStatements.length,
        failedFiles: fileResults.filter((row) => row.status === 'error').length
      });
      setPaymentFileResults(fileResults);
      setIsPaymentsTableExpanded(true);
      setIsPaymentDetailsExpanded(true);
    } catch (err) {
      setError(`Payments parsing error: ${err.message}`);
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  }, [parsePaymentsFile, buildSettlementSummary]);

  // Extract pack information from product name
  const extractPackInfo = (productName) => {
    const hasPackOfOne = /Pack of 1/i.test(productName);
    const hasPackOfTwo = /Pack of 2/i.test(productName);
    
    if (hasPackOfTwo) {
      return { packOfOne: 0, packOfTwo: 1 };
    } else if (hasPackOfOne) {
      return { packOfOne: 1, packOfTwo: 0 };
    } else {
      // Default: treat as single pack if no specific pack mention is found
      return { packOfOne: 1, packOfTwo: 0 };
    }
  };

  // Process product sales by variant (excluding cancelled orders)
  const processProductSalesByVariant = useCallback((activeReturnData = returnData) => {
    if (!orderData.length) return { productSales: [], shippingRevenue: 0 };

    // Filter out cancelled orders
    const nonCancelledOrders = orderData.filter(row => {
      const orderStatus = row['order-status']?.trim().toLowerCase();
      return orderStatus !== 'cancelled';
    });

    // Group products by base name and variant
    const productSales = {};
    const skuToBaseName = {}; // SKU → baseName lookup for return matching
    let totalShippingRevenue = 0;
    const revenueByState = {};

    nonCancelledOrders.forEach(row => {
      const productName = row['product-name']?.trim();
      const sku = row['sku']?.trim();
      const quantity = parseInt(row.quantity) || 1;
      const itemPrice = parseFloat(row['item-price']) || 0;
      const promotionDiscount = parseFloat(row['item-promotion-discount']) || 0;
      const shippingPrice = parseFloat(row['shipping-price']) || 0;

      // Add to shipping revenue
      totalShippingRevenue += shippingPrice;

      // Add to revenue by state
      const state = row['ship-state']?.trim().toUpperCase();
      const orderId = row['amazon-order-id']?.trim();
      if (state) {
        if (!revenueByState[state]) {
          revenueByState[state] = { state, revenue: 0, orderIds: new Set() };
        }
        revenueByState[state].revenue += itemPrice - promotionDiscount;
        if (orderId) revenueByState[state].orderIds.add(orderId);
      }

      if (!productName) return;

      // Determine variant and extract base product name
      let variant = 'Pack of One'; // Default for uncategorized products
      let baseName = normalizeBaseName(productName);

      if (/pack of 2/i.test(productName)) {
        variant = 'Pack of Two';
      } else if (/pack of 1/i.test(productName)) {
        variant = 'Pack of One';
      }

      // Map this SKU to its base product name
      if (sku) {
        skuToBaseName[sku] = baseName;
      }

      // Initialize product entry if it doesn't exist
      if (!productSales[baseName]) {
        productSales[baseName] = {
          productName: baseName,
          packOfOneSold: 0,
          packOfTwoSold: 0,
          totalSales: 0,
          returnQuantity: 0
        };
      }

      // Calculate sales amount for this item (net revenue after discounts)
      const salesAmount = itemPrice - promotionDiscount;

      // Add quantity to appropriate variant
      if (variant === 'Pack of Two') {
        productSales[baseName].packOfTwoSold += quantity;
      } else {
        productSales[baseName].packOfOneSold += quantity;
      }
      
      // Add to total sales
      productSales[baseName].totalSales += salesAmount;
    });

    // Merge return quantities from return data using SKU matching
    if (activeReturnData.length > 0) {
      activeReturnData.forEach(ret => {
        const retSku = ret.sku;
        const qty = ret.returnQuantity || 0;
        if (!retSku) return;

        const baseName = skuToBaseName[retSku];
        if (baseName && productSales[baseName]) {
          productSales[baseName].returnQuantity += qty;
        } else {
          // SKU exists only in returns — use item name as fallback label
          const fallbackName = normalizeBaseName(ret.itemName) || retSku;
          if (!productSales[fallbackName]) {
            productSales[fallbackName] = {
              productName: fallbackName,
              packOfOneSold: 0,
              packOfTwoSold: 0,
              totalSales: 0,
              returnQuantity: qty
            };
          } else {
            productSales[fallbackName].returnQuantity += qty;
          }
        }
      });
    }

    // Convert to array and sort by total sales (descending)
    const productSalesArray = Object.values(productSales).sort((a, b) => {
      const totalA = a.totalSales;
      const totalB = b.totalSales;
      return totalB - totalA;
    });

    // Convert revenue by state to array and sort by revenue (descending)
    const revenueByStateArray = Object.values(revenueByState)
      .map(({ state, revenue, orderIds }) => ({
        state,
        revenue,
        orderCount: orderIds.size
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      productSales: productSalesArray,
      shippingRevenue: totalShippingRevenue,
      revenueByState: revenueByStateArray
    };
  }, [orderData, returnData]);

  // Process orders and calculate shipping
  /* eslint-disable react-hooks/exhaustive-deps */
  const processOrders = useCallback(() => {
    if (!orderData.length) {
      setError('Please upload the Amazon order report CSV file');
      return;
    }

    if (!ratesLoaded) {
      setError('Shipping rates are still loading. Please wait...');
      return;
    }

    setLoading(true);
    setError('');

    try {

      // Filter for shipped orders only
      const shippedOrders = orderData.filter(row => {
        const orderStatus = row['order-status']?.trim().toLowerCase();
        return orderStatus && orderStatus.includes('shipped');
      });

      // Filter for allowed states only
      const allowedStateOrders = shippedOrders.filter(row => {
        const state = row['ship-state']?.trim().toUpperCase();
        return state && ALLOWED_STATES.includes(state);
      });

      // Log filtering information
      if (shippedOrders.length > allowedStateOrders.length) {
        const filteredCount = shippedOrders.length - allowedStateOrders.length;
        console.log(`Filtered out ${filteredCount} orders from states not in the allowed list.`);
        console.log(`Processing ${allowedStateOrders.length} orders from allowed states: ${ALLOWED_STATES.join(', ')}`);
      }

      // Group orders by Order ID
      const orderGroups = {};
      allowedStateOrders.forEach(row => {
        const orderId = row['amazon-order-id']?.trim();
        const productName = row['product-name']?.trim();
        const quantity = parseInt(row.quantity) || 1;
        const state = row['ship-state']?.trim().toUpperCase();

        if (!orderId || !productName) return;

        if (!orderGroups[orderId]) {
          orderGroups[orderId] = {
            orderId,
            state,
            packOfOne: 0,
            packOfTwo: 0,
            items: []
          };
        }

        const packInfo = extractPackInfo(productName);
        orderGroups[orderId].packOfOne += packInfo.packOfOne * quantity;
        orderGroups[orderId].packOfTwo += packInfo.packOfTwo * quantity;
        orderGroups[orderId].items.push({ productName, quantity, ...packInfo });
      });

      // Calculate shipping for each order
      const processedResults = Object.values(orderGroups).map(order => {
        const totalWeight = (order.packOfOne * 0.5) + (order.packOfTwo * 1.0);
        const roundedWeight = Math.ceil(totalWeight);
        const rate = shippingRates[order.state] || DEFAULT_RATE;
        const shippingCost = roundedWeight * rate;

        return {
          orderId: order.orderId,
          state: order.state,
          packOfOne: order.packOfOne,
          packOfTwo: order.packOfTwo,
          totalWeight: totalWeight.toFixed(2),
          roundedWeight,
          ratePerKg: rate,
          shippingCost,
          stateFound: !!shippingRates[order.state],
          items: order.items
        };
      });

      setResults(processedResults);
      
      // Process return report only when user explicitly generates the report
      let effectiveReturnData = returnData;
      if (returnRawData.length > 0) {
        const { valid, normalized } = processReturnReport(returnRawData);
        if (!valid) {
          setLoading(false);
          return;
        }
        effectiveReturnData = normalized;
      }

      // Calculate product sales data, shipping revenue, and revenue by state
      const { productSales, shippingRevenue: totalShippingRevenue, revenueByState } = processProductSalesByVariant(effectiveReturnData);
      setProductSalesData(productSales);
      setShippingRevenue(totalShippingRevenue);
      setRevenueByStateData(revenueByState);
      
      setLoading(false);
    } catch (err) {
      setError(`Processing error: ${err.message}`);
      setLoading(false);
    }
  }, [orderData, shippingRates, ratesLoaded, returnData, returnRawData, processProductSalesByVariant]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Process return report data
  function processReturnReport(rawData = returnRawData) {
    if (!rawData.length) {
      setReturnData([]);
      setReturnSummary(null);
      return { valid: true, normalized: [], summary: null };
    }

    const REQUIRED_COLUMNS = ['Order ID', 'Return request status', 'Item Name', 'Return quantity'];
    const headers = Object.keys(rawData[0]);
    const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
    if (missing.length > 0) {
      setError(`Return report missing required columns: ${missing.join(', ')}`);
      return { valid: false, normalized: [], summary: null };
    }

    const normalized = rawData.map(row => ({
      orderId: (row['Order ID'] || '').trim(),
      orderDate: (row['Order date'] || '').trim(),
      returnRequestDate: (row['Return request date'] || '').trim(),
      returnDeliveryDate: (row['Return delivery date'] || '').trim(),
      status: (row['Return request status'] || '').trim(),
      rmaId: (row['Amazon RMA ID'] || '').trim(),
      labelType: (row['Label type'] || '').trim(),
      labelCost: parseFloat(row['Label cost']) || 0,
      returnCarrier: (row['Return carrier'] || '').trim(),
      trackingId: (row['Tracking ID'] || '').trim(),
      isPrime: (row['Is prime'] || '').trim(),
      asin: (row['ASIN'] || '').trim(),
      sku: (row['Merchant SKU'] || row[' Merchant SKU'] || '').trim(),
      itemName: (row['Item Name'] || '').trim(),
      returnQuantity: parseInt(row['Return quantity']) || 0,
      returnReason: (row['Return reason'] || '').trim(),
      inPolicy: (row['In policy'] || '').trim(),
      returnType: (row['Return type'] || '').trim(),
      resolution: (row['Resolution'] || '').trim(),
      invoiceNumber: (row['Invoice number'] || '').trim(),
      orderAmount: parseFloat(row['Order Amount']) || 0,
      orderQuantity: parseInt(row['Order quantity']) || 0,
      refundedAmount: parseFloat(row['Refunded Amount']) || 0,
      category: (row['Category'] || '').trim(),
    }));

    const totalReturns = normalized.length;
    const approvedCount = normalized.filter(r => r.status.toLowerCase() === 'approved').length;
    const totalReturnQuantity = normalized.reduce((s, r) => s + r.returnQuantity, 0);
    const totalRefunded = normalized.reduce((s, r) => s + r.refundedAmount, 0);
    const totalLabelCost = normalized.reduce((s, r) => s + r.labelCost, 0);
    const uniqueSkus = new Set(normalized.map(r => r.sku).filter(Boolean)).size;
    const uniqueAsins = new Set(normalized.map(r => r.asin).filter(Boolean)).size;

    const reasonCounts = {};
    normalized.forEach(r => {
      const reason = r.returnReason || 'Unknown';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
    const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];

    const resolutionCounts = {};
    normalized.forEach(r => {
      const res = r.resolution || 'Unknown';
      resolutionCounts[res] = (resolutionCounts[res] || 0) + 1;
    });

    const returnTypeCounts = {};
    normalized.forEach(r => {
      const rt = r.returnType || 'Unknown';
      returnTypeCounts[rt] = (returnTypeCounts[rt] || 0) + 1;
    });

    const summary = {
      totalReturns,
      approvedCount,
      totalReturnQuantity,
      totalRefunded,
      totalLabelCost,
      uniqueSkus,
      uniqueAsins,
      topReason: topReason ? { reason: topReason[0], count: topReason[1] } : null,
      resolutionCounts,
      returnTypeCounts,
    };

    setReturnData(normalized);
    setReturnSummary(summary);
    return { valid: true, normalized, summary };
  }

  // Re-process product sales when return data changes after report is already generated
  useEffect(() => {
    if (results.length > 0 && orderData.length > 0) {
      const { productSales, shippingRevenue: totalShippingRevenue, revenueByState } = processProductSalesByVariant();
      setProductSalesData(productSales);
      setShippingRevenue(totalShippingRevenue);
      setRevenueByStateData(revenueByState);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnData]);

  // Export results to CSV
  const exportResults = useCallback(() => {
    if (!results.length) return;

    const csvContent = Papa.unparse({
      fields: [
        'S.No.',
        'Order ID',
        'State',
        'Total Weight (kg)',
        'Rounded Weight (kg)',
        'Rate per kg',
        'Shipping Cost'
      ],
      data: results.map((row, index) => [
        index + 1,
        row.orderId,
        row.state,
        row.totalWeight,
        row.roundedWeight,
        row.ratePerKg,
        row.shippingCost
      ])
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'shipping_calculation_results.csv';
    link.click();
  }, [results]);

  // Export top products by revenue to CSV
  const exportTopProducts = useCallback(() => {
    const topProducts = productSalesData.slice(0, TOP_PRODUCTS_COUNT);
    if (!topProducts.length) return;

    const fields = ['Rank', 'Product Name', 'Pack of One Sold', 'Pack of Two Sold', 'Total Units'];
    if (isAdminMode) fields.push('Revenue');
    fields.push('% of Total');

    const totalRevenue = productSalesData.reduce((sum, p) => sum + p.totalSales, 0);
    const csvContent = Papa.unparse({
      fields,
      data: topProducts.map((product, index) => {
        const pct = totalRevenue > 0 ? ((product.totalSales / totalRevenue) * 100).toFixed(1) + '%' : '0%';
        const row = [
          index + 1,
          product.productName,
          product.packOfOneSold,
          product.packOfTwoSold,
          product.packOfOneSold + (product.packOfTwoSold * 2)
        ];
        if (isAdminMode) row.push(product.totalSales);
        row.push(pct);
        return row;
      })
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'top_products_by_revenue.csv';
    link.click();
  }, [productSalesData, isAdminMode]);

  // Export product sales to CSV
  const exportProductSales = useCallback(() => {
    if (!productSalesData.length) return;

    const fields = [
      'S.No.',
      'Product Name',
      'Pack of One Sold',
      'Pack of Two Sold',
      'Total Units',
      'Return Qty'
    ];
    
    if (isAdminMode) {
      fields.push('Total Sales');
    }

    const csvContent = Papa.unparse({
      fields: fields,
      data: productSalesData.map((product, index) => {
        const row = [
          index + 1,
          product.productName,
          product.packOfOneSold,
          product.packOfTwoSold,
          product.packOfOneSold + (product.packOfTwoSold * 2),
          product.returnQuantity
        ];
        
        if (isAdminMode) {
          row.push(product.totalSales);
        }
        
        return row;
      })
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'product_sales_results.csv';
    link.click();
  }, [productSalesData, isAdminMode]);

  // Export revenue by state to CSV
  const exportRevenueByState = useCallback(() => {
    if (!revenueByStateData.length) return;

    const totalRevenue = revenueByStateData.reduce((sum, row) => sum + row.revenue, 0);
    const csvContent = Papa.unparse({
      fields: ['S.No.', 'State', 'Revenue', '% of Total', 'Orders'],
      data: revenueByStateData.map((row, index) => [
        index + 1,
        row.state,
        row.revenue.toFixed(2),
        totalRevenue > 0 ? ((row.revenue / totalRevenue) * 100).toFixed(1) + '%' : '0%',
        row.orderCount
      ])
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'revenue_by_state.csv';
    link.click();
  }, [revenueByStateData]);

  // Export return report to CSV
  const exportReturns = useCallback(() => {
    if (!returnData.length) return;

    const csvContent = Papa.unparse({
      fields: [
        'S.No.',
        'Order ID',
        'Order Date',
        'Return Request Date',
        'Return Delivery Date',
        'Status',
        'ASIN',
        'SKU',
        'Item Name',
        'Return Qty',
        'Return Reason',
        'In Policy',
        'Return Type',
        'Resolution',
        'Label Cost',
        'Refunded Amount',
        'Category'
      ],
      data: returnData.map((row, index) => [
        index + 1,
        row.orderId,
        row.orderDate,
        row.returnRequestDate,
        row.returnDeliveryDate,
        row.status,
        row.asin,
        row.sku,
        row.itemName,
        row.returnQuantity,
        row.returnReason,
        row.inPolicy,
        row.returnType,
        row.resolution,
        row.labelCost.toFixed(2),
        row.refundedAmount.toFixed(2),
        row.category
      ])
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'return_report.csv';
    link.click();
  }, [returnData]);

  const exportPaymentSummary = useCallback(() => {
    if (!paymentStatements.length) return;

    const csvContent = Papa.unparse({
      fields: [
        'S.No.',
        'Settlement ID',
        'Statement Period',
        'Deposit Date',
        'Beginning Balance',
        'Sales',
        'Refunds',
        'Expenses',
        'Others',
        'Payout Amount',
        'Computed Payout',
        'Reconcile Difference',
        'Reconcile Status',
        'Source File'
      ],
      data: paymentStatements.map((statement, index) => [
        index + 1,
        statement.settlementId,
        statement.statementPeriod,
        statement.depositDate,
        fromPaise(statement.beginningBalancePaise).toFixed(2),
        fromPaise(statement.salesPaise).toFixed(2),
        fromPaise(statement.refundsPaise).toFixed(2),
        fromPaise(statement.expensesPaise).toFixed(2),
        fromPaise(statement.othersPaise).toFixed(2),
        fromPaise(statement.payoutAmountPaise).toFixed(2),
        fromPaise(statement.computedPayoutPaise).toFixed(2),
        fromPaise(statement.reconcileDifferencePaise).toFixed(2),
        statement.reconcilePass ? 'PASS' : 'FAIL',
        statement.sourceFileName
      ])
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'amazon_payment_statements_summary.csv';
    link.click();
  }, [paymentStatements]);

  const exportPaymentDetails = useCallback(() => {
    const target = paymentStatements.find((statement) => statement.settlementId === selectedSettlementId);
    if (!target) return;

    const csvContent = Papa.unparse({
      fields: [
        'S.No.',
        'Settlement ID',
        'Bucket',
        'Transaction Type',
        'Amount Type',
        'Amount Description',
        'Amount',
        'Order ID',
        'Adjustment ID',
        'SKU',
        'Posted Date',
        'Posted Date Time',
        'Marketplace',
        'Source File'
      ],
      data: target.details.map((row, index) => [
        index + 1,
        row.settlementId,
        row.bucket,
        row.transactionType,
        row.amountType,
        row.amountDescription,
        fromPaise(row.amountPaise).toFixed(2),
        row.orderId,
        row.adjustmentId,
        row.sku,
        row.postedDate,
        row.postedDateTime,
        row.marketplaceName,
        row.sourceFileName
      ])
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `payment_details_${target.settlementId}.csv`;
    link.click();
  }, [paymentStatements, selectedSettlementId]);

  // Calculate total shipping cost
  const totalShippingCost = results.reduce((sum, order) => sum + order.shippingCost, 0);
  const selectedPaymentStatement = paymentStatements.find(
    (statement) => statement.settlementId === selectedSettlementId
  );
  const paymentBreakdown = [
    {
      key: 'sales',
      label: 'Sales',
      valuePaise: paymentStatements.reduce((sum, statement) => sum + statement.salesPaise, 0),
      color: '#16a34a'
    },
    {
      key: 'refunds',
      label: 'Refunds',
      valuePaise: paymentStatements.reduce((sum, statement) => sum + statement.refundsPaise, 0),
      color: '#2563eb'
    },
    {
      key: 'expenses',
      label: 'Expenses',
      valuePaise: paymentStatements.reduce((sum, statement) => sum + statement.expensesPaise, 0),
      color: '#dc2626'
    },
    {
      key: 'others',
      label: 'Others',
      valuePaise: paymentStatements.reduce((sum, statement) => sum + statement.othersPaise, 0),
      color: '#7c3aed'
    }
  ];
  const paymentBreakdownTotalMagnitude = paymentBreakdown.reduce(
    (sum, item) => sum + Math.abs(item.valuePaise),
    0
  );
  let paymentBreakdownAccumulator = 0;
  const paymentBreakdownGradient = paymentBreakdown.map((item) => {
    const percentage = paymentBreakdownTotalMagnitude > 0
      ? (Math.abs(item.valuePaise) / paymentBreakdownTotalMagnitude) * 100
      : 0;
    const start = paymentBreakdownAccumulator;
    const end = start + percentage;
    paymentBreakdownAccumulator = end;
    return `${item.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  }).join(', ');
  const paymentSalesPaise = paymentBreakdown.find((item) => item.key === 'sales')?.valuePaise || 0;
  const paymentRefundsPaise = paymentBreakdown.find((item) => item.key === 'refunds')?.valuePaise || 0;
  const paymentExpensesPaise = paymentBreakdown.find((item) => item.key === 'expenses')?.valuePaise || 0;
  const paymentOthersPaise = paymentBreakdown.find((item) => item.key === 'others')?.valuePaise || 0;
  const paymentNetPayoutPaise = paymentSalesPaise + paymentRefundsPaise + paymentExpensesPaise + paymentOthersPaise;
  const paymentSalesBase = Math.max(Math.abs(paymentSalesPaise), 1);
  const paymentBridgeRows = [
    {
      key: 'sales',
      label: 'Sales',
      valuePaise: paymentSalesPaise,
      color: '#16a34a',
      percentOfSales: 100
    },
    {
      key: 'refunds',
      label: 'Refunds',
      valuePaise: paymentRefundsPaise,
      color: '#2563eb',
      percentOfSales: (Math.abs(paymentRefundsPaise) / paymentSalesBase) * 100
    },
    {
      key: 'expenses',
      label: 'Expenses',
      valuePaise: paymentExpensesPaise,
      color: '#dc2626',
      percentOfSales: (Math.abs(paymentExpensesPaise) / paymentSalesBase) * 100
    },
    {
      key: 'others',
      label: 'Others',
      valuePaise: paymentOthersPaise,
      color: '#7c3aed',
      percentOfSales: (Math.abs(paymentOthersPaise) / paymentSalesBase) * 100
    },
    {
      key: 'net',
      label: 'Net Payout',
      valuePaise: paymentNetPayoutPaise,
      color: '#0f172a',
      percentOfSales: (Math.abs(paymentNetPayoutPaise) / paymentSalesBase) * 100
    }
  ];

  // Toggle row expansion
  const toggleRowExpansion = (orderId) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(orderId)) {
      newExpandedRows.delete(orderId);
    } else {
      newExpandedRows.add(orderId);
    }
    setExpandedRows(newExpandedRows);
  };



  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>🚚 Amazon Report</h1>
          <AdminLogin />
        </header>

        <AdminPanel />

        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
          </div>
        )}

        {results.length === 0 && (
          <FeatureLocked feature="uploadFiles">
            <div className="upload-section">
              <div className="upload-container">
              <div className="upload-grid">
                <div className="upload-area">
                    <div className="upload-header">
                      <div className="upload-icon">📁</div>
                      <div className="upload-text">
                        <h3>Upload Order Report</h3>
                        <p>Drop your Amazon order file here or click to browse</p>
                      <a
                        href="https://sellercentral.amazon.in/order-reports-and-feeds/reports/ref=xx_orderrpt_dnav_xx"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="report-link"
                      >
                        Download Order Report Page
                      </a>
                      </div>
                    </div>
                    
                    <input
                      type="file"
                      accept=".txt,.csv"
                      onChange={handleOrderUpload}
                      disabled={loading || isFeatureLocked('uploadFiles')}
                      className="file-input-hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="file-upload-label">
                      Choose File
                    </label>

                  {uploadStatus.orders && orderData.length > 0 && (
                    <div className="upload-success">
                      <div className="success-indicator">
                        <span className="success-icon">✅</span>
                        <div className="success-details">
                          <strong>{orderData.length} orders loaded</strong>
                          <div className="file-details">
                            <span className="file-name">{fileInfo.name}</span>
                            {fileInfo.converted && (
                              <span className="conversion-tag">TXT→CSV</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="upload-area return-upload-area">
                  <div className="upload-header">
                    <div className="upload-icon">🔄</div>
                    <div className="upload-text">
                      <h3>Upload Return Report</h3>
                      <p>Upload your Amazon return report file</p>
                    <a
                      href="https://sellercentral.amazon.in/returns/report/ref=xx_scnvrr_dnav_xx"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="report-link"
                    >
                      Download Return Report Page
                    </a>
                    </div>
                  </div>

                  <input
                    type="file"
                    accept=".tsv,.txt,.csv"
                    onChange={handleReturnUpload}
                    disabled={loading || isFeatureLocked('uploadFiles')}
                    className="file-input-hidden"
                    id="return-file-upload"
                  />
                  <label htmlFor="return-file-upload" className="file-upload-label">
                    Choose File
                  </label>

                  {returnUploadStatus && returnRawData.length > 0 && (
                    <div className="upload-success">
                      <div className="success-indicator">
                        <span className="success-icon">✅</span>
                        <div className="success-details">
                          <strong>{returnRawData.length} returns loaded</strong>
                          <div className="file-details">
                            <span className="file-name">{returnFileInfo.name}</span>
                            {returnFileInfo.converted && (
                              <span className="conversion-tag">{returnFileInfo.type}→CSV</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {isAdminMode && (
                <div className="upload-area payments-upload-area">
                  <div className="upload-header">
                    <div className="upload-icon">💳</div>
                    <div className="upload-text">
                      <h3>Upload Payments Flat File V2</h3>
                      <p>Select one or more Amazon settlement flatfiles</p>
                      <a
                        href="https://sellercentral.amazon.in/payments/reports-and-statements"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="report-link"
                      >
                        Open Payments Statements Page
                      </a>
                    </div>
                  </div>

                  <input
                    type="file"
                    accept=".txt,.csv,.tsv"
                    multiple
                    onChange={handlePaymentsUpload}
                    disabled={loading || isFeatureLocked('uploadFiles')}
                    className="file-input-hidden"
                    id="payments-file-upload"
                  />
                  <label htmlFor="payments-file-upload" className="file-upload-label">
                    Choose Files
                  </label>

                  {paymentUploadStatus.filesUploaded > 0 && (
                    <div className="upload-success">
                      <div className="success-indicator">
                        <span className="success-icon">✅</span>
                        <div className="success-details">
                          <strong>{paymentUploadStatus.statementsLoaded} statements loaded</strong>
                          <div className="file-details">
                            <span className="file-name">
                              {paymentUploadStatus.filesUploaded} files uploaded
                            </span>
                            {paymentUploadStatus.failedFiles > 0 && (
                              <span className="conversion-tag">
                                {paymentUploadStatus.failedFiles} failed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>
          </div>
          </FeatureLocked>
        )}

        {results.length === 0 && (
          <FeatureLocked feature="processOrders">
            <div className="action-section">
              <button
                onClick={processOrders}
                disabled={!uploadStatus.orders || !ratesLoaded || loading || isFeatureLocked('processOrders')}
                className="process-button"
              >
                {loading ? '⏳ Processing...' : 
                 !ratesLoaded ? '⏳ Loading Rates...' : 
                 '📊 Generate Report'}
              </button>
            </div>
          </FeatureLocked>
        )}

        {results.length > 0 && (
          <FeatureLocked feature="viewResults">
            <div className="results-section">
            <div className="results-header">
              <div className="results-title-section">
                <h2>📊 Self-Ship</h2>
                <button 
                  onClick={() => setIsShippingTableExpanded(!isShippingTableExpanded)}
                  className="toggle-button"
                  title={isShippingTableExpanded ? 'Collapse table' : 'Expand table'}
                >
                  {isShippingTableExpanded ? '🔽' : '▶️'}
                </button>
              </div>
              <div className="results-actions">
                <input
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleOrderUpload}
                  disabled={loading}
                  className="file-input-hidden"
                  id="new-file-upload"
                />
                <label htmlFor="new-file-upload" className="upload-new-button">
                  📁 Upload New File
                </label>
                <FeatureLocked feature="exportData">
                  <button 
                    onClick={exportResults} 
                    className="export-button"
                    disabled={isFeatureLocked('exportData')}
                  >
                    📥 Export CSV
                  </button>
                </FeatureLocked>
              </div>
            </div>

            <div className="summary">
              <div className="summary-grid">
                <div className="summary-card-modern orders-card">
                  <div className="card-icon">📦</div>
                  <div className="card-content">
                    <div className="card-value">{results.length}</div>
                    <div className="card-label">Orders Processed</div>
                  </div>
                </div>
                
                <div className="summary-card-modern cost-card">
                  <div className="card-icon">💰</div>
                  <div className="card-content">
                    <div className="card-value">₹{totalShippingCost.toLocaleString()}</div>
                    <div className="card-label">Total Shipping Cost</div>
                  </div>
                </div>
                
                <div className="summary-card-modern average-card">
                  <div className="card-icon">📊</div>
                  <div className="card-content">
                    <div className="card-value">₹{Math.round(totalShippingCost / results.length)}</div>
                    <div className="card-label">Average per Order</div>
                  </div>
                </div>
              </div>
              
              {results.some(r => !r.stateFound) && (
                <div className="warning-banner">
                  <div className="warning-icon">⚠️</div>
                  <div className="warning-content">
                    <strong>Notice:</strong> Some states used default rate (₹{DEFAULT_RATE}/kg) - not found in rates file
                  </div>
                </div>
              )}
            </div>

            {isShippingTableExpanded && (
              <div className="table-container">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Details</th>
                      <th>S.No.</th>
                      <th>Order ID</th>
                      <th>State</th>
                      <th>Total Weight (kg)</th>
                      <th>Rounded Weight (kg)</th>
                      <th>Rate per kg</th>
                      <th>Shipping Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, index) => {
                      const isExpanded = expandedRows.has(row.orderId);
                      
                      return (
                        <React.Fragment key={row.orderId}>
                          <tr 
                            className={!row.stateFound ? 'warning-row' : ''}
                            onClick={() => toggleRowExpansion(row.orderId)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <button 
                                className="expand-button"
                                title={isExpanded ? 'Collapse details' : 'Expand details'}
                              >
                                {isExpanded ? '🔽' : '▶️'}
                              </button>
                            </td>
                            <td className="serial-number">{index + 1}</td>
                            <td>{row.orderId}</td>
                            <td>
                              {row.state}
                              {!row.stateFound && <span className="warning-badge">⚠️</span>}
                            </td>
                            <td>{row.totalWeight}</td>
                            <td>{row.roundedWeight}</td>
                            <td>₹{row.ratePerKg}</td>
                            <td>₹{row.shippingCost}</td>
                          </tr>
                          {isExpanded && (
                            <tr className="expanded-row">
                              <td colSpan="8">
                                <div className="product-table">
                                  <div className="product-header">
                                    <div className="product-header-name">Product Name</div>
                                    <div className="product-header-qty">Qty</div>
                                  </div>
                                  <div className="product-list">
                                    {row.items.map((item, itemIndex) => (
                                      <div key={itemIndex} className="product-item">
                                        <div className="product-name">{item.productName}</div>
                                        <div className="product-divider"></div>
                                        <div className="product-quantity">{item.quantity}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="expanded-footer">
                                  <span className="total-units">Total Units: {row.packOfOne + row.packOfTwo * 2}</span>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </FeatureLocked>
        )}

        {/* Product Sales by Variant Section */}
        {results.length > 0 && productSalesData.length > 0 && (
          <FeatureLocked feature="viewResults">
            <div className="results-section">
            <div className="results-header">
              <div className="results-title-section">
                <h2>📈 Product Sales</h2>
                <button 
                  onClick={() => setIsProductSalesTableExpanded(!isProductSalesTableExpanded)}
                  className="toggle-button"
                  title={isProductSalesTableExpanded ? 'Collapse table' : 'Expand table'}
                >
                  {isProductSalesTableExpanded ? '🔽' : '▶️'}
                </button>
              </div>
              <div className="results-actions">
                <FeatureLocked feature="exportData">
                  <button 
                    onClick={exportProductSales} 
                    className="export-button"
                    disabled={isFeatureLocked('exportData')}
                  >
                    📥 Export CSV
                  </button>
                </FeatureLocked>
              </div>
            </div>

            <div className="summary">
              <div className="summary-grid">
                <div className="summary-card-modern orders-card">
                  <div className="card-icon">🏷️</div>
                  <div className="card-content">
                    <div className="card-value">{productSalesData.length}</div>
                    <div className="card-label">Unique Products</div>
                  </div>
                </div>
                
                <div className="summary-card-modern cost-card">
                  <div className="card-icon">📦</div>
                  <div className="card-content">
                    <div className="card-value">
                      {productSalesData.reduce((sum, product) => sum + product.packOfOneSold, 0)}
                    </div>
                    <div className="card-label">Pack of One Units</div>
                  </div>
                </div>
                
                <div className="summary-card-modern average-card">
                  <div className="card-icon">📦📦</div>
                  <div className="card-content">
                    <div className="card-value">
                      {productSalesData.reduce((sum, product) => sum + product.packOfTwoSold, 0)}
                    </div>
                    <div className="card-label">Pack of Two Units</div>
                  </div>
                </div>

                <div className="summary-card-modern">
                  <div className="card-icon">📊</div>
                  <div className="card-content">
                    <div className="card-value">
                      {productSalesData.reduce((sum, product) => sum + product.packOfOneSold + (product.packOfTwoSold * 2), 0)}
                    </div>
                    <div className="card-label">Total Units</div>
                  </div>
                </div>

                {productSalesData.some(p => p.returnQuantity > 0) && (
                  <div className="summary-card-modern return-card">
                    <div className="card-icon">🔄</div>
                    <div className="card-content">
                      <div className="card-value">
                        {productSalesData.reduce((sum, product) => sum + product.returnQuantity, 0)}
                      </div>
                      <div className="card-label">Total Returns</div>
                    </div>
                  </div>
                )}

                {isAdminMode && (
                  <>
                    <div className="summary-card-modern revenue-card">
                      <div className="card-icon">💰</div>
                      <div className="card-content">
                        <div className="card-value">
                          ₹{productSalesData.reduce((sum, product) => sum + product.totalSales, 0).toLocaleString()}
                        </div>
                        <div className="card-label">Total Revenue</div>
                      </div>
                    </div>

                    <div className="summary-card-modern cost-card">
                      <div className="card-icon">🚚</div>
                      <div className="card-content">
                        <div className="card-value">
                          ₹{shippingRevenue.toLocaleString()}
                        </div>
                        <div className="card-label">Shipping Revenue</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

                        {isProductSalesTableExpanded && (
              <div className="table-container">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>S.No.</th>
                      <th>Product Name</th>
                      <th>Pack of One Sold</th>
                      <th>Pack of Two Sold</th>
                      <th>Total Units</th>
                      <th>Return Qty</th>
                      {isAdminMode && <th>Total Sales</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {productSalesData.map((product, index) => (
                      <tr key={index}>
                        <td className="serial-number">{index + 1}</td>
                        <td>{product.productName}</td>
                        <td>{product.packOfOneSold}</td>
                        <td>{product.packOfTwoSold}</td>
                        <td>{product.packOfOneSold + (product.packOfTwoSold * 2)}</td>
                        <td className={product.returnQuantity > 0 ? 'return-qty-highlight' : ''}>{product.returnQuantity}</td>
                        {isAdminMode && <td>₹{product.totalSales.toLocaleString()}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </FeatureLocked>
        )}

        {/* Revenue by State Section - Admin only */}
        {results.length > 0 && revenueByStateData.length > 0 && isAdminMode && (
          <FeatureLocked feature="viewResults">
            <div className="results-section">
              <div className="results-header">
                <div className="results-title-section">
                  <h2>🗺️ Revenue by State</h2>
                  <button
                    onClick={() => setIsRevenueByStateExpanded(!isRevenueByStateExpanded)}
                    className="toggle-button"
                    title={isRevenueByStateExpanded ? 'Collapse table' : 'Expand table'}
                  >
                    {isRevenueByStateExpanded ? '🔽' : '▶️'}
                  </button>
                </div>
                <div className="results-actions">
                  <FeatureLocked feature="exportData">
                    <button
                      onClick={exportRevenueByState}
                      className="export-button"
                      disabled={isFeatureLocked('exportData')}
                    >
                      📥 Export CSV
                    </button>
                  </FeatureLocked>
                </div>
              </div>

              {isRevenueByStateExpanded && (
                <div className="table-container">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>S.No.</th>
                        <th>State</th>
                        <th>Revenue</th>
                        <th>% of Total</th>
                        <th>Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const totalRevenue = revenueByStateData.reduce((sum, r) => sum + r.revenue, 0);
                        return revenueByStateData.map((row, index) => {
                          const pct = totalRevenue > 0 ? ((row.revenue / totalRevenue) * 100).toFixed(1) : '0';
                          return (
                            <tr key={row.state}>
                              <td className="serial-number">{index + 1}</td>
                              <td>{row.state}</td>
                              <td>₹{row.revenue.toLocaleString()}</td>
                              <td>{pct}%</td>
                              <td>{row.orderCount}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </FeatureLocked>
        )}

        {/* Top Products by Revenue Section - Last */}
        {results.length > 0 && productSalesData.length > 0 && (
          <FeatureLocked feature="viewResults">
            <div className="results-section">
              <div className="results-header">
                <div className="results-title-section">
                  <h2>🏆 Top 5 Products by Revenue</h2>
                  <button
                    onClick={() => setIsTopProductsExpanded(!isTopProductsExpanded)}
                    className="toggle-button"
                    title={isTopProductsExpanded ? 'Collapse table' : 'Expand table'}
                  >
                    {isTopProductsExpanded ? '🔽' : '▶️'}
                  </button>
                </div>
                <div className="results-actions">
                  <FeatureLocked feature="exportData">
                    <button
                      onClick={exportTopProducts}
                      className="export-button"
                      disabled={isFeatureLocked('exportData')}
                    >
                      📥 Export CSV
                    </button>
                  </FeatureLocked>
                </div>
              </div>

              {isTopProductsExpanded && (
                <div className="table-container">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Product Name</th>
                        <th>Pack of One</th>
                        <th>Pack of Two</th>
                        <th>Total Units</th>
                        {isAdminMode && <th>Revenue</th>}
                        <th>% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const totalRevenue = productSalesData.reduce((sum, p) => sum + p.totalSales, 0);
                        return productSalesData.slice(0, TOP_PRODUCTS_COUNT).map((product, index) => {
                          const pct = totalRevenue > 0 ? ((product.totalSales / totalRevenue) * 100).toFixed(1) : '0';
                          return (
                            <tr key={index}>
                              <td className="serial-number">{index + 1}</td>
                              <td>{product.productName}</td>
                              <td>{product.packOfOneSold}</td>
                              <td>{product.packOfTwoSold}</td>
                              <td>{product.packOfOneSold + (product.packOfTwoSold * 2)}</td>
                              {isAdminMode && <td>₹{product.totalSales.toLocaleString()}</td>}
                              <td>{pct}%</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </FeatureLocked>
        )}

        {/* Return Report Section */}
        {returnData.length > 0 && returnSummary && (
          <FeatureLocked feature="viewResults">
            <div className="results-section">
              <div className="results-header">
                <div className="results-title-section">
                  <h2>🔄 Return Report</h2>
                  <button
                    onClick={() => setIsReturnTableExpanded(!isReturnTableExpanded)}
                    className="toggle-button"
                    title={isReturnTableExpanded ? 'Collapse table' : 'Expand table'}
                  >
                    {isReturnTableExpanded ? '🔽' : '▶️'}
                  </button>
                </div>
                <div className="results-actions">
                  <input
                    type="file"
                    accept=".tsv,.txt,.csv"
                    onChange={handleReturnUpload}
                    disabled={loading}
                    className="file-input-hidden"
                    id="return-file-reupload"
                  />
                  <label htmlFor="return-file-reupload" className="upload-new-button">
                    📁 Upload New File
                  </label>
                  <FeatureLocked feature="exportData">
                    <button
                      onClick={exportReturns}
                      className="export-button"
                      disabled={isFeatureLocked('exportData')}
                    >
                      📥 Export CSV
                    </button>
                  </FeatureLocked>
                </div>
              </div>

              <div className="summary">
                <div className="summary-grid">
                  <div className="summary-card-modern orders-card">
                    <div className="card-icon">🔄</div>
                    <div className="card-content">
                      <div className="card-value">{returnSummary.totalReturns}</div>
                      <div className="card-label">Total Returns</div>
                    </div>
                  </div>

                  <div className="summary-card-modern cost-card">
                    <div className="card-icon">✅</div>
                    <div className="card-content">
                      <div className="card-value">{returnSummary.approvedCount}</div>
                      <div className="card-label">Approved</div>
                    </div>
                  </div>

                  <div className="summary-card-modern average-card">
                    <div className="card-icon">📦</div>
                    <div className="card-content">
                      <div className="card-value">{returnSummary.totalReturnQuantity}</div>
                      <div className="card-label">Units Returned</div>
                    </div>
                  </div>

                  <div className="summary-card-modern">
                    <div className="card-icon">🏷️</div>
                    <div className="card-content">
                      <div className="card-value">{returnSummary.uniqueSkus}</div>
                      <div className="card-label">Unique SKUs</div>
                    </div>
                  </div>

                  {isAdminMode && (
                    <>
                      <div className="summary-card-modern revenue-card">
                        <div className="card-icon">💸</div>
                        <div className="card-content">
                          <div className="card-value">₹{returnSummary.totalRefunded.toLocaleString()}</div>
                          <div className="card-label">Total Refunded</div>
                        </div>
                      </div>

                      <div className="summary-card-modern cost-card">
                        <div className="card-icon">🏷️</div>
                        <div className="card-content">
                          <div className="card-value">₹{returnSummary.totalLabelCost.toLocaleString()}</div>
                          <div className="card-label">Label Cost</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {returnSummary.topReason && (
                  <div className="warning-banner" style={{ marginTop: '12px' }}>
                    <div className="warning-icon">📋</div>
                    <div className="warning-content">
                      <strong>Top Return Reason:</strong> {returnSummary.topReason.reason} ({returnSummary.topReason.count} returns)
                    </div>
                  </div>
                )}
              </div>

              {isReturnTableExpanded && (
                <div className="table-container">
                  <table className="results-table return-table">
                    <thead>
                      <tr>
                        <th>S.No.</th>
                        <th>Order ID</th>
                        <th>Return Date</th>
                        <th>Status</th>
                        <th>SKU</th>
                        <th>Item Name</th>
                        <th>Qty</th>
                        <th>Reason</th>
                        <th>Return Type</th>
                        <th>Resolution</th>
                        {isAdminMode && <th>Refunded</th>}
                        <th>Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnData.map((row, index) => (
                        <tr key={index}>
                          <td className="serial-number">{index + 1}</td>
                          <td>{row.orderId}</td>
                          <td>{row.returnRequestDate}</td>
                          <td>
                            <span className={`return-status-badge ${row.status.toLowerCase() === 'approved' ? 'status-approved' : 'status-other'}`}>
                              {row.status}
                            </span>
                          </td>
                          <td>{row.sku}</td>
                          <td className="item-name-cell">{row.itemName}</td>
                          <td>{row.returnQuantity}</td>
                          <td>{row.returnReason}</td>
                          <td>{row.returnType}</td>
                          <td>{row.resolution}</td>
                          {isAdminMode && <td>₹{row.refundedAmount.toLocaleString()}</td>}
                          <td>{row.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </FeatureLocked>
        )}

        {paymentStatements.length > 0 && (
          <FeatureLocked feature="viewResults">
            <div className="results-section">
              <div className="results-header">
                <div className="results-title-section">
                  <h2>💳 Payments Dashboard</h2>
                  <button
                    onClick={() => setIsPaymentsTableExpanded(!isPaymentsTableExpanded)}
                    className="toggle-button"
                    title={isPaymentsTableExpanded ? 'Collapse table' : 'Expand table'}
                  >
                    {isPaymentsTableExpanded ? '🔽' : '▶️'}
                  </button>
                </div>
                <div className="results-actions">
                  {isAdminMode && (
                    <>
                      <input
                        type="file"
                        accept=".txt,.csv,.tsv"
                        multiple
                        onChange={handlePaymentsUpload}
                        disabled={loading}
                        className="file-input-hidden"
                        id="payments-file-reupload"
                      />
                      <label htmlFor="payments-file-reupload" className="upload-new-button">
                        📁 Upload New Files
                      </label>
                    </>
                  )}
                  <FeatureLocked feature="exportData">
                    <button
                      onClick={exportPaymentSummary}
                      className="export-button"
                      disabled={isFeatureLocked('exportData')}
                    >
                      📥 Export Summary CSV
                    </button>
                  </FeatureLocked>
                </div>
              </div>

              <div className="summary">
                <div className="summary-grid">
                  <div className="summary-card-modern orders-card">
                    <div className="card-icon">🧾</div>
                    <div className="card-content">
                      <div className="card-value">{paymentStatements.length}</div>
                      <div className="card-label">Statements</div>
                    </div>
                  </div>

                  <div className="summary-card-modern revenue-card">
                    <div className="card-icon">💰</div>
                    <div className="card-content">
                      <div className="card-value">
                        ₹
                        {fromPaise(
                          paymentStatements.reduce((sum, statement) => sum + statement.payoutAmountPaise, 0)
                        ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                      <div className="card-label">Total Payout</div>
                    </div>
                  </div>

                  <div className="summary-card-modern cost-card">
                    <div className="card-icon">✅</div>
                    <div className="card-content">
                      <div className="card-value">
                        {paymentStatements.filter((statement) => statement.reconcilePass).length}/
                        {paymentStatements.length}
                      </div>
                      <div className="card-label">Reconciled</div>
                    </div>
                  </div>

                  <div className="summary-card-modern payment-pie-card">
                    <div className="payment-pie-content">
                      <div
                        className="payment-pie-chart"
                        style={{
                          background: paymentBreakdownTotalMagnitude > 0
                            ? `conic-gradient(${paymentBreakdownGradient})`
                            : '#e5e7eb'
                        }}
                        title="Breakdown by absolute value"
                      />
                      <div className="payment-pie-legend">
                        <div className="card-label">Breakdown (Abs.)</div>
                        {paymentBreakdown.map((item) => {
                          const percentage = paymentBreakdownTotalMagnitude > 0
                            ? (Math.abs(item.valuePaise) / paymentBreakdownTotalMagnitude) * 100
                            : 0;
                          return (
                            <div className="payment-legend-row" key={item.key}>
                              <span
                                className="payment-legend-dot"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="payment-legend-name">{item.label}</span>
                              <span className="payment-legend-value">
                                ₹{fromPaise(item.valuePaise).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </span>
                              <span className="payment-legend-pct">{percentage.toFixed(1)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="summary-card-modern payment-bridge-card">
                    <div className="payment-bridge-content">
                      <div className="card-label">Sales To Payout Bridge</div>
                      {paymentBridgeRows.map((row) => {
                        const width = row.key === 'sales'
                          ? 100
                          : Math.min(100, row.percentOfSales);
                        return (
                          <div className="payment-bridge-row" key={row.key}>
                            <div className="payment-bridge-row-top">
                              <span className="payment-bridge-label">{row.label}</span>
                              <span className="payment-bridge-value">
                                ₹{fromPaise(row.valuePaise).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="payment-bridge-track">
                              <div
                                className="payment-bridge-bar"
                                style={{
                                  width: `${width}%`,
                                  backgroundColor: row.color
                                }}
                              />
                            </div>
                            <div className="payment-bridge-meta">
                              {row.key === 'sales'
                                ? '100% of sales'
                                : `${row.percentOfSales.toFixed(1)}% of sales`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {paymentFileResults.some((file) => file.status === 'error') && (
                  <div className="warning-banner">
                    <div className="warning-icon">⚠️</div>
                    <div className="warning-content">
                      <strong>Some files failed:</strong>{' '}
                      {paymentFileResults
                        .filter((file) => file.status === 'error')
                        .map((file) => `${file.fileName} (${file.message})`)
                        .join('; ')}
                    </div>
                  </div>
                )}
              </div>

              {isPaymentsTableExpanded && (
                <div className="table-container">
                  <table className="results-table payments-table">
                    <thead>
                      <tr>
                        <th>S.No.</th>
                        <th>Settlement ID</th>
                        <th>Statement Period</th>
                        <th>Beginning Balance</th>
                        <th>Sales</th>
                        <th>Refunds</th>
                        <th>Expenses</th>
                        <th>Others</th>
                        <th>Payout Amount</th>
                        <th>Reconcile</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentStatements.map((statement, index) => (
                        <tr
                          key={statement.settlementId}
                          className={selectedSettlementId === statement.settlementId ? 'selected-payment-row' : ''}
                          onClick={() => setSelectedSettlementId(statement.settlementId)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="serial-number">{index + 1}</td>
                          <td>{statement.settlementId}</td>
                          <td>{statement.statementPeriod}</td>
                          <td>₹{fromPaise(statement.beginningBalancePaise).toLocaleString()}</td>
                          <td>₹{fromPaise(statement.salesPaise).toLocaleString()}</td>
                          <td>₹{fromPaise(statement.refundsPaise).toLocaleString()}</td>
                          <td>₹{fromPaise(statement.expensesPaise).toLocaleString()}</td>
                          <td>₹{fromPaise(statement.othersPaise).toLocaleString()}</td>
                          <td>₹{fromPaise(statement.payoutAmountPaise).toLocaleString()}</td>
                          <td>
                            <span
                              className={`reconcile-badge ${
                                statement.reconcilePass ? 'reconcile-pass' : 'reconcile-fail'
                              }`}
                            >
                              {statement.reconcilePass ? 'PASS' : 'FAIL'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedPaymentStatement && (
                <>
                  <div className="results-header payment-detail-header">
                    <div className="results-title-section">
                      <h2>🔎 Statement Details: {selectedPaymentStatement.settlementId}</h2>
                      <button
                        onClick={() => setIsPaymentDetailsExpanded(!isPaymentDetailsExpanded)}
                        className="toggle-button"
                        title={isPaymentDetailsExpanded ? 'Collapse table' : 'Expand table'}
                      >
                        {isPaymentDetailsExpanded ? '🔽' : '▶️'}
                      </button>
                    </div>
                    <div className="results-actions">
                      <FeatureLocked feature="exportData">
                        <button
                          onClick={exportPaymentDetails}
                          className="export-button"
                          disabled={isFeatureLocked('exportData')}
                        >
                          📥 Export Details CSV
                        </button>
                      </FeatureLocked>
                    </div>
                  </div>

                  <div className="payment-reconcile-note">
                    Reconcile = Beginning Balance + Sales + Refunds + Expenses + Others. Difference:{' '}
                    ₹{fromPaise(selectedPaymentStatement.reconcileDifferencePaise).toFixed(2)}
                  </div>

                  {isPaymentDetailsExpanded && (
                    <div className="table-container">
                      <table className="results-table payments-detail-table">
                        <thead>
                          <tr>
                            <th>S.No.</th>
                            <th>Bucket</th>
                            <th>Transaction Type</th>
                            <th>Amount Type</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Order ID</th>
                            <th>Posted Date</th>
                            <th>SKU</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPaymentStatement.details.map((row, index) => (
                            <tr key={`${row.settlementId}-${row.lineNumber}-${index}`}>
                              <td className="serial-number">{index + 1}</td>
                              <td>{row.bucket}</td>
                              <td>{row.transactionType}</td>
                              <td>{row.amountType}</td>
                              <td>{row.amountDescription}</td>
                              <td>₹{fromPaise(row.amountPaise).toLocaleString()}</td>
                              <td>{row.orderId || '-'}</td>
                              <td>{row.postedDateTime || row.postedDate || '-'}</td>
                              <td>{row.sku || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </FeatureLocked>
        )}

      </div>
    </div>
  );
};

// Main App Component with Admin Provider
const App = () => {
  return (
    <AdminProvider>
      <AppContent />
    </AdminProvider>
  );
};

export default App; 