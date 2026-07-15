import asyncHandler from 'express-async-handler';
import Trip from '../../models/tripModel.js';
import City from '../../models/cityModel.js';
import Attraction from '../../models/attractionModel.js';
import Hotel from '../../models/hotelModel.js';
import Restaurant from '../../models/restaurantModel.js';
import Cafe from '../../models/cafeModel.js';

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
  let schedule = [];
  if (req.body.schedule && Array.isArray(req.body.schedule)) {
    schedule = req.body.schedule.map((item, index) => {
      const dayDate = new Date(startUTC);
      dayDate.setUTCDate(startUTC.getUTCDate() + index);
      return {
        day: item.day || (index + 1),
        date: dayDate,
        places: (item.places || []).map((p, pIndex) => ({
          placeType: p.placeType,
          placeId: p.placeId,
          order: p.order !== undefined ? p.order : pIndex,
          note: p.note || '',
          visited: p.visited || false,
          checkInTime: p.checkInTime ? new Date(p.checkInTime) : undefined
        }))
      };
    });
  } else {
    for (let i = 1; i <= duration; i++) {
      const dayDate = new Date(startUTC);
      dayDate.setUTCDate(startUTC.getUTCDate() + (i - 1));
      schedule.push({
        day: i,
        date: dayDate,
        places: []
      });
    }
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

// @desc    Add a place to a specific day in trip schedule
// @route   POST /api/trips/:id/schedule/places
// @access  Private
const addPlaceToSchedule = asyncHandler(async (req, res) => {
  const { day, placeType, placeId, note } = req.body;

  if (!day || !placeType || !placeId) {
    res.status(400);
    throw new Error('Please provide day, placeType, and placeId');
  }

  const validTypes = ['Attraction', 'Hotel', 'Restaurant', 'Cafe'];
  const typeMatch = validTypes.find(t => t.toLowerCase() === placeType.toLowerCase());
  if (!typeMatch) {
    res.status(400);
    throw new Error('Invalid placeType. Must be: Attraction, Hotel, Restaurant, Cafe');
  }

  const trip = await Trip.findById(req.params.id);
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  // Check ownership
  if (trip.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to modify this trip');
  }

  // Check if place exists
  let Model;
  if (typeMatch === 'Attraction') Model = Attraction;
  else if (typeMatch === 'Hotel') Model = Hotel;
  else if (typeMatch === 'Restaurant') Model = Restaurant;
  else if (typeMatch === 'Cafe') Model = Cafe;

  const place = await Model.findById(placeId);
  if (!place) {
    res.status(404);
    throw new Error(`${typeMatch} not found`);
  }

  // Find target day in schedule
  const daySchedule = trip.schedule.find(s => s.day === Number(day));
  if (!daySchedule) {
    res.status(400);
    throw new Error(`Day ${day} does not exist in this trip's schedule`);
  }

  // Calculate order
  const order = daySchedule.places.length;

  daySchedule.places.push({
    placeType: typeMatch,
    placeId,
    order,
    note: note || ''
  });

  await trip.save();
  res.status(201).json(trip);
});

// @desc    Remove a place from trip schedule
// @route   DELETE /api/trips/:id/schedule/places/:subId
// @access  Private
const removePlaceFromSchedule = asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  // Check ownership
  if (trip.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to modify this trip');
  }

  const { subId } = req.params;

  // Find day containing the place subdocument
  let foundDay = null;
  for (const daySchedule of trip.schedule) {
    const itemIndex = daySchedule.places.findIndex(p => p._id.toString() === subId);
    if (itemIndex !== -1) {
      foundDay = daySchedule;
      // Remove item
      daySchedule.places.splice(itemIndex, 1);
      break;
    }
  }

  if (!foundDay) {
    res.status(404);
    throw new Error('Place not found in trip schedule');
  }

  // Reorder remaining places in that day
  foundDay.places.sort((a, b) => a.order - b.order);
  foundDay.places.forEach((p, idx) => {
    p.order = idx;
  });

  await trip.save();
  res.json(trip);
});

// @desc    Reorder places in a specific day's schedule
// @route   PUT /api/trips/:id/schedule/reorder
// @access  Private
const reorderSchedulePlaces = asyncHandler(async (req, res) => {
  const { day, placesOrder } = req.body; // placesOrder is array of subdocument _id strings

  if (!day || !Array.isArray(placesOrder)) {
    res.status(400);
    throw new Error('Please provide day and placesOrder array of IDs');
  }

  const trip = await Trip.findById(req.params.id);
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  // Check ownership
  if (trip.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to modify this trip');
  }

  const daySchedule = trip.schedule.find(s => s.day === Number(day));
  if (!daySchedule) {
    res.status(400);
    throw new Error(`Day ${day} does not exist in this trip's schedule`);
  }

  // Map to hold items by their subId
  const placesMap = {};
  daySchedule.places.forEach(p => {
    placesMap[p._id.toString()] = p;
  });

  // Build new array of places with updated orders
  const newPlaces = [];
  placesOrder.forEach((subId, idx) => {
    const placeItem = placesMap[subId];
    if (placeItem) {
      placeItem.order = idx;
      newPlaces.push(placeItem);
      // Remove from map to track any omitted items
      delete placesMap[subId];
    }
  });

  // Append any items that were not included in placesOrder to the end
  const remainingItems = Object.values(placesMap);
  remainingItems.forEach((placeItem, idx) => {
    placeItem.order = newPlaces.length + idx;
    newPlaces.push(placeItem);
  });

  daySchedule.places = newPlaces;
  await trip.save();
  res.json(trip);
});

// @desc    Check-in/visited place in schedule (Designed mainly for Mobile App)
// @route   PATCH /api/trips/:id/schedule/places/:subId/check-in
// @access  Private
const checkInPlace = asyncHandler(async (req, res) => {
  const { visited } = req.body;

  if (visited === undefined) {
    const error = new Error('Please provide visited status (true or false)');
    res.status(400);
    throw error;
  }

  const trip = await Trip.findById(req.params.id);
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  // Check ownership
  if (trip.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to modify this trip');
  }

  const { subId } = req.params;

  let foundPlace = null;
  for (const daySchedule of trip.schedule) {
    const item = daySchedule.places.find(p => p._id.toString() === subId);
    if (item) {
      foundPlace = item;
      break;
    }
  }

  if (!foundPlace) {
    res.status(404);
    throw new Error('Place not found in trip schedule');
  }

  foundPlace.visited = !!visited;
  if (foundPlace.visited) {
    foundPlace.checkInTime = new Date();
  } else {
    foundPlace.checkInTime = undefined;
  }

  await trip.save();
  res.json(trip);
});

// @desc    Update trip diary notes and photos (For both Mobile App and Web App)
// @route   PUT /api/trips/:id/diary
// @access  Private
const updateTripDiary = asyncHandler(async (req, res) => {
  const { notes, photos } = req.body;

  const trip = await Trip.findById(req.params.id);
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  // Check ownership
  if (trip.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to modify this trip');
  }

  if (notes !== undefined) {
    trip.diary.notes = notes;
  }
  if (photos !== undefined) {
    if (!Array.isArray(photos)) {
      const error = new Error('Photos must be an array of strings');
      res.status(400);
      throw error;
    }
    trip.diary.photos = photos;
  }

  await trip.save();
  res.json(trip);
});

// @desc    Update trip metadata (Title, Budget)
// @route   PUT /api/trips/:id
// @access  Private
const updateTripMetadata = asyncHandler(async (req, res) => {
  const { title, budget } = req.body;

  const trip = await Trip.findById(req.params.id);
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  // Check ownership
  if (trip.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to modify this trip');
  }

  if (title !== undefined) {
    trip.title = title;
  }
  if (budget !== undefined) {
    trip.budget = Number(budget) || 0;
  }

  const updatedTrip = await trip.save();
  res.json(updatedTrip);
});

export {
  createTrip,
  getMyTrips,
  getTripById,
  deleteTrip,
  addPlaceToSchedule,
  removePlaceFromSchedule,
  reorderSchedulePlaces,
  checkInPlace,
  updateTripDiary,
  updateTripMetadata
};
