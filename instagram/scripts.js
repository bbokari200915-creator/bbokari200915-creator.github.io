let csvData = null;
const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1kOAedLmLLPTnjchQvwKyApgHR16iGnanjeMCkh0E0vk/export?format=csv&gid=0';

// Load data from Google Sheets CSV
async function loadCsvData() {
  showLoading(true);

  try {
    console.log('Loading data from Google Sheets...');
    const response = await fetch(GOOGLE_SHEETS_CSV_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const csvText = await response.text();

    if (!csvText || csvText.includes('<html')) {
      throw new Error('獲取的不是CSV資料，可能是權限問題');
    }

    // Parse CSV using Papa Parse
    Papa.parse(csvText, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: function (results) {
        try {
          csvData = results.data.filter(row => {
            // Filter out empty rows and ensure required fields exist
            return row && Object.keys(row).length > 0 &&
              (row.ownerUsername || row.ownerFullName || row.url);
          });

          showLoading(false);
          console.log(`Successfully loaded ${csvData.length} records from Google Sheets`);

          if (csvData.length > 0) {
            displayTable(csvData);
          } else {
            console.error('No valid data found in CSV');
          }

        } catch (error) {
          showLoading(false);
          console.error('Error processing CSV data:', error.message);
        }
      },
      error: function (error) {
        showLoading(false);
        console.error('CSV parsing error:', error.message);
      }
    });

  } catch (error) {
    showLoading(false);
    console.error('Error loading CSV data:', error.message);
  }
}

// Keep the original file upload function as backup
function loadJsonFile() {
  const fileInput = document.getElementById('jsonFile');
  const file = fileInput.files[0];

  if (!file) {
    console.error('Please select a JSON file first.');
    return;
  }

  if (!file.name.toLowerCase().endsWith('.json')) {
    console.error('Please select a valid JSON file.');
    return;
  }

  showLoading(true);

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const content = e.target.result;
      csvData = JSON.parse(content);

      showLoading(false);
      console.log(`Successfully loaded ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);

      displayTable(csvData);

    } catch (error) {
      showLoading(false);
      console.error(`Error parsing JSON file: ${error.message}`);
    }
  };

  reader.onerror = function () {
    showLoading(false);
    console.error('Error reading the file.');
  };

  reader.readAsText(file);
}


function displayTable(data) {
  // Note: dataTableTitle is no longer used since we have separate section headers
  // const dataTableTitle = document.getElementById('dataTableTitle');

  if (!data) {
    console.error('No data to display');
    return;
  }

  // Update titles with timestamp from data
  const formattedDate = data[0] ? data[0].latestDate : new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const yongLixxTitle = document.getElementById('yongLixxDataTableTitle');
  const smallMagazineTitle = document.getElementById('smallMagazineDataTableTitle');
  const bigMagazineTitle = document.getElementById('bigMagazineDataTableTitle');
  const titleText = `抓取时间: ${formattedDate}`;

  if (yongLixxTitle) yongLixxTitle.textContent = titleText;
  if (smallMagazineTitle) smallMagazineTitle.textContent = titleText;
  if (bigMagazineTitle) bigMagazineTitle.textContent = titleText;

  // Define the specific fields to display and their corresponding display names
  const targetFields = [
    'No.',
    'ownerUsername',
    'likesCount',
    'commentsCount',
    'videoPlayCount',
    'url',
    'shortCode',
    'timestamp'
  ];

  // Define display names for each field
  const fieldDisplayNames = {
    'No.': 'No.',
    'ownerUsername': 'Account',
    'url': 'Link',
    'likesCount': 'Likes',
    'commentsCount': 'Comments',
    'videoPlayCount': 'Views'
  };

  // Handle different data structures
  let allData = [];

  if (Array.isArray(data)) {
    // Extract only the target fields from each item
    allData = data.map((item, index) => {
      const extractedData = {};
      targetFields.forEach(field => {
        if (field === 'No.') {
          extractedData[field] = index + 1;
        } else {
          extractedData[field] = item[field];
        }
      });
      return extractedData;
    });
  } else if (typeof data === 'object') {
    // Convert object to array format
    const entries = Object.entries(data);
    allData = entries.map(([key, value], index) => {
      const extractedData = {};
      targetFields.forEach(field => {
        if (field === 'No.') {
          extractedData[field] = index + 1;
        } else if (typeof value === 'object' && value !== null) {
          extractedData[field] = value[field];
        } else {
          extractedData[field] = field === key ? value : '';
        }
      });
      return extractedData;
    });
  } else {
    console.error('Data format not supported for table display');
    return;
  }

  // Separate data based on config categories
  const felixData = [];
  const bigMagazineData = [];
  const smallMagazineData = [];

  allData.forEach(item => {
    const category = categorizeUser(item.ownerUsername);
    switch (category) {
      case 'felix':
        felixData.push(item);
        break;
      case 'bigMagazine':
        bigMagazineData.push(item);
        break;
      case 'smallMagazine':
      default:
        smallMagazineData.push(item);
        break;
    }
  });

  // Sort data by timestamp
  felixData.sort((a, b) => (new Date(a.timestamp) - new Date(b.timestamp)) < 0 ? -1 : 1);
  bigMagazineData.sort((a, b) => (new Date(a.timestamp) - new Date(b.timestamp)) < 0 ? -1 : 1);
  smallMagazineData.sort((a, b) => (new Date(a.timestamp) - new Date(b.timestamp)) < 0 ? -1 : 1);

  // Re-number the items
  felixData.forEach((item, index) => {
    item['No.'] = index + 1;
  });
  smallMagazineData.forEach((item, index) => {
    item['No.'] = index + 1;
  });
  bigMagazineData.forEach((item, index) => {
    item['No.'] = index + 1;
  });

  // Sort data by timestamp
  felixData.sort((a, b) => (new Date(a.timestamp) - new Date(b.timestamp)) < 0 ? 1 : -1);
  bigMagazineData.sort((a, b) => (new Date(a.timestamp) - new Date(b.timestamp)) < 0 ? 1 : -1);
  smallMagazineData.sort((a, b) => (new Date(a.timestamp) - new Date(b.timestamp)) < 0 ? 1 : -1);

  // Get separate table elements
  const yongLixxSectionHeader = document.getElementById('yongLixxSectionHeader');
  const yongLixxTableContainer = document.getElementById('yongLixxTableContainer');
  const yongLixxTableHeader = document.getElementById('yongLixxTableHeader');
  const yongLixxTableBody = document.getElementById('yongLixxTableBody');

  const smallMagazineSectionHeader = document.getElementById('smallMagazineSectionHeader');
  const smallMagazineTableContainer = document.getElementById('smallMagazineTableContainer');
  const smallMagazineTableHeader = document.getElementById('smallMagazineTableHeader');
  const smallMagazineTableBody = document.getElementById('smallMagazineTableBody');

  const bigMagazineSectionHeader = document.getElementById('bigMagazineSectionHeader');
  const bigMagazineTableContainer = document.getElementById('bigMagazineTableContainer');
  const bigMagazineTableHeader = document.getElementById('bigMagazineTableHeader');
  const bigMagazineTableBody = document.getElementById('bigMagazineTableBody');

  // Clear existing table content and mobile cards
  yongLixxTableHeader.innerHTML = '';
  yongLixxTableBody.innerHTML = '';
  if (smallMagazineTableHeader) smallMagazineTableHeader.innerHTML = '';
  if (smallMagazineTableBody) smallMagazineTableBody.innerHTML = '';
  if (bigMagazineTableHeader) bigMagazineTableHeader.innerHTML = '';
  if (bigMagazineTableBody) bigMagazineTableBody.innerHTML = '';

  // Remove existing mobile cards
  const existingCards = document.querySelectorAll('.mobile-cards');
  existingCards.forEach(cards => cards.remove());

  // Create felix table if data exists
  if (felixData.length > 0) {
    createTableSection(felixData, yongLixxTableHeader, yongLixxTableBody, targetFields, fieldDisplayNames);
    yongLixxSectionHeader.style.display = 'flex';
    yongLixxTableContainer.style.display = 'block';
  } else {
    yongLixxSectionHeader.style.display = 'none';
    yongLixxTableContainer.style.display = 'none';
  }

  // Create small magazine table if data exists
  if (smallMagazineData.length > 0 && smallMagazineTableHeader && smallMagazineTableBody) {
    createTableSection(smallMagazineData, smallMagazineTableHeader, smallMagazineTableBody, targetFields, fieldDisplayNames);
    if (smallMagazineSectionHeader) smallMagazineSectionHeader.style.display = 'flex';
    if (smallMagazineTableContainer) smallMagazineTableContainer.style.display = 'block';
  } else {
    if (smallMagazineSectionHeader) smallMagazineSectionHeader.style.display = 'none';
    if (smallMagazineTableContainer) smallMagazineTableContainer.style.display = 'none';
  }

  // Create big magazine table if data exists
  if (bigMagazineData.length > 0 && bigMagazineTableHeader && bigMagazineTableBody) {
    createTableSection(bigMagazineData, bigMagazineTableHeader, bigMagazineTableBody, targetFields, fieldDisplayNames);
    if (bigMagazineSectionHeader) bigMagazineSectionHeader.style.display = 'flex';
    if (bigMagazineTableContainer) bigMagazineTableContainer.style.display = 'block';
  } else {
    if (bigMagazineSectionHeader) bigMagazineSectionHeader.style.display = 'none';
    if (bigMagazineTableContainer) bigMagazineTableContainer.style.display = 'none';
  }
}

// Helper function to create a table section
function createTableSection(tableData, tableHeader, tableBody, targetFields, fieldDisplayNames) {
  // Create header row with display names
  const headerRow = document.createElement('tr');
  targetFields.forEach(field => {
    const th = document.createElement('th');
    th.textContent = fieldDisplayNames[field] || field;
    headerRow.appendChild(th);
  });
  tableHeader.appendChild(headerRow);

  // Create mobile cards container
  const mobileCards = document.createElement('div');
  mobileCards.className = 'mobile-cards';

  // Insert mobile cards after the table container
  const tableContainer = tableBody.parentElement.parentElement;
  tableContainer.parentElement.insertBefore(mobileCards, tableContainer.nextSibling);

  // Create data rows and mobile cards
  tableData.forEach((row, index) => {
    // Create mobile card
    const card = document.createElement('div');
    card.className = 'mobile-card';

    // Card header with number, link, and account
    const cardHeader = document.createElement('div');
    cardHeader.className = 'mobile-card-header';

    const linkHtml = row['url'] ? `
      <div class="mobile-card-link-header">
        <button onclick="copyToClipboard(\`${row['url']}\`, this)" style="background: none; border: none; cursor: pointer; padding: 4px; border-radius: 3px; color: #9ca3af; font-size: 14px; transition: all 0.2s ease;" title="Copy URL">
          <span class="material-icons" style="font-size: 16px;">content_copy</span>
        </button>
        <a href="${row['url']}" target="_blank" style="color: #999; text-decoration: none; transition: color 0.2s ease; font-size: 13px;">${row['shortCode'] || 'Link'}</a>
      </div>
    ` : '';

    cardHeader.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="mobile-card-number">#${row['No.']}</div>
        ${linkHtml}
      </div>
      <div class="mobile-card-account">@${row['ownerUsername'] || 'N/A'}</div>
    `;
    card.appendChild(cardHeader);

    // Card stats
    const cardStats = document.createElement('div');
    cardStats.className = 'mobile-card-stats';
    cardStats.innerHTML = `
      <div class="mobile-card-stat">
        <div class="mobile-card-stat-label">Likes</div>
        <div class="mobile-card-stat-value">${row['likesCount'] || '0'}</div>
      </div>
      <div class="mobile-card-stat">
        <div class="mobile-card-stat-label">Comments</div>
        <div class="mobile-card-stat-value">${row['commentsCount'] || '0'}</div>
      </div>
      <div class="mobile-card-stat">
        <div class="mobile-card-stat-label">Views</div>
        <div class="mobile-card-stat-value">${row['videoPlayCount'] || '0'}</div>
      </div>
    `;
    card.appendChild(cardStats);

    mobileCards.appendChild(card);
    const tr = document.createElement('tr');
    targetFields.forEach(field => {
      const td = document.createElement('td');
      td.style.textAlign = 'left';
      td.style.verticalAlign = 'middle';
      let cellValue = row[field];

      // Handle different data types
      if (cellValue === null || cellValue === undefined) {
        cellValue = '';
      } else if (typeof cellValue === 'object') {
        cellValue = JSON.stringify(cellValue);
      } else {
        cellValue = String(cellValue);
      }

      // Special formatting for different field types
      if (field === 'url') {
        if (cellValue) {
          td.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
              <button onclick="copyToClipboard(\`${cellValue}\`, this)" style="background: none; border: none; cursor: pointer; padding: 4px; border-radius: 3px; color: #9ca3af; font-size: 14px; transition: all 0.2s ease;" title="Copy URL" onmouseover="this.style.color='#e1e3e1'; this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.color='#9ca3af'; this.style.background='none'">
                <span class="material-icons" style="font-size: 16px;">content_copy</span>
              </button>
              <a href="${cellValue}" target="_blank" style="color: #64B5F6; text-decoration: none; flex: 1; transition: color 0.2s ease;" onmouseover="this.style.color='#90CAF9'" onmouseout="this.style.color='#64B5F6'">${cellValue.length > 50 ? cellValue.substring(0, 50) + '...' : cellValue}</a>
            </div>
          `;
        } else {
          td.textContent = 'N/A';
        }
      } else if (field === 'likesCount' || field === 'commentsCount' || field === 'videoPlayCount') {
        td.textContent = parseInt(cellValue).toLocaleString();
      } else {
        // Truncate long text for other fields
        if (cellValue.length > 100) {
          cellValue = cellValue.substring(0, 100) + '...';
        }
        td.textContent = cellValue;
      }

      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });
}

function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'block' : 'none';
}



function copyToClipboard(url, button) {
  console.log('Attempting to copy URL:', url);

  if (!url) {
    console.error('No URL to copy');
    return;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function () {
      console.log('Successfully copied to clipboard');
      // Show success feedback
      const originalText = button.innerHTML;
      button.innerHTML = '<span class="material-icons" style="font-size: 16px;">check</span>';
      button.style.color = '#4CAF50';

      setTimeout(function () {
        button.innerHTML = originalText;
        button.style.color = '#9ca3af';
      }, 1500);
    }).catch(function (err) {
      console.error('Clipboard API failed:', err);
      fallbackCopy(url, button);
    });
  } else {
    console.log('Clipboard API not available, using fallback');
    fallbackCopy(url, button);
  }
}

function fallbackCopy(url, button) {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = url;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (successful) {
      console.log('Fallback copy successful');
      // Show success feedback
      const originalText = button.innerHTML;
      button.innerHTML = '<span class="material-icons" style="font-size: 16px;">check</span>';
      button.style.color = '#4CAF50';

      setTimeout(function () {
        button.innerHTML = originalText;
        button.style.color = '#9ca3af';
      }, 1500);
    } else {
      console.error('Fallback copy failed');
      // Show error feedback
      const originalText = button.innerHTML;
      button.innerHTML = '<span class="material-icons" style="font-size: 16px;">error</span>';
      button.style.color = '#f44336';

      setTimeout(function () {
        button.innerHTML = originalText;
        button.style.color = '#9ca3af';
      }, 1500);
    }
  } catch (err) {
    console.error('Copy operation failed:', err);
  }
}

// Check authentication
function checkAuth() {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  if (!isLoggedIn) {
    window.location.href = '../login.html';
    return false;
  }

  // Display current user
  // const currentUser = localStorage.getItem('currentUser');
  // if (currentUser) {
  //   document.getElementById('currentUser').textContent = `欢迎, ${currentUser}`;
  // }

  return true;
}

// Go to dashboard function
function goToDashboard() {
  window.location.href = '../dashboard.html';
}

// Handle logout
function handleLogout() {
  localStorage.removeItem('isLoggedIn');
  // localStorage.removeItem('currentUser');
  localStorage.removeItem('rememberMe');
  window.location.href = '../login.html';
}

// Load configuration
let config = null;

async function loadConfig() {
  try {
    const response = await fetch('config.json');
    config = await response.json();
    console.log('Config loaded:', config);
  } catch (error) {
    console.error('Error loading config:', error);
    // Fallback config
    config = {
      userCategories: {
        felix: ["yong.lixx"],
        bigMagazine: [],
        smallMagazine: []
      },
      defaultCategory: "felix"
    };
  }
}

// Function to categorize user based on config
function categorizeUser(ownerUsername) {
  if (!config) return 'felix';

  for (const [category, users] of Object.entries(config.userCategories)) {
    if (users.includes(ownerUsername)) {
      return category;
    }
  }

  return config.defaultCategory || 'felix';
}

// Handle drag and drop and auto-load data
document.addEventListener('DOMContentLoaded', async function () {
  // Check authentication first
  if (!checkAuth()) {
    return;
  }

  // Add event listeners
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  const dashboardBtn = document.getElementById('dashboardBtn');
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', goToDashboard);
  }

  // Load config first
  await loadConfig();

  // Auto-load CSV data when page loads
  setTimeout(() => {
    loadCsvData();
  }, 1000);

  // Set up automatic refresh every 10 minutes (600,000 milliseconds)
  setInterval(() => {
    console.log('Auto-refreshing data...');
    loadCsvData();
  }, 600000);
});

// Make function available globally
window.switchInstagramTab = function (tabName) {
  // Remove active class from all tabs and panels
  document.querySelectorAll('.md3-secondary-tab').forEach(tab => {
    tab.classList.remove('active');
    tab.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.tab-content').forEach(panel => {
    panel.classList.remove('active');
  });

  // Add active class to selected tab and panel
  const selectedTab = document.getElementById(`${tabName}-tab`);
  const selectedPanel = document.getElementById(`${tabName}-panel`);

  if (selectedTab && selectedPanel) {
    selectedTab.classList.add('active');
    selectedTab.setAttribute('aria-selected', 'true');
    selectedPanel.classList.add('active');
  }

  // Load data when Felix, small-magazine, or big-magazine tab is selected
  if (tabName === 'felix' || tabName === 'small-magazine' || tabName === 'big-magazine') {
    loadCsvData();
  }
};