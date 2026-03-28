// State
let orderData = [];
let monthlyChartInstance = null;
let regionChartInstance = null;
let timeChartInstance = null;
let currentFilter = 'all';

// DOM Elements
const fetchBtn = document.getElementById('fetch-btn');
const clearBtn = document.getElementById('clear-btn');
const statusText = document.getElementById('status-text');
const progressBar = document.getElementById('progress-bar');
const authError = document.getElementById('auth-error');

const elTotalSpend = document.getElementById('total-spend');
const elTotalOrders = document.getElementById('total-orders');
const elAvgOrderValue = document.getElementById('avg-order-value');
const elTopRestaurantsTable = document.querySelector('#top-restaurants-table tbody');

const filterBtns = document.querySelectorAll('.filter-btn[data-range]');
const customStartDateInput = document.getElementById('custom-start-date');
const customEndDateInput = document.getElementById('custom-end-date');
const applyCustomDateBtn = document.getElementById('apply-custom-date');

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadCachedData();
  fetchBtn.addEventListener('click', startFetching);
  clearBtn.addEventListener('click', clearData);

  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.getAttribute('data-range');
      renderDashboard();
    });
  });

  applyCustomDateBtn.addEventListener('click', () => {
    if(customStartDateInput.value && customEndDateInput.value) {
      filterBtns.forEach(b => b.classList.remove('active'));
      currentFilter = 'custom';
      renderDashboard();
    } else {
      alert("Please select both start and end dates.");
    }
  });
});

async function loadCachedData() {
  chrome.storage.local.get(['zomatoOrders'], (result) => {
    if (result.zomatoOrders) {
      orderData = result.zomatoOrders;
      statusText.innerText = `Loaded ${orderData.length} cached orders.`;
      progressBar.style.width = '100%';
      renderDashboard();
    }
  });
}

async function clearData() {
  chrome.storage.local.remove(['zomatoOrders'], () => {
    orderData = [];
    statusText.innerText = 'Cache cleared.';
    progressBar.style.width = '0%';
    renderDashboard();
  });
}

async function startFetching() {
  fetchBtn.disabled = true;
  fetchBtn.innerText = 'Fetching...';
  authError.classList.add('hidden');
  orderData = [];
  
  let page = 1;
  let totalPages = 1;
  let keepFetching = true;

  try {
    while (keepFetching && page <= totalPages) {
      statusText.innerText = `Fetching page ${page} of ${totalPages}...`;
      
      const response = await fetch(`https://www.zomato.com/webroutes/user/orders?page=${page}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('UNAUTHORIZED');
        }
        throw new Error(`FETCH_FAILED (${response.status})`);
      }

      const json = await response.json();
      
      if (page === 1) {
        try {
          totalPages = json.page_data.sections.SECTION_USER_ORDER_HISTORY.totalPages || 1;
        } catch (e) {
          totalPages = 50; 
        }
      }

      const entities = json.entities?.ORDER;
      if (!entities || Object.keys(entities).length === 0) {
        keepFetching = false;
        break;
      }

      for (let orderId in entities) {
        orderData.push(entities[orderId]);
      }

      progressBar.style.width = `${Math.min((page / totalPages) * 100, 100)}%`;
      page++;
      
      renderDashboard();

      await new Promise(r => setTimeout(r, 800));
    }

    statusText.innerText = `Fetch complete! ${orderData.length} total orders.`;
    progressBar.style.width = '100%';
    chrome.storage.local.set({ zomatoOrders: orderData });
    
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') {
      authError.classList.remove('hidden');
      statusText.innerText = "Fetch failed: Please login.";
    } else {
      statusText.innerText = `Error: ${err.message}`;
    }
  } finally {
    fetchBtn.disabled = false;
    fetchBtn.innerText = 'Fetch Data';
  }
}

function parseCost(costString) {
  if(!costString) return 0;
  const numMatches = costString.match(/\d+(\.\d+)?/);
  return numMatches ? parseFloat(numMatches[0]) : 0;
}

function parseZomatoDate(dateStr) {
  if (!dateStr) return new Date(0);
  const lowerStr = dateStr.toLowerCase();
  let dateObj = new Date();
  
  if (lowerStr.includes('today')) {
    // keep today
  } else if (lowerStr.includes('yesterday')) {
    dateObj.setDate(dateObj.getDate() - 1);
  } else {
    const rawDate = dateStr.split(' at ')[0];
    const parsed = new Date(rawDate);
    if (!isNaN(parsed.getTime())) {
      dateObj = parsed;
    }
  }
  return dateObj;
}

function filterOrders(data) {
  if (currentFilter === 'all') return data;
  
  const now = new Date();
  let startTime = 0;
  let endTime = now.getTime();

  if (currentFilter === '30d') {
    startTime = now.getTime() - (30 * 24 * 60 * 60 * 1000);
  } else if (currentFilter === '3m') {
    startTime = now.getTime() - (90 * 24 * 60 * 60 * 1000);
  } else if (currentFilter === '1y') {
    startTime = now.getTime() - (365 * 24 * 60 * 60 * 1000);
  } else if (currentFilter === 'custom') {
    const customStart = new Date(customStartDateInput.value);
    const customEnd = new Date(customEndDateInput.value);
    if (isNaN(customStart.getTime()) || isNaN(customEnd.getTime())) return data;
    startTime = customStart.getTime();
    endTime = customEnd.getTime() + (24 * 60 * 60 * 1000) - 1;
  }

  return data.filter(order => {
    const orderDate = parseZomatoDate(order.orderDate).getTime();
    return orderDate >= startTime && orderDate <= endTime;
  });
}

function renderDashboard() {
  const filteredData = filterOrders(orderData);

  if (filteredData.length === 0) {
    elTotalSpend.innerText = '₹ 0';
    elTotalOrders.innerText = '0';
    elAvgOrderValue.innerText = '₹ 0';
    elTopRestaurantsTable.innerHTML = '';
    if (monthlyChartInstance) { monthlyChartInstance.destroy(); monthlyChartInstance = null; }
    if (regionChartInstance) { regionChartInstance.destroy(); regionChartInstance = null; }
    if (timeChartInstance) { timeChartInstance.destroy(); timeChartInstance = null; }
    return;
  }

  let totalSpend = 0;
  let totalOrders = filteredData.length;
  
  const monthlySpendMap = {};
  const restaurantMap = {};
  const regionMap = {};
  const timeMap = {};
  for(let i=0; i<24; i++) {
    const displayHour = i === 0 ? 12 : (i > 12 ? i - 12 : i);
    const ampm = i >= 12 ? 'PM' : 'AM';
    timeMap[`${displayHour} ${ampm}`] = 0;
  }

  filteredData.forEach(order => {
    const cost = parseCost(order.totalCost);
    totalSpend += cost;

    // Monthly
    const dateParts = order.orderDate ? order.orderDate.split(' ') : [];
    let monthYear = "Unknown";
    if (dateParts.length >= 3) {
      monthYear = `${dateParts[1]} ${dateParts[2]}`;
    }
    monthlySpendMap[monthYear] = (monthlySpendMap[monthYear] || 0) + cost;

    // Top Restaurants
    const resName = order.resInfo?.name || "Unknown Restaurant";
    if (!restaurantMap[resName]) restaurantMap[resName] = { spend: 0, orders: 0 };
    restaurantMap[resName].spend += cost;
    restaurantMap[resName].orders += 1;

    // Region / Locality
    const localityObj = order.resInfo?.locality;
    let locality = "Unknown Region";
    if (localityObj) {
      if (typeof localityObj === 'string') {
        locality = localityObj;
      } else if (localityObj.localityName) {
        locality = localityObj.localityName;
      } else if (localityObj.name) {
        locality = localityObj.name;
      }
    }
    
    if (locality !== "Unknown Region" && locality.includes(',')) {
      const parts = locality.split(',');
      locality = parts[parts.length - 1].trim();
    }
    
    regionMap[locality] = (regionMap[locality] || 0) + 1;

    // Time Tracking
    const timeMatch = order.orderDate?.match(/\d{1,2}:\d{2}\s(?:AM|PM)/i);
    if (timeMatch) {
      const timeStr = timeMatch[0];
      const [hm, ampm] = timeStr.split(' ');
      let [h, m] = hm.split(':').map(Number);
      if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
      if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
      
      const displayHour = h === 0 ? 12 : (h > 12 ? h - 12 : h);
      const displayAmpm = h >= 12 ? 'PM' : 'AM';
      const key = `${displayHour} ${displayAmpm}`;
      if (timeMap[key] !== undefined) {
        timeMap[key] += 1;
      }
    }
  });

  elTotalSpend.innerText = `₹ ${totalSpend.toLocaleString('en-IN')}`;
  elTotalOrders.innerText = totalOrders;
  const avg = Math.round(totalSpend / totalOrders);
  elAvgOrderValue.innerText = `₹ ${avg.toLocaleString('en-IN')}`;

  const topRestaurants = Object.entries(restaurantMap)
    .sort((a, b) => b[1].spend - a[1].spend)
    .slice(0, 10);
  
  elTopRestaurantsTable.innerHTML = topRestaurants.map(([name, stats]) => `
    <tr>
      <td style="font-weight: 500">${name}</td>
      <td>₹ ${Math.round(stats.spend).toLocaleString('en-IN')}</td>
      <td>${stats.orders}</td>
    </tr>
  `).join('');

  updateCharts(monthlySpendMap, regionMap, timeMap);
}

function updateCharts(monthlySpendMap, regionMap, timeMap) {
  const months = Object.keys(monthlySpendMap).reverse();
  const spendData = months.map(m => monthlySpendMap[m]);

  const ctxMonthly = document.getElementById('monthly-chart').getContext('2d');
  if (monthlyChartInstance) monthlyChartInstance.destroy();
  
  monthlyChartInstance = new Chart(ctxMonthly, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'Monthly Spend (₹)',
        data: spendData,
        borderColor: '#E23744',
        backgroundColor: 'rgba(226, 55, 68, 0.2)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#E23744'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  const sortedRegions = Object.entries(regionMap).sort((a,b) => b[1] - a[1]).slice(0, 8);
  const ctxRegion = document.getElementById('region-chart').getContext('2d');
  
  if (regionChartInstance) regionChartInstance.destroy();

  regionChartInstance = new Chart(ctxRegion, {
    type: 'doughnut',
    data: {
      labels: sortedRegions.map(r => r[0]),
      datasets: [{
        data: sortedRegions.map(r => r[1]),
        backgroundColor: [
          '#8A031E', '#B2182B', '#cb202d', '#E23744', 
          '#FF4D4D', '#FF6B6B', '#FF8E8E', '#FFB4B4'
        ],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });

  const ctxTime = document.getElementById('time-chart').getContext('2d');
  if (timeChartInstance) timeChartInstance.destroy();

  timeChartInstance = new Chart(ctxTime, {
    type: 'bar',
    data: {
      labels: Object.keys(timeMap),
      datasets: [{
        label: 'Orders',
        data: Object.values(timeMap),
        backgroundColor: '#E23744',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: {
            autoSkip: true,
            maxTicksLimit: 12
          }
        },
        y: { beginAtZero: true }
      }
    }
  });
}
