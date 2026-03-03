const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    challenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    habit_name: { type: String, required: true },
    description: { type: String, default: '' },
    target_days: { type: Number, default: 7 },
    xp_reward: { type: Number, default: 100 },
    coin_reward: { type: Number, default: 50 },
    status: { type: String, enum: ['pending', 'accepted', 'completed', 'declined'], default: 'pending' },
    start_date: { type: Date },
    end_date: { type: Date },
    creator_progress: { type: Number, default: 0 },
    challenger_progress: { type: Number, default: 0 },
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Challenge', challengeSchema);
