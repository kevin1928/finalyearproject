const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'fas fa-gift' },
    cost_coins: { type: Number, required: true },
    category: { type: String, default: 'general' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Reward', rewardSchema);
