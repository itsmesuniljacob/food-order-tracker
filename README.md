# Zomato Food Expense Tracker

A beautifully crafted Google Chrome Extension that calculates your lifetime spending on Zomato and presents it in a premium, responsive dashboard with insights into your ordering habits.

## ✨ Features

- **Lifetime Statistics**: See your total lifetime spend, total order count, and average order value.
- **Top 10 Restaurants**: A leaderboard of your most ordered restaurants and total spend at each.
- **Monthly Spend Trends**: Interactive area line charts powered by Chart.js showing your spending habits over time.
- **Order Time Analysis**: A 24-hour frequency chart that pinpoints exactly what time of the day you order food the most.
- **Region Wise Spends**: A beautiful doughnut chart breaking down your orders by city/locality.
- **Date Filtering**: Instantly filter your cached data by All Time, Last 30 Days, Last 3 Months, Last 1 Year, or custom date ranges.
- **Privacy First**: Order history is fetched directly from Zomato.com while you are logged in, and data is aggressively cached to your local browser storage. No external servers involved!

## 🚀 Installation 

Since this extension is custom-built and not available on the Chrome Web Store, you can run it locally in "Developer Mode":

1. Clone or download this repository to your local machine.
2. Open Google Chrome and type `chrome://extensions/` into your address bar.
3. Toggle the **Developer mode** switch in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select the `04-zomato-expense` folder you downloaded.
6. Make sure you are logged into [Zomato.com](https://www.zomato.com) in your browser.
7. Click the new extension icon in your Chrome toolbar to open the popup, and hit **Open Full Dashboard** to begin fetching your data!

## 🎨 Theme & Aesthetic
Built purely with Vanilla HTML, JS, and CSS to guarantee lightning-fast performance while maintaining the classic bright/red Zomato aesthetic. Includes custom gradient coloring for time series mappings.
