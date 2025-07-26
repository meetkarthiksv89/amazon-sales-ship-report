import React, { useState, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import './App.css';

const App = () => {
  const [orderData, setOrderData] = useState([]);
  const [results, setResults] = useState([]);
  const [productSalesData, setProductSalesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadStatus, setUploadStatus] = useState({
    orders: false
  });

  const [fileInfo, setFileInfo] = useState({
    name: '',
    type: '',
    converted: false
  });
  const [shippingRates, setShippingRates] = useState({});
  const [ratesLoaded, setRatesLoaded] = useState(false);

  const DEFAULT_RATE = 60; // Default rate per kg if state not found



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
      setLoading(false);
    });
  }, [parseFile]);



  // Extract pack information from product name
  const extractPackInfo = (productName) => {
    const packOfOne = /Pack of 1/i.test(productName) ? 1 : 0;
    const packOfTwo = /Pack of 2/i.test(productName) ? 1 : 0;
    return { packOfOne, packOfTwo };
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
          stateFound: !!shippingRates[order.state]
        };
      });

      setResults(processedResults);
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

  // Calculate total shipping cost
  const totalShippingCost = results.reduce((sum, order) => sum + order.shippingCost, 0);

  // Process product sales by variant (excluding cancelled orders)
  const processProductSalesByVariant = useCallback(() => {
    if (!orderData.length) return [];

    // Filter out cancelled orders
    const nonCancelledOrders = orderData.filter(row => {
      const orderStatus = row['order-status']?.trim().toLowerCase();
      return orderStatus !== 'cancelled';
    });

    // Group products by base name and variant
    const productSales = {};

    nonCancelledOrders.forEach(row => {
      const productName = row['product-name']?.trim();
      const quantity = parseInt(row.quantity) || 1;

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
          packOfTwoSold: 0
        };
      }

      // Add quantity to appropriate variant
      if (variant === 'Pack of Two') {
        productSales[baseName].packOfTwoSold += quantity;
      } else {
        productSales[baseName].packOfOneSold += quantity;
      }
    });

    // Convert to array and sort by total sales (descending)
    const productSalesArray = Object.values(productSales).sort((a, b) => {
      const totalA = a.packOfOneSold + a.packOfTwoSold;
      const totalB = b.packOfOneSold + b.packOfTwoSold;
      return totalB - totalA;
    });

    return productSalesArray;
  }, [orderData]);

  // Update product sales data when order data changes
  useEffect(() => {
    if (orderData.length > 0) {
      const salesData = processProductSalesByVariant();
      setProductSalesData(salesData);
    } else {
      setProductSalesData([]);
    }
  }, [orderData, processProductSalesByVariant]);

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>🚚 Amazon Report</h1>
        </header>

        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
          </div>
        )}

        {results.length === 0 && (
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
                  disabled={loading}
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
        )}

        {results.length === 0 && (
          <div className="action-section">
            <button
              onClick={processOrders}
              disabled={!uploadStatus.orders || !ratesLoaded || loading}
              className="process-button"
            >
              {loading ? '⏳ Processing...' : 
               !ratesLoaded ? '⏳ Loading Rates...' : 
               '🧮 Calculate Self-Ship Costs'}
            </button>
          </div>
        )}

        {results.length > 0 && (
          <div className="results-section">
            <div className="results-header">
              <h2>📊 Self-Ship</h2>
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
                <button onClick={exportResults} className="export-button">
                  📥 Export CSV
                </button>
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

            <div className="table-container">
              <table className="results-table">
                <thead>
                  <tr>
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
                  {results.map((row, index) => (
                    <tr key={index} className={!row.stateFound ? 'warning-row' : ''}>
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Product Sales by Variant Section */}
        {productSalesData.length > 0 && (
          <div className="results-section">
            <div className="results-header">
                             <h2>📈 Product Sales</h2>
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
              </div>
            </div>

            <div className="table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>S.No.</th>
                    <th>Product Name</th>
                    <th>Pack of One Sold</th>
                    <th>Pack of Two Sold</th>
                    <th>Total Units</th>
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
                     </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <footer className="footer">
          <p>Built for efficient Amazon self-ship operations</p>
        </footer>
      </div>
    </div>
  );
};

export default App; 