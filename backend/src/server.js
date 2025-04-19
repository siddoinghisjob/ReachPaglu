// server.js - Node.js Express API implementation
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Data storage path
const DATA_FILE = path.join(__dirname, 'ratings.json');

// Initialize or load ratings data
let ratingsData = {};

// Load existing data if available
try {
  if (fs.existsSync(DATA_FILE)) {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    ratingsData = JSON.parse(data);
    
    // Convert stored date strings back to Date objects
    Object.values(ratingsData).forEach(rating => {
      rating.lastUpdated = new Date(rating.lastUpdated);
    });
    
    console.log('Loaded ratings data from file');
  } else {
    // Create empty data file if it doesn't exist
    fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf8');
    console.log('Created new ratings data file');
  }
} catch (error) {
  console.error('Error loading ratings data:', error);
}

// Helper function to save data
function saveRatingsData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(ratingsData, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving ratings data:', error);
  }
}

// Submit a new rating
app.post('/api/rate', (req, res) => {
  const { username, rating } = req.body;
  
  if (!username || !rating) {
    return res.status(400).json({ error: 'Username and rating are required' });
  }
  
  if (rating !== 'genuine' && rating !== 'farmer') {
    return res.status(400).json({ error: 'Rating must be "genuine" or "farmer"' });
  }
  
  if (!ratingsData[username]) {
    ratingsData[username] = { genuineCount: 0, farmerCount: 0, lastUpdated: new Date() };
  }
  
  if (rating === 'genuine') {
    ratingsData[username].genuineCount += 1;
  } else {
    ratingsData[username].farmerCount += 1;
  }
  
  ratingsData[username].lastUpdated = new Date();
  
  // Save updated data
  saveRatingsData();
  
  res.json({ 
    success: true, 
    username,
    genuineCount: ratingsData[username].genuineCount,
    farmerCount: ratingsData[username].farmerCount
  });
});

// Get rating for a username
app.get('/api/rating/:username', (req, res) => {
  const { username } = req.params;
  const rating = ratingsData[username] || { genuineCount: 0, farmerCount: 0, lastUpdated: new Date() };
  
  const totalRatings = rating.genuineCount + rating.farmerCount;
  const genuinePercentage = totalRatings > 0 ? 
    Math.round((rating.genuineCount / totalRatings) * 100) : 0;
  
  res.json({
    username,
    genuineCount: rating.genuineCount,
    farmerCount: rating.farmerCount,
    totalRatings,
    genuinePercentage,
    lastUpdated: rating.lastUpdated
  });
});

// Get top genuine and farmer accounts
app.get('/api/stats', (req, res) => {
  const accounts = Object.entries(ratingsData).map(([username, data]) => ({
    username,
    ...data,
    totalRatings: data.genuineCount + data.farmerCount
  }));
  
  const topGenuine = accounts
    .sort((a, b) => b.genuineCount - a.genuineCount)
    .slice(0, 10)
    .map(({ username, genuineCount, totalRatings }) => ({
      username,
      genuineCount,
      totalRatings
    }));
    
  const topFarmers = accounts
    .sort((a, b) => b.farmerCount - a.farmerCount)
    .slice(0, 10)
    .map(({ username, farmerCount, totalRatings }) => ({
      username,
      farmerCount,
      totalRatings
    }));
  
  // Calculate total stats
  const totalProfiles = Object.keys(ratingsData).length;
  const totalGenuineVotes = Object.values(ratingsData).reduce((sum, data) => sum + data.genuineCount, 0);
  const totalFarmerVotes = Object.values(ratingsData).reduce((sum, data) => sum + data.farmerCount, 0);
  
  res.json({ 
    topGenuine, 
    topFarmers,
    totalProfiles,
    totalGenuineVotes,
    totalFarmerVotes
  });
});

// Add a backup endpoint to download all data
app.get('/api/backup', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=ratings-backup.json');
  res.json(ratingsData);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown to ensure data is saved
['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
  process.on(signal, () => {
    console.log(`Received ${signal}, saving data and shutting down...`);
    saveRatingsData();
    process.exit(0);
  });
});