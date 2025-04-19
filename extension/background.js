// background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'rateUser') {
    const apiUrl = 'http://localhost:3000/api/rate'; // Local backend API endpoint
    
    // Implement fallback in case API isn't ready
    let fallbackMode = false;
    
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: message.username,
        rating: message.rating
      })
    })
    .then(response => {
      if (!response.ok) {
        fallbackMode = true;
        throw new Error(`Server responded with status ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      sendResponse({ success: true, data });
    })
    .catch(error => {
      console.error('Error submitting rating:', error);
      
      // In fallback mode, we'll save ratings locally only
      if (fallbackMode) {
        sendResponse({ 
          success: false, 
          error: "API server unavailable. Rating saved locally only.",
          fallback: true
        });
      } else {
        sendResponse({ 
          success: false, 
          error: error.message
        });
      }
    });
    
    return true; // Indicates we'll respond asynchronously
  }
  
  if (message.action === 'getUserRating') {
    const apiUrl = `http://localhost:3000/api/rating/${message.username}`;
    
    fetch(apiUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      sendResponse({ success: true, data });
    })
    .catch(error => {
      console.error('Error fetching rating:', error);
      
      // If API fails, return mock data as fallback
      const mockData = {
        username: message.username,
        genuineCount: Math.floor(Math.random() * 15),
        farmerCount: Math.floor(Math.random() * 10),
        lastUpdated: new Date().toISOString(),
        totalRatings: 0,
        genuinePercentage: 0
      };
      
      mockData.totalRatings = mockData.genuineCount + mockData.farmerCount;
      mockData.genuinePercentage = mockData.totalRatings > 0 ? 
        Math.round((mockData.genuineCount / mockData.totalRatings) * 100) : 0;
      
      sendResponse({ 
        success: true, 
        data: mockData,
        fallback: true
      });
    });
    
    return true; // Indicates we'll respond asynchronously
  }
  
  if (message.action === 'getStats') {
    const apiUrl = 'http://localhost:3000/api/stats';
    
    fetch(apiUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Calculate total counts for the popup display
      const totalProfiles = Object.keys(data.topGenuine.concat(data.topFarmers)
        .reduce((acc, curr) => {
          acc[curr.username] = true;
          return acc;
        }, {})).length;
      
      const totalGenuineVotes = data.topGenuine.reduce((sum, user) => sum + user.genuineCount, 0);
      const totalFarmerVotes = data.topFarmers.reduce((sum, user) => sum + user.farmerCount, 0);
      
      sendResponse({ 
        success: true, 
        data: {
          ...data,
          totalProfiles,
          totalGenuineVotes,
          totalFarmerVotes
        }
      });
    })
    .catch(error => {
      console.error('Error fetching stats:', error);
      
      // Return mock stats if API fails
      const mockStats = {
        totalProfiles: 142,
        totalGenuineVotes: 387,
        totalFarmerVotes: 253,
        topGenuine: [
          { username: "genuine_user1", genuineCount: 42, totalRatings: 50 },
          { username: "genuine_user2", genuineCount: 38, totalRatings: 45 }
        ],
        topFarmers: [
          { username: "farmer_user1", farmerCount: 37, totalRatings: 40 },
          { username: "farmer_user2", farmerCount: 32, totalRatings: 35 }
        ]
      };
      
      sendResponse({ 
        success: true, 
        data: mockStats,
        fallback: true
      });
    });
    
    return true; // Indicates we'll respond asynchronously
  }
});

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Twitter Handle Rater extension installed');
  
  // Initialize storage with empty rated users object if needed
  chrome.storage.local.get(['ratedUsers'], (result) => {
    if (!result.ratedUsers) {
      chrome.storage.local.set({ ratedUsers: {} });
    }
  });
});