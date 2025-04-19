// content.js
// Add message listener at the top level
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'showRater') {
    const username = extractTwitterHandle();
    if (username) {
      injectRatingUI(username);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Could not extract Twitter handle' });
    }
    return true; // Return true to indicate asynchronous response
  }
  return false;
});

function extractTwitterHandle() {
  // Look for username in URL which is in format twitter.com/username or x.com/username
  const url = window.location.href;
  const urlPattern = /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)(?:\/|\?|$)/;
  const match = url.match(urlPattern);
  
  if (match && match[1]) {
    const username = match[1];
    // Don't extract usernames that are likely Twitter features rather than actual handles
    const excludedUsernames = ['home', 'explore', 'notifications', 'messages', 'settings'];
    
    if (!excludedUsernames.includes(username.toLowerCase())) {
      return username;
    }
  }
  
  return null;
}

// Add styles to prevent the UI from shaking/glitching
function addGlobalStyles() {
  const styleId = 'twitter-rater-global-styles';
  
  // Don't add styles if they're already there
  if (document.getElementById(styleId)) {
    return;
  }
  
  const styleElement = document.createElement('style');
  styleElement.id = styleId;
  styleElement.textContent = `
    #twitter-rater-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: white;
      border: 1px solid #ccc;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      width: 280px;
      max-width: 90vw;
      transform: translateZ(0); /* Prevent jittering */
      will-change: transform; /* Optimize for animations */
      transition: all 0.2s ease;
    }
    
    #twitter-rater-container h3 {
      margin-top: 0;
      margin-bottom: 12px;
      font-size: 16px;
      font-weight: 700;
      color: #0f1419;
    }
    
    #twitter-rater-container button {
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    #twitter-rater-container button:hover {
      filter: brightness(90%);
    }
    
    #twitter-rater-container button:active {
      transform: scale(0.98);
    }
    
    .twitter-rater-rating-bar {
      display: flex;
      height: 10px;
      width: 100%;
      background-color: #f2f2f2;
      border-radius: 5px;
      overflow: hidden;
      margin: 10px 0;
    }
    
    .twitter-rater-genuine-bar {
      height: 100%;
      background-color: #4CAF50;
    }
    
    .twitter-rater-farmer-bar {
      height: 100%;
      background-color: #f44336;
    }
    
    .twitter-rater-stats {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #536471;
      margin-bottom: 12px;
    }
    
    .twitter-rater-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 6px;
    }
    
    .twitter-rater-genuine-badge {
      background-color: rgba(76, 175, 80, 0.1);
      color: #4CAF50;
    }
    
    .twitter-rater-farmer-badge {
      background-color: rgba(244, 67, 54, 0.1);
      color: #f44336;
    }
    
    .twitter-rater-neutral-badge {
      background-color: rgba(83, 100, 113, 0.1);
      color: #536471;
    }
  `;
  
  document.head.appendChild(styleElement);
}

// Improved function to inject a floating UI with community ratings
function injectRatingUI(username) {
  // Add global styles once
  addGlobalStyles();
  
  // Don't inject if the UI is already there
  if (document.getElementById('twitter-rater-container')) {
    document.getElementById('twitter-rater-container').remove();
  }
  
  // Create the floating UI
  const container = document.createElement('div');
  container.id = 'twitter-rater-container';
  
  // Start with a loading state UI
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h3>Rate @${username}</h3>
      <button id="close-rater" style="background: none; border: none; cursor: pointer; color: #536471; font-size: 14px; font-weight: bold;">×</button>
    </div>
    <div id="twitter-rater-content">
      <p style="color: #536471; font-size: 14px;">Loading ratings...</p>
    </div>
  `;
  
  document.body.appendChild(container);
  
  // Add event listener for close button
  document.getElementById('close-rater').addEventListener('click', () => {
    container.remove();
  });
  
  // Fetch existing ratings from API
  chrome.runtime.sendMessage({
    action: 'getUserRating',
    username
  }, response => {
    // Handle communication error
    if (chrome.runtime.lastError) {
      showRatingInterface(username, { genuineCount: 0, farmerCount: 0 });
      return;
    }
    
    if (response && response.success) {
      showRatingInterface(username, response.data);
    } else {
      // If API failed, show UI with zero counts
      showRatingInterface(username, { genuineCount: 0, farmerCount: 0 });
    }
  });
}

function showRatingInterface(username, ratings) {
  const contentDiv = document.getElementById('twitter-rater-content');
  if (!contentDiv) return;
  
  const { genuineCount = 0, farmerCount = 0 } = ratings;
  const totalRatings = genuineCount + farmerCount;
  const genuinePercentage = totalRatings > 0 ? Math.round((genuineCount / totalRatings) * 100) : 0;
  const farmerPercentage = totalRatings > 0 ? 100 - genuinePercentage : 0;
  
  let ratingStatus = '';
  let badgeClass = '';
  
  if (totalRatings >= 5) {
    if (genuinePercentage >= 70) {
      ratingStatus = 'Likely Genuine';
      badgeClass = 'twitter-rater-genuine-badge';
    } else if (farmerPercentage >= 70) {
      ratingStatus = 'Likely Farmer';
      badgeClass = 'twitter-rater-farmer-badge';
    } else {
      ratingStatus = 'Mixed Ratings';
      badgeClass = 'twitter-rater-neutral-badge';
    }
  } else if (totalRatings > 0) {
    ratingStatus = 'Not Enough Ratings';
    badgeClass = 'twitter-rater-neutral-badge';
  } else {
    ratingStatus = 'No Ratings Yet';
    badgeClass = 'twitter-rater-neutral-badge';
  }
  
  // Check if this user has already been rated by the current user
  chrome.storage.local.get(['ratedUsers'], (result) => {
    const ratedUsers = result.ratedUsers || {};
    const userRating = ratedUsers[username];
    
    contentDiv.innerHTML = `
      <div class="twitter-rater-stats">
        <span>Community Rating:</span>
        <span class="twitter-rater-badge ${badgeClass}">${ratingStatus}</span>
      </div>
      
      <div class="twitter-rater-rating-bar">
        <div class="twitter-rater-genuine-bar" style="width: ${genuinePercentage}%;"></div>
        <div class="twitter-rater-farmer-bar" style="width: ${farmerPercentage}%;"></div>
      </div>
      
      <div class="twitter-rater-stats">
        <span>👍 Genuine: ${genuineCount}</span>
        <span>🚜 Farmer: ${farmerCount}</span>
      </div>
      
      ${userRating ? 
        `<p style="margin: 12px 0; font-size: 14px; color: #536471;">You rated this account as: <strong>${userRating}</strong></p>
         <button id="change-rating-btn" style="width: 100%; display:flex; justify-content: center; padding: 8px 2px; background-color: #1DA1F2; color: white; border: none; border-radius: 9px; font-weight: bold; margin-bottom: 8px;"> Change My Rating</button>` 
        : 
        `<div style="margin: 16px 0; display: flex; justify-content: space-between; align-items: center;">
           <button id="genuine-btn" style="width: 48%; background-color: #4CAF50; display: flex; justify-content: center; align-items: center; color: white; border: none; padding: 12px 16px; border-radius: 0; font-weight: bold; transition: transform 0.2s;">👍 Genuine</button>
           <button id="farmer-btn" style="width: 48%; background-color: #f44336; display: flex; justify-content: center; align-items: center; color: white; border: none; padding: 12px 16px; border-radius: 0; font-weight: bold; transition: transform 0.2s;">🚜 Farmer</button>
         </div>`
      }
      
      <div id="rating-status" style="margin-top: 12px; font-size: 13px; color: #536471; text-align: center;"></div>
    `;
    
    // Add event listeners to buttons
    if (userRating) {
      document.getElementById('change-rating-btn').addEventListener('click', () => {
        // Show rating buttons when user wants to change rating
        contentDiv.querySelector('p').remove();
        document.getElementById('change-rating-btn').remove();
        
        const ratingButtons = document.createElement('div');
        ratingButtons.style.cssText = 'margin: 16px 0;';
        ratingButtons.innerHTML = `
          <button id="genuine-btn" style="width: 48%; background-color: #4CAF50; color: white; border: none; padding: 8px 0; border-radius: 9999px; font-weight: bold;">👍 Genuine</button>
          <button id="farmer-btn" style="width: 48%; float: right; background-color: #f44336; color: white; border: none; padding: 8px 0; border-radius: 9999px; font-weight: bold;">🚜 Farmer</button>
        `;
        
        contentDiv.appendChild(ratingButtons);
        
        document.getElementById('genuine-btn').addEventListener('click', (e) => {
          e.preventDefault();
          rateUser(username, 'genuine');
        });
        
        document.getElementById('farmer-btn').addEventListener('click', (e) => {
          e.preventDefault();
          rateUser(username, 'farmer');
        });
      });
    } else {
      document.getElementById('genuine-btn').addEventListener('click', (e) => {
        e.preventDefault();
        rateUser(username, 'genuine');
      });
      
      document.getElementById('farmer-btn').addEventListener('click', (e) => {
        e.preventDefault();
        rateUser(username, 'farmer');
      });
    }
  });
}

function rateUser(username, rating) {
  const statusElement = document.getElementById('rating-status');
  statusElement.textContent = 'Submitting rating...';
  
  // Send rating to background script to handle API communication
  chrome.runtime.sendMessage({
    action: 'rateUser',
    username,
    rating
  }, response => {
    if (chrome.runtime.lastError) {
      statusElement.textContent = `Error: ${chrome.runtime.lastError.message}`;
      return;
    }
    
    if (response && (response.success || response.fallback)) {
      statusElement.textContent = `Successfully rated @${username} as ${rating}`;
      
      // Save the rating locally
      chrome.storage.local.get(['ratedUsers'], (result) => {
        const ratedUsers = result.ratedUsers || {};
        ratedUsers[username] = rating;
        chrome.storage.local.set({ ratedUsers });
        
        // After a short delay, refresh the rating UI
        setTimeout(() => {
          injectRatingUI(username);
        }, 1500);
      });
    } else {
      statusElement.textContent = `Error: ${response ? response.error : 'Could not submit rating'}`;
    }
  });
}

// Inject a small permanent badge next to usernames in the Twitter feed
function injectProfileBadge() {
  // Find all tweet author links and profile links
  const profileLinks = document.querySelectorAll('a[href^="/"]');
  
  profileLinks.forEach(link => {
    // Skip if already processed or not a profile link
    if (link.dataset.raterProcessed || !link.href) return;
    if (link.href.includes('/status/')) return;
    
    const href = link.href;
    const urlPattern = /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)(?:\/|\?|$)/;
    const match = href.match(urlPattern);
    
    if (match && match[1]) {
      const username = match[1];
      const excludedUsernames = ['home', 'explore', 'notifications', 'messages', 'settings'];
      
      if (!excludedUsernames.includes(username.toLowerCase())) {
        // Mark as processed
        link.dataset.raterProcessed = 'true';
        
        // Check if this user has ratings
        chrome.runtime.sendMessage({
          action: 'getUserRating',
          username
        }, response => {
          if (chrome.runtime.lastError || !response || !response.success) return;
          
          const ratings = response.data;
          if (!ratings || ratings.totalRatings < 5) return;
          
          // Only show badge for accounts with clear ratings
          const { genuineCount = 0, farmerCount = 0 } = ratings;
          const totalRatings = genuineCount + farmerCount;
          const genuinePercentage = totalRatings > 0 ? Math.round((genuineCount / totalRatings) * 100) : 0;
          
          if (genuinePercentage >= 70 || genuinePercentage <= 30) {
            const badgeClass = genuinePercentage >= 70 ? 'twitter-rater-genuine-badge' : 'twitter-rater-farmer-badge';
            const badgeText = genuinePercentage >= 70 ? '👍' : '🚜';
            
            const badge = document.createElement('span');
            badge.className = `twitter-rater-badge ${badgeClass}`;
            badge.style.cssText = 'margin-left: 4px; font-size: 10px; padding: 0 4px;';
            badge.textContent = badgeText;
            badge.title = genuinePercentage >= 70 ? 
              `Rated genuine by ${genuineCount} users` : 
              `Rated as engagement farmer by ${farmerCount} users`;
            
            // Append badge after the link
            if (link.parentNode) {
              link.parentNode.insertBefore(badge, link.nextSibling);
            }
          }
        });
      }
    }
  });
}

// Listen for page changes (for SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(checkForProfile, 1000); // Delay to let the page render
  }
  
  // Check for new profile links in the feed
  injectProfileBadge();
}).observe(document, { subtree: true, childList: true });

function checkForProfile() {
  const username = extractTwitterHandle();
  if (username) {
    // Check if we're on a profile page by looking for typical profile elements
    const isProfilePage = document.querySelector('a[href$="/followers"]') || 
                          document.querySelector('a[href$="/following"]');
    
    if (isProfilePage) {
      injectRatingUI(username);
    }
  }
}

// Initial check when content script loads
setTimeout(checkForProfile, 1500);

// Also check for profile badges when script loads
setTimeout(injectProfileBadge, 2000);

// Log that content script has loaded correctly
console.log("Twitter Handle Rater: Content script loaded");