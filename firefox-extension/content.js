// ServiceNow Case Tracker - Content Script
// Scrapes case data from ServiceNow Agent Workspace (Shadow DOM) and classic list views

// Column mapping from visible headers to internal field names
const COLUMN_MAPPING = {
  // Common variations
  'number': 'number',
  'case': 'number',
  'case number': 'number',

  'short description': 'short_description',
  'description': 'short_description',
  'subject': 'short_description',

  'time to respond': 'u_time_to_respond',
  'response time': 'u_time_to_respond',

  'sla time left': 'sla_time_left',
  'sla': 'sla_time_left',
  'time left': 'sla_time_left',

  'sub-state': 'sub_state',
  'sub state': 'sub_state',
  'substate': 'sub_state',
  'state': 'sub_state',

  'region': 'region',

  'priority': 'priority',

  'updated': 'sys_updated_on',
  'sys updated on': 'sys_updated_on',
  'last updated': 'sys_updated_on',
  'updated on': 'sys_updated_on'
};

// Detect which UI we're on
function detectUIType() {
  // Agent Workspace
  if (window.location.href.includes('/now/cwf/agent/') ||
      window.location.href.includes('/now/workspace/')) {
    return 'agent_workspace';
  }

  // Classic list view
  if (window.location.href.includes('_list.do')) {
    return 'classic_list';
  }

  // Check for common table structures
  if (document.querySelector('[data-type="list"]') ||
      document.querySelector('.sn-list') ||
      document.querySelector('.list_table')) {
    return 'generic';
  }

  return 'unknown';
}

/**
 * Recursively find all shadow roots starting from a root element
 * ServiceNow Agent Workspace uses deeply nested Shadow DOM (up to 10+ levels)
 */
function findAllShadowRoots(root, depth = 0, maxDepth = 15) {
  let results = [];

  if (depth > maxDepth) return results;

  const elements = root.querySelectorAll('*');
  elements.forEach(el => {
    if (el.shadowRoot) {
      results.push({ element: el, shadow: el.shadowRoot, depth: depth });
      results = results.concat(findAllShadowRoots(el.shadowRoot, depth + 1, maxDepth));
    }
  });

  return results;
}

/**
 * Clean text by removing tooltip instructions and extra whitespace
 */
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/Press and hold Shift.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Scrape Agent Workspace using Shadow DOM traversal
 * This is the main method for ServiceNow's modern Agent Workspace UI
 */
function scrapeAgentWorkspaceShadowDOM() {
  const cases = [];

  console.log('Starting Shadow DOM traversal for Agent Workspace...');

  // Find the main macroponent - this is ServiceNow's custom element container
  // Try multiple possible macroponent IDs
  const macroponentSelectors = [
    'macroponent-f51912f4c700201072b211d4d8c26010',
    '[id^="macroponent-"]',
    'sn-workspace-component',
    'now-workspace'
  ];

  let macroponent = null;
  for (const selector of macroponentSelectors) {
    macroponent = document.querySelector(selector);
    if (macroponent) {
      console.log(`Found macroponent with selector: ${selector}`);
      break;
    }
  }

  if (!macroponent) {
    console.log('No macroponent found, trying document-level shadow search');
    // Try searching from document body
    const allShadows = findAllShadowRoots(document.body);
    console.log(`Found ${allShadows.length} shadow roots from document body`);
    return extractFromShadowRoots(allShadows);
  }

  // Check if macroponent has shadow root
  let startRoot = macroponent.shadowRoot || macroponent;

  // Find all nested shadow roots
  const allShadows = findAllShadowRoots(startRoot);
  console.log(`Found ${allShadows.length} shadow roots total`);

  return extractFromShadowRoots(allShadows);
}

/**
 * Extract case data from shadow roots by finding now-grid tables
 */
function extractFromShadowRoots(allShadows) {
  const cases = [];

  // Find now-grid components (ServiceNow's table component)
  const grids = allShadows.filter(s =>
    s.element.tagName.toLowerCase() === 'now-grid' ||
    s.element.tagName.toLowerCase() === 'now-list' ||
    s.element.tagName.toLowerCase().includes('grid')
  );

  console.log(`Found ${grids.length} grid components`);

  // Find the main case list grid - prioritize by specificity and row count
  let mainTable = null;
  let mainHeaders = [];
  let bestScore = -1;

  for (const grid of grids) {
    const table = grid.shadow.querySelector('table');
    if (!table) continue;

    const headerCells = table.querySelectorAll('th');
    const headers = Array.from(headerCells).map(th => cleanText(th.textContent));
    const rows = table.querySelectorAll('tbody tr');
    const rowCount = rows.length;

    console.log(`Grid: ${rowCount} rows, headers: [${headers.slice(0, 5).join(', ')}...]`);

    // Score the grid based on how likely it is the main case list
    let score = 0;

    // Strong indicators (unique to main case list)
    if (headers.some(h => h.toLowerCase().includes('sla'))) score += 100;
    if (headers.some(h => h.toLowerCase().includes('time to respond'))) score += 100;
    if (headers.some(h => h.toLowerCase().includes('sub state') || h.toLowerCase().includes('sub-state'))) score += 50;
    if (headers.some(h => h.toLowerCase().includes('region'))) score += 50;

    // Weaker indicators (common across multiple grids)
    if (headers.some(h => h.toLowerCase() === 'number')) score += 10;
    if (headers.some(h => h.toLowerCase() === 'priority')) score += 5;

    // More rows = more likely to be the main list
    score += rowCount;

    // Must have at least Number column
    const hasNumber = headers.some(h => h.toLowerCase() === 'number');
    if (!hasNumber) continue;

    console.log(`  Score: ${score}`);

    if (score > bestScore) {
      bestScore = score;
      mainTable = table;
      mainHeaders = headers;
    }
  }

  if (mainTable) {
    const rows = mainTable.querySelectorAll('tbody tr');
    console.log(`Selected grid with ${rows.length} rows, score: ${bestScore}`);
    console.log('Headers:', mainHeaders);
  }

  // If no grid found, try finding any table with case data
  if (!mainTable) {
    for (const shadow of allShadows) {
      const tables = shadow.shadow.querySelectorAll('table');
      for (const table of tables) {
        const rows = table.querySelectorAll('tbody tr');
        if (rows.length > 5) {
          const headerCells = table.querySelectorAll('th');
          const headers = Array.from(headerCells).map(th => cleanText(th.textContent));

          const hasCaseData = headers.some(h =>
            h.toLowerCase().includes('number') ||
            h.toLowerCase().includes('case')
          );

          if (hasCaseData) {
            mainTable = table;
            mainHeaders = headers;
            console.log('Found fallback table with headers:', headers);
            break;
          }
        }
      }
      if (mainTable) break;
    }
  }

  if (!mainTable) {
    console.log('No suitable table found in shadow DOM');
    return cases;
  }

  // Map headers to field names
  const columnMap = {};
  mainHeaders.forEach((header, index) => {
    const normalized = header.toLowerCase().trim();

    // Direct mapping
    if (COLUMN_MAPPING[normalized]) {
      columnMap[index] = COLUMN_MAPPING[normalized];
    } else {
      // Partial matching for variations
      for (const [key, value] of Object.entries(COLUMN_MAPPING)) {
        if (normalized.includes(key) || key.includes(normalized)) {
          columnMap[index] = value;
          break;
        }
      }
    }
  });

  console.log('Column mapping:', columnMap);

  // Extract data from rows
  const rows = mainTable.querySelectorAll('tbody tr');
  console.log(`Processing ${rows.length} rows`);

  // Detect header offset - ServiceNow often has empty/hidden columns (Record Preview, Row Selection)
  // that exist in both headers and cells but don't contain data
  let headerOffset = 0;
  if (rows.length > 0) {
    const firstRowCells = rows[0].querySelectorAll('td');
    const headerCount = mainHeaders.length;
    const cellCount = firstRowCells.length;

    // Find where "Number" header is
    const numberHeaderIdx = mainHeaders.findIndex(h => h.toLowerCase() === 'number');

    if (numberHeaderIdx >= 0) {
      // Find which cell actually contains the case number (7-8 digit number)
      for (let i = 0; i < Math.min(cellCount, 5); i++) {
        const cellText = cleanText(firstRowCells[i].textContent);
        // Case numbers are typically 7-8 digits at the start of the cell
        if (/^\d{7,8}/.test(cellText)) {
          headerOffset = numberHeaderIdx - i;
          console.log(`Header offset detected: ${headerOffset} (Number header at ${numberHeaderIdx}, case number found in cell ${i})`);
          break;
        }
      }
    }
    console.log(`Headers: ${headerCount}, Cells: ${cellCount}, Offset: ${headerOffset}`);
  }

  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('td');
    if (cells.length === 0) return;

    const caseData = {};

    cells.forEach((cell, cellIndex) => {
      // Apply offset to align cells with headers
      const headerIndex = cellIndex + headerOffset;
      const fieldName = columnMap[headerIndex];
      if (fieldName) {
        // Get text, handling links and nested elements
        let value = '';
        const link = cell.querySelector('a');
        if (link) {
          value = cleanText(link.textContent);
        } else {
          value = cleanText(cell.textContent);
        }
        caseData[fieldName] = value;
      }
    });

    // Only add if we have a case number
    if (caseData.number) {
      cases.push(caseData);
    }
  });

  console.log(`Extracted ${cases.length} cases from Shadow DOM`);
  return cases;
}

/**
 * Fallback scraper for regular DOM (classic list view)
 */
function scrapeClassicList() {
  const cases = [];

  const table = document.querySelector('.list_table, .list2_table, table.list');
  if (!table) {
    console.log('No classic list table found');
    return cases;
  }

  // Get headers
  const headers = [];
  const headerRow = table.querySelector('thead tr, tr.list_header_row');
  if (headerRow) {
    headerRow.querySelectorAll('th').forEach(th => {
      headers.push(cleanText(th.textContent).toLowerCase());
    });
  }

  // Map headers
  const columnMap = {};
  headers.forEach((header, index) => {
    const normalized = header.toLowerCase().trim();
    if (COLUMN_MAPPING[normalized]) {
      columnMap[index] = COLUMN_MAPPING[normalized];
    }
  });

  // Get rows
  const rows = table.querySelectorAll('tbody tr, tr.list_row, tr.list_odd, tr.list_even');
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    const caseData = {};

    cells.forEach((cell, index) => {
      const fieldName = columnMap[index];
      if (fieldName) {
        const link = cell.querySelector('a');
        caseData[fieldName] = link ? cleanText(link.textContent) : cleanText(cell.textContent);
      }
    });

    if (caseData.number) {
      cases.push(caseData);
    }
  });

  return cases;
}

/**
 * Try regular DOM scraping (for non-Shadow DOM pages)
 */
function scrapeRegularDOM() {
  const cases = [];

  // Try multiple selectors for regular tables
  const selectors = [
    'table tbody tr',
    '[role="grid"] [role="row"]',
    '.sn-list-table tbody tr',
    '[data-type="list"] tr',
    '.list-content tr'
  ];

  let rows = [];
  let headerRow = null;

  for (const selector of selectors) {
    const found = document.querySelectorAll(selector);
    if (found.length > 0) {
      rows = Array.from(found);
      console.log(`Found ${rows.length} rows with selector: ${selector}`);
      break;
    }
  }

  if (rows.length === 0) {
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      const trs = table.querySelectorAll('tbody tr');
      if (trs.length > 5) {
        rows = Array.from(trs);
        headerRow = table.querySelector('thead tr');
        console.log(`Found table with ${rows.length} rows`);
        break;
      }
    }
  }

  if (rows.length === 0) {
    return cases;
  }

  // Get headers
  const headers = [];
  if (!headerRow) {
    headerRow = document.querySelector('table thead tr') ||
                document.querySelector('[role="columnheader"]')?.parentElement;
  }

  if (headerRow) {
    const headerCells = headerRow.querySelectorAll('th, [role="columnheader"]');
    headerCells.forEach(cell => {
      headers.push(cleanText(cell.textContent).toLowerCase());
    });
  }

  // Map headers
  const columnMap = {};
  headers.forEach((header, index) => {
    if (COLUMN_MAPPING[header]) {
      columnMap[index] = COLUMN_MAPPING[header];
    }
  });

  // Extract data
  rows.forEach(row => {
    if (row.querySelector('th')) return;
    const cells = row.querySelectorAll('td, [role="gridcell"]');
    if (cells.length === 0) return;

    const caseData = {};
    cells.forEach((cell, cellIndex) => {
      const fieldName = columnMap[cellIndex];
      if (fieldName) {
        const link = cell.querySelector('a');
        caseData[fieldName] = link ? cleanText(link.textContent) : cleanText(cell.textContent);
      }
    });

    if (caseData.number) {
      cases.push(caseData);
    }
  });

  return cases;
}

/**
 * Main scrape function - tries Shadow DOM first, then falls back to regular DOM
 */
function scrapeCases() {
  const uiType = detectUIType();
  console.log(`Detected UI type: ${uiType}`);
  console.log(`URL: ${window.location.href}`);

  let cases = [];

  // For Agent Workspace, use Shadow DOM traversal
  if (uiType === 'agent_workspace') {
    console.log('Using Shadow DOM scraping for Agent Workspace');
    cases = scrapeAgentWorkspaceShadowDOM();

    // Fallback to regular DOM if Shadow DOM scraping fails
    if (cases.length === 0) {
      console.log('Shadow DOM scraping returned 0 cases, trying regular DOM');
      cases = scrapeRegularDOM();
    }
  } else if (uiType === 'classic_list') {
    console.log('Using classic list scraping');
    cases = scrapeClassicList();
  } else {
    // Try all methods
    console.log('Unknown UI type, trying all scraping methods');
    cases = scrapeAgentWorkspaceShadowDOM();

    if (cases.length === 0) {
      cases = scrapeRegularDOM();
    }

    if (cases.length === 0) {
      cases = scrapeClassicList();
    }
  }

  console.log(`Total scraped: ${cases.length} cases`);

  if (cases.length > 0) {
    console.log('Sample case:', cases[0]);
  }

  return cases;
}

// Listen for messages from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrape') {
    console.log('Received scrape request from background script');

    try {
      const cases = scrapeCases();

      sendResponse({
        success: true,
        cases: cases,
        count: cases.length,
        url: window.location.href,
        uiType: detectUIType()
      });
    } catch (e) {
      console.error('Scrape failed:', e);
      sendResponse({
        success: false,
        error: e.message
      });
    }

    return true; // Keep channel open for async response
  }

  return false;
});

// Log that content script is loaded
console.log('ServiceNow Case Tracker content script loaded on:', window.location.href);
console.log('UI Type detected:', detectUIType());
