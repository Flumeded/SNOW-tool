// ServiceNow Case Tracker - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const lastSyncEl = document.getElementById('lastSync');
  const caseCountEl = document.getElementById('caseCount');
  const enableToggle = document.getElementById('enableToggle');
  const syncNowBtn = document.getElementById('syncNowBtn');

  // Load current status from background
  async function loadStatus() {
    try {
      const response = await browser.runtime.sendMessage({ action: 'getStatus' });

      // Update toggle
      enableToggle.checked = response.isEnabled;

      // Update status indicator
      updateStatusIndicator(response.lastSyncStatus);

      // Update last sync time
      if (response.lastSyncTime) {
        const date = new Date(response.lastSyncTime);
        lastSyncEl.textContent = formatTime(date);
      } else {
        lastSyncEl.textContent = 'Never';
      }

      // Update case count
      caseCountEl.textContent = response.lastSyncCount || 0;

    } catch (e) {
      console.error('Failed to get status:', e);
      statusText.textContent = 'Error loading status';
    }
  }

  // Format time as relative or absolute
  function formatTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Update status indicator appearance
  function updateStatusIndicator(status) {
    statusIndicator.className = 'status-indicator';

    switch (status) {
      case 'success':
        statusIndicator.classList.add('success');
        statusText.textContent = 'Synced successfully';
        break;
      case 'error':
      case 'server_error':
        statusIndicator.classList.add('error');
        statusText.textContent = 'Sync failed - server error';
        break;
      case 'no_tabs':
        statusIndicator.classList.add('warning');
        statusText.textContent = 'No ServiceNow tabs open';
        break;
      case 'no_cases':
        statusIndicator.classList.add('warning');
        statusText.textContent = 'No cases found on page';
        break;
      default:
        statusIndicator.classList.add('idle');
        statusText.textContent = 'Ready to sync';
    }
  }

  // Handle enable/disable toggle
  enableToggle.addEventListener('change', async () => {
    await browser.runtime.sendMessage({
      action: 'setEnabled',
      value: enableToggle.checked
    });
  });

  // Handle sync now button
  syncNowBtn.addEventListener('click', async () => {
    syncNowBtn.disabled = true;
    syncNowBtn.textContent = 'Syncing...';

    await browser.runtime.sendMessage({ action: 'syncNow' });

    // Wait a bit then reload status
    setTimeout(async () => {
      await loadStatus();
      syncNowBtn.disabled = false;
      syncNowBtn.textContent = 'Sync Now';
    }, 2000);
  });

  // Listen for sync completion from background
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'sync_complete') {
      loadStatus();
    }
  });

  // Initial load
  await loadStatus();
});
