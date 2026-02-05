// ServiceNow Case Tracker - Background Script
// Handles alarm scheduling, tab communication, and server sync

const SERVER_URL = 'http://192.168.31.59:8085/api/upload-json';
const ALARM_NAME = 'servicenow-sync';
const SYNC_INTERVAL_MINUTES = 5;

// State
let lastSyncTime = null;
let lastSyncStatus = null;
let lastSyncCount = 0;
let isEnabled = true;

// Initialize on install/startup
browser.runtime.onInstalled.addListener(() => {
  console.log('ServiceNow Case Tracker installed');
  initializeAlarm();
  loadSettings();
});

// Also initialize on browser startup
browser.runtime.onStartup.addListener(() => {
  console.log('ServiceNow Case Tracker started');
  initializeAlarm();
  loadSettings();
});

// Initialize alarm
function initializeAlarm() {
  browser.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: SYNC_INTERVAL_MINUTES
  });
  console.log(`Alarm set for every ${SYNC_INTERVAL_MINUTES} minutes`);
}

// Load settings from storage
async function loadSettings() {
  try {
    const data = await browser.storage.local.get(['isEnabled', 'lastSyncTime', 'lastSyncStatus', 'lastSyncCount']);
    isEnabled = data.isEnabled !== false; // Default to true
    lastSyncTime = data.lastSyncTime || null;
    lastSyncStatus = data.lastSyncStatus || null;
    lastSyncCount = data.lastSyncCount || 0;
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    await browser.storage.local.set({
      isEnabled,
      lastSyncTime,
      lastSyncStatus,
      lastSyncCount
    });
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

// Handle alarm
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME && isEnabled) {
    console.log('Alarm triggered, starting sync...');
    triggerSync();
  }
});

// Find ServiceNow tabs and trigger scraping
async function triggerSync() {
  try {
    // Query for ServiceNow tabs
    const tabs = await browser.tabs.query({
      url: [
        '*://*.service-now.com/*',
        '*://*.servicenow.com/*'
      ]
    });

    if (tabs.length === 0) {
      console.log('No ServiceNow tabs found');
      lastSyncStatus = 'no_tabs';
      lastSyncTime = new Date().toISOString();
      await saveSettings();
      return;
    }

    console.log(`Found ${tabs.length} ServiceNow tab(s)`);

    // Try to scrape from each tab
    let allCases = [];
    let scrapedFromTab = false;

    for (const tab of tabs) {
      try {
        const response = await browser.tabs.sendMessage(tab.id, { action: 'scrape' });

        if (response && response.success && response.cases && response.cases.length > 0) {
          console.log(`Scraped ${response.cases.length} cases from tab ${tab.id}`);
          allCases = response.cases;
          scrapedFromTab = true;
          break; // Use first successful scrape
        }
      } catch (e) {
        console.log(`Tab ${tab.id} not ready or not a case list:`, e.message);
      }
    }

    if (!scrapedFromTab || allCases.length === 0) {
      console.log('No cases scraped from any tab');
      lastSyncStatus = 'no_cases';
      lastSyncTime = new Date().toISOString();
      await saveSettings();
      return;
    }

    // POST to server
    await postToServer(allCases);

  } catch (e) {
    console.error('Sync failed:', e);
    lastSyncStatus = 'error';
    lastSyncTime = new Date().toISOString();
    await saveSettings();
  }
}

// POST cases to server
async function postToServer(cases) {
  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        source: 'firefox-extension',
        cases: cases
      })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const result = await response.json();
    console.log('Server response:', result);

    lastSyncStatus = 'success';
    lastSyncTime = new Date().toISOString();
    lastSyncCount = cases.length;
    await saveSettings();

    // Notify popup if open
    browser.runtime.sendMessage({
      type: 'sync_complete',
      status: 'success',
      count: cases.length,
      time: lastSyncTime
    }).catch(() => {}); // Ignore if popup not open

  } catch (e) {
    console.error('Failed to POST to server:', e);
    lastSyncStatus = 'server_error';
    lastSyncTime = new Date().toISOString();
    await saveSettings();

    browser.runtime.sendMessage({
      type: 'sync_complete',
      status: 'error',
      error: e.message,
      time: lastSyncTime
    }).catch(() => {});
  }
}

// Handle messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getStatus') {
    sendResponse({
      isEnabled,
      lastSyncTime,
      lastSyncStatus,
      lastSyncCount
    });
    return true;
  }

  if (message.action === 'setEnabled') {
    isEnabled = message.value;
    saveSettings();
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'syncNow') {
    triggerSync();
    sendResponse({ success: true });
    return true;
  }

  return false;
});

// Log startup
console.log('ServiceNow Case Tracker background script loaded');
initializeAlarm();
loadSettings();
