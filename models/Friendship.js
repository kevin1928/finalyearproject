const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    friend: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'blocked'], default: 'pending' }
}, { timestamps: true });

// Ensure unique friendship pairs
friendshipSchema.index({ user: 1, friend: 1 }, { unique: true });

module.exports = mongoose.model('Friendship', friendshipSchema);
