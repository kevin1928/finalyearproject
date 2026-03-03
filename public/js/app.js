// ==========================================
// HABIT ECONOMY — Frontend Application
// ==========================================

const API = '';
let token = localStorage.getItem('habit_token');
let currentUser = null;
let currentPage = 'dashboard';
let dashboardChart = null;
let weeklyChart = null;
let monthlyChart = null;

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

async function api(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        const res = await fetch(`${API}${endpoint}`, { ...options, headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    } catch (err) {
        if (err.message.includes('Invalid token') || err.message.includes('No token')) {
            logout();
        }
        throw err;
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = { success: '<i class="fas fa-check-circle"></i>', error: '<i class="fas fa-times-circle"></i>', info: '<i class="fas fa-info-circle"></i>', achievement: '<i class="fas fa-trophy"></i>' };
    toast.innerHTML = `<span>${icons[type] || '<i class="fas fa-info-circle"></i>'}</span><span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}

function showXpPopup(xp) {
    const popup = document.getElementById('xp-popup');
    popup.querySelector('.xp-popup-text').textContent = `+${xp} XP`;
    popup.style.display = 'block';
    setTimeout(() => { popup.style.display = 'none'; }, 1200);
}

function showLevelUp(level) {
    const modal = document.getElementById('level-up-modal');
    document.getElementById('level-up-text').textContent = `Level ${level}`;
    modal.style.display = 'flex';
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning!';
    if (h < 17) return 'Good afternoon!';
    return 'Good evening!';
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// ==========================================
// AUTH
// ==========================================

async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) return showToast('Please fill all fields', 'error');

    try {
        const data = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('habit_token', token);
        showApp();
        showToast('Welcome back, ' + currentUser.display_name + '!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function register() {
    const display_name = document.getElementById('reg-display-name').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!display_name || !username || !email || !password) return showToast('All fields are required', 'error');
    if (password.length < 6) return showToast('Password must be at least 6 characters', 'error');

    try {
        const data = await api('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ display_name, username, email, password })
        });
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('habit_token', token);
        showApp();
        showToast('Welcome to Habit Economy, ' + currentUser.display_name + '! <i class="fas fa-party-horn"></i>', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('habit_token');
    document.getElementById('app').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
}

// ==========================================
// APP INITIALIZATION
// ==========================================

async function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';

    try {
        currentUser = await api('/api/auth/me');
        updateSidebar();
        navigateTo('dashboard');
    } catch (err) {
        logout();
    }
}

function updateSidebar() {
    if (!currentUser) return;
    document.getElementById('sidebar-name').textContent = currentUser.display_name;
    document.getElementById('sidebar-level').textContent = `Level ${currentUser.level}`;

    // Avatar
    const avatarEl = document.getElementById('sidebar-avatar');
    if (currentUser.avatar_url) {
        avatarEl.style.backgroundImage = `url(${currentUser.avatar_url})`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
        avatarEl.textContent = '';
    } else {
        avatarEl.style.backgroundImage = 'none';
        avatarEl.textContent = currentUser.display_name.charAt(0).toUpperCase();
    }

    document.getElementById('sidebar-xp').textContent = formatNumber(currentUser.xp);
    document.querySelector('#sidebar-coins .coin-count').textContent = formatNumber(currentUser.coins);

    // XP progress to next level
    const nextLevelXp = Math.pow(currentUser.level, 2) * 100;
    const currentLevelXp = Math.pow(currentUser.level - 1, 2) * 100;
    const progress = ((currentUser.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;
    document.getElementById('sidebar-xp-fill').style.width = Math.min(progress, 100) + '%';
}

// ==========================================
// NAVIGATION
// ==========================================

function navigateTo(page) {
    currentPage = page;

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });

    // Show page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    // Close mobile nav
    document.getElementById('sidebar').classList.remove('open');

    // Load page data
    switch (page) {
        case 'dashboard': loadDashboard(); break;
        case 'profile': loadProfile(); break;
        case 'habits': loadHabitsPage(); break;
        case 'analytics': loadAnalytics(); break;
        case 'leaderboard': loadLeaderboard('xp'); break;
        case 'friends': loadFriends(); break;
        case 'challenges': loadChallenges(); break;
        case 'rewards': loadRewards(); break;
        case 'achievements': loadAchievements(); break;
    }
}

// ==========================================
// DASHBOARD
// ==========================================

async function loadDashboard() {
    document.getElementById('greeting-title').textContent = getGreeting();

    // Update stats
    document.getElementById('dash-xp').textContent = formatNumber(currentUser.xp);
    document.getElementById('dash-coins').textContent = formatNumber(currentUser.coins);
    document.getElementById('dash-total-habits').textContent = formatNumber(currentUser.total_habits_completed);
    document.querySelector('#stat-streak .stat-value').textContent = currentUser.current_streak;
    document.querySelector('#stat-level .stat-value').textContent = currentUser.level;

    // Load habits
    try {
        const habits = await api('/api/habits');
        const container = document.getElementById('dashboard-habits-list');

        if (habits.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon"><i class="fas fa-sparkles"></i></span>
          <div class="empty-state-title">No habits yet</div>
          <div class="empty-state-desc">Create your first habit to get started!</div>
        </div>`;
            return;
        }

        const completedCount = habits.filter(h => h.completed_today).length;
        document.getElementById('dash-completed').textContent = `${completedCount}/${habits.length}`;

        // Update progress ring
        const pct = habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0;
        const circle = document.getElementById('progress-circle');
        const circumference = 2 * Math.PI * 42;
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = circumference - (pct / 100) * circumference;
        document.getElementById('progress-text').textContent = pct + '%';

        container.innerHTML = habits.map(habit => `
      <div class="habit-item ${habit.completed_today ? 'completed' : ''}" 
           data-habit-id="${habit.id}" onclick="toggleHabit('${habit.id}', ${habit.completed_today ? 'true' : 'false'})">
        <div class="habit-check">${habit.completed_today ? '<i class="fas fa-check"></i>' : ''}</div>
        <div class="habit-icon"><i class="${habit.icon}"></i></div>
        <div class="habit-info">
          <div class="habit-name">${habit.name}</div>
          <div class="habit-desc">${habit.description}</div>
        </div>
        <div class="habit-rewards">
          <span class="habit-reward-tag reward-xp"><i class="fas fa-bolt"></i> ${habit.xp_reward} XP</span>
          <span class="habit-reward-tag reward-coin"><i class="fas fa-coins"></i> ${habit.coin_reward}</span>
        </div>
      </div>
    `).join('');

        // Load weekly chart
        loadDashboardChart();
    } catch (err) {
        showToast('Failed to load habits', 'error');
    }
}

async function loadDashboardChart() {
    try {
        const data = await api('/api/analytics/weekly');
        const ctx = document.getElementById('dashboard-chart').getContext('2d');

        if (dashboardChart) dashboardChart.destroy();

        dashboardChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.day),
                datasets: [{
                    label: 'Completion %',
                    data: data.map(d => d.percentage),
                    backgroundColor: data.map(d => {
                        const pct = d.percentage;
                        if (pct >= 100) return 'rgba(0, 184, 148, 0.7)';
                        if (pct >= 50) return 'rgba(108, 92, 231, 0.7)';
                        return 'rgba(225, 112, 85, 0.5)';
                    }),
                    hoverBackgroundColor: data.map(d => {
                        const pct = d.percentage;
                        if (pct >= 100) return 'rgba(0, 184, 148, 0.9)';
                        if (pct >= 50) return 'rgba(108, 92, 231, 0.9)';
                        return 'rgba(225, 112, 85, 0.7)';
                    }),
                    borderRadius: 8,
                    borderSkipped: false,
                    barThickness: 24
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1a1f35',
                        titleColor: '#f1f5f9',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(148, 163, 184, 0.1)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: (context) => ` ${context.parsed.y}% Completed`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(148, 163, 184, 0.05)', drawBorder: false },
                        ticks: {
                            color: '#64748b',
                            font: { size: 10 },
                            stepSize: 25,
                            callback: (value) => value + '%'
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8', font: { size: 11, weight: 600 } }
                    }
                }
            }
        });
    } catch (err) {
        console.error('Chart error:', err);
    }
}

// ==========================================
// TOGGLE HABIT COMPLETION
// ==========================================

async function toggleHabit(habitId, isCompleted) {
    try {
        if (isCompleted) {
            const result = await api(`/api/habits/${habitId}/uncomplete`, { method: 'POST' });
            currentUser = result.user;
            showToast('Habit unchecked', 'info');
        } else {
            const result = await api(`/api/habits/${habitId}/complete`, { method: 'POST' });
            currentUser = result.user;
            showXpPopup(result.xp_earned);
            showToast(`+${result.xp_earned} XP, +${result.coins_earned} coins!`, 'success');

            if (result.streak_bonus > 0) {
                setTimeout(() => showToast(`<i class="fas fa-fire"></i> Streak bonus: +${result.streak_bonus} XP!`, 'info'), 800);
            }

            if (result.level_up) {
                setTimeout(() => showLevelUp(currentUser.level), 1500);
            }

            if (result.new_achievements && result.new_achievements.length > 0) {
                result.new_achievements.forEach((ach, i) => {
                    setTimeout(() => showToast(`<i class="${ach.icon}"></i> Achievement: ${ach.name}!`, 'achievement'), 2000 + i * 500);
                });
            }
        }

        updateSidebar();
        loadDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ==========================================
// HABITS PAGE
// ==========================================

async function loadHabitsPage() {
    try {
        const habits = await api('/api/habits');
        const container = document.getElementById('habits-page-list');

        if (habits.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon"><i class="fas fa-star"></i></span>
          <div class="empty-state-title">No habits yet</div>
          <div class="empty-state-desc">Click "New Habit" to create your first one!</div>
        </div>`;
            return;
        }

        container.innerHTML = habits.map(habit => `
      <div class="habit-card" style="border-top: 3px solid ${habit.color}">
        <div class="habit-card-header">
          <div class="habit-card-icon" style="background: ${habit.color}22"><i class="${habit.icon}"></i></div>
          <div>
            <div class="habit-card-title">${habit.name}</div>
            <div class="habit-card-category">${habit.category}</div>
          </div>
        </div>
        <div class="habit-card-desc">${habit.description || 'No description'}</div>
        <div class="habit-card-footer">
          <div class="habit-rewards">
            <span class="habit-reward-tag reward-xp"><i class="fas fa-bolt"></i> ${habit.xp_reward}</span>
            <span class="habit-reward-tag reward-coin"><i class="fas fa-coins"></i> ${habit.coin_reward}</span>
          </div>
          <div class="habit-card-actions">
            <button class="delete-habit-btn" onclick="deleteHabit('${habit.id}')" title="Delete habit"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>
    `).join('');
    } catch (err) {
        showToast('Failed to load habits', 'error');
    }
}

async function createHabit() {
    const name = document.getElementById('habit-name-input').value.trim();
    const description = document.getElementById('habit-desc-input').value.trim();
    const category = document.getElementById('habit-category-input').value;
    const xp_reward = parseInt(document.getElementById('habit-xp-input').value) || 10;

    const selectedIcon = document.querySelector('#icon-picker .icon-option.selected');
    const selectedColor = document.querySelector('#color-picker .color-option.selected');
    const icon = selectedIcon ? selectedIcon.dataset.icon : 'fas fa-star';
    const color = selectedColor ? selectedColor.dataset.color : '#6C5CE7';

    if (!name) return showToast('Habit name is required', 'error');

    try {
        await api('/api/habits', {
            method: 'POST',
            body: JSON.stringify({ name, description, icon, color, category, xp_reward, coin_reward: Math.floor(xp_reward / 2) })
        });
        showToast('Habit created! <i class="fas fa-party-horn"></i>', 'success');
        closeModal('add-habit-modal');
        loadHabitsPage();

        // Clear form
        document.getElementById('habit-name-input').value = '';
        document.getElementById('habit-desc-input').value = '';
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteHabit(habitId) {
    if (!confirm('Delete this habit?')) return;
    try {
        await api(`/api/habits/${habitId}`, { method: 'DELETE' });
        showToast('Habit deleted', 'info');
        loadHabitsPage();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ==========================================
// ANALYTICS
// ==========================================

async function loadAnalytics() {
    try {
        // Update summary stats from currentUser
        document.getElementById('summary-total-done').textContent = formatNumber(currentUser.total_habits_completed);
        document.getElementById('summary-longest-streak').textContent = formatNumber(currentUser.longest_streak);

        // Weekly chart
        const weeklyData = await api('/api/analytics/weekly');

        // Calculate average completion from weekly data
        const avgComp = weeklyData.length > 0
            ? Math.round(weeklyData.reduce((acc, d) => acc + d.percentage, 0) / weeklyData.length)
            : 0;
        document.getElementById('summary-avg-completion').textContent = avgComp + '%';

        const wCtx = document.getElementById('weekly-chart').getContext('2d');
        if (weeklyChart) weeklyChart.destroy();
        weeklyChart = new Chart(wCtx, {
            type: 'line',
            data: {
                labels: weeklyData.map(d => d.day),
                datasets: [{
                    label: 'Completion %',
                    data: weeklyData.map(d => d.percentage),
                    borderColor: '#6C5CE7',
                    backgroundColor: 'rgba(108, 92, 231, 0.15)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#6C5CE7',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1a1f35',
                        titleColor: '#f1f5f9',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(148, 163, 184, 0.1)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: (context) => ` ${context.parsed.y}% Completed`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(148, 163, 184, 0.05)' },
                        ticks: { color: '#64748b', callback: (value) => value + '%' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8', font: { weight: 600 } }
                    }
                }
            }
        });

        // Monthly chart
        const monthlyData = await api('/api/analytics/monthly');
        const mCtx = document.getElementById('monthly-chart').getContext('2d');
        if (monthlyChart) monthlyChart.destroy();
        monthlyChart = new Chart(mCtx, {
            type: 'bar',
            data: {
                labels: monthlyData.map(d => d.week),
                datasets: [{
                    label: 'Completed',
                    data: monthlyData.map(d => d.completed),
                    backgroundColor: 'rgba(0, 184, 148, 0.7)',
                    borderRadius: 6,
                }, {
                    label: 'Total',
                    data: monthlyData.map(d => d.total),
                    backgroundColor: 'rgba(108, 92, 231, 0.3)',
                    borderRadius: 6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#94a3b8', font: { size: 11, weight: 600 }, padding: 20, usePointStyle: true }
                    },
                    tooltip: {
                        backgroundColor: '#1a1f35',
                        cornerRadius: 8,
                        padding: 12
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(148, 163, 184, 0.05)' },
                        ticks: { color: '#64748b' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8', font: { weight: 600 } }
                    }
                }
            }
        });

        // Habit performance
        const habitData = await api('/api/analytics/habits');
        const habitsContainer = document.getElementById('habit-analytics-list');

        // Update best habit summary
        if (habitData.length > 0) {
            const bestHabit = habitData.reduce((prev, current) => (prev.completion_rate > current.completion_rate) ? prev : current);
            document.getElementById('summary-best-habit').textContent = bestHabit.name;
        }

        if (habitData.length === 0) {
            habitsContainer.innerHTML = '<div class="empty-state"><span class="empty-state-icon"><i class="fas fa-chart-line"></i></span><div class="empty-state-title">No data yet</div></div>';
            return;
        }

        habitsContainer.innerHTML = habitData.map(h => `
      <div class="habit-analytics-item">
        <div class="habit-analytics-icon" style="color: ${h.color}"><i class="${h.icon}"></i></div>
        <div class="habit-analytics-info">
          <div class="habit-analytics-name">${h.name}</div>
          <div class="habit-analytics-stats">${h.total_completions} total • ${h.last_7_days}/7 this week</div>
        </div>
        <div class="habit-analytics-bar">
          <div class="analytics-bar-track">
            <div class="analytics-bar-fill" style="width: ${h.completion_rate}%; background: ${h.color}"></div>
          </div>
          <div class="analytics-bar-label">${h.completion_rate}%</div>
        </div>
      </div>
    `).join('');
    } catch (err) {
        showToast('Failed to load analytics', 'error');
    }
}

// ==========================================
// LEADERBOARD
// ==========================================

async function loadLeaderboard(type = 'xp') {
    try {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        const data = await api(`/api/leaderboard?type=${type}`);
        const container = document.getElementById('leaderboard-list');

        const statLabels = { xp: 'XP', streak: 'Streak', coins: 'Coins', completions: 'Done' };
        const statKeys = { xp: 'xp', streak: 'current_streak', coins: 'coins', completions: 'total_habits_completed' };

        container.innerHTML = data.map(user => {
            const isMe = currentUser && user.id === currentUser.id;
            const rankClass = user.rank <= 3 ? `top-3 rank-${user.rank}` : '';
            const medals = { 1: '<i class="fas fa-medal" style="color:#FFD700"></i>', 2: '<i class="fas fa-medal" style="color:#C0C0C0"></i>', 3: '<i class="fas fa-medal" style="color:#CD7F32"></i>' };

            return `
        <div class="leaderboard-row ${rankClass} ${isMe ? 'is-me' : ''}">
          <div class="lb-rank">${medals[user.rank] || user.rank}</div>
          <div class="lb-avatar">${user.display_name.charAt(0).toUpperCase()}</div>
          <div class="lb-info">
            <div class="lb-name">${user.display_name} ${isMe ? '(You)' : ''}</div>
            <div class="lb-username">@${user.username} • Lvl ${user.level}</div>
          </div>
          <div class="lb-stat">
            <div class="lb-stat-value">${formatNumber(user[statKeys[type]])}</div>
            <div class="lb-stat-label">${statLabels[type]}</div>
          </div>
        </div>`;
        }).join('');
    } catch (err) {
        showToast('Failed to load leaderboard', 'error');
    }
}

// ==========================================
// FRIENDS
// ==========================================

async function loadFriends() {
    try {
        // Load friend requests
        const requests = await api('/api/friends/requests');
        const requestsContainer = document.getElementById('friend-requests-container');
        const requestsList = document.getElementById('friend-requests-list');

        if (requests.length > 0) {
            requestsContainer.style.display = 'block';
            requestsList.innerHTML = requests.map(r => `
        <div class="friend-request-card">
          <div class="friend-avatar">${r.display_name.charAt(0).toUpperCase()}</div>
          <div class="friend-info">
            <div class="friend-name">${r.display_name}</div>
            <div class="friend-meta">@${r.username} • Level ${r.level}</div>
          </div>
          <div class="friend-request-actions">
            <button class="btn btn-success btn-sm" onclick="acceptFriend('${r.request_id}')">Accept</button>
            <button class="btn btn-ghost btn-sm" onclick="rejectFriend('${r.request_id}')">Decline</button>
          </div>
        </div>
      `).join('');
        } else {
            requestsContainer.style.display = 'none';
        }

        // Load friends
        const friends = await api('/api/friends');
        const friendsList = document.getElementById('friends-list');

        if (friends.length === 0) {
            friendsList.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon"><i class="fas fa-users"></i></span>
          <div class="empty-state-title">No friends yet</div>
          <div class="empty-state-desc">Add friends by their username to compete!</div>
        </div>`;
            return;
        }

        friendsList.innerHTML = friends.map(f => `
      <div class="friend-card">
        <div class="friend-avatar">${f.display_name.charAt(0).toUpperCase()}</div>
        <div class="friend-info">
          <div class="friend-name">${f.display_name}</div>
          <div class="friend-meta">@${f.username} • Level ${f.level} • <i class="fas fa-fire"></i> ${f.current_streak}</div>
        </div>
      </div>
    `).join('');
    } catch (err) {
        showToast('Failed to load friends', 'error');
    }
}

async function addFriend() {
    const username = document.getElementById('add-friend-input').value.trim();
    if (!username) return showToast('Enter a username', 'error');

    try {
        await api('/api/friends/add', {
            method: 'POST',
            body: JSON.stringify({ username })
        });
        showToast('Friend request sent! <i class="fas fa-paper-plane"></i>', 'success');
        document.getElementById('add-friend-input').value = '';
        loadFriends();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function acceptFriend(requestId) {
    try {
        await api(`/api/friends/accept/${requestId}`, { method: 'POST' });
        showToast('Friend request accepted! <i class="fas fa-handshake"></i>', 'success');
        loadFriends();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function rejectFriend(requestId) {
    try {
        await api(`/api/friends/reject/${requestId}`, { method: 'POST' });
        showToast('Request declined', 'info');
        loadFriends();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ==========================================
// CHALLENGES
// ==========================================

async function loadChallenges() {
    try {
        const challenges = await api('/api/challenges');
        const container = document.getElementById('challenges-list');

        if (challenges.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon"><i class="fas fa-fist-raised"></i></span>
          <div class="empty-state-title">No challenges yet</div>
          <div class="empty-state-desc">Challenge a friend to stay motivated!</div>
        </div>`;
            return;
        }

        container.innerHTML = challenges.map(c => {
            const maxProgress = c.target_days;
            const creatorPct = Math.min((c.creator_progress / maxProgress) * 100, 100);
            const challengerPct = Math.min((c.challenger_progress / maxProgress) * 100, 100);
            const isPending = c.status === 'pending';
            const isChallenger = c.challenger_id === currentUser.id;

            return `
        <div class="challenge-card status-${c.status}">
          <span class="challenge-status">${c.status}</span>
          <div class="challenge-title">${c.habit_name}</div>
          <div class="challenge-participants">
            ${c.creator_name} vs ${c.challenger_name} • ${c.target_days} days
          </div>
          ${c.description ? `<div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px">${c.description}</div>` : ''}
          <div class="challenge-progress">
            <div class="challenge-progress-bar">
              <div class="cp-label">
                <span>${c.creator_name}</span>
                <span>${c.creator_progress}/${maxProgress}</span>
              </div>
              <div class="cp-track"><div class="cp-fill creator" style="width:${creatorPct}%"></div></div>
            </div>
            <div class="challenge-progress-bar">
              <div class="cp-label">
                <span>${c.challenger_name}</span>
                <span>${c.challenger_progress}/${maxProgress}</span>
              </div>
              <div class="cp-track"><div class="cp-fill challenger" style="width:${challengerPct}%"></div></div>
            </div>
          </div>
          <div class="challenge-footer">
            <div class="challenge-reward"><i class="fas fa-bolt"></i> ${c.xp_reward} XP • <i class="fas fa-coins"></i> ${c.coin_reward}</div>
            ${isPending && isChallenger ? `<button class="btn btn-success btn-sm" onclick="acceptChallenge('${c.id}')">Accept</button>` : ''}
            ${c.status === 'active' ? `<button class="btn btn-primary btn-sm" onclick="progressChallenge('${c.id}')">+1 Day</button>` : ''}
            ${c.status === 'completed' && c.winner_id ? `<span style="font-weight:700;color:var(--accent-warning)"><i class="fas fa-trophy"></i> ${c.winner_id === c.creator_id ? c.creator_name : c.challenger_name} wins!</span>` : ''}
          </div>
        </div>`;
        }).join('');
    } catch (err) {
        showToast('Failed to load challenges', 'error');
    }
}

async function createChallenge() {
    const challenger_username = document.getElementById('challenge-user-input').value.trim();
    const habit_name = document.getElementById('challenge-habit-input').value.trim();
    const description = document.getElementById('challenge-desc-input').value.trim();
    const target_days = parseInt(document.getElementById('challenge-days-input').value) || 7;
    const xp_reward = parseInt(document.getElementById('challenge-xp-input').value) || 100;

    if (!challenger_username || !habit_name) return showToast('Username and habit name required', 'error');

    try {
        await api('/api/challenges', {
            method: 'POST',
            body: JSON.stringify({ challenger_username, habit_name, description, target_days, xp_reward, coin_reward: Math.floor(xp_reward / 2) })
        });
        showToast('Challenge sent! <i class="fas fa-fist-raised"></i>', 'success');
        closeModal('challenge-modal');
        loadChallenges();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function acceptChallenge(id) {
    try {
        await api(`/api/challenges/${id}/accept`, { method: 'POST' });
        showToast('Challenge accepted! <i class="fas fa-fire"></i>', 'success');
        loadChallenges();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function progressChallenge(id) {
    try {
        await api(`/api/challenges/${id}/progress`, { method: 'POST' });
        showToast('Progress updated! <i class="fas fa-dumbbell"></i>', 'success');
        loadChallenges();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ==========================================
// REWARDS
// ==========================================

async function loadRewards() {
    try {
        const rewards = await api('/api/rewards');
        document.querySelector('#rewards-coins .coin-count').textContent = formatNumber(currentUser.coins);

        const container = document.getElementById('rewards-list');
        container.innerHTML = rewards.map(r => `
      <div class="reward-card ${r.purchased ? 'purchased' : ''}">
        <span class="reward-icon"><i class="${r.icon}"></i></span>
        <div class="reward-name">${r.name}</div>
        <div class="reward-desc">${r.description}</div>
        <div class="reward-price"><i class="fas fa-coins"></i> ${r.cost_coins}</div>
        ${!r.purchased ? `<button class="btn btn-primary btn-sm" onclick="purchaseReward('${r.id}')" ${currentUser.coins < r.cost_coins ? 'disabled style="opacity:0.4;cursor:not-allowed"' : ''}>
          ${currentUser.coins < r.cost_coins ? 'Not Enough Coins' : 'Purchase'}
        </button>` : ''}
      </div>
    `).join('');
    } catch (err) {
        showToast('Failed to load rewards', 'error');
    }
}

async function purchaseReward(id) {
    if (!confirm('Purchase this reward?')) return;
    try {
        const result = await api(`/api/rewards/${id}/purchase`, { method: 'POST' });
        currentUser = result.user;
        updateSidebar();
        showToast('Reward purchased! <i class="fas fa-party-horn"></i>', 'success');
        loadRewards();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ==========================================
// ACHIEVEMENTS
// ==========================================

async function loadAchievements() {
    try {
        const achievements = await api('/api/achievements');
        const container = document.getElementById('achievements-list');

        container.innerHTML = achievements.map(a => `
      <div class="achievement-card ${a.unlocked ? 'unlocked' : 'locked'}">
        <div class="achievement-icon-box"><i class="${a.icon}"></i></div>
        <div class="achievement-info">
          <div class="achievement-name">${a.name}</div>
          <div class="achievement-desc">${a.description}</div>
          <div class="achievement-xp">+${a.xp_reward} XP</div>
        </div>
      </div>
    `).join('');
    } catch (err) {
        showToast('Failed to load achievements', 'error');
    }
}

// ==========================================
// PROFILE
// ==========================================

async function loadProfile() {
    try {
        const user = await api('/api/user/profile');
        currentUser = user; // Update local user data
        updateSidebar();

        // Update profile display
        document.getElementById('profile-display-name').textContent = user.display_name;
        document.getElementById('profile-username').textContent = `@${user.username}`;
        document.getElementById('profile-level').textContent = user.level;
        document.getElementById('profile-xp').textContent = formatNumber(user.xp);
        document.getElementById('profile-coins').textContent = formatNumber(user.coins);
        document.getElementById('profile-streak-current').textContent = user.current_streak;
        document.getElementById('profile-streak-longest').textContent = user.longest_streak;
        document.getElementById('profile-total-completions').textContent = formatNumber(user.total_habits_completed);

        // Dates
        const createdDate = new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('profile-member-since').textContent = createdDate;

        const lastActive = new Date(user.last_active).toLocaleString();
        document.getElementById('profile-last-active').textContent = lastActive;

        // Avatar
        const avatarEl = document.getElementById('profile-avatar-display');
        if (user.avatar_url) {
            avatarEl.style.backgroundImage = `url(${user.avatar_url})`;
            avatarEl.style.backgroundSize = 'cover';
            avatarEl.style.backgroundPosition = 'center';
            avatarEl.textContent = '';
        } else {
            avatarEl.style.backgroundImage = 'none';
            avatarEl.textContent = user.display_name.charAt(0).toUpperCase();
        }

        // Fill form
        document.getElementById('profile-edit-name').value = user.display_name;
        document.getElementById('profile-edit-email').value = user.email;
        document.getElementById('profile-edit-avatar').value = user.avatar_url || '';

    } catch (err) {
        showToast('Failed to load profile', 'error');
    }
}

async function updateProfile(e) {
    if (e) e.preventDefault();
    const display_name = document.getElementById('profile-edit-name').value.trim();
    const email = document.getElementById('profile-edit-email').value.trim();
    const avatar_url = document.getElementById('profile-edit-avatar').value.trim();

    if (!display_name || !email) return showToast('Name and email are required', 'error');

    try {
        const result = await api('/api/user/profile', {
            method: 'PUT',
            body: JSON.stringify({ display_name, email, avatar_url })
        });

        currentUser = result.user;
        showToast('Profile updated successfully!', 'success');
        loadProfile();
        updateSidebar();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ==========================================
// MODAL HELPERS
// ==========================================

function openModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

// ==========================================
// EVENT LISTENERS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Auth
    document.getElementById('login-btn').addEventListener('click', login);
    document.getElementById('register-btn').addEventListener('click', register);
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    });
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Enter key for login
    document.getElementById('login-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });
    document.getElementById('login-username').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });

    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });

    // Mobile nav
    document.getElementById('mobile-nav-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Habits modal
    document.getElementById('add-habit-btn').addEventListener('click', () => openModal('add-habit-modal'));
    document.getElementById('close-habit-modal').addEventListener('click', () => closeModal('add-habit-modal'));
    document.getElementById('cancel-habit-btn').addEventListener('click', () => closeModal('add-habit-modal'));
    document.getElementById('save-habit-btn').addEventListener('click', createHabit);

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            overlay.parentElement.style.display = 'none';
        });
    });

    // Icon picker
    document.querySelectorAll('#icon-picker .icon-option').forEach(icon => {
        icon.addEventListener('click', () => {
            document.querySelectorAll('#icon-picker .icon-option').forEach(i => i.classList.remove('selected'));
            icon.classList.add('selected');
        });
    });

    // Color picker
    document.querySelectorAll('#color-picker .color-option').forEach(color => {
        color.addEventListener('click', () => {
            document.querySelectorAll('#color-picker .color-option').forEach(c => c.classList.remove('selected'));
            color.classList.add('selected');
        });
    });

    // Leaderboard filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => loadLeaderboard(btn.dataset.type));
    });

    // Friends
    document.getElementById('add-friend-btn').addEventListener('click', addFriend);
    document.getElementById('add-friend-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addFriend();
    });

    // Challenges modal
    document.getElementById('create-challenge-btn').addEventListener('click', () => openModal('challenge-modal'));
    document.getElementById('close-challenge-modal').addEventListener('click', () => closeModal('challenge-modal'));
    document.getElementById('cancel-challenge-btn').addEventListener('click', () => closeModal('challenge-modal'));
    document.getElementById('send-challenge-btn').addEventListener('click', createChallenge);

    // Level up close
    document.getElementById('level-up-close').addEventListener('click', () => {
        document.getElementById('level-up-modal').style.display = 'none';
    });

    // Profile form
    document.getElementById('profile-update-form').addEventListener('submit', updateProfile);

    // Check auth on load
    if (token) {
        showApp();
    }
});
