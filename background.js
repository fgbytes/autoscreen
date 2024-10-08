let screenshotCount = {};

// Listen for tab updates and take screenshots if enabled
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        chrome.storage.local.get(['screenshotsEnabled', 'waitTime'], (result) => {
            if (result.screenshotsEnabled) {
                const url = tab.url;
                const waitTime = result.waitTime !== undefined ? result.waitTime : 300; // Default to 300 ms

                if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                    setTimeout(() => {
                        console.log('Taking screenshot for URL:', url);
                        takeScreenshot(tab.windowId, url);
                    }, waitTime);
                } else {
                    console.warn('Skipping screenshot for undefined or restricted URL:', url);
                }
            }
        });
    }
});

// Function to take a screenshot
function takeScreenshot(windowId, url) {
  const domain = new URL(url).hostname;
  console.log('Taking screenshot for domain:', domain);

  chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
    if (chrome.runtime.lastError || !dataUrl) {
      console.error('Failed to capture screenshot:', chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Unknown error');
      return;
    }

    if (!screenshotCount[domain]) {
      screenshotCount[domain] = 1;
    } else {
      screenshotCount[domain]++;
    }

    const screenshotNumber = screenshotCount[domain];
    const fileName = `${screenshotNumber}--${url.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.png`;
    console.log('Generated file name for screenshot:', fileName);

    chrome.downloads.download({
      url: dataUrl,
      filename: `${domain}/${fileName}`,
      conflictAction: 'uniquify'
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to download screenshot:', chrome.runtime.lastError.message);
      } else {
        console.log('Screenshot saved with download ID:', downloadId);
      }
    });
  });
}

// Function to update the extension icon
function updateIcon(isEnabled) {
  const iconPath = isEnabled ? './icons/32-on.png' : './icons/32-off.png';
  console.log('Updating icon to:', iconPath);
  try {
    chrome.action.setIcon({ path: iconPath }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error setting icon:', chrome.runtime.lastError.message);
      } else {
        console.log('Icon successfully updated to:', iconPath);
      }
    });
  } catch (error) {
    console.error('Exception caught while updating icon:', error.message);
  }
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  if (message.screenshotsEnabled !== undefined) {
    console.log('Screenshot functionality has been', message.screenshotsEnabled ? 'enabled' : 'disabled');
    updateIcon(message.screenshotsEnabled);
    sendResponse({ status: "success" });
  } else if (message.action === "takeScreenshot") {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        console.error('Failed to capture screenshot:', chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Unknown error');
        sendResponse({ status: "error", message: "Failed to capture screenshot" });
      } else {
        const url = message.url;
        const domain = new URL(url).hostname;
        console.log('Taking manual screenshot for URL:', url);
        saveScreenshot(dataUrl, domain, url);
        sendResponse({ status: "success" });
      }
    });
    return true; // Indicates that the response is sent asynchronously
  }
});

function saveScreenshot(dataUrl, domain, url) {
  if (!screenshotCount[domain]) {
    screenshotCount[domain] = 1;
  } else {
    screenshotCount[domain]++;
  }

  const screenshotNumber = screenshotCount[domain];
  const fileName = `${screenshotNumber}--${url.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.png`;
  console.log('Generated file name for saved screenshot:', fileName);

  chrome.downloads.download({
    url: dataUrl,
    filename: `${domain}/${fileName}`,
    conflictAction: 'uniquify'
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('Failed to download screenshot:', chrome.runtime.lastError.message);
    } else {
      console.log('Screenshot saved with download ID:', downloadId);
    }
  });
}

// Initialize the icon state when the extension starts
chrome.storage.local.get(['screenshotsEnabled'], (result) => {
  const isEnabled = result.screenshotsEnabled !== undefined ? result.screenshotsEnabled : false;
  console.log('Initializing icon state. Screenshots enabled:', isEnabled);
  updateIcon(isEnabled);
});

chrome.commands.onCommand.addListener((command) => {
    if (command === "take_manual_screenshot") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab) {
                // Capture the visible tab directly
                chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
                    if (chrome.runtime.lastError || !dataUrl) {
                        console.error('Failed to capture screenshot:', chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Unknown error');
                    } else {
                        const url = activeTab.url;
                        const domain = new URL(url).hostname;
                        console.log('Taking manual screenshot for URL:', url);
                        saveScreenshot(dataUrl, domain, url); // Save the screenshot directly
                    }
                });
            } else {
                console.error('No active tab found.');
            }
        });
    }
});