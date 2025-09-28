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

  // Find the latest date from the data
  let latestDate = null;
  data.forEach(item => {
    if (item.latestDate) {
      const itemDate = new Date(item.latestDate);
      if (!isNaN(itemDate.getTime()) && (!latestDate || itemDate > latestDate)) {
        latestDate = itemDate;
      }
    }
  });

  // Update table title with latest date
  if (latestDate) {
    const formattedDate = latestDate.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    // Update both section titles with the formatted date
    const yongLixxTitle = document.getElementById('yongLixxDataTableTitle');
    const otherUsersTitle = document.getElementById('otherUsersDataTableTitle');
    const titleText = `数据抓取时间: ${formattedDate}`;
    
    if (yongLixxTitle) yongLixxTitle.textContent = titleText;
    if (otherUsersTitle) otherUsersTitle.textContent = titleText;
  } else {
    // Set default title if no date available
    const yongLixxTitle = document.getElementById('yongLixxDataTableTitle');
    const otherUsersTitle = document.getElementById('otherUsersDataTableTitle');
    
    if (yongLixxTitle) yongLixxTitle.textContent = 'Data Table';
    if (otherUsersTitle) otherUsersTitle.textContent = 'Data Table';
  }

  // Define the specific fields to display and their corresponding display names
  const targetFields = [
    'No.',
    'ownerUsername',
    'image',
    'url',
    'likesCount',
    'commentsCount',
    'videoPlayCount'
  ];

  // Define display names for each field
  const fieldDisplayNames = {
    'No.': 'No.',
    'ownerUsername': '@account',
    'image': 'Image',
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

  // Separate data into two groups
  const yongLixxData = allData.filter(item => item.ownerUsername === 'yong.lixx');
  const otherUsersData = allData.filter(item => item.ownerUsername !== 'yong.lixx');

  // Re-number the items in each group
  yongLixxData.forEach((item, index) => {
    item['No.'] = index + 1;
  });
  otherUsersData.forEach((item, index) => {
    item['No.'] = index + 1;
  });

  // Get separate table elements
  const yongLixxTableContainer = document.getElementById('yongLixxTableContainer');
  const yongLixxTableHeader = document.getElementById('yongLixxTableHeader');
  const yongLixxTableBody = document.getElementById('yongLixxTableBody');

  const otherUsersTableContainer = document.getElementById('otherUsersTableContainer');
  const otherUsersTableHeader = document.getElementById('otherUsersTableHeader');
  const otherUsersTableBody = document.getElementById('otherUsersTableBody');

  // Clear existing table content
  yongLixxTableHeader.innerHTML = '';
  yongLixxTableBody.innerHTML = '';
  otherUsersTableHeader.innerHTML = '';
  otherUsersTableBody.innerHTML = '';

  // Create yong.lixx table if data exists
  if (yongLixxData.length > 0) {
    createTableSection(yongLixxData, yongLixxTableHeader, yongLixxTableBody, targetFields, fieldDisplayNames);
    yongLixxTableContainer.style.display = 'block';
  } else {
    yongLixxTableContainer.style.display = 'none';
  }

  // Create other users table if data exists
  if (otherUsersData.length > 0) {
    createTableSection(otherUsersData, otherUsersTableHeader, otherUsersTableBody, targetFields, fieldDisplayNames);
    otherUsersTableContainer.style.display = 'block';
  } else {
    otherUsersTableContainer.style.display = 'none';
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

  // Create data rows
  tableData.forEach((row, index) => {
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
      if (field === 'image') {
        if (cellValue) {
          td.innerHTML = `
            <div style="width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid #404040; cursor: pointer; transition: all 0.2s ease;" onclick="window.open('${cellValue}', '_blank')" title="Click to view full image" onmouseover="this.style.borderColor='#64B5F6'" onmouseout="this.style.borderColor='#404040'">
              <img src="${cellValue}" alt="Instagram image" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<div style=\\'width: 100%; height: 100%; background: #2a2a2a; display: flex; align-items: center; justify-content: center;\\'><span class=\\'material-icons\\' style=\\'color: #666; font-size: 24px;\\'>broken_image</span></div>'">
            </div>`;
        } else {
          td.innerHTML = `
            <div style="width: 80px; height: 80px; border-radius: 8px; background: #2a2a2a; display: flex; align-items: center; justify-content: center; border: 1px solid #404040;">
              <span class="material-icons" style="color: #666; font-size: 24px;">image</span>
            </div>`;
        }
      } else if (field === 'url') {
        if (cellValue) {
          td.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
              <a href="${cellValue}" target="_blank" style="color: #64B5F6; text-decoration: none; flex: 1; transition: color 0.2s ease;" onmouseover="this.style.color='#90CAF9'" onmouseout="this.style.color='#64B5F6'">${cellValue.length > 50 ? cellValue.substring(0, 50) + '...' : cellValue}</a>
              <button onclick="copyToClipboard(\`${cellValue}\`, this)" style="background: none; border: none; cursor: pointer; padding: 4px; border-radius: 3px; color: #9ca3af; font-size: 14px; transition: all 0.2s ease;" title="Copy URL" onmouseover="this.style.color='#e1e3e1'; this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.color='#9ca3af'; this.style.background='none'">
                <span class="material-icons" style="font-size: 16px;">content_copy</span>
              </button>
            </div>
          `;
        } else {
          td.textContent = '';
        }
      } else if (field === 'No.') {
        td.style.textAlign = 'center';
        td.style.fontWeight = 'bold';
        td.textContent = cellValue;
      } else if (field === 'likesCount' || field === 'commentsCount' || field === 'videoPlayCount') {
        // Format numbers with commas (xxx,xxx,xxx)
        if (cellValue && !isNaN(cellValue)) {
          td.textContent = parseInt(cellValue).toLocaleString();
        } else {
          td.textContent = cellValue || '';
        }
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
  const currentUser = localStorage.getItem('currentUser');
  if (currentUser) {
    document.getElementById('currentUser').textContent = `欢迎, ${currentUser}`;
  }

  return true;
}

// Go to dashboard function
function goToDashboard() {
  window.location.href = '../dashboard.html';
}

// Handle logout
function handleLogout() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('rememberMe');
  window.location.href = '../login.html';
}

// Handle drag and drop and auto-load data
document.addEventListener('DOMContentLoaded', function () {
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

  // Auto-load CSV data when page loads
  setTimeout(() => {
    loadCsvData();
  }, 1000);
});