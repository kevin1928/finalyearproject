const mongoose = require('mongoose');
const User = require('./models/User');
const Habit = require('./models/Habit');
const Reward = require('./models/Reward');
const Achievement = require('./models/Achievement');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
    try {
        // Check if data already exists
        const userCount = await User.countDocuments();
        if (userCount > 0) {
            console.log('🌱 Database already seeded');
            return;
        }

        console.log('🌱 Seeding database...');

        // 1. Seed Rewards
        const rewards = [
            { name: 'Custom Theme', description: 'Unlock a custom color theme for your dashboard', icon: 'fas fa-palette', cost_coins: 200, category: 'cosmetic' },
            { name: 'Profile Badge', description: 'Show off a shiny badge on your profile', icon: 'fas fa-id-badge', cost_coins: 150, category: 'cosmetic' },
            { name: 'Streak Shield', description: 'Protect your streak for one missed day', icon: 'fas fa-shield-halved', cost_coins: 300, category: 'power-up' },
            { name: 'Double XP (24h)', description: 'Earn double XP for 24 hours', icon: 'fas fa-bolt', cost_coins: 500, category: 'power-up' },
            { name: 'Custom Avatar Frame', description: 'A golden frame around your avatar', icon: 'fas fa-crown', cost_coins: 400, category: 'cosmetic' },
            { name: 'Habit Slot Unlock', description: 'Track one additional habit', icon: 'fas fa-plus-circle', cost_coins: 250, category: 'utility' },
            { name: 'Analytics Pro', description: 'Unlock advanced analytics for 7 days', icon: 'fas fa-chart-line', cost_coins: 350, category: 'utility' },
            { name: 'Challenge Boost', description: 'Start a challenge with +1 day advantage', icon: 'fas fa-rocket', cost_coins: 450, category: 'power-up' },
        ];
        await Reward.insertMany(rewards);

        // 2. Seed Achievements
        const achievements = [
            { name: 'First Step', description: 'Complete your first habit', icon: 'fas fa-footprints', xp_reward: 10, requirement_type: 'total_completions', requirement_value: 1 },
            { name: 'Getting Started', description: 'Complete 10 habits', icon: 'fas fa-seedling', xp_reward: 25, requirement_type: 'total_completions', requirement_value: 10 },
            { name: 'Dedicated', description: 'Complete 50 habits', icon: 'fas fa-dumbbell', xp_reward: 50, requirement_type: 'total_completions', requirement_value: 50 },
            { name: 'Habit Master', description: 'Complete 100 habits', icon: 'fas fa-medal', xp_reward: 100, requirement_type: 'total_completions', requirement_value: 100 },
            { name: 'Streak Starter', description: 'Maintain a 3-day streak', icon: 'fas fa-fire', xp_reward: 20, requirement_type: 'streak', requirement_value: 3 },
            { name: 'On Fire', description: 'Maintain a 7-day streak', icon: 'fas fa-fire-flame-curved', xp_reward: 50, requirement_type: 'streak', requirement_value: 7 },
            { name: 'Unstoppable', description: 'Maintain a 30-day streak', icon: 'fas fa-gem', xp_reward: 200, requirement_type: 'streak', requirement_value: 30 },
            { name: 'Century Run', description: 'Maintain a 100-day streak', icon: 'fas fa-trophy', xp_reward: 500, requirement_type: 'streak', requirement_value: 100 },
            { name: 'Social Butterfly', description: 'Add 3 friends', icon: 'fas fa-users', xp_reward: 30, requirement_type: 'friends', requirement_value: 3 },
            { name: 'Challenger', description: 'Complete 5 challenges', icon: 'fas fa-fist-raised', xp_reward: 75, requirement_type: 'challenges', requirement_value: 5 },
            { name: 'Wealthy', description: 'Accumulate 1000 coins', icon: 'fas fa-coins', xp_reward: 50, requirement_type: 'coins', requirement_value: 1000 },
            { name: 'Level 5', description: 'Reach level 5', icon: 'fas fa-star', xp_reward: 100, requirement_type: 'level', requirement_value: 5 },
        ];
        await Achievement.insertMany(achievements);

        // 3. Seed Demo Users
        const demoUsers = [
            { username: 'alex_dev', email: 'alex@example.com', password: 'password123', display_name: 'Alex Johnson', xp: 2450, coins: 780, level: 8, current_streak: 14, longest_streak: 21, total_habits_completed: 156 },
            { username: 'sarah_fit', email: 'sarah@example.com', password: 'password123', display_name: 'Sarah Chen', xp: 3200, coins: 1200, level: 10, current_streak: 25, longest_streak: 30, total_habits_completed: 210 },
            { username: 'mike_reads', email: 'mike@example.com', password: 'password123', display_name: 'Mike Rivera', xp: 1800, coins: 450, level: 6, current_streak: 7, longest_streak: 15, total_habits_completed: 98 },
            { username: 'emma_code', email: 'emma@example.com', password: 'password123', display_name: 'Emma Wilson', xp: 4100, coins: 2100, level: 12, current_streak: 42, longest_streak: 42, total_habits_completed: 305 },
            { username: 'james_run', email: 'james@example.com', password: 'password123', display_name: 'James Park', xp: 1200, coins: 320, level: 4, current_streak: 3, longest_streak: 10, total_habits_completed: 67 },
            { username: 'demo', email: 'demo@example.com', password: 'password123', display_name: 'Demo User', xp: 500, coins: 250, level: 3, current_streak: 5, longest_streak: 8, total_habits_completed: 35 },
        ];

        // We hash passwords in the model's pre-save hook, but let's be safe
        const createdUsers = [];
        for (const u of demoUsers) {
            const user = new User(u);
            await user.save();
            createdUsers.push(user);
        }

        // 4. Seed Habits for Demo User
        const demoUser = createdUsers.find(u => u.username === 'demo');
        const demoHabits = [
            { user: demoUser._id, name: 'Morning Meditation', description: '10 minutes of mindfulness', icon: 'fas fa-spa', color: '#6C5CE7', xp_reward: 15, coin_reward: 8, category: 'wellness' },
            { user: demoUser._id, name: 'Read 30 Pages', description: 'Read at least 30 pages of a book', icon: 'fas fa-book', color: '#00B894', xp_reward: 20, coin_reward: 10, category: 'learning' },
            { user: demoUser._id, name: 'Exercise', description: '30 minutes of physical activity', icon: 'fas fa-dumbbell', color: '#E17055', xp_reward: 25, coin_reward: 12, category: 'fitness' },
            { user: demoUser._id, name: 'Drink Water', description: 'Drink 8 glasses of water', icon: 'fas fa-tint', color: '#0984E3', xp_reward: 10, coin_reward: 5, category: 'health' },
            { user: demoUser._id, name: 'Code Practice', description: 'Solve 1 coding problem', icon: 'fas fa-laptop-code', color: '#FDCB6E', xp_reward: 20, coin_reward: 10, category: 'learning' },
        ];
        await Habit.insertMany(demoHabits);

        console.log('✅ Seeding completed!');
    } catch (error) {
        console.error('❌ Seeding error:', error);
    }
};

module.exports = seedDatabase;
