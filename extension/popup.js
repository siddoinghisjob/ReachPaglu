// popup.js
document.addEventListener('DOMContentLoaded', function() {
  // Handle "Rate Current Profile" button
  document.getElementById('rate-current').addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const currentTab = tabs[0];
      
      // Check if we're on Twitter
      if (currentTab.url.includes('twitter.com') || currentTab.url.includes('x.com')) {
        try {
          chrome.tabs.sendMessage(
            currentTab.id, 
            { action: 'showRater' },
            // Add response callback
            (response) => {
              if (chrome.runtime.lastError) {
                console.error("Error: ", chrome.runtime.lastError.message);
                showStatus("Please navigate to a Twitter profile page and try again");
              } else if (response && response.success) {
                window.close(); // Close the popup since the rating UI will show on the page
              } else {
                showStatus("Could not detect a Twitter profile. Please navigate to a profile page");
              }
            }
          );
        } catch (err) {
          console.error("Error sending message:", err);
          showStatus("Error communicating with the page. Please refresh and try again");
        }
      } else {
        showStatus("Please navigate to Twitter first");
      }
    });
  });
  
  // Load community stats
  loadCommunityStats();
  
  // Load and display recently rated profiles
  loadRecentRatings();
});

function showStatus(message) {
  const statusElements = document.querySelectorAll('.status');
  const lastStatus = statusElements[statusElements.length - 1];
  
  if (lastStatus) {
    lastStatus.textContent = message;
  }
}

function loadCommunityStats() {
  // Fetch community statistics from the API
  chrome.runtime.sendMessage({
    action: 'getStats'
  }, response => {
    if (chrome.runtime.lastError || !response || !response.success) {
      console.error("Error loading stats:", chrome.runtime.lastError || "Unknown error");
      return;
    }
    
    const stats = response.data || {};
    
    // Update stats in the UI
    document.getElementById('profiles-rated').textContent = stats.totalProfiles || '0';
    document.getElementById('genuine-count').textContent = stats.totalGenuineVotes || '0';
    document.getElementById('farmer-count').textContent = stats.totalFarmerVotes || '0';
  });
}

function loadRecentRatings() {
  chrome.storage.local.get(['ratedUsers'], function(result) {
    const ratedUsers = result.ratedUsers || {};
    const recentRatingsElement = document.getElementById('recent-ratings');
    
    if (Object.keys(ratedUsers).length === 0) {
      recentRatingsElement.innerHTML = '<div class="status">No recently rated profiles</div>';
      return;
    }
    
    recentRatingsElement.innerHTML = '';
    
    // Get the most recent 5 rated users
    const users = Object.keys(ratedUsers).slice(-5).reverse();
    
    users.forEach(username => {
      const rating = ratedUsers[username];
      const userDiv = document.createElement('div');
      userDiv.className = 'user-item';
      
      const ratingClass = rating === 'genuine' ? 'genuine' : 'farmer';
      const badge = rating === 'genuine' ? '👍' : '🚜';
      
      userDiv.innerHTML = `
        <span class="username">@${username}</span>
        <span class="badge ${rating === 'genuine' ? 'genuine-badge' : 'farmer-badge'}">${badge} ${rating === 'genuine' ? 'Genuine' : 'Farmer'}</span>
      `;
      
      userDiv.addEventListener('click', () => {
        chrome.tabs.create({ url: `https://twitter.com/${username}` });
      });
      
      recentRatingsElement.appendChild(userDiv);
    });
  });
}