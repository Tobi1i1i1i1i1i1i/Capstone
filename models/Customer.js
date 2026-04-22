const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  customer_id:             { type: String, required: true, unique: true, index: true },
  year:                    { type: Number },
  phone_no:                { type: String },
  gender:                  { type: String, enum: ['Male', 'Female', 'Other'] },
  age:                     { type: Number, min: 0 },
  no_of_days_subscribed:   { type: Number, min: 0 },
  multi_screen:            { type: String, enum: ['Yes', 'No'], default: 'No' },
  mail_subscribed:         { type: String, enum: ['Yes', 'No'], default: 'No' },
  weekly_mins_watched:     { type: Number, min: 0 },
  minimum_daily_mins:      { type: Number, min: 0 },
  maximum_daily_mins:      { type: Number, min: 0 },
  weekly_max_night_mins:   { type: Number, min: 0 },
  videos_watched:          { type: Number, min: 0 },
  maximum_days_inactive:   { type: Number, min: 0 },
  customer_support_calls:  { type: Number, min: 0 },
  churn:                   { type: Number, enum: [0, 1], default: null },
}, {
  timestamps: true,
});

CustomerSchema.index({ churn: 1 });
CustomerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Customer', CustomerSchema);