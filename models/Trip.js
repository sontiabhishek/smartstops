const mongoose = require('mongoose');

const TripSchema = new mongoose.Schema({
  startLocation: {
    type: String,
    required: true
  },
  endLocation: {
    type: String,
    required: true
  },
  totalDurationMinutes: {
    type: Number,
    required: true
  },
  departureTime: {
    type: String,
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  },
  routeCoordinates: {
    type: [[Number]], 
    required: true
  }
});

module.exports = mongoose.model('Trip', TripSchema);
