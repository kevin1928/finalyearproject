require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const connectDB = require('./config/db');
const seedDatabase = require('./seed');
const User = require('./models/User');
const Habit = require('./models/Habit');
const Completion = require('./models/Completion');
const Friendship = require('./models/Friendship');
const Challenge = require('./models/Challenge');
const Reward = require('./models/Reward');
const Achievement = require('./models/Achievement');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'habit-economy-secret-key-2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
async function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) return res.status(401).json({ error: 'User no longer exists' });
        req.userId = decoded.userId;
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, display_name } = req.body;
        if (!username || !email || !password || !display_name) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) return res.status(400).json({ error: 'Username or email already exists' });

        const user = new User({ username, email, password, display_name });
        await user.save();

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

        const safeUser = user.toObject();
        delete safeUser.password;

        res.json({ token, user: { ...safeUser, id: user._id } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ $or: [{ username }, { email: username }] });
        if (!user) return res.status(400).json({ error: 'User not found' });

        const isMatch = await user.matchPassword(password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

        user.last_active = Date.now();
        await user.save();

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

        const safeUser = user.toObject();
        delete safeUser.password;

        res.json({ token, user: { ...safeUser, id: user._id } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ ...user.toObject(), id: user._id });
});

// ==================== PROFILE ROUTES ====================

app.get('/api/user/profile', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select('-password')
            .populate('achievements.achievement')
            .populate('purchased_rewards.reward');
        
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Add some basic stats like total days active if needed, but the model has most info
        res.json({ ...user.toObject(), id: user._id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

app.put('/api/user/profile', authenticate, async (req, res) => {
    try {
        const { display_name, email, avatar_url } = req.body;
        const user = await User.findById(req.userId);
        
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        if (display_name) user.display_name = display_name;
        if (email) user.email = email;
        if (avatar_url) user.avatar_url = avatar_url;
        
        await user.save();
        
        const safeUser = user.toObject();
        delete safeUser.password;
        
        res.json({ success: true, user: { ...safeUser, id: user._id } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// ==================== HABITS ROUTES ====================

app.get('/api/habits', authenticate, async (req, res) => {
    try {
        const habits = await Habit.find({ user: req.userId, isActive: true }).sort({ createdAt: -1 });
        const today = new Date().toISOString().split('T')[0];

        const habitsWithStatus = await Promise.all(habits.map(async (habit) => {
            const completion = await Completion.findOne({ habit: habit._id, date_key: today });
            return { ...habit.toObject(), id: habit._id, completed_today: !!completion };
        }));

        res.json(habitsWithStatus);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch habits' });
    }
});

app.post('/api/habits', authenticate, async (req, res) => {
    try {
        const { name, description, icon, color, frequency, target_count, xp_reward, coin_reward, category } = req.body;
        if (!name) return res.status(400).json({ error: 'Habit name is required' });

        const habit = new Habit({
            user: req.userId,
            name,
            description: description || '',
            icon: icon || 'fas fa-star',
            color: color || '#6C5CE7',
            frequency: frequency || 'daily',
            target_count: target_count || 1,
            xp_reward: xp_reward || 10,
            coin_reward: coin_reward || 5,
            category: category || 'general'
        });

        await habit.save();
        res.json({ ...habit.toObject(), id: habit._id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create habit' });
    }
});

app.put('/api/habits/:id', authenticate, async (req, res) => {
    try {
        const { name, description, icon, color, category } = req.body;
        const habit = await Habit.findOneAndUpdate(
            { _id: req.params.id, user: req.userId },
            { name, description, icon, color, category },
            { new: true }
        );
        if (!habit) return res.status(404).json({ error: 'Habit not found' });
        res.json({ ...habit.toObject(), id: habit._id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update habit' });
    }
});

app.delete('/api/habits/:id', authenticate, async (req, res) => {
    try {
        await Habit.findOneAndUpdate({ _id: req.params.id, user: req.userId }, { isActive: false });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete habit' });
    }
});

// ==================== HABIT COMPLETION ROUTES ====================

app.post('/api/habits/:id/complete', authenticate, async (req, res) => {
    try {
        const habitId = req.params.id;
        const today = new Date().toISOString().split('T')[0];

        const habit = await Habit.findOne({ _id: habitId, user: req.userId });
        if (!habit) return res.status(404).json({ error: 'Habit not found' });

        const existing = await Completion.findOne({ habit: habitId, date_key: today });
        if (existing) return res.status(400).json({ error: 'Already completed today' });

        const completion = new Completion({ habit: habitId, user: req.userId, date_key: today });
        await completion.save();

        // Award XP and coins
        const user = req.user;
        user.xp += habit.xp_reward;
        user.coins += habit.coin_reward;
        user.total_habits_completed += 1;

        // Check streak
        const totalActive = await Habit.countDocuments({ user: req.userId, isActive: true });
        const completedToday = await Completion.countDocuments({ user: req.userId, date_key: today });

        let streakBonus = 0;
        if (completedToday >= totalActive) {
            user.current_streak += 1;
            user.longest_streak = Math.max(user.longest_streak, user.current_streak);

            streakBonus = Math.min(user.current_streak * 2, 50);
            user.xp += streakBonus;
            user.coins += Math.floor(streakBonus / 2);
        }

        // Check level up
        const expectedLevel = Math.floor(Math.sqrt(user.xp / 100)) + 1;
        let levelUp = false;
        if (expectedLevel > user.level) {
            user.coins += expectedLevel * 25;
            user.level = expectedLevel;
            levelUp = true;
        }

        await user.save();

        // Check achievements and challenges (we'll update these helpers next)
        const newAchievements = await checkAchievements(req.userId);
        await updateChallengeProgress(req.userId, habit.name);

        const safeUser = user.toObject();
        delete safeUser.password;
        safeUser.id = user._id;

        res.json({
            success: true,
            xp_earned: habit.xp_reward + streakBonus,
            coins_earned: habit.coin_reward + Math.floor(streakBonus / 2),
            streak_bonus: streakBonus,
            level_up: levelUp,
            new_achievements: newAchievements,
            user: safeUser
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to complete habit' });
    }
});

app.post('/api/habits/:id/uncomplete', authenticate, async (req, res) => {
    try {
        const habitId = req.params.id;
        const today = new Date().toISOString().split('T')[0];

        const habit = await Habit.findOne({ _id: habitId, user: req.userId });
        if (!habit) return res.status(404).json({ error: 'Habit not found' });

        await Completion.findOneAndDelete({ habit: habitId, date_key: today, user: req.userId });

        // Remove XP and coins
        const user = req.user;
        user.xp = Math.max(0, user.xp - habit.xp_reward);
        user.coins = Math.max(0, user.coins - habit.coin_reward);
        user.total_habits_completed = Math.max(0, user.total_habits_completed - 1);
        await user.save();

        const safeUser = user.toObject();
        delete safeUser.password;
        safeUser.id = user._id;

        res.json({ success: true, user: safeUser });
    } catch (err) {
        res.status(500).json({ error: 'Failed to uncomplete habit' });
    }
});

// ==================== ANALYTICS ROUTES ====================

app.get('/api/analytics/weekly', authenticate, async (req, res) => {
    try {
        const days = [];
        const total = await Habit.countDocuments({ user: req.userId, isActive: true });

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];
            const dayName = d.toLocaleDateString('en', { weekday: 'short' });

            const completed = await Completion.countDocuments({ user: req.userId, date_key: dateKey });

            days.push({
                date: dateKey,
                day: dayName,
                completed,
                total,
                percentage: total > 0 ? Math.round((completed / total) * 100) : 0
            });
        }
        res.json(days);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch weekly analytics' });
    }
});

app.get('/api/analytics/monthly', authenticate, async (req, res) => {
    try {
        const weeks = [];
        const activeHabits = await Habit.countDocuments({ user: req.userId, isActive: true });

        for (let w = 3; w >= 0; w--) {
            let totalCompleted = 0;
            let totalPossible = activeHabits * 7;

            for (let d = 6; d >= 0; d--) {
                const date = new Date();
                date.setDate(date.getDate() - (w * 7 + d));
                const dateKey = date.toISOString().split('T')[0];

                const count = await Completion.countDocuments({ user: req.userId, date_key: dateKey });
                totalCompleted += count;
            }

            weeks.push({
                week: `Week ${4 - w}`,
                completed: totalCompleted,
                total: totalPossible,
                percentage: totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0
            });
        }
        res.json(weeks);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch monthly analytics' });
    }
});

app.get('/api/analytics/habits', authenticate, async (req, res) => {
    try {
        const habits = await Habit.find({ user: req.userId, isActive: true });
        const last7DaysDate = new Date();
        last7DaysDate.setDate(last7DaysDate.getDate() - 7);
        const last7DaysKey = last7DaysDate.toISOString().split('T')[0];

        const analytics = await Promise.all(habits.map(async (habit) => {
            const total_completions = await Completion.countDocuments({ habit: habit._id });
            const last_7_days = await Completion.countDocuments({
                habit: habit._id,
                date_key: { $gte: last7DaysKey }
            });

            return {
                ...habit.toObject(),
                id: habit._id,
                total_completions,
                last_7_days,
                completion_rate: Math.round((last_7_days / 7) * 100)
            };
        }));
        res.json(analytics);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch habit analytics' });
    }
});

// ==================== LEADERBOARD ROUTES ====================

app.get('/api/leaderboard', async (req, res) => {
    try {
        const type = req.query.type || 'xp';
        let sortField = 'xp';
        if (type === 'streak') sortField = 'current_streak';
        if (type === 'coins') sortField = 'coins';
        if (type === 'completions') sortField = 'total_habits_completed';

        const leaderboard = await User.find({})
            .sort({ [sortField]: -1 })
            .limit(20)
            .select('username display_name avatar_url xp coins level current_streak longest_streak total_habits_completed');

        const ranked = leaderboard.map((user, idx) => ({
            ...user.toObject(),
            id: user._id,
            rank: idx + 1
        }));
        res.json(ranked);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// ==================== FRIENDS ROUTES ====================

app.get('/api/friends', authenticate, async (req, res) => {
    try {
        const friendships = await Friendship.find({ user: req.userId, status: 'accepted' })
            .populate('friend', 'username display_name avatar_url xp level current_streak');

        const friends = friendships.map(f => ({
            ...f.friend.toObject(),
            id: f.friend._id,
            status: f.status
        }));
        res.json(friends);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch friends' });
    }
});

app.get('/api/friends/requests', authenticate, async (req, res) => {
    try {
        const requests = await Friendship.find({ friend: req.userId, status: 'pending' })
            .populate('user', 'username display_name avatar_url xp level');

        const pending = requests.map(r => ({
            ...r.user.toObject(),
            id: r.user._id,
            request_id: r._id
        }));
        res.json(pending);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch friend requests' });
    }
});

app.post('/api/friends/add', authenticate, async (req, res) => {
    try {
        const { username } = req.body;
        const friend = await User.findOne({ username });
        if (!friend) return res.status(404).json({ error: 'User not found' });
        if (friend._id.toString() === req.userId.toString()) return res.status(400).json({ error: 'Cannot add yourself' });

        const existing = await Friendship.findOne({ user: req.userId, friend: friend._id });
        if (existing) return res.status(400).json({ error: 'Friend request already exists' });

        const request = new Friendship({ user: req.userId, friend: friend._id, status: 'pending' });
        await request.save();
        res.json({ success: true, message: 'Friend request sent' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send friend request' });
    }
});

app.post('/api/friends/accept/:requestId', authenticate, async (req, res) => {
    try {
        const request = await Friendship.findOne({ _id: req.params.requestId, friend: req.userId });
        if (!request) return res.status(404).json({ error: 'Request not found' });

        request.status = 'accepted';
        await request.save();

        // Create reverse friendship
        await Friendship.findOneAndUpdate(
            { user: req.userId, friend: request.user },
            { status: 'accepted' },
            { upsert: true, new: true }
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to accept request' });
    }
});

app.post('/api/friends/reject/:requestId', authenticate, async (req, res) => {
    try {
        await Friendship.findOneAndDelete({ _id: req.params.requestId, friend: req.userId });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to reject request' });
    }
});

// ==================== CHALLENGES ROUTES ====================

app.get('/api/challenges', authenticate, async (req, res) => {
    try {
        const challenges = await Challenge.find({
            $or: [{ creator: req.userId }, { challenger: req.userId }]
        })
            .populate('creator', 'display_name username')
            .populate('challenger', 'display_name username')
            .sort({ createdAt: -1 });

        const formatted = challenges.map(c => ({
            ...c.toObject(),
            id: c._id,
            creator_id: c.creator?._id,
            challenger_id: c.challenger?._id,
            creator_name: c.creator?.display_name || 'Unknown',
            creator_username: c.creator?.username || 'unknown',
            challenger_name: c.challenger?.display_name || 'Unknown',
            challenger_username: c.challenger?.username || 'unknown'
        }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch challenges' });
    }
});

app.post('/api/challenges', authenticate, async (req, res) => {
    try {
        const { challenger_username, habit_name, description, target_days, xp_reward, coin_reward } = req.body;
        const challenger = await User.findOne({ username: challenger_username });
        if (!challenger) return res.status(404).json({ error: 'User not found' });

        const startDate = new Date();
        const endDate = new Date(Date.now() + (target_days || 7) * 86400000);

        const challenge = new Challenge({
            creator: req.userId,
            challenger: challenger._id,
            habit_name,
            description: description || '',
            target_days: target_days || 7,
            xp_reward: xp_reward || 100,
            coin_reward: coin_reward || 50,
            start_date: startDate,
            end_date: endDate
        });

        await challenge.save();
        res.json({ ...challenge.toObject(), id: challenge._id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create challenge' });
    }
});

app.post('/api/challenges/:id/accept', authenticate, async (req, res) => {
    try {
        const challenge = await Challenge.findOne({ _id: req.params.id, challenger: req.userId });
        if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

        challenge.status = 'active';
        challenge.start_date = new Date();
        challenge.end_date = new Date(Date.now() + challenge.target_days * 86400000);

        await challenge.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to accept challenge' });
    }
});

app.post('/api/challenges/:id/progress', authenticate, async (req, res) => {
    try {
        const challenge = await Challenge.findOne({ _id: req.params.id, status: 'active' });
        if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

        if (challenge.creator.toString() === req.userId.toString()) {
            challenge.creator_progress += 1;
        } else if (challenge.challenger.toString() === req.userId.toString()) {
            challenge.challenger_progress += 1;
        }

        await challenge.save();
        res.json({ ...challenge.toObject(), id: challenge._id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update progress' });
    }
});

// ==================== REWARDS ROUTES ====================

app.get('/api/rewards', authenticate, async (req, res) => {
    try {
        const rewards = await Reward.find({ isActive: true });
        const purchasedIds = req.user.purchased_rewards.map(p => p.reward.toString());

        const rewardsWithStatus = rewards.map(r => ({
            ...r.toObject(),
            id: r._id,
            purchased: purchasedIds.includes(r._id.toString())
        }));
        res.json(rewardsWithStatus);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch rewards' });
    }
});

app.post('/api/rewards/:id/purchase', authenticate, async (req, res) => {
    try {
        const reward = await Reward.findById(req.params.id);
        if (!reward) return res.status(404).json({ error: 'Reward not found' });

        const user = req.user;
        if (user.coins < reward.cost_coins) return res.status(400).json({ error: 'Not enough coins' });

        const alreadyPurchased = user.purchased_rewards.some(p => p.reward.toString() === reward._id.toString());
        if (alreadyPurchased) return res.status(400).json({ error: 'Already purchased' });

        user.coins -= reward.cost_coins;
        user.purchased_rewards.push({ reward: reward._id });
        await user.save();

        const safeUser = user.toObject();
        delete safeUser.password;
        safeUser.id = user._id;

        res.json({ success: true, user: safeUser });
    } catch (err) {
        res.status(500).json({ error: 'Failed to purchase reward' });
    }
});

// ==================== ACHIEVEMENTS ROUTES ====================

app.get('/api/achievements', authenticate, async (req, res) => {
    try {
        const achievements = await Achievement.find();
        const unlockedMap = {};
        req.user.achievements.forEach(a => {
            unlockedMap[a.achievement.toString()] = a.unlocked_at;
        });

        const achWithStatus = achievements.map(a => ({
            ...a.toObject(),
            id: a._id,
            unlocked: !!unlockedMap[a._id.toString()],
            unlocked_at: unlockedMap[a._id.toString()] || null
        }));
        res.json(achWithStatus);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch achievements' });
    }
});

// ==================== SEARCH USERS ====================

app.get('/api/users/search', authenticate, async (req, res) => {
    try {
        const q = req.query.q || '';
        if (q.length < 2) return res.json([]);
        const users = await User.find({
            $and: [
                { _id: { $ne: req.userId } },
                {
                    $or: [
                        { username: { $regex: q, $options: 'i' } },
                        { display_name: { $regex: q, $options: 'i' } }
                    ]
                }
            ]
        }).limit(10).select('-password');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Search failed' });
    }
});

// ==================== HELPER FUNCTIONS ====================

async function checkAchievements(userId) {
    try {
        const user = await User.findById(userId);
        if (!user) return [];

        const achievements = await Achievement.find();
        const unlockedIds = user.achievements.map(a => a.achievement.toString());

        const newAchievements = [];

        for (const ach of achievements) {
            if (unlockedIds.includes(ach._id.toString())) continue;

            let earned = false;
            switch (ach.requirement_type) {
                case 'total_completions':
                    earned = user.total_habits_completed >= ach.requirement_value;
                    break;
                case 'streak':
                    earned = user.current_streak >= ach.requirement_value || user.longest_streak >= ach.requirement_value;
                    break;
                case 'coins':
                    earned = user.coins >= ach.requirement_value;
                    break;
                case 'level':
                    earned = user.level >= ach.requirement_value;
                    break;
                case 'friends':
                    const friendCount = await Friendship.countDocuments({ user: userId, status: 'accepted' });
                    earned = friendCount >= ach.requirement_value;
                    break;
                case 'challenges':
                    const chalCount = await Challenge.countDocuments({
                        $or: [{ creator: userId }, { challenger: userId }],
                        status: 'completed'
                    });
                    earned = chalCount >= ach.requirement_value;
                    break;
            }

            if (earned) {
                user.achievements.push({ achievement: ach._id });
                user.xp += ach.xp_reward;
                newAchievements.push(ach);
            }
        }

        if (newAchievements.length > 0) {
            await user.save();
        }

        return newAchievements;
    } catch (e) {
        console.error('checkAchievements error:', e);
        return [];
    }
}

async function updateChallengeProgress(userId, habitName) {
    try {
        const activeChallenges = await Challenge.find({
            status: 'active',
            habit_name: habitName,
            $or: [{ creator: userId }, { challenger: userId }]
        });

        for (const challenge of activeChallenges) {
            if (challenge.creator.toString() === userId.toString()) {
                challenge.creator_progress += 1;
            } else {
                challenge.challenger_progress += 1;
            }
            await challenge.save();
        }
    } catch (e) {
        console.error('updateChallengeProgress error:', e);
    }
}

// Catch-all: serve index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== START SERVER ====================

async function start() {
    try {
        await connectDB();
        await seedDatabase();
        const { setupCronJobs } = require('./cron');
        setupCronJobs();

        app.listen(PORT, () => {
            console.log(`\n🚀 Habit Economy server running at http://localhost:${PORT}`);
            console.log(`💡 Demo login: username "demo", password "password123"\n`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
    }
}

start();
