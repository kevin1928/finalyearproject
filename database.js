const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'habit_economy.db');

let db = null;
let SQL = null;

async function getDb() {
  if (db) return db;

  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Auto-save every 30 seconds
setInterval(() => { saveDb(); }, 30000);

async function initializeDatabase() {
  const db = await getDb();

  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT DEFAULT '',
      xp INTEGER DEFAULT 0,
      coins INTEGER DEFAULT 100,
      level INTEGER DEFAULT 1,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      total_habits_completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_active DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Habits table
  db.run(`
    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      icon TEXT DEFAULT 'fas fa-star',
      color TEXT DEFAULT '#6C5CE7',
      frequency TEXT DEFAULT 'daily',
      target_count INTEGER DEFAULT 1,
      xp_reward INTEGER DEFAULT 10,
      coin_reward INTEGER DEFAULT 5,
      category TEXT DEFAULT 'general',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Habit completions table
  db.run(`
    CREATE TABLE IF NOT EXISTS habit_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      count INTEGER DEFAULT 1,
      date_key TEXT NOT NULL,
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(habit_id, date_key)
    )
  `);

  // Daily streaks tracking
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_streaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date_key TEXT NOT NULL,
      all_habits_done INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, date_key)
    )
  `);

  // Friendships table
  db.run(`
    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      friend_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, friend_id)
    )
  `);

  // Challenges table
  db.run(`
    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id INTEGER NOT NULL,
      challenger_id INTEGER NOT NULL,
      habit_name TEXT NOT NULL,
      description TEXT DEFAULT '',
      target_days INTEGER DEFAULT 7,
      xp_reward INTEGER DEFAULT 100,
      coin_reward INTEGER DEFAULT 50,
      status TEXT DEFAULT 'pending',
      start_date TEXT,
      end_date TEXT,
      creator_progress INTEGER DEFAULT 0,
      challenger_progress INTEGER DEFAULT 0,
      winner_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (challenger_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Rewards shop
  db.run(`
    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      icon TEXT DEFAULT 'fas fa-gift',
      cost_coins INTEGER NOT NULL,
      category TEXT DEFAULT 'general',
      is_active INTEGER DEFAULT 1
    )
  `);

  // User purchased rewards
  db.run(`
    CREATE TABLE IF NOT EXISTS user_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      reward_id INTEGER NOT NULL,
      purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE
    )
  `);

  // Achievements table
  db.run(`
    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT DEFAULT 'fas fa-trophy',
      xp_reward INTEGER DEFAULT 50,
      requirement_type TEXT NOT NULL,
      requirement_value INTEGER NOT NULL
    )
  `);

  // User achievements
  db.run(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
      UNIQUE(user_id, achievement_id)
    )
  `);

  // Helper to run parameterized SQL during seeding
  function seedRun(sql, params) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
  }

  function seedQuery(sql, params) {
    const stmt = db.prepare(sql);
    if (params) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  // Seed default rewards
  const rewardCount = db.exec('SELECT COUNT(*) as count FROM rewards')[0];
  if (rewardCount && rewardCount.values[0][0] === 0) {
    const rewards = [
      ['Custom Theme', 'Unlock a custom color theme for your dashboard', 'fas fa-palette', 200, 'cosmetic'],
      ['Profile Badge', 'Show off a shiny badge on your profile', 'fas fa-id-badge', 150, 'cosmetic'],
      ['Streak Shield', 'Protect your streak for one missed day', 'fas fa-shield-halved', 300, 'power-up'],
      ['Double XP (24h)', 'Earn double XP for 24 hours', 'fas fa-bolt', 500, 'power-up'],
      ['Custom Avatar Frame', 'A golden frame around your avatar', 'fas fa-crown', 400, 'cosmetic'],
      ['Habit Slot Unlock', 'Track one additional habit', 'fas fa-plus-circle', 250, 'utility'],
      ['Analytics Pro', 'Unlock advanced analytics for 7 days', 'fas fa-chart-line', 350, 'utility'],
      ['Challenge Boost', 'Start a challenge with +1 day advantage', 'fas fa-rocket', 450, 'power-up'],
    ];
    for (const r of rewards) {
      seedRun('INSERT INTO rewards (name, description, icon, cost_coins, category) VALUES (?, ?, ?, ?, ?)', r);
    }
  }

  // Seed default achievements
  const achCount = db.exec('SELECT COUNT(*) as count FROM achievements')[0];
  if (achCount && achCount.values[0][0] === 0) {
    const achievements = [
      ['First Step', 'Complete your first habit', 'fas fa-footprints', 10, 'total_completions', 1],
      ['Getting Started', 'Complete 10 habits', 'fas fa-seedling', 25, 'total_completions', 10],
      ['Dedicated', 'Complete 50 habits', 'fas fa-dumbbell', 50, 'total_completions', 50],
      ['Habit Master', 'Complete 100 habits', 'fas fa-medal', 100, 'total_completions', 100],
      ['Streak Starter', 'Maintain a 3-day streak', 'fas fa-fire', 20, 'streak', 3],
      ['On Fire', 'Maintain a 7-day streak', 'fas fa-fire-flame-curved', 50, 'streak', 7],
      ['Unstoppable', 'Maintain a 30-day streak', 'fas fa-gem', 200, 'streak', 30],
      ['Century Run', 'Maintain a 100-day streak', 'fas fa-trophy', 500, 'streak', 100],
      ['Social Butterfly', 'Add 3 friends', 'fas fa-users', 30, 'friends', 3],
      ['Challenger', 'Complete 5 challenges', 'fas fa-fist-raised', 75, 'challenges', 5],
      ['Wealthy', 'Accumulate 1000 coins', 'fas fa-coins', 50, 'coins', 1000],
      ['Level 5', 'Reach level 5', 'fas fa-star', 100, 'level', 5],
    ];
    for (const a of achievements) {
      seedRun('INSERT INTO achievements (name, description, icon, xp_reward, requirement_type, requirement_value) VALUES (?, ?, ?, ?, ?, ?)', a);
    }
  }

  // Seed demo users
  const userCount = db.exec('SELECT COUNT(*) as count FROM users')[0];
  if (userCount && userCount.values[0][0] === 0) {
    const hashedPw = bcrypt.hashSync('password123', 10);
    const demoUsers = [
      ['alex_dev', 'alex@example.com', hashedPw, 'Alex Johnson', 2450, 780, 8, 14, 21, 156],
      ['sarah_fit', 'sarah@example.com', hashedPw, 'Sarah Chen', 3200, 1200, 10, 25, 30, 210],
      ['mike_reads', 'mike@example.com', hashedPw, 'Mike Rivera', 1800, 450, 6, 7, 15, 98],
      ['emma_code', 'emma@example.com', hashedPw, 'Emma Wilson', 4100, 2100, 12, 42, 42, 305],
      ['james_run', 'james@example.com', hashedPw, 'James Park', 1200, 320, 4, 3, 10, 67],
      ['demo', 'demo@example.com', hashedPw, 'Demo User', 500, 250, 3, 5, 8, 35],
    ];
    for (const u of demoUsers) {
      seedRun('INSERT INTO users (username, email, password, display_name, xp, coins, level, current_streak, longest_streak, total_habits_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', u);
    }

    // Get demo user id
    const demoRow = seedQuery("SELECT id FROM users WHERE username = 'demo'")[0];
    const demoUserId = demoRow.id;

    // Seed demo habits
    const demoHabits = [
      [demoUserId, 'Morning Meditation', '10 minutes of mindfulness', 'fas fa-spa', '#6C5CE7', 15, 8, 'wellness'],
      [demoUserId, 'Read 30 Pages', 'Read at least 30 pages of a book', 'fas fa-book', '#00B894', 20, 10, 'learning'],
      [demoUserId, 'Exercise', '30 minutes of physical activity', 'fas fa-dumbbell', '#E17055', 25, 12, 'fitness'],
      [demoUserId, 'Drink Water', 'Drink 8 glasses of water', 'fas fa-tint', '#0984E3', 10, 5, 'health'],
      [demoUserId, 'Code Practice', 'Solve 1 coding problem', 'fas fa-laptop-code', '#FDCB6E', 20, 10, 'learning'],
    ];
    for (const h of demoHabits) {
      seedRun('INSERT INTO habits (user_id, name, description, icon, color, xp_reward, coin_reward, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', h);
    }

    // Seed some completions for the past 7 days
    const habits = seedQuery('SELECT id FROM habits WHERE user_id = ?', [demoUserId]);
    const habitIds = habits.map(h => h.id);
    for (let daysAgo = 7; daysAgo >= 1; daysAgo--) {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      const dateKey = d.toISOString().split('T')[0];
      for (const habitId of habitIds) {
        if (Math.random() > 0.3) {
          try {
            seedRun('INSERT INTO habit_completions (habit_id, user_id, date_key, completed_at) VALUES (?, ?, ?, ?)',
              [habitId, demoUserId, dateKey, d.toISOString()]);
          } catch (e) { /* ignore duplicate */ }
        }
      }
    }

    // Seed friendships for demo user
    const otherUsers = seedQuery("SELECT id FROM users WHERE username != 'demo'");
    for (let i = 0; i < Math.min(3, otherUsers.length); i++) {
      try {
        seedRun('INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, ?)', [demoUserId, otherUsers[i].id, 'accepted']);
        seedRun('INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, ?)', [otherUsers[i].id, demoUserId, 'accepted']);
      } catch (e) { /* ignore duplicate */ }
    }
  }

  saveDb();
  console.log('✅ Database initialized successfully');
}

// Helper functions to make queries easier using prepared statements
// IMPORTANT: sql.js's db.exec() does NOT support bind parameters.
// We must use db.prepare().bind() for parameterized queries.
function queryAll(sql, params = []) {
  let stmt;
  try {
    stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      rows.push(row);
    }
    return rows;
  } catch (e) {
    console.error('queryAll error:', e.message, sql);
    return [];
  } finally {
    if (stmt) stmt.free();
  }
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length ? rows[0] : null;
}

function runSql(sql, params = []) {
  try {
    if (params.length > 0) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();
    } else {
      db.run(sql);
    }
    // Get last insert ID and rows modified
    const lastIdResult = db.exec('SELECT last_insert_rowid() as id');
    const lastId = lastIdResult[0] ? lastIdResult[0].values[0][0] : 0;
    const changes = db.getRowsModified ? db.getRowsModified() : 0;
    saveDb();
    return { changes, lastId };
  } catch (e) {
    console.error('runSql error:', e.message, sql);
    throw e;
  }
}

function getLastInsertId() {
  const result = db.exec('SELECT last_insert_rowid() as id');
  return result[0] ? result[0].values[0][0] : 0;
}

module.exports = { getDb, initializeDatabase, saveDb, queryAll, queryOne, runSql };
