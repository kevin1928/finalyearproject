const mongoose = require('mongoose');

const completionSchema = new mongoose.Schema({
    habit: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date_key: { type: String, required: true }, // Format: YYYY-MM-DD
    count: { type: Number, default: 1 },
    completed_at: { type: Date, default: Date.now }
}, { timestamps: true });

// Ensure a user can only have one completion per habit per day
completionSchema.index({ habit: 1, date_key: 1 }, { unique: true });

module.exports = mongoose.model('Completion', completionSchema);
