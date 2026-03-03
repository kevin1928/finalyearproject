const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'fas fa-star' },
    color: { type: String, default: '#6C5CE7' },
    frequency: { type: String, default: 'daily' },
    target_count: { type: Number, default: 1 },
    xp_reward: { type: Number, default: 10 },
    coin_reward: { type: Number, default: 5 },
    category: { type: String, default: 'general' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Habit', habitSchema);
