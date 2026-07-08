import mongoose from 'mongoose';

const placeInScheduleSchema = mongoose.Schema({
  placeType: {
    type: String,
    required: true,
    enum: ['Attraction', 'Hotel', 'Restaurant', 'Cafe'],
  },
  placeId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'schedule.places.placeType',
  },
  order: {
    type: Number,
    required: true,
  },
  note: {
    type: String,
    default: '',
  },
  visited: {
    type: Boolean,
    default: false,
  },
  checkInTime: {
    type: Date,
  },
});

const dayScheduleSchema = mongoose.Schema({
  day: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  places: [placeInScheduleSchema],
});

const tripSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    budget: {
      type: Number,
      default: 0,
    },
    schedule: [dayScheduleSchema],
    diary: {
      notes: {
        type: String,
        default: '',
      },
      photos: {
        type: [String],
        default: [],
      },
    },
  },
  {
    timestamps: true,
  }
);

const Trip = mongoose.model('Trip', tripSchema);

export default Trip;
