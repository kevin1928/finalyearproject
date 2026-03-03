const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, default: 'fas fa-trophy' },
    xp_reward: { type: Number, default: 50 },
    requirement_type: { type: String, required: true },
    requirement_value: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Achievement', achievementSchema);
