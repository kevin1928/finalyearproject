const cron = require('node-cron');
const User = require('./models/User');
const Habit = require('./models/Habit');
const Completion = require('./models/Completion');
const Challenge = require('./models/Challenge');

function setupCronJobs() {
    // Midnight cron job — reset daily tracking and update streaks
    cron.schedule('0 0 * * *', async () => {
        console.log('(time) Running midnight cron: streak updates...');

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = yesterday.toISOString().split('T')[0];

        const today = new Date();
        const todayKey = today.toISOString().split('T')[0];

        try {
            // Get all users
            const users = await User.find({});

            for (const user of users) {
                const completions = await Completion.countDocuments({
                    user: user._id,
                    date_key: yesterdayKey
                });

                const activeHabits = await Habit.countDocuments({
                    user: user._id,
                    isActive: true
                });

                if (activeHabits > 0 && completions >= activeHabits) {
                    user.current_streak += 1;
                    user.longest_streak = Math.max(user.longest_streak, user.current_streak);
                    user.last_active = Date.now();
                } else if (activeHabits > 0) {
                    user.current_streak = 0;
                    user.last_active = Date.now();
                }
                await user.save();
            }

            // Update challenge progress
            const activeChallenges = await Challenge.find({
                status: 'active',
                end_date: { $gte: today }
            });

            for (const challenge of activeChallenges) {
                if (today > challenge.end_date) {
                    let winner = null;
                    if (challenge.creator_progress > challenge.challenger_progress) {
                        winner = challenge.creator;
                    } else if (challenge.challenger_progress > challenge.creator_progress) {
                        winner = challenge.challenger;
                    }

                    challenge.status = 'completed';
                    challenge.winner = winner;
                    await challenge.save();

                    if (winner) {
                        const winnerUser = await User.findById(winner);
                        if (winnerUser) {
                            winnerUser.xp += challenge.xp_reward;
                            winnerUser.coins += challenge.coin_reward;
                            await winnerUser.save();
                        }
                    }
                }
            }

            console.log('(check) Midnight cron completed');
        } catch (error) {
            console.error('Midnight cron error:', error);
        }
    });

    // Every hour — check for level-ups
    cron.schedule('0 * * * *', async () => {
        console.log('(time) Running hourly cron: level checks...');

        try {
            const users = await User.find({});

            for (const user of users) {
                const expectedLevel = Math.floor(Math.sqrt(user.xp / 100)) + 1;
                if (expectedLevel > user.level) {
                    user.level = expectedLevel;
                    user.coins += expectedLevel * 25;
                    await user.save();
                    console.log(`(party) User ${user.username} leveled up to ${expectedLevel}!`);
                }
            }

            console.log('(check) Hourly cron completed');
        } catch (error) {
            console.error('Hourly cron error:', error);
        }
    });

    console.log('(time) Cron jobs scheduled');
}

module.exports = { setupCronJobs };
