# 🚚 ShipCal - Amazon Self-Ship Report

A React-based web application that helps Amazon sellers calculate shipping charges for self-ship orders. The app processes CSV files, aggregates orders, and computes shipping costs by state using configurable shipping rates.

## ✨ Features

- **📁 Smart File Upload**: Upload Amazon Order Report in TXT or CSV format (shipping rates are built-in)
- **🔄 Automatic TXT to CSV Conversion**: Seamlessly converts tab-delimited TXT files to CSV format
- **🚚 Smart Order Filtering**: Only processes orders with "Shipped" status
- **🔄 Order Aggregation**: Groups multiple order lines by Order ID
- **⚖️ Weight Calculation**: Automatically calculates weights based on product pack types
  - Pack of One: 500g (0.5kg)
  - Pack of Two: 1kg (1.0kg)
- **📊 Shipping Cost Calculation**: Applies state-specific rates with automatic weight rounding
- **📋 Results Display**: Clean table showing all order details and calculations
- **📥 CSV Export**: Export results for further analysis
- **🔄 Return Report**: Upload Amazon return reports (TSV/TXT/CSV) with summary cards, detailed table, and CSV export
- **🎯 Error Handling**: Graceful handling of missing states and malformed data
- **📱 Responsive Design**: Works on desktop and mobile devices

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone or download this project**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Start the development server**:
   ```bash
   npm start
   ```
4. **Open your browser** and navigate to `http://localhost:3000`

## 📝 Usage Guide

### Step 1: Prepare Your CSV Files

#### Amazon Order Report (TXT or CSV)
Your order report should contain these columns:
- `amazon-order-id`: Unique order identifier
- `product-name`: Product description (should contain "Pack of 1" or "Pack of 2")
- `quantity`: Number of items ordered
- `ship-state`: Destination state for shipping
- `order-status`: Order status (only "Shipped" orders will be processed)

#### Amazon Return Report (TSV, TXT, or CSV)
Your return report should contain these columns:
- `Order ID`: Amazon order identifier
- `Return request date`: Date the return was requested
- `Return request status`: Status of the return (e.g., "Approved")
- `Item Name`: Product description
- `Return quantity`: Number of units returned
- `Return reason`: Reason for the return
- `Resolution`: How the return was resolved (e.g., "StandardRefund")
- `Return type`: Type of return (e.g., "Rejected", "Undelivered")
- `Refunded Amount`: Amount refunded to the customer
- `Category`: Product category

Optional columns (used when available): `Order date`, `Return delivery date`, `Amazon RMA ID`, `Label type`, `Label cost`, `Return carrier`, `Tracking ID`, `Is prime`, `ASIN`, `Merchant SKU`, `In policy`, `Invoice number`, `Order Amount`, `Order quantity`.

#### Built-in State-wise Shipping Rates
The app includes predefined shipping rates for all Indian states:
- Rates range from ₹45/kg (Goa, Kerala) to ₹65/kg (Arunachal Pradesh)
- Default rate of ₹60/kg for any state not found in the predefined list
- No separate file upload required

### Step 2: Upload Order File

1. Click "Choose File" under "Amazon Order Report" and select your order file (TXT or CSV)
2. If uploading a TXT file, the app will automatically convert it to CSV format
3. Wait for the green "✅ Uploaded" confirmation
4. Note: Shipping rates are built-in and don't need to be uploaded

### Step 3: Calculate Shipping

1. Click the "🧮 Calculate Self-Ship Costs" button
2. Wait for processing to complete
3. Review the results table

### Step 4: Export Results

1. Click "📥 Export CSV" to download the calculated results
2. The exported file will contain all calculations and can be used for further analysis

## 🧮 Calculation Logic

### Weight Calculation
- **Pack of One**: 0.5kg per unit
- **Pack of Two**: 1.0kg per unit
- **Total Weight**: (Pack of One qty × 0.5) + (Pack of Two qty × 1.0)
- **Rounded Weight**: Math.ceil(Total Weight) - always rounds up to next whole kg

### Shipping Cost Calculation
- **Rate Lookup**: Finds rate for destination state from rates CSV
- **Default Rate**: ₹60/kg used if state not found in rates file
- **Final Cost**: Rounded Weight × Rate per kg

### Order Filtering and Aggregation
- **Filters for Shipped Orders Only**: Only processes orders with `order-status = "Shipped"`
- **Groups all items** with the same Order ID
- **Sums quantities** for each pack type
- **Uses the shipping state** from any line item in the order
- **Shows filtering statistics** in the results summary

## 📁 File Structure

```
amazon-self-ship-report/
├── public/
│   └── index.html
├── src/
│   ├── App.js          # Main application component
│   ├── App.css         # Styling for the application
│   ├── index.js        # React app entry point
│   └── index.css       # Global styles
├── package.json        # Dependencies and scripts
└── README.md          # This file
```

## 🛠️ Technologies Used

- **React 18**: Modern React with hooks
- **PapaParse**: CSV parsing library
- **CSS3**: Modern styling with gradients and animations
- **Responsive Design**: Mobile-first approach

## 🎨 Features in Detail

### File Upload System
- Supports both TXT and CSV file formats
- Automatic TXT to CSV conversion for Amazon reports
- Real-time upload status indicators
- Error handling for malformed files
- Progress feedback during processing

### Data Processing
- Robust CSV parsing with error handling
- Intelligent product name parsing for pack types
- State name normalization (case-insensitive matching)
- Graceful handling of missing or invalid data

### Results Display
- Sortable table with all calculation details
- Visual indicators for missing states (warning badges)
- Summary statistics (total orders, total cost, average cost)
- Responsive table design with horizontal scrolling on mobile

### Export Functionality
- One-click CSV export
- Maintains all calculated data
- Ready for import into Excel or other tools

## 🔧 Customization

### Changing Default Shipping Rate
Edit the `DEFAULT_RATE` constant in `src/App.js`:
```javascript
const DEFAULT_RATE = 60; // Change this value
```

### Modifying Weight Calculations
Adjust the weight calculation logic in the `processOrders` function:
```javascript
const totalWeight = (order.packOfOne * 0.5) + (order.packOfTwo * 1.0);
```

### Adding New Pack Types
Extend the `extractPackInfo` function to recognize additional pack types:
```javascript
const extractPackInfo = (productName) => {
  const packOfOne = /Pack of 1/i.test(productName) ? 1 : 0;
  const packOfTwo = /Pack of 2/i.test(productName) ? 1 : 0;
  // Add more pack types here
  return { packOfOne, packOfTwo };
};
```

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Static Hosting
The built files in the `build/` folder can be deployed to:
- Netlify
- Vercel
- GitHub Pages
- Any static file hosting service

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## 🆘 Support

If you encounter any issues:
1. Check that your order file (TXT or CSV) has the required columns
2. For TXT files, ensure they are tab-delimited (standard Amazon format)
3. Verify that product names contain "Pack of 1" or "Pack of 2"
4. Ensure orders have a valid `order-status` column
5. Check the browser console for any error messages

---

Built with ❤️ for efficient Amazon self-ship operations 