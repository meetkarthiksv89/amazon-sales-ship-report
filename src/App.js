import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';
import Papa from 'papaparse';
import './App.css';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadStatus, setUploadStatus] = useState({
    orders: false
  });
  const [isShippingTableExpanded, setIsShippingTableExpanded] = useState(true);
  const [isProductSalesTableExpanded, setIsProductSalesTableExpanded] = useState(true);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const [fileInfo, setFileInfo] = useState({
    name: '',
    type: '',
    converted: false
  });
  const [shippingRates, setShippingRates] = useState({});
  const [ratesLoaded, setRatesLoaded] = useState(false);

  const DEFAULT_RATE = 60; // Default rate per kg if state not found
  
  // Use admin context
  const { isFeatureLocked, isAdminMode } = useAdmin();



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
      setLoading(false);
    });
  }, [parseFile]);



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

  // Process orders and calculate shipping
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
        return orderStatus === 'shipped';
      });



      // Group orders by Order ID
      const orderGroups = {};
      shippedOrders.forEach(row => {
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
      
      // Calculate product sales data and shipping revenue
      const { productSales, shippingRevenue: totalShippingRevenue } = processProductSalesByVariant();
      setProductSalesData(productSales);
      setShippingRevenue(totalShippingRevenue);
      
      setLoading(false);
    } catch (err) {
      setError(`Processing error: ${err.message}`);
      setLoading(false);
    }
  }, [orderData, shippingRates, ratesLoaded]);

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

  // Export product sales to CSV
  const exportProductSales = useCallback(() => {
    if (!productSalesData.length) return;

    const csvContent = Papa.unparse({
      fields: [
        'S.No.',
        'Product Name',
        'Pack of One Sold',
        'Pack of Two Sold',
        'Total Units',
        'Total Sales'
      ],
      data: productSalesData.map((product, index) => [
        index + 1,
        product.productName,
        product.packOfOneSold,
        product.packOfTwoSold,
        product.packOfOneSold + (product.packOfTwoSold * 2),
        product.totalSales
      ])
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'product_sales_results.csv';
    link.click();
  }, [productSalesData]);

  // Calculate total shipping cost
  const totalShippingCost = results.reduce((sum, order) => sum + order.shippingCost, 0);

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

  // Process product sales by variant (excluding cancelled orders)
  const processProductSalesByVariant = useCallback(() => {
    if (!orderData.length) return { productSales: [], shippingRevenue: 0 };

    // Filter out cancelled orders
    const nonCancelledOrders = orderData.filter(row => {
      const orderStatus = row['order-status']?.trim().toLowerCase();
      return orderStatus !== 'cancelled';
    });

    // Group products by base name and variant
    const productSales = {};
    let totalShippingRevenue = 0;

    nonCancelledOrders.forEach(row => {
      const productName = row['product-name']?.trim();
      const quantity = parseInt(row.quantity) || 1;
      const itemPrice = parseFloat(row['item-price']) || 0;
      const promotionDiscount = parseFloat(row['item-promotion-discount']) || 0;
      const shippingPrice = parseFloat(row['shipping-price']) || 0;

      // Add to shipping revenue
      totalShippingRevenue += shippingPrice;

      if (!productName) return;

      // Determine variant and extract base product name
      let variant = 'Pack of One'; // Default for uncategorized products
      let baseName = productName;

      if (/pack of 2/i.test(productName)) {
        variant = 'Pack of Two';
        baseName = productName.replace(/pack of 2/gi, '').trim();
      } else if (/pack of 1/i.test(productName)) {
        variant = 'Pack of One';
        baseName = productName.replace(/pack of 1/gi, '').trim();
      }

      // Clean up base name (remove extra spaces, dashes, parentheses)
      baseName = baseName.replace(/\s*-\s*$|^\s*-\s*|\s*\(\s*\)\s*$/, '').trim();

      // Initialize product entry if it doesn't exist
      if (!productSales[baseName]) {
        productSales[baseName] = {
          productName: baseName,
          packOfOneSold: 0,
          packOfTwoSold: 0,
          totalSales: 0
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

    // Convert to array and sort by total sales (descending)
    const productSalesArray = Object.values(productSales).sort((a, b) => {
      const totalA = a.totalSales;
      const totalB = b.totalSales;
      return totalB - totalA;
    });

    return { productSales: productSalesArray, shippingRevenue: totalShippingRevenue };
  }, [orderData]);

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
                <div className="upload-area">
                  <div className="upload-header">
                    <div className="upload-icon">📁</div>
                    <div className="upload-text">
                      <h3>Upload Order Report</h3>
                      <p>Drop your Amazon order file here or click to browse</p>
                      <span className="supported-formats">Supports TXT & CSV formats</span>
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

              <div className="rates-status">
                <div className="rates-indicator">
                  <div className="rates-icon">⚙️</div>
                  <div className="rates-info">
                    <div className="rates-title">Shipping Rates</div>
                    <div className={`rates-status-text ${ratesLoaded ? 'loaded' : 'loading'}`}>
                      {ratesLoaded ? `${Object.keys(shippingRates).length} states configured` : 'Loading...'}
                    </div>
                    {ratesLoaded && (
                      <div className="rates-sample">
                        KA: ₹{shippingRates['KARNATAKA'] || DEFAULT_RATE} • TN: ₹{shippingRates['TAMIL NADU'] || DEFAULT_RATE} • MH: ₹{shippingRates['MAHARASHTRA'] || DEFAULT_RATE}
                      </div>
                    )}
                  </div>
                  {ratesLoaded && (
                    <button 
                      onClick={loadShippingRates}
                      className="refresh-btn"
                      disabled={loading}
                      title="Refresh rates from CSV"
                    >
                      🔄
                    </button>
                  )}
                </div>
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
                      <th>Total Sales</th>
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
                        <td>₹{product.totalSales.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </FeatureLocked>
        )}

        <footer className="footer">
          <p>Built for efficient Amazon self-ship operations</p>
        </footer>
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