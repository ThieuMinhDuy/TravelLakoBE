import asyncHandler from 'express-async-handler';
import Trip from '../../models/tripModel.js';
import City from '../../models/cityModel.js';

// @desc    Create a new trip
// @route   POST /api/trips
// @access  Private
const createTrip = asyncHandler(async (req, res) => {
  const { title, city, startDate, endDate, budget } = req.body;

  if (!title || !city || !startDate || !endDate) {
    res.status(400);
    throw new Error('Please provide all required fields: title, city, startDate, endDate');
  }

  // Check if city exists
  const cityExists = await City.findById(city);
  if (!cityExists) {
    res.status(404);
    throw new Error('City not found');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const error = new Error('Invalid start or end date');
    res.status(400);
    throw error;
  }

  if (start > end) {
    const error = new Error('Start date must be before or equal to end date');
    res.status(400);
    throw error;
  }

  // Parse to UTC midnight to avoid timezone shifting
  const startUTC = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const endUTC = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  const oneDayMs = 24 * 60 * 60 * 1000;
  const duration = Math.ceil((endUTC - startUTC) / oneDayMs) + 1;

  // Generate schedule days
  const schedule = [];
  for (let i = 1; i <= duration; i++) {
    const dayDate = new Date(startUTC);
    dayDate.setUTCDate(startUTC.getUTCDate() + (i - 1));
    schedule.push({
      day: i,
      date: dayDate,
      places: []
    });
  }

  const trip = new Trip({
    user: req.user._id,
    title,
    city,
    startDate: startUTC,
    endDate: endUTC,
    budget: Number(budget) || 0,
    schedule
  });

  const createdTrip = await trip.save();
  res.status(201).json(createdTrip);
});

// @desc    Get user's trips grouped by time status
// @route   GET /api/trips
// @access  Private
const getMyTrips = asyncHandler(async (req, res) => {
  const trips = await Trip.find({ user: req.user._id })
    .populate('city', 'name image coordinates')
    .sort({ startDate: 1 });

  const upcoming = [];
  const ongoing = [];
  const past = [];

  const now = new Date();
  // Get today's UTC midnight for clean comparison
  const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  for (const trip of trips) {
    const tripStart = new Date(trip.startDate);
    const tripStartUTC = new Date(Date.UTC(tripStart.getUTCFullYear(), tripStart.getUTCMonth(), tripStart.getUTCDate()));
    
    const tripEnd = new Date(trip.endDate);
    const tripEndUTC = new Date(Date.UTC(tripEnd.getUTCFullYear(), tripEnd.getUTCMonth(), tripEnd.getUTCDate()));

    if (todayUTC < tripStartUTC) {
      upcoming.push(trip);
    } else if (todayUTC >= tripStartUTC && todayUTC <= tripEndUTC) {
      ongoing.push(trip);
    } else {
      past.push(trip);
    }
  }

  res.json({
    upcoming,
    ongoing,
    past
  });
});

// @desc    Get trip details by ID
// @route   GET /api/trips/:id
// @access  Private
const getTripById = asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.id)
    .populate('city')
    .populate({
      path: 'schedule.places.placeId'
    });

  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  // Check ownership
  if (trip.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to view this trip');
  }

  res.json(trip);
});

// @desc    Delete a trip
// @route   DELETE /api/trips/:id
// @access  Private
const deleteTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.id);

  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  // Check ownership
  if (trip.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to delete this trip');
  }

  await Trip.deleteOne({ _id: req.params.id });
  res.json({ message: 'Trip removed successfully' });
});

export { createTrip, getMyTrips, getTripById, deleteTrip };
