'use strict';

var vocabulary = EMBEDDED_VOCABULARY, allWords = [];
    var filteredWords = [], currentIndex = 0, currentOrder = 'abc', defVisible = true;
    var spellWord = null, recallWord = null, matchWord = null, dictationWord = null;
    var errorWords = [], masteredWords = [], favoriteWords = [], learnTime = 0, streak = 0, todayLearned = 0;
    var learningTimer = null, lastDate = new Date().toDateString();
    var recallMode = 'reverse';
    var todayMastered = 0;
    var reviewData = {};
    var quizCorrect = 0, quizWrong = 0, quizWord = null;

    var StorageManager = {
        db: null,
        dbName: 'CET6Database',
        dbVersion: 1,
        
        init: function(callback) {
            var self = this;
            if (!window.indexedDB) {
                console.log('IndexedDB not supported, using localStorage');
                if (callback) callback();
                return;
            }
            
            var request = indexedDB.open(self.dbName, self.dbVersion);
            
            request.onupgradeneeded = function(event) {
                var db = event.target.result;
                if (!db.objectStoreNames.contains('appData')) {
                    db.createObjectStore('appData', { keyPath: 'key' });
                }
            };
            
            request.onsuccess = function(event) {
                self.db = event.target.result;
                console.log('IndexedDB initialized');
                self.migrateFromLocalStorage();
                if (callback) callback();
            };
            
            request.onerror = function(event) {
                console.log('IndexedDB error, falling back to localStorage');
                if (callback) callback();
            };
        },
        
        migrateFromLocalStorage: function() {
            var keys = ['cet6_data', 'cet6_settings', 'cet6_daily_history', 'cet6_notes', 'cet6_checkin', 'cet6_backups', 'cet6_achievements'];
            var self = this;
            
            keys.forEach(function(key) {
                var value = localStorage.getItem(key);
                if (value) {
                    self.set(key, value);
                }
            });
            console.log('Migration from localStorage complete');
        },
        
        get: function(key, callback) {
            if (!this.db) {
                var value = localStorage.getItem(key);
                if (callback) callback(value);
                return value;
            }
            
            var transaction = this.db.transaction(['appData'], 'readonly');
            var store = transaction.objectStore('appData');
            var request = store.get(key);
            
            request.onsuccess = function(event) {
                var result = event.target.result;
                var value = result ? result.value : null;
                if (callback) callback(value);
            };
            
            request.onerror = function() {
                var value = localStorage.getItem(key);
                if (callback) callback(value);
            };
        },
        
        set: function(key, value) {
            if (!this.db) {
                localStorage.setItem(key, value);
                return;
            }
            
            var transaction = this.db.transaction(['appData'], 'readwrite');
            var store = transaction.objectStore('appData');
            store.put({ key: key, value: value });
            localStorage.setItem(key, value);
        },
        
        remove: function(key) {
            if (!this.db) {
                localStorage.removeItem(key);
                return;
            }
            
            var transaction = this.db.transaction(['appData'], 'readwrite');
            var store = transaction.objectStore('appData');
            store.delete(key);
            localStorage.removeItem(key);
        }
    };

    window.onerror = function(msg, url, line, col, err) {
        var loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.innerHTML = '<div style="color:#dc2626;font-size:18px;margin-bottom:12px"> 页面加载出错</div>' +
                '<div style="color:#64748b;font-size:14px;margin-bottom:8px;word-break:break-all">' + (msg || '未知错误') + '</div>' +
                '<div style="color:#94a3b8;font-size:12px">行: ' + (line || '?') + ' 列: ' + (col || '?') + '</div>' +
                '<button onclick="location.reload()" style="margin-top:16px;padding:8px 20px;background:#4f46e5;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px">刷新页面</button>';
            loadingEl.style.display = 'block';
        }
        return false;
    };

    function $(id) { return document.getElementById(id); }
    window.$ = $;

    function showToast(msg, type) {
        type = type || 'info';
        var t = document.createElement('div');
        t.className = 'toast ' + type;
        t.textContent = msg;
        $('toastContainer').appendChild(t);
        setTimeout(function() { t.remove(); }, 2800);
    }

    function shuffle(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
        }
        return a;
    }

    function getDifficulty(w) {
        var len = w.length;
        if (len <= 5) return 'easy';
        if (len <= 8) return 'medium';
        return 'hard';
    }

    function loadData() {
        var d = JSON.parse(localStorage.getItem('cet6_data') || '{}');
        errorWords = d.errorWords || [];
        masteredWords = d.masteredWords || [];
        favoriteWords = d.favoriteWords || [];
        learnTime = d.learnTime || 0;
        streak = d.streak || 0;
        todayLearned = d.todayLearned || 0;
        lastDate = d.lastDate || new Date().toDateString();
        todayMastered = d.todayMastered || 0;
        reviewData = d.reviewData || {};

        var todayStr = new Date().toDateString();
        if (lastDate !== todayStr) {
            var yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastDate === yesterday.toDateString()) streak++;
            else streak = 1;
            todayLearned = 0;
            todayMastered = 0;
            lastDate = todayStr;
        }

        var s = JSON.parse(localStorage.getItem('cet6_settings') || '{}');
        if (s.dailyGoal) $('dailyGoal').value = s.dailyGoal;
        if (s.reminderTime) $('reminderTime').value = s.reminderTime;
        if (s.reminderEnabled !== undefined) $('reminderEnabled').checked = s.reminderEnabled;
        recallMode = localStorage.getItem('cet6_recallMode') || 'reverse';
    }

    function saveData() {
        localStorage.setItem('cet6_data', JSON.stringify({
            errorWords: errorWords, masteredWords: masteredWords, favoriteWords: favoriteWords,
            learnTime: learnTime, streak: streak, todayLearned: todayLearned,
            lastDate: lastDate, todayMastered: todayMastered, reviewData: reviewData
        }));
        var history = JSON.parse(localStorage.getItem('cet6_daily_history') || '{}');
        history[new Date().toISOString().slice(0, 10)] = todayLearned;
        localStorage.setItem('cet6_daily_history', JSON.stringify(history));
    }

    function saveSettings() {
        localStorage.setItem('cet6_settings', JSON.stringify({
            dailyGoal: $('dailyGoal').value,
            reminderTime: $('reminderTime').value,
            reminderEnabled: $('reminderEnabled').checked
        }));
        showToast('设置已保存', 'success');
    }

    var autoBackupTimer = null;

    function toggleAutoBackup() {
        var enabled = $('autoBackupEnabled').checked;
        localStorage.setItem('cet6_auto_backup', enabled ? '1' : '0');
        $('autoBackupLabel').textContent = enabled ? '开启' : '关闭';
        if (enabled) {
            startAutoBackup();
        } else {
            stopAutoBackup();
        }
    }

    function loadAutoBackupSetting() {
        var enabled = localStorage.getItem('cet6_auto_backup') === '1';
        if ($('autoBackupEnabled')) {
            $('autoBackupEnabled').checked = enabled;
            $('autoBackupLabel').textContent = enabled ? '开启' : '关闭';
        }
        updateBackupStatus();
        if (enabled) {
            startAutoBackup();
        }
    }

    function startAutoBackup() {
        stopAutoBackup();
        autoBackupTimer = setInterval(function() {
            createBackup('auto');
        }, 3600000);
        createBackup('auto');
    }

    function stopAutoBackup() {
        if (autoBackupTimer) {
            clearInterval(autoBackupTimer);
            autoBackupTimer = null;
        }
    }

    function createManualBackup() {
        createBackup('manual');
        showToast('备份已创建', 'success');
        updateBackupStatus();
    }

    function createBackup(type) {
        try {
            var backups = JSON.parse(localStorage.getItem('cet6_backups') || '[]');
            var backup = {
                time: new Date().toISOString(),
                type: type,
                data: {
                    errorWords: errorWords,
                    masteredWords: masteredWords,
                    favoriteWords: favoriteWords,
                    learnTime: learnTime,
                    streak: streak,
                    todayLearned: todayLearned,
                    lastDate: lastDate,
                    todayMastered: todayMastered,
                    reviewData: reviewData
                }
            };
            backups.push(backup);
            var sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            backups = backups.filter(function(b) {
                return new Date(b.time) > sevenDaysAgo;
            });
            localStorage.setItem('cet6_backups', JSON.stringify(backups));
            updateBackupStatus();
        } catch(e) {
            console.log('Backup error:', e);
        }
    }

    function updateBackupStatus() {
        var statusEl = $('backupStatus');
        if (!statusEl) return;
        try {
            var backups = JSON.parse(localStorage.getItem('cet6_backups') || '[]');
            if (backups.length === 0) {
                statusEl.textContent = '暂无备份';
            } else {
                var last = backups[backups.length - 1];
                var date = new Date(last.time);
                statusEl.textContent = '最近备份: ' + date.toLocaleDateString() + ' ' + date.toLocaleTimeString() + ' (' + backups.length + ' 个备份)';
            }
        } catch(e) {
            statusEl.textContent = '暂无备份';
        }
    }

    function restoreFromBackup() {
        try {
            var backups = JSON.parse(localStorage.getItem('cet6_backups') || '[]');
            if (backups.length === 0) {
                showToast('暂无备份可恢复', 'info');
                return;
            }
            var last = backups[backups.length - 1];
            if (!confirm('确定要恢复到最近的备份吗？\n\n备份时间: ' + new Date(last.time).toLocaleString() + '\n\n当前数据将被覆盖！')) return;

            var d = last.data;
            if (d.errorWords) errorWords = d.errorWords;
            if (d.masteredWords) masteredWords = d.masteredWords;
            if (d.favoriteWords) favoriteWords = d.favoriteWords;
            if (d.learnTime !== undefined) learnTime = d.learnTime;
            if (d.streak !== undefined) streak = d.streak;
            if (d.todayLearned !== undefined) todayLearned = d.todayLearned;
            if (d.lastDate) lastDate = d.lastDate;
            if (d.todayMastered !== undefined) todayMastered = d.todayMastered;
            if (d.reviewData) reviewData = d.reviewData;

            saveData();
            updateStats();
            showToast('数据已恢复到 ' + new Date(last.time).toLocaleDateString() + ' 的备份', 'success');
        } catch(e) {
            showToast('恢复失败: ' + e.message, 'error');
        }
    }

    function toggleAutoRead() {
        var enabled = $('autoReadToggle').checked;
        localStorage.setItem('cet6_auto_read', enabled ? '1' : '0');
        $('autoReadLabel').textContent = enabled ? '开启' : '关闭';
    }

    function loadAutoReadSetting() {
        var enabled = localStorage.getItem('cet6_auto_read') === '1';
        if ($('autoReadToggle')) {
            $('autoReadToggle').checked = enabled;
            $('autoReadLabel').textContent = enabled ? '开启' : '关闭';
        }
        var accent = localStorage.getItem('cet6_accent') || 'en-us';
        if ($('accentSelect')) $('accentSelect').value = accent;
        var rate = localStorage.getItem('cet6_rate') || '75';
        if ($('rateSlider')) {
            $('rateSlider').value = rate;
            $('rateValue').textContent = (rate / 100).toFixed(2) + 'x';
        }
    }

    function setAccent(accent) {
        localStorage.setItem('cet6_accent', accent);
        showToast('口音已切换: ' + (accent === 'en-us' ? '美式' : '英式'), 'success');
    }

    function setSpeechRate(rate) {
        localStorage.setItem('cet6_rate', rate);
    }

    var achievements = [
        { id: 'first_word', name: '初窥门径', desc: '学习第1个单词', icon: 'A', check: function() { return masteredWords.length >= 1; } },
        { id: 'master_10', name: '牛刀小试', desc: '掌握10个单词', icon: 'B', check: function() { return masteredWords.length >= 10; } },
        { id: 'master_50', name: '初露锋芒', desc: '掌握50个单词', icon: 'C', check: function() { return masteredWords.length >= 50; } },
        { id: 'master_100', name: '小有成就', desc: '掌握100个单词', icon: 'D', check: function() { return masteredWords.length >= 100; } },
        { id: 'master_500', name: '学有所成', desc: '掌握500个单词', icon: 'E', check: function() { return masteredWords.length >= 500; } },
        { id: 'master_1000', name: '融会贯通', desc: '掌握1000个单词', icon: 'F', check: function() { return masteredWords.length >= 1000; } },
        { id: 'master_2000', name: '学富五车', desc: '掌握2000个单词', icon: 'G', check: function() { return masteredWords.length >= 2000; } },
        { id: 'master_3000', name: '满腹经纶', desc: '掌握3000个单词', icon: 'H', check: function() { return masteredWords.length >= 3000; } },
        { id: 'master_all', name: '登峰造极', desc: '掌握全部词汇', icon: 'I', check: function() { return masteredWords.length >= vocabulary.length; } },
        { id: 'streak_3', name: '坚持不懈', desc: '连续学习3天', icon: 'J', check: function() { return streak >= 3; } },
        { id: 'streak_7', name: '持之以恒', desc: '连续学习7天', icon: 'K', check: function() { return streak >= 7; } },
        { id: 'streak_30', name: '锲而不舍', desc: '连续学习30天', icon: 'L', check: function() { return streak >= 30; } },
        { id: 'streak_100', name: '百折不挠', desc: '连续学习100天', icon: 'M', check: function() { return streak >= 100; } },
        { id: 'streak_365', name: '铁杵磨针', desc: '连续学习365天', icon: 'N', check: function() { return streak >= 365; } },
        { id: 'night_owl', name: '夜猫子', desc: '凌晨12点后学习', icon: 'O', check: function() { return localStorage.getItem('cet6_achievement_night_owl') === '1'; } },
        { id: 'early_bird', name: '早起鸟', desc: '早上6点前学习', icon: 'P', check: function() { return localStorage.getItem('cet6_achievement_early_bird') === '1'; } },
        { id: 'error_clear', name: '错词清零', desc: '将错词本清空', icon: 'Q', check: function() { return errorWords.length === 0 && masteredWords.length > 0; } },
        { id: 'favorite_10', name: '收藏达人', desc: '收藏10个单词', icon: 'R', check: function() { return favoriteWords.length >= 10; } },
        { id: 'today_50', name: '今日达标', desc: '单日学习50个单词', icon: 'S', check: function() { return todayLearned >= 50; } },
        { id: 'today_100', name: '超额完成', desc: '单日学习100个单词', icon: 'T', check: function() { return todayLearned >= 100; } }
    ];

    function checkAchievements() {
        var hour = new Date().getHours();
        if (hour >= 0 && hour < 6) localStorage.setItem('cet6_achievement_night_owl', '1');
        if (hour >= 5 && hour < 7) localStorage.setItem('cet6_achievement_early_bird', '1');
        var unlocked = JSON.parse(localStorage.getItem('cet6_achievements') || '[]');
        var newUnlocked = false;
        achievements.forEach(function(a) {
            if (unlocked.indexOf(a.id) === -1 && a.check()) {
                unlocked.push(a.id);
                newUnlocked = true;
                showToast('成就解锁: ' + a.name, 'success');
            }
        });
        if (newUnlocked) localStorage.setItem('cet6_achievements', JSON.stringify(unlocked));
    }

    function renderAchievements() {
        var container = $('achievementList');
        if (!container) return;
        var unlocked = JSON.parse(localStorage.getItem('cet6_achievements') || '[]');
        var unlockedCount = unlocked.length;
        var totalCount = achievements.length;
        
        var html = '<div class="flex items-center justify-between mb-3">';
        html += '<span class="text-sm text-gray-500">已解锁: ' + unlockedCount + ' / ' + totalCount + '</span>';
        html += '<button class="btn btn-outline btn-sm" onclick="toggleAchievementList()" id="btnToggleAchievement">展开全部</button>';
        html += '</div>';
        
        // 显示已解锁的成就
        html += '<div id="achievementUnlocked">';
        achievements.forEach(function(a) {
            var isUnlocked = unlocked.indexOf(a.id) !== -1;
            if (!isUnlocked) return;
            html += '<div class="flex items-center justify-between p-3 rounded mb-2" style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3)">';
            html += '<div class="flex items-center gap-3">';
            html += '<div class="w-10 h-10 rounded-full flex items-center justify-center font-bold" style="background:var(--primary);color:#fff">' + a.icon + '</div>';
            html += '<div><div class="font-medium">' + a.name + '</div><div class="text-sm text-gray-500">' + a.desc + '</div></div>';
            html += '</div>';
            html += '<span class="text-xs text-green-600">已解锁</span>';
            html += '</div>';
        });
        html += '</div>';
        
        // 隐藏未解锁的成就
        html += '<div id="achievementLocked" style="display:none">';
        achievements.forEach(function(a) {
            var isUnlocked = unlocked.indexOf(a.id) !== -1;
            if (isUnlocked) return;
            html += '<div class="flex items-center justify-between p-3 rounded mb-2" style="background:rgba(255,255,255,0.15);border:1px solid rgba(226,232,240,0.2);opacity:0.5">';
            html += '<div class="flex items-center gap-3">';
            html += '<div class="w-10 h-10 rounded-full flex items-center justify-center font-bold" style="background:var(--border-light);color:var(--text-tertiary)">' + a.icon + '</div>';
            html += '<div><div class="font-medium">' + a.name + '</div><div class="text-sm text-gray-500">' + a.desc + '</div></div>';
            html += '</div>';
            html += '<span class="text-xs text-gray-400">未解锁</span>';
            html += '</div>';
        });
        html += '</div>';
        
        container.innerHTML = html;
    }

    function toggleAchievementList() {
        var locked = document.getElementById('achievementLocked');
        var btn = document.getElementById('btnToggleAchievement');
        if (!locked || !btn) return;
        if (locked.style.display === 'none') {
            locked.style.display = 'block';
            btn.textContent = '收起';
        } else {
            locked.style.display = 'none';
            btn.textContent = '展开全部';
        }
    }

    var fontSize = localStorage.getItem('cet6_font_size') || '15';
        if ($('fontSizeSlider')) $('fontSizeSlider').value = fontSize;
        if ($('fontSizeValue')) $('fontSizeValue').textContent = fontSize + 'px';
        if ($('fontSizeSelect')) {
            var nearest = [14, 16, 18].reduce(function(a, b) { return Math.abs(a - Number(fontSize)) < Math.abs(b - Number(fontSize)) ? a : b; });
            $('fontSizeSelect').value = String(nearest);
        }
        document.documentElement.style.fontSize = fontSize + 'px';

    function setFontSize(size) {
        localStorage.setItem('cet6_font_size', size);
        document.documentElement.style.fontSize = size + 'px';
    }

    function populateLetterFilter() {
        var sel = $('filterLetter');
        var letters = [];
        for (var i = 0; i < vocabulary.length; i++) {
            var l = vocabulary[i].word.charAt(0).toUpperCase();
            if (letters.indexOf(l) === -1) letters.push(l);
        }
        letters.sort();
        for (var j = 0; j < letters.length; j++) {
            var opt = document.createElement('option');
            opt.value = letters[j];
            opt.textContent = letters[j];
            sel.appendChild(opt);
        }
    }

    function initLetterFilterFromExisting() {
        var container = $('filterLetterChips');
        if (!container) return;
        var html = '<span class="cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium" style="background:var(--primary);color:#fff" onclick="setFilterLetter(\'all\',this)">全部</span>';
        for (var code = 65; code <= 90; code++) {
            var letter = String.fromCharCode(code);
            var hasWords = false;
            for (var i = 0; i < vocabulary.length; i++) {
                if (vocabulary[i].word.charAt(0).toUpperCase() === letter) { hasWords = true; break; }
            }
            if (hasWords) {
                html += '<span class="cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium" style="background:rgba(255,255,255,0.3);border:1px solid var(--border)" onclick="setFilterLetter(\'' + letter + '\',this)">' + letter + '</span>';
            }
        }
        container.innerHTML = html;
    }

    function toggleMobileMenu() {
        $('mobileMenu').classList.toggle('hidden');
    }

    function switchTab(tab) {
        // 新版 tabbar (.wd1-tabbar / .td-tabbar button[data-screen])
        var allTabs = document.querySelectorAll('.nav-tab, .bottom-nav-item, .wd1-tabbar button[data-screen], .td-tabbar button[data-screen]');
        for (var i = 0; i < allTabs.length; i++) { allTabs[i].classList.remove('active'); }
        // 旧版 tab-content + 新版 app-screen
        var allContent = document.querySelectorAll('.tab-content, .app-screen');
        for (var j = 0; j < allContent.length; j++) {
            allContent[j].classList.remove('active');
            allContent[j].style.display = 'none';
        }

        var tabEls = document.querySelectorAll('.nav-tab[data-tab="' + tab + '"], .bottom-nav-item[data-tab="' + tab + '"], .wd1-tabbar button[data-screen="' + tab + '"], .td-tabbar button[data-screen="' + tab + '"]');
        for (var k = 0; k < tabEls.length; k++) { tabEls[k].classList.add('active'); }

        // Try old ID first, then new screen-xxx pattern
        var content = $(tab) || document.getElementById('screen-' + tab);
        if (content) {
            content.classList.add('active');
            content.style.display = 'block';
        }

        var mobileMenu = $('mobileMenu');
        if (mobileMenu) mobileMenu.classList.add('hidden');

        document.body.classList.toggle('memorize-mode', tab === 'memorize' || tab === 'screen-home');

        if (tab === 'stats') updateStats();
        if (tab === 'errors') renderErrors();
        if (tab === 'overview') { initOverviewFilters(); renderOverview(); }
        if (tab === 'memorize' || tab === 'screen-home') updateWordCard();
        if (tab === 'recall') {
            setRecallMode(recallMode);
        }
        if (tab === 'settings') { renderAchievements(); }
        if (tab === 'notes') { renderNotesList(); }
    }

    function setOrder(order) {
        currentOrder = order;
        if (order === 'abc') {
            filteredWords.sort(function(a, b) { return a.word.localeCompare(b.word); });
        } else if (order === 'random') {
            filteredWords = shuffle(filteredWords);
        } else if (order === 'reverse') {
            filteredWords.sort(function(a, b) { return b.word.localeCompare(a.word); });
        }
        currentIndex = 0;
        updateWordCard();
    }

    function toggleOrder() {
        if (currentOrder === 'abc') {
            setOrder('reverse');
        } else {
            setOrder('abc');
        }
    }

    function setOrderFromFilter(order, el) {
        var chips = el.parentNode.children;
        for (var i = 0; i < chips.length; i++) {
            chips[i].style.background = 'rgba(255,255,255,0.3)';
            chips[i].style.border = '1px solid var(--border)';
            chips[i].style.color = '';
        }
        el.style.background = 'var(--primary)';
        el.style.border = 'none';
        el.style.color = '#fff';
        setOrder(order);
    }

    function setLearningPath(path, el) {
        window._learningPath = path;
        var chips = el.parentNode.children;
        for (var i = 0; i < chips.length; i++) {
            chips[i].style.background = 'rgba(255,255,255,0.3)';
            chips[i].style.border = '1px solid var(--border)';
            chips[i].style.color = '';
        }
        el.style.background = 'var(--primary)';
        el.style.border = 'none';
        el.style.color = '#fff';
        applyFilter();
    }

    function applyFilter() {
        var letter = window._filterLetter || 'all';
        var status = window._filterStatus || 'all';
        var difficulty = window._filterDiff || 'all';
        var learningPath = window._learningPath || 'all';

        filteredWords = vocabulary.filter(function(w) {
            if (letter !== 'all' && !w.word.toUpperCase().startsWith(letter)) return false;
            if (status === 'mastered' && masteredWords.indexOf(w.word) === -1) return false;
            if (status === 'wrong' && !errorWords.some(function(e) { return e.word === w.word; })) return false;
            if (status === 'new' && (masteredWords.indexOf(w.word) !== -1 || errorWords.some(function(e) { return e.word === w.word; }))) return false;
            if (difficulty !== 'all' && getDifficulty(w.word) !== difficulty) return false;
            return true;
        });

        if (learningPath === 'easy-first') {
            filteredWords.sort(function(a, b) {
                var da = getDifficulty(a.word) === 'easy' ? 0 : getDifficulty(a.word) === 'medium' ? 1 : 2;
                var db = getDifficulty(b.word) === 'easy' ? 0 : getDifficulty(b.word) === 'medium' ? 1 : 2;
                return da - db || a.word.localeCompare(b.word);
            });
        } else if (learningPath === 'hard-first') {
            filteredWords.sort(function(a, b) {
                var da = getDifficulty(a.word) === 'hard' ? 0 : getDifficulty(a.word) === 'medium' ? 1 : 2;
                var db = getDifficulty(b.word) === 'hard' ? 0 : getDifficulty(b.word) === 'medium' ? 1 : 2;
                return da - db || a.word.localeCompare(b.word);
            });
        } else if (learningPath === 'new-first') {
            filteredWords.sort(function(a, b) {
                var sa = masteredWords.indexOf(a.word) === -1 && !errorWords.some(function(e) { return e.word === a.word; }) ? 0 : 1;
                var sb = masteredWords.indexOf(b.word) === -1 && !errorWords.some(function(e) { return e.word === b.word; }) ? 0 : 1;
                return sa - sb || a.word.localeCompare(b.word);
            });
        } else if (learningPath === 'error-first') {
            filteredWords.sort(function(a, b) {
                var ea = errorWords.some(function(e) { return e.word === a.word; }) ? 0 : 1;
                var eb = errorWords.some(function(e) { return e.word === b.word; }) ? 0 : 1;
                return ea - eb || a.word.localeCompare(b.word);
            });
        } else if (learningPath === 'smart') {
            var recentMastered = masteredWords.slice(-20);
            var recentLetters = {};
            recentMastered.forEach(function(w) {
                var l = w.charAt(0).toUpperCase();
                recentLetters[l] = (recentLetters[l] || 0) + 1;
            });
            filteredWords.sort(function(a, b) {
                var sa = 0, sb = 0;
                var la = a.word.charAt(0).toUpperCase();
                var lb = b.word.charAt(0).toUpperCase();
                if (recentLetters[la]) sa += recentLetters[la];
                if (recentLetters[lb]) sb += recentLetters[lb];
                if (masteredWords.indexOf(a.word) === -1) sa += 5;
                if (masteredWords.indexOf(b.word) === -1) sb += 5;
                if (errorWords.some(function(e) { return e.word === a.word; })) sa += 10;
                if (errorWords.some(function(e) { return e.word === b.word; })) sb += 10;
                return sb - sa || a.word.localeCompare(b.word);
            });
            filteredWords = filteredWords.slice(0, 50);
        } else {
            if (currentOrder === 'abc') filteredWords.sort(function(a, b) { return a.word.localeCompare(b.word); });
            else if (currentOrder === 'reverse') filteredWords.sort(function(a, b) { return b.word.localeCompare(a.word); });
        }

        currentIndex = 0;
        updateWordCard();
        updateStats();
    }

    function toggleMemorizeFilter() {
        var panel = $('memorizeFilterPanel');
        var toggle = $('memorizeFilterToggle');
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
            toggle.textContent = '收起';
        } else {
            panel.style.display = 'none';
            toggle.textContent = '展开';
        }
    }

    function setFilterLetter(val, el) {
        window._filterLetter = val;
        var chips = el.parentNode.children;
        for (var i = 0; i < chips.length; i++) {
            chips[i].style.background = 'rgba(255,255,255,0.3)';
            chips[i].style.border = '1px solid var(--border)';
            chips[i].style.color = '';
        }
        el.style.background = 'var(--primary)';
        el.style.border = 'none';
        el.style.color = '#fff';
        applyFilter();
    }

    function setFilterStatus(val, el) {
        window._filterStatus = val;
        var chips = el.parentNode.children;
        for (var i = 0; i < chips.length; i++) {
            chips[i].style.background = 'rgba(255,255,255,0.3)';
            chips[i].style.border = '1px solid var(--border)';
            chips[i].style.color = '';
        }
        el.style.background = 'var(--primary)';
        el.style.border = 'none';
        el.style.color = '#fff';
        applyFilter();
    }

    function setFilterDiff(val, el) {
        window._filterDiff = val;
        var chips = el.parentNode.children;
        for (var i = 0; i < chips.length; i++) {
            chips[i].style.background = 'rgba(255,255,255,0.3)';
            chips[i].style.border = '1px solid var(--border)';
            chips[i].style.color = '';
        }
        el.style.background = 'var(--primary)';
        el.style.border = 'none';
        el.style.color = '#fff';
        applyFilter();
    }

    function updateWordCard() {
        if (!filteredWords.length) {
            $('wordDisplay').textContent = '暂无单词';
            $('phoneticDisplay').textContent = '';
            $('posDisplay').textContent = '';
            $('defDisplay').textContent = '请调整筛选条件';
            $('exampleDisplay').textContent = '';
            $('wordIndex').textContent = '0 / 0';
            $('memorizeProgress').style.width = '0%';
            return;
        }
        if (currentIndex >= filteredWords.length) currentIndex = 0;
        if (currentIndex < 0) currentIndex = filteredWords.length - 1;

        var w = filteredWords[currentIndex];
        $('wordDisplay').textContent = w.word;
        $('phoneticDisplay').textContent = w.phonetic || '';
        $('posDisplay').textContent = w.pos || '';
        $('defDisplay').textContent = w.definition;
        $('exampleDisplay').textContent = w.example || '';
        $('defDisplay').style.display = defVisible ? 'block' : 'none';
        $('exampleDisplay').style.display = defVisible ? 'block' : 'none';
        $('wordIndex').textContent = (currentIndex + 1) + ' / ' + filteredWords.length;

        var wordLen = (w.word || '').length;
        var wd = $('wordDisplay');
        wd.style.fontSize =
          wordLen > 18 ? '20px' :
          wordLen > 14 ? '26px' :
          wordLen > 11 ? '32px' :
          wordLen > 8  ? '38px' : '42px';

        var pct = Math.round((currentIndex + 1) / filteredWords.length * 100);
        $('memorizeProgress').style.width = pct + '%';

        // eink-specific elements (memorize tab)
        if ($('einkWord')) {
            $('einkWord').textContent = w.word;
            $('einkPhonetic').textContent = w.phonetic || '';
            $('einkDef').textContent = w.definition;
            $('einkExample').textContent = w.example || '';
            $('einkProgressFill').style.width = pct + '%';
            $('einkWordCount').textContent = (currentIndex + 1);
        }

        if (!defVisible) {
            $('btnToggleDef').textContent = '显示释义';
        } else {
            $('btnToggleDef').textContent = '隐藏释义';
        }

        var isFav = favoriteWords.indexOf(w.word) !== -1;
        $('btnFavorite').textContent = isFav ? '已收藏' : ' 收藏';
        $('btnFavorite').className = isFav ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';

        var note = getWordNote(w.word);
        var hasNote = !!note;
        var noteBtn = $('btnNote');
        if (noteBtn) {
            noteBtn.textContent = '笔记';
            noteBtn.className = hasNote ? 'btn btn-primary btn-sm flex-1' : 'btn btn-outline btn-sm flex-1';
        }
        var noteIndicator = $('noteIndicator');
        if (noteIndicator) {
            noteIndicator.style.display = hasNote ? 'block' : 'none';
            if (hasNote) {
                var preview = note.length > 50 ? note.substring(0, 50) + '...' : note;
                $('notePreview').textContent = preview;
            }
        }

        // Auto-read on word change
        var autoRead = localStorage.getItem('cet6_auto_read') === '1';
        if (autoRead && w.word) {
            try { speakWord(w.word); } catch(e) {}
        }

        var wc = $('wordCard');
        if (wc) {
            wc.style.transform = 'scale(0.98)';
            setTimeout(function() { wc.style.transform = 'scale(1)'; }, 100);
            wc.style.transition = 'transform 0.1s ease';
        }
        updateDailyGoalProgress();
    }

    function updateDailyGoalProgress() {
        var goal = parseInt($('dailyGoal').value) || 50;
        var pct = Math.min(100, Math.round(todayLearned / goal * 100));
        var progressBar = $('dailyGoalProgress');
        var progressText = $('dailyGoalText');
        var trendEl = $('dailyTrend');
        if (progressBar) {
            progressBar.style.width = pct + '%';
            progressBar.style.background = pct >= 100 ? 'var(--success)' : 'var(--primary)';
        }
        if (progressText) {
            progressText.textContent = todayLearned + '/' + goal;
            progressText.style.color = pct >= 100 ? 'var(--success)' : '';
        }
        if (trendEl) {
            var history = JSON.parse(localStorage.getItem('cet6_daily_history') || '{}');
            var yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            var yesterdayKey = yesterday.toISOString().slice(0, 10);
            var yesterdayCount = history[yesterdayKey] || 0;
            if (todayLearned > yesterdayCount && yesterdayCount > 0) {
                trendEl.textContent = '↑';
                trendEl.style.color = 'var(--success)';
            } else if (todayLearned < yesterdayCount && todayLearned > 0) {
                trendEl.textContent = '↓';
                trendEl.style.color = 'var(--danger)';
            } else {
                trendEl.textContent = '';
            }
        }
    }

    function showTodayReview() {
        var existing = document.getElementById('__todayReviewModal');
        if (existing) existing.remove();

        var modal = document.createElement('div');
        modal.id = '__todayReviewModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:16px';

        var goal = parseInt($('dailyGoal').value) || 50;
        var pct = Math.min(100, Math.round(todayLearned / goal * 100));

        var box = document.createElement('div');
        box.style.cssText = 'background:#fff;border-radius:16px;width:100%;max-width:400px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden';

        var header = '<div style="padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between">';
        header += '<span style="font-weight:600;font-size:16px">今日学习回顾</span>';
        header += '<button onclick="this.closest(\'#__todayReviewModal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#6b7280">X</button></div>';

        var content = '<div style="padding:16px 20px;overflow-y:auto;flex:1">';
        content += '<div class="grid grid-cols-3 gap-3 mb-4">';
        content += '<div class="text-center"><div class="text-xl font-bold" style="color:var(--primary)">' + todayLearned + '</div><div class="text-xs text-gray-400">今日学习</div></div>';
        content += '<div class="text-center"><div class="text-xl font-bold" style="color:var(--success)">' + todayMastered + '</div><div class="text-xs text-gray-400">今日掌握</div></div>';
        content += '<div class="text-center"><div class="text-xl font-bold" style="color:' + (pct >= 100 ? 'var(--success)' : 'var(--primary)') + '">' + pct + '%</div><div class="text-xs text-gray-400">完成率</div></div>';
        content += '</div>';

        content += '<div class="mb-4">';
        content += '<div class="flex justify-between text-xs text-gray-400 mb-1"><span>今日目标</span><span>' + todayLearned + '/' + goal + '</span></div>';
        content += '<div class="progress-bar" style="height:6px"><div class="progress-fill" style="width:' + pct + '%;background:' + (pct >= 100 ? 'var(--success)' : 'var(--primary)') + '"></div></div>';
        content += '</div>';

        var today = new Date().toISOString().slice(0, 10);
        var history = JSON.parse(localStorage.getItem('cet6_daily_history') || '{}');
        var todayCount = history[today] || todayLearned;

        if (todayCount > 0) {
            content += '<div class="text-sm font-medium text-gray-500 mb-2">今日学习记录</div>';
            content += '<div class="p-3 rounded" style="background:rgba(255,255,255,0.25);border:1px solid rgba(226,232,240,0.3)">';
            content += '<div class="flex justify-between text-sm"><span>学习单词</span><span class="font-medium">' + todayCount + ' 个</span></div>';
            content += '<div class="flex justify-between text-sm mt-1"><span>连续学习</span><span class="font-medium">' + streak + ' 天</span></div>';
            content += '</div>';
        }

        content += '</div>';

        var footer = '<div style="padding:16px 20px;border-top:1px solid #e5e7eb">';
        footer += '<button onclick="this.closest(\'#__todayReviewModal\').remove()" style="width:100%;padding:10px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer">关闭</button></div>';

        box.innerHTML = header + content + footer;
        modal.appendChild(box);
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    }

    function toggleFavorite() {
        if (!filteredWords.length) return;
        var w = filteredWords[currentIndex];
        var idx = favoriteWords.indexOf(w.word);
        if (idx === -1) {
            favoriteWords.push(w.word);
            showToast('已收藏 ' + w.word, 'success');
        } else {
            favoriteWords.splice(idx, 1);
            showToast('已取消收藏 ' + w.word, 'info');
        }
        saveData();
        updateWordCard();
    }

    var wordNotes = {};
    function loadWordNotes() {
        try {
            wordNotes = JSON.parse(localStorage.getItem('cet6_notes') || '{}');
        } catch(e) {
            wordNotes = {};
        }
    }
    function saveWordNotes() {
        localStorage.setItem('cet6_notes', JSON.stringify(wordNotes));
    }
    function getWordNote(word) {
        return wordNotes[word] || '';
    }
    function setWordNote(word, note) {
        if (note && note.trim()) {
            wordNotes[word] = note.trim();
        } else {
            delete wordNotes[word];
        }
        saveWordNotes();
    }

    function showNoteEditor() {
        if (!filteredWords.length) return;
        var w = filteredWords[currentIndex];
        var existing = document.getElementById('__noteModal');
        if (existing) existing.remove();

        var modal = document.createElement('div');
        modal.id = '__noteModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:16px';

        var note = getWordNote(w.word);
        var box = document.createElement('div');
        box.style.cssText = 'background:#fff;border-radius:16px;width:100%;max-width:400px;overflow:hidden';
        box.innerHTML = '<div style="padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between">' +
            '<span style="font-weight:600;font-size:16px">笔记 - ' + w.word + '</span>' +
            '<button onclick="this.closest(\'#__noteModal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#6b7280">X</button></div>' +
            '<div style="padding:16px 20px">' +
            '<textarea id="__noteText" placeholder="为这个单词写点笔记...&#10;&#10;例如：词根、联想、例句、易混淆词等" style="width:100%;height:150px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;font-family:inherit;font-size:14px;resize:vertical;outline:none">' + (note ? note.replace(/</g, '&lt;') : '') + '</textarea>' +
            '<div style="display:flex;gap:8px;margin-top:12px">' +
            '<button onclick="saveNoteFromEditor()" style="flex:1;padding:10px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer">保存</button>' +
            '<button onclick="deleteNoteFromEditor()" style="flex:1;padding:10px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-weight:600;cursor:pointer">删除</button>' +
            '</div></div>';
        modal.appendChild(box);
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    }

    function saveNoteFromEditor() {
        if (!filteredWords.length) return;
        var w = filteredWords[currentIndex];
        var ta = document.getElementById('__noteText');
        if (!ta) return;
        setWordNote(w.word, ta.value);
        showToast('笔记已保存', 'success');
        document.getElementById('__noteModal').remove();
        updateWordCard();
    }

    function deleteNoteFromEditor() {
        if (!filteredWords.length) return;
        var w = filteredWords[currentIndex];
        setWordNote(w.word, '');
        showToast('笔记已删除', 'info');
        document.getElementById('__noteModal').remove();
        updateWordCard();
    }

    var reviewMode = null;
    var reviewModeNames = { errors: '错词复习', favorites: '收藏复习', smart: '智能复习', random: '随机抽查' };

    function showReviewMenu() {
        var existing = document.getElementById('__reviewMenu');
        if (existing) existing.remove();

        var menu = document.createElement('div');
        menu.id = '__reviewMenu';
        menu.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100;background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.15);padding:20px;min-width:260px';

        var html = '<h3 class="font-semibold mb-4 text-center">选择复习方式</h3><div class="space-y-2">';
        html += '<button class="btn btn-outline w-full" onclick="startReviewMode(\'errors\');closeReviewMenu()">错词复习 (' + errorWords.length + ')</button>';
        html += '<button class="btn btn-outline w-full" onclick="startReviewMode(\'favorites\');closeReviewMenu()">收藏复习 (' + favoriteWords.length + ')</button>';
        html += '<button class="btn btn-outline w-full" onclick="startReviewMode(\'smart\');closeReviewMenu()">智能复习</button>';
        html += '<button class="btn btn-outline w-full" onclick="startReviewMode(\'random\');closeReviewMenu()">随机抽查 (20)</button>';
        html += '<button class="btn btn-ghost w-full mt-2" onclick="closeReviewMenu()">取消</button>';
        html += '</div>';
        menu.innerHTML = html;
        document.body.appendChild(menu);
        setTimeout(function() { document.addEventListener('click', closeReviewMenu, { once: true }); }, 0);
    }

    function closeReviewMenu() {
        var m = document.getElementById('__reviewMenu');
        if (m && m.parentNode) m.parentNode.removeChild(m);
    }

    function startReviewMode(mode) {
        reviewMode = mode;
        var words = [];

        if (mode === 'errors') {
            if (!errorWords.length) { showToast('暂无错词', 'info'); return; }
            words = shuffle(errorWords.map(function(e) {
                return vocabulary.find(function(v) { return v.word === e.word; });
            }).filter(Boolean));
        } else if (mode === 'favorites') {
            if (!favoriteWords.length) { showToast('暂无收藏', 'info'); return; }
            words = shuffle(favoriteWords.map(function(w) {
                return vocabulary.find(function(v) { return v.word === w; });
            }).filter(Boolean));
        } else if (mode === 'smart') {
            words = getReviewWords();
            if (!words.length) { showToast('暂无待复习单词', 'info'); return; }
        } else if (mode === 'random') {
            if (!masteredWords.length) { showToast('暂无已掌握单词', 'info'); return; }
            var pool = shuffle(masteredWords.map(function(w) {
                return vocabulary.find(function(v) { return v.word === w; });
            }).filter(Boolean));
            words = pool.slice(0, 20);
        }

        if (!words.length) return;
        filteredWords = words;
        currentIndex = 0;

        $('reviewModeBar').style.display = '';
        $('reviewModeLabel').textContent = reviewModeNames[mode] || '复习模式';
        $('reviewModeCount').textContent = words.length + ' 词';
        $('btnReview').className = 'btn btn-primary btn-sm flex-1';

        updateWordCard();
        showToast(reviewModeNames[mode] + ': ' + words.length + ' 个单词', 'info');
    }

    function exitReviewMode() {
        reviewMode = null;
        $('reviewModeBar').style.display = 'none';
        $('btnReview').className = 'btn btn-outline btn-sm flex-1';
        applyFilter();
        showToast('已退出复习模式', 'info');
    }

    function renderNotesList() {
        var container = $('notesList');
        if (!container) return;
        var search = ($('notesSearch').value || '').toLowerCase();

        var notesArr = [];
        for (var word in wordNotes) {
            if (wordNotes[word]) {
                var vocab = vocabulary.find(function(v) { return v.word === word; });
                notesArr.push({
                    word: word,
                    note: wordNotes[word],
                    phonetic: vocab ? vocab.phonetic : '',
                    definition: vocab ? vocab.definition : ''
                });
            }
        }

        if (search) {
            notesArr = notesArr.filter(function(n) {
                return n.word.toLowerCase().indexOf(search) !== -1 ||
                       n.note.toLowerCase().indexOf(search) !== -1 ||
                       (n.definition && n.definition.toLowerCase().indexOf(search) !== -1);
            });
        }

        $('notesCount').textContent = notesArr.length + ' 条笔记';

        if (!notesArr.length) {
            container.innerHTML = '<p class="eink-empty">' + (search ? '没有匹配的笔记' : '暂无笔记') + '</p>';
            return;
        }

        notesArr.sort(function(a, b) { return a.word.localeCompare(b.word); });

        var html = '';
        for (var i = 0; i < notesArr.length; i++) {
            var n = notesArr[i];
            var preview = n.note.length > 60 ? n.note.substring(0, 60) + '...' : n.note;
            html += '<div class="eink-row" onclick="jumpToNoteWord(\'' + n.word.replace(/'/g, "\\'") + '\')">' +
                '<div class="eink-row-l"><b>' + n.word + '</b><span style="font-size:10px;color:#888">' + (n.phonetic || '') + '</span></div>' +
                '<div class="eink-row-r" style="max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + preview.replace(/</g, '&lt;') + '</div>' +
                '</div>';
        }
        container.innerHTML = html;
    }

    function jumpToNoteWord(word) {
        var idx = vocabulary.findIndex(function(v) { return v.word === word; });
        if (idx === -1) return;
        filteredWords = vocabulary.slice();
        filteredWords.sort(function(a, b) { return a.word.localeCompare(b.word); });
        currentIndex = filteredWords.findIndex(function(v) { return v.word === word; });
        if (currentIndex === -1) currentIndex = 0;
        switchTab('screen-home');
        updateWordCard();
    }

    var wdCurrentWord = null;

    function showWordDetail(word) {
        var w = vocabulary.find(function(v) { return v.word === word; });
        if (!w) { showToast('未找到单词: ' + word, 'error'); return; }
        wdCurrentWord = w;
        $('wdWord').textContent = w.word;
        $('wdPhonetic').textContent = w.phonetic || '';
        $('wdPos').textContent = w.pos || '';
        $('wdPos').style.display = w.pos ? 'inline-block' : 'none';
        $('wdDef').textContent = w.definition;
        $('wdExample').textContent = w.example || '';
        $('wdExample').style.display = w.example ? 'block' : 'none';
        var isFav = favoriteWords.indexOf(w.word) !== -1;
        $('wdFavBtn').textContent = isFav ? '已收藏' : ' 收藏';
        $('wdFavBtn').className = isFav ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
        $('wordDetailPopup').style.display = 'block';
    }

    function closeWordDetail() {
        $('wordDetailPopup').style.display = 'none';
        wdCurrentWord = null;
    }

    function wdSpeak() {
        if (!wdCurrentWord) return;
        speakWord(wdCurrentWord.word);
    }

    function wdToggleFav() {
        if (!wdCurrentWord) return;
        var idx = favoriteWords.indexOf(wdCurrentWord.word);
        if (idx === -1) {
            favoriteWords.push(wdCurrentWord.word);
            showToast('已收藏 ' + wdCurrentWord.word, 'success');
        } else {
            favoriteWords.splice(idx, 1);
            showToast('已取消收藏 ' + wdCurrentWord.word, 'info');
        }
        saveData();
        var isFav = favoriteWords.indexOf(wdCurrentWord.word) !== -1;
        $('wdFavBtn').textContent = isFav ? '已收藏' : ' 收藏';
        $('wdFavBtn').className = isFav ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
        updateWordCard();
    }

    function wdMarkMastered() {
        if (!wdCurrentWord) return;
        if (masteredWords.indexOf(wdCurrentWord.word) === -1) {
            masteredWords.push(wdCurrentWord.word);
            todayMastered++;
        }
        saveData();
        showToast('已标记为掌握', 'success');
        updateStats();
        closeWordDetail();
    }

    function wdMarkWrong() {
        if (!wdCurrentWord) return;
        if (!errorWords.some(function(e) { return e.word === wdCurrentWord.word; })) {
            errorWords.push({
                word: wdCurrentWord.word, phonetic: wdCurrentWord.phonetic || '',
                pos: wdCurrentWord.pos || '', definition: wdCurrentWord.definition,
                example: wdCurrentWord.example || '', difficulty: getDifficulty(wdCurrentWord.word),
                time: new Date().toISOString(), count: 1
            });
        }
        saveData();
        showToast('已加入错词本', 'error');
        closeWordDetail();
    }

    function toggleWord() {
        defVisible = !defVisible;
        updateWordCard();
    }

    function toggleFocusMode() {
        document.body.classList.toggle('focus-mode');
        var isFocus = document.body.classList.contains('focus-mode');
        $('btnFocusMode').textContent = isFocus ? '退出' : '专注';
        if (isFocus) {
            var exitBtn = document.createElement('button');
            exitBtn.className = 'btn btn-outline btn-sm focus-exit';
            exitBtn.textContent = '退出专注';
            exitBtn.onclick = function() { toggleFocusMode(); };
            document.body.appendChild(exitBtn);
            showToast('专注模式：点击卡片切换单词，点击右上角退出', 'info');
        } else {
            var exitBtn = document.querySelector('.focus-exit');
            if (exitBtn) exitBtn.remove();
        }
    }

    var pomodoroTimer = null;
    var pomodoroSeconds = 25 * 60;
    var pomodoroRunning = false;
    var pomodoroPaused = false;
    var pomodoroIsBreak = false;

    function pomodoroStart() {
        if (pomodoroRunning) {
            $('pomodoroBar').style.display = '';
            return;
        }
        pomodoroRunning = true;
        pomodoroPaused = false;
        pomodoroIsBreak = false;
        pomodoroSeconds = 25 * 60;
        $('pomodoroBar').style.display = '';
        $('pomodoroLabel').textContent = '学习中';
        $('pomodoroTime').style.color = 'var(--primary)';
        $('btnPomodoroPause').textContent = '暂停';
        $('btnPomodoro').classList.add('btn-primary');
        $('btnPomodoro').classList.remove('btn-outline');
        pomodoroUpdateDisplay();
        pomodoroTimer = setInterval(pomodoroTick, 1000);
        showToast('番茄钟开始！专注学习 25 分钟', 'success');
    }

    function pomodoroTick() {
        if (pomodoroPaused) return;
        pomodoroSeconds--;
        pomodoroUpdateDisplay();
        if (pomodoroSeconds <= 0) {
            clearInterval(pomodoroTimer);
            pomodoroTimer = null;
            if (pomodoroIsBreak) {
                showToast('休息结束！继续学习吧', 'success');
                pomodoroIsBreak = false;
                pomodoroSeconds = 25 * 60;
                $('pomodoroLabel').textContent = '学习中';
                $('pomodoroTime').style.color = 'var(--primary)';
                pomodoroTimer = setInterval(pomodoroTick, 1000);
            } else {
                showToast('时间到！休息 5 分钟', 'success');
                pomodoroIsBreak = true;
                pomodoroSeconds = 5 * 60;
                $('pomodoroLabel').textContent = '休息中';
                $('pomodoroTime').style.color = 'var(--success)';
                pomodoroTimer = setInterval(pomodoroTick, 1000);
                speakWord('Time for a break');
            }
        }
    }

    function pomodoroUpdateDisplay() {
        var m = Math.floor(pomodoroSeconds / 60);
        var s = pomodoroSeconds % 60;
        $('pomodoroTime').textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    function pomodoroPause() {
        if (!pomodoroRunning) return;
        pomodoroPaused = !pomodoroPaused;
        $('btnPomodoroPause').textContent = pomodoroPaused ? '继续' : '暂停';
    }

    function pomodoroStop() {
        if (pomodoroTimer) { clearInterval(pomodoroTimer); pomodoroTimer = null; }
        pomodoroRunning = false;
        pomodoroPaused = false;
        pomodoroIsBreak = false;
        pomodoroSeconds = 25 * 60;
        $('pomodoroBar').style.display = 'none';
        $('btnPomodoro').classList.remove('btn-primary');
        $('btnPomodoro').classList.add('btn-outline');
        showToast('番茄钟已停止', 'info');
    }

    // 专注模式下点击卡片切换单词
    document.addEventListener('click', function(e) {
        if (!document.body.classList.contains('focus-mode')) return;
        var card = document.getElementById('wordCard');
        if (card && card.contains(e.target)) {
            if (defVisible) {
                defVisible = false;
            } else {
                defVisible = true;
                nextWord();
            }
            updateWordCard();
        }
    });

    function prevWord() {
        if (!filteredWords.length) return;
        if (currentIndex > 0) {
            currentIndex--;
        } else {
            currentIndex = filteredWords.length - 1;
            showToast('已是第一个单词，回到末尾', 'info');
        }
        animateCardOut('left', function() {
            updateWordCard();
            animateCardIn();
        });
    }

    function nextWord() {
        if (!filteredWords.length) return;
        if (currentIndex < filteredWords.length - 1) {
            currentIndex++;
        } else {
            currentIndex = 0;
            showToast('已是最后一个单词，回到开头', 'info');
        }
        todayLearned++;
        saveData();
        animateCardOut('right', function() {
            updateWordCard();
            animateCardIn();
        });
        updateStats();
    }

    function initSwipeGestures() {
        var card = $('wordCard');
        if (!card) return;
        var startX = 0, startY = 0, startT = 0, moved = false, swipeThreshold = 60;
        var longPressTimer = null, longPressed = false;

        card.addEventListener('touchstart', function(e) {
            if (e.touches.length !== 1) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startT = Date.now();
            moved = false;
            longPressed = false;
            card.classList.add('swiping');
            clearTimeout(longPressTimer);
            longPressTimer = setTimeout(function() {
                longPressed = true;
                showLongPressMenu();
            }, 500);
        }, { passive: true });

        card.addEventListener('touchmove', function(e) {
            if (e.touches.length !== 1) return;
            var dx = e.touches[0].clientX - startX;
            var dy = e.touches[0].clientY - startY;
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                clearTimeout(longPressTimer);
                if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
                    moved = true;
                    e.preventDefault();
                    card.style.transform = 'translateX(' + dx * 0.3 + 'px) rotate(' + dx * 0.03 + 'deg)';
                    if (dx < -swipeThreshold) {
                        var sr = $('swipeRight'); if (sr) sr.classList.add('show');
                        var sl = $('swipeLeft'); if (sl) sl.classList.remove('show');
                    } else if (dx > swipeThreshold) {
                        var sl2 = $('swipeLeft'); if (sl2) sl2.classList.add('show');
                        var sr2 = $('swipeRight'); if (sr2) sr2.classList.remove('show');
                    } else {
                        var sl3 = $('swipeLeft'); if (sl3) sl3.classList.remove('show');
                        var sr3 = $('swipeRight'); if (sr3) sr3.classList.remove('show');
                    }
                }
            }
        }, { passive: false });

        card.addEventListener('touchend', function(e) {
            clearTimeout(longPressTimer);
            card.classList.remove('swiping');
            card.style.transform = '';
            card.style.transition = 'transform 0.3s ease';
            var sl4 = $('swipeLeft'); if (sl4) sl4.classList.remove('show');
            var sr4 = $('swipeRight'); if (sr4) sr4.classList.remove('show');

            if (longPressed) return;

            var endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : startX;
            var dxEnd = endX - startX;

            if (moved) {
                if (dxEnd < -swipeThreshold) nextWord();
                else if (dxEnd > swipeThreshold) prevWord();
            }
            // Tap (no movement) does nothing on card.
        }, { passive: true });
    }

    function showLongPressMenu() {
        hideLongPressMenu();
        var card = $('wordCard');
        if (!card) return;
        var menu = document.createElement('div');
        menu.id = '__longPressMenu';
        menu.style.cssText = 'position:absolute;left:50%;top:100%;transform:translate(-50%,8px);z-index:60;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:8px;display:flex;gap:6px;white-space:nowrap;';
        var items = [
            { label: '⬅ 上一个', action: 'prev' },
            { label: ' 发音', action: 'speak' },
            { label: ' 释义', action: 'toggle' },
            { label: ' 认识', action: 'master' },
            { label: ' 不认识', action: 'wrong' }
        ];
        items.forEach(function(it) {
            var b = document.createElement('button');
            b.className = 'btn btn-sm';
            b.style.cssText = 'padding:6px 10px;font-size:13px;border:1px solid #e5e7eb;background:#fff;border-radius:8px;';
            b.textContent = it.label;
            b.onclick = function(ev) {
                ev.stopPropagation();
                if (it.action === 'prev') prevWord();
                else if (it.action === 'speak') speakWord();
                else if (it.action === 'toggle') toggleWord();
                else if (it.action === 'master') markMastered();
                else if (it.action === 'wrong') markWrong();
                hideLongPressMenu();
            };
            menu.appendChild(b);
        });
        card.style.position = 'relative';
        card.appendChild(menu);
        setTimeout(function() {
            document.addEventListener('click', hideLongPressMenu, { once: true });
        }, 0);
    }
    function hideLongPressMenu() {
        var m = document.getElementById('__longPressMenu');
        if (m && m.parentNode) m.parentNode.removeChild(m);
    }

    function speakWord(targetWord) {
        var word = (typeof targetWord === 'string' && targetWord)
            ? targetWord
            : (filteredWords.length ? filteredWords[currentIndex].word : '');
        if (!word) return;
        word = String(word).slice(0, 500);
        var accent = localStorage.getItem('cet6_accent') || 'en-us';
        var rate = Math.round(parseInt(localStorage.getItem('cet6_rate') || '75') * 1.65);
        // 1) 内置 eSpeak（最优先）：bridge 内部自动 fallback 到 local
        try {
            if (window.AndroidTts && typeof window.AndroidTts.speak === 'function') {
                var st = '';
                try { st = window.AndroidTts.getStatus ? window.AndroidTts.getStatus() : ''; } catch(_) {}
                try { console.log('[TTS] speakWord("' + word + '") status=' + st); } catch(_) {}
                if (st === 'ready' || st === 'loading' || st.indexOf('failed') !== 0) {
                    try { if (window.AndroidTts.setVoice) window.AndroidTts.setVoice(accent); } catch(_) {}
                    try { if (window.AndroidTts.setRate) window.AndroidTts.setRate(rate); } catch(_) {}
                    window.AndroidTts.speak(word);
                    return;
                }
                if (st.indexOf('failed') === 0) {
                    try { console.warn('[TTS] eSpeak failed, trying localTts'); } catch(_) {}
                    if (window.AndroidTts.speakLocal) {
                        window.AndroidTts.speakLocal(word);
                        return;
                    }
                }
            }
        } catch (e) { try { console.warn('[TTS] AndroidTts failed:', e); } catch(_){} }
        // 2) Web Speech 兜底
        if (!('speechSynthesis' in window)) {
            try { console.warn('[TTS] No speechSynthesis available'); } catch(_){}
            if (typeof showToast === 'function') showToast('发音不可用：TTS 未就绪', 'error');
            return;
        }
        try { window.speechSynthesis.cancel(); } catch (e) {}
        var u = new SpeechSynthesisUtterance(word);
        u.lang = accent;
        u.rate = rate / 165;
        u.pitch = 1;
        try {
            var voices = window.speechSynthesis.getVoices();
            var enVoice = voices.find(function(v){ return v.lang.startsWith(accent.split('-')[0]); });
            if (enVoice) u.voice = enVoice;
        } catch (e) {}
        try { window.speechSynthesis.speak(u); } catch (e) {}
    }

    /** 双击  按钮时显示 TTS 状态 */
    function showTtsDiagnostic() {
        var st = 'unknown';
        if (window.AndroidTts) {
            try { st = window.AndroidTts.getStatus(); } catch(e) { st = 'error'; }
        }
        if (typeof showToast === 'function') {
            showToast('TTS: ' + st, st === 'ready' ? 'success' : 'info');
        }
    }

    function startVoiceInput(inputId) {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            showToast('语音识别不可用', 'error');
            return;
        }
        var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        var recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        var btn = $('btnVoice' + (inputId === 'spellInput' ? 'Spell' : 'Recall'));
        if (btn) {
            btn.textContent = ' ️';
            btn.style.background = 'var(--danger)';
            btn.style.color = '#fff';
        }

        recognition.onresult = function(event) {
            var transcript = event.results[0][0].transcript.toLowerCase().trim();
            var input = $(inputId);
            if (input) {
                input.value = transcript;
                input.removeAttribute('readonly');
                input.focus();
            }
            showToast('识别结果: ' + transcript, 'success');
        };

        recognition.onerror = function(event) {
            showToast('语音识别失败: ' + event.error, 'error');
        };

        recognition.onend = function() {
            if (btn) {
                btn.textContent = ' ';
                btn.style.background = '';
                btn.style.color = '';
            }
        };

        recognition.start();
        showToast('请说出单词...', 'info');
    }

    function markWrong() {
        if (!filteredWords.length) return;
        var w = filteredWords[currentIndex];
        if (!errorWords.some(function(e) { return e.word === w.word; })) {
            errorWords.push({
                word: w.word,
                phonetic: w.phonetic || '',
                pos: w.pos || '',
                definition: w.definition,
                example: w.example || '',
                difficulty: getDifficulty(w.word),
                time: new Date().toISOString(),
                count: 1
            });
        } else {
            var ew = errorWords.find(function(e) { return e.word === w.word; });
            if (ew) { ew.count = (ew.count || 1) + 1; ew.time = new Date().toISOString(); }
        }
        updateReviewData(w.word, 1);
        saveData();
        showToast('已加入错词本', 'error');
        autoAdvanceWord('error');
    }

    function updateReviewData(word, quality) {
        if (!reviewData[word]) {
            reviewData[word] = { interval: 0, easeFactor: 2.5, repetitions: 0, lastReview: null, nextReview: null };
        }
        var rd = reviewData[word];
        var now = new Date();
        rd.lastReview = now.toISOString().slice(0, 10);
        if (quality >= 3) {
            if (rd.repetitions === 0) rd.interval = 1;
            else if (rd.repetitions === 1) rd.interval = 3;
            else rd.interval = Math.round(rd.interval * rd.easeFactor);
            rd.repetitions++;
        } else {
            rd.repetitions = 0;
            rd.interval = 1;
        }
        rd.easeFactor = Math.max(1.3, rd.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
        var nextDate = new Date(now);
        nextDate.setDate(nextDate.getDate() + rd.interval);
        rd.nextReview = nextDate.toISOString().slice(0, 10);
        saveData();
    }

    function getReviewWords() {
        var today = new Date().toISOString().slice(0, 10);
        var words = [];
        for (var word in reviewData) {
            if (reviewData[word].nextReview && reviewData[word].nextReview <= today) {
                var found = vocabulary.find(function(v) { return v.word === word; });
                if (found) words.push(found);
            }
        }
        return words;
    }

    function markMastered() {
        if (!filteredWords.length) return;
        var w = filteredWords[currentIndex];
        if (masteredWords.indexOf(w.word) === -1) {
            masteredWords.push(w.word);
            todayMastered++;
        }
        updateReviewData(w.word, 4);
        saveData();
        showToast('已标记为掌握 ', 'success');
        updateStats();
        autoAdvanceWord('success');
    }

    function showFeedbackFlash(type) {
        var flash = $('feedbackFlash');
        if (!flash) return;
        flash.classList.remove('flash-success', 'flash-error');
        void flash.offsetWidth;
        flash.classList.add(type === 'success' ? 'flash-success' : 'flash-error');
        setTimeout(function() {
            flash.classList.remove('flash-success', 'flash-error');
        }, 300);
    }

    function animateCardOut(direction, callback) {
        var card = $('wordCard');
        if (!card) { callback(); return; }
        var cls = direction === 'right' ? 'swipe-out-right' : 'swipe-out-left';
        card.classList.add(cls);
        setTimeout(function() {
            card.classList.remove('swipe-out-right', 'swipe-out-left');
            callback();
        }, 320);
    }

    function animateCardIn() {
        var card = $('wordCard');
        if (!card) return;
        card.classList.add('swipe-in');
        void card.offsetWidth;
        requestAnimationFrame(function() {
            card.classList.remove('swipe-in');
            card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
            requestAnimationFrame(function() {
                card.style.transform = '';
                card.style.opacity = '';
                setTimeout(function() {
                    card.style.transition = '';
                }, 320);
            });
        });
    }

    function autoAdvanceWord(feedbackType) {
        if (!filteredWords.length) return;
        if (currentIndex < filteredWords.length - 1) {
            currentIndex++;
        } else {
            currentIndex = 0;
            showToast('已是最后一个单词，回到开头', 'info');
        }
        todayLearned++;
        saveData();
        showFeedbackFlash(feedbackType);
        animateCardOut(feedbackType === 'success' ? 'right' : 'left', function() {
            updateWordCard();
            animateCardIn();
        });
        updateStats();
    }

    function nextSpell() {
        if (!vocabulary.length) return;
        var pool = vocabulary.filter(function(w) { return masteredWords.indexOf(w.word) === -1; });
        if (!pool.length) pool = vocabulary;
        spellWord = pool[Math.floor(Math.random() * pool.length)];
        $('spellDef').textContent = spellWord.definition;
        $('spellPhonetic').textContent = spellWord.phonetic || '';
        $('spellPos').textContent = spellWord.pos || '';
        $('spellInput').value = '';
        $('spellResult').innerHTML = '';
        $('spellCorrect').style.display = 'none';
    }

    function checkSpell() {
        if (!spellWord) return;
        var input = $('spellInput').value.trim().toLowerCase();
        if (!input) { showToast('请输入单词', 'info'); return; }

        if (input === spellWord.word.toLowerCase()) {
            $('spellResult').innerHTML = '<span style="color:var(--success);font-weight:600;font-size:18px"> 正确！太棒了！</span>';
            if (masteredWords.indexOf(spellWord.word) === -1) {
                masteredWords.push(spellWord.word);
                todayMastered++;
                saveData();
            }
            showToast('拼写正确！', 'success');
            $('spellCorrect').style.display = 'block';
            $('spellCorrect').textContent = spellWord.word;
        } else {
            $('spellResult').innerHTML = '<span style="color:var(--danger);font-weight:600"> 错误！</span>';
            $('spellCorrect').style.display = 'block';
            $('spellCorrect').textContent = spellWord.word;
            addErrorWord(spellWord);
            showToast('拼写错误，已加入错词本', 'error');
        }
    }

    function showSpellHint() {
        if (!spellWord) return;
        var w = spellWord.word;
        var hint = w[0];
        for (var i = 1; i < w.length - 1; i++) hint += '_';
        hint += w[w.length - 1];
        $('spellInput').value = hint;
        $('spellInput').focus();
        var len = hint.length;
        $('spellInput').setSelectionRange(1, len - 1);
    }

    function nextQuiz() {
        if (!vocabulary.length) return;
        quizWord = vocabulary[Math.floor(Math.random() * vocabulary.length)];
        $('quizWord').textContent = quizWord.word;
        $('quizPhonetic').textContent = quizWord.phonetic || '';
        $('quizPos').textContent = quizWord.pos || '';
        $('quizResult').innerHTML = '';
        
        var options = [quizWord.definition];
        while (options.length < 4) {
            var rand = vocabulary[Math.floor(Math.random() * vocabulary.length)];
            if (options.indexOf(rand.definition) === -1) {
                options.push(rand.definition);
            }
        }
        options.sort(function() { return Math.random() - 0.5; });
        
        var html = '';
        for (var i = 0; i < options.length; i++) {
            html += '<button class="quiz-option match-option" onclick="checkQuiz(this, \'' + options[i].replace(/'/g, "\\'") + '\')">' + options[i] + '</button>';
        }
        $('quizOptions').innerHTML = html;
    }

    function checkQuiz(btn, answer) {
        var buttons = document.querySelectorAll('.quiz-option');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].disabled = true;
            if (buttons[i].textContent === quizWord.definition) {
                buttons[i].classList.add('correct');
            }
        }
        if (answer === quizWord.definition) {
            btn.classList.add('correct');
            quizCorrect++;
            $('quizResult').innerHTML = '<span style="color:var(--success);font-weight:600"> 正确！</span>';
            updateReviewData(quizWord.word, 4);
        } else {
            btn.classList.add('wrong');
            quizWrong++;
            $('quizResult').innerHTML = '<span style="color:var(--danger);font-weight:600"> 错误！正确答案: ' + quizWord.definition + '</span>';
            updateReviewData(quizWord.word, 1);
        }
        saveData();
        $('quizCorrect').textContent = quizCorrect;
        $('quizWrong').textContent = quizWrong;
        var total = quizCorrect + quizWrong;
        $('quizRate').textContent = total > 0 ? Math.round(quizCorrect / total * 100) + '%' : '0%';
    }

    function speakQuizWord() {
        if (quizWord) speakWord(quizWord.word);
    }

    function setRecallMode(mode) {
        recallMode = mode;
        localStorage.setItem('cet6_recallMode', mode);
        var btns = ['btnRecallReverse','btnRecallSpell','btnRecallMatch','btnRecallDictation','btnRecallChallenge','btnRecallQuiz'];
        btns.forEach(function(id) {
            $(id).classList.remove('eink-chip-active');
        });

        $('recallReverseMode').style.display = 'none';
        $('recallSpellMode').style.display = 'none';
        $('recallMatchMode').style.display = 'none';
        $('recallDictationMode').style.display = 'none';
        $('recallChallengeMode').style.display = 'none';
        $('recallQuizMode').style.display = 'none';

        if (mode === 'reverse') {
            $('btnRecallReverse').classList.add('eink-chip-active');
            $('recallReverseMode').style.display = 'block';
            nextRecall();
        } else if (mode === 'spell') {
            $('btnRecallSpell').classList.add('eink-chip-active');
            $('recallSpellMode').style.display = 'block';
            nextSpell();
        } else if (mode === 'match') {
            $('btnRecallMatch').classList.add('eink-chip-active');
            $('recallMatchMode').style.display = 'block';
            nextMatch();
        } else if (mode === 'dictation') {
            $('btnRecallDictation').classList.add('eink-chip-active');
            $('recallDictationMode').style.display = 'block';
            nextDictation();
        } else if (mode === 'challenge') {
            $('btnRecallChallenge').classList.add('eink-chip-active');
            $('recallChallengeMode').style.display = 'block';
        } else if (mode === 'quiz') {
            $('btnRecallQuiz').classList.add('eink-chip-active');
            $('recallQuizMode').style.display = 'block';
            nextQuiz();
        }
    }

    function nextRecall() {
        if (!vocabulary.length) return;
        var pool = vocabulary.filter(function(w) { return masteredWords.indexOf(w.word) === -1; });
        if (!pool.length) pool = vocabulary;
        recallWord = pool[Math.floor(Math.random() * pool.length)];
        $('recallDef').textContent = recallWord.definition;
        $('recallPhonetic').textContent = recallWord.phonetic || '';
        $('recallInput').value = '';
        $('recallResult').innerHTML = '';
    }

    function checkRecall() {
        if (!recallWord) return;
        var input = $('recallInput').value.trim().toLowerCase();
        if (!input) { showToast('请输入单词', 'info'); return; }

        if (input === recallWord.word.toLowerCase()) {
            $('recallResult').innerHTML = '<span style="color:var(--success);font-weight:600;font-size:18px"> 正确！</span>';
            showToast('回忆正确！', 'success');
        } else {
            $('recallResult').innerHTML = '<span style="color:var(--danger);font-weight:600"> 错误！正确答案：' + recallWord.word + '</span>';
            addErrorWord(recallWord);
            showToast('回忆错误，已加入错词本', 'error');
        }
    }

    function showRecallHint() {
        if (!recallWord) return;
        var w = recallWord.word;
        var hint = w[0];
        for (var i = 1; i < w.length - 1; i++) hint += '_';
        hint += w[w.length - 1];
        $('recallInput').value = hint;
        $('recallInput').focus();
        var len = hint.length;
        $('recallInput').setSelectionRange(1, len - 1);
    }

    function nextMatch() {
        if (vocabulary.length < 4) { showToast('词汇不足4个，无法配对', 'info'); return; }
        var pool = shuffle(vocabulary);
        matchWord = pool[0];
        var options = pool.slice(0, 4);
        if (!options.some(function(o) { return o.word === matchWord.word; })) options[0] = matchWord;
        options = shuffle(options);

        $('matchDef').textContent = matchWord.definition;
        var html = '';
        for (var i = 0; i < options.length; i++) {
            html += '<div class="match-option" onclick="selectMatch(\'' + options[i].word.replace(/'/g, "\\'") + '\',\'' + matchWord.word.replace(/'/g, "\\'") + '\',this)">' + options[i].word + '</div>';
        }
        $('matchOptions').innerHTML = html;
        $('matchResult').innerHTML = '';
    }

    function resetMatch() { nextMatch(); }

    function selectMatch(selected, correct, el) {
        var allOpts = document.querySelectorAll('#matchOptions .match-option');
        for (var i = 0; i < allOpts.length; i++) { allOpts[i].style.pointerEvents = 'none'; }

        if (selected === correct) {
            el.classList.add('correct');
            $('matchResult').innerHTML = '<span style="color:var(--success);font-weight:600;font-size:18px"> 正确！</span>';
            showToast('配对正确！', 'success');
        } else {
            el.classList.add('wrong');
            $('matchResult').innerHTML = '<span style="color:var(--danger);font-weight:600"> 错误！正确答案：' + correct + '</span>';
            var w = vocabulary.find(function(v) { return v.word === correct; });
            if (w) addErrorWord(w);
        }
    }

    function addErrorWord(w) {
        var existing = errorWords.find(function(e) { return e.word === w.word; });
        if (existing) {
            existing.count = (existing.count || 1) + 1;
            existing.time = new Date().toISOString();
        } else {
            errorWords.push({
                word: w.word,
                phonetic: w.phonetic || '',
                pos: w.pos || '',
                definition: w.definition,
                example: w.example || '',
                difficulty: getDifficulty(w.word),
                time: new Date().toISOString(),
                count: 1
            });
        }
        saveData();
    }

    function nextDictation() {
        if (!vocabulary.length) return;
        var pool = vocabulary.filter(function(w) { return masteredWords.indexOf(w.word) === -1; });
        if (!pool.length) pool = vocabulary;
        dictationWord = pool[Math.floor(Math.random() * pool.length)];
        $('dictationInput').value = '';
        $('dictationResult').innerHTML = '';
        $('dictationCorrect').style.display = 'none';
        setTimeout(function() { playDictationAudio(); }, 300);
    }

    function playDictationAudio() {
        if (!dictationWord) return;
        speakWord(dictationWord.word);
    }

    function checkDictation() {
        if (!dictationWord) return;
        var input = $('dictationInput').value.trim().toLowerCase();
        if (!input) { showToast('请输入单词', 'info'); return; }
        if (input === dictationWord.word.toLowerCase()) {
            $('dictationResult').innerHTML = '<span style="color:var(--success);font-weight:600"> 正确！</span>';
            updateReviewData(dictationWord.word, 4);
            showToast('听写正确！', 'success');
        } else {
            $('dictationResult').innerHTML = '<span style="color:var(--danger);font-weight:600"> 错误！</span>';
            $('dictationCorrect').style.display = 'block';
            $('dictationCorrect').textContent = dictationWord.word;
            addErrorWord(dictationWord);
            updateReviewData(dictationWord.word, 1);
            showToast('听写错误，已加入错词本', 'error');
        }
        saveData();
    }

    function showDictationHint() {
        if (!dictationWord) return;
        var w = dictationWord.word;
        var hint = w[0];
        for (var i = 1; i < w.length - 1; i++) hint += '_';
        hint += w[w.length - 1];
        $('dictationInput').value = hint;
        $('dictationInput').focus();
        var len = hint.length;
        $('dictationInput').setSelectionRange(1, len - 1);
    }

    var challengeTimer = null, challengeTime = 60, challengeScore = 0;
    var challengeCorrect = 0, challengeWrong = 0, challengeWord = null;
    var challengeActive = false;

    function startChallenge() {
        challengeTime = 60;
        challengeScore = 0;
        challengeCorrect = 0;
        challengeWrong = 0;
        challengeActive = true;
        $('challengeTimer').textContent = challengeTime;
        $('challengeScore').textContent = challengeScore;
        $('challengeCorrect').textContent = challengeCorrect;
        $('challengeWrong').textContent = challengeWrong;
        $('challengeRate').textContent = '0%';
        $('btnStartChallenge').style.display = 'none';
        $('btnCheckChallenge').style.display = '';
        $('challengeInput').disabled = false;
        nextChallengeWord();
        challengeTimer = setInterval(function() {
            challengeTime--;
            $('challengeTimer').textContent = challengeTime;
            if (challengeTime <= 0) {
                endChallenge();
            }
        }, 1000);
    }

    function endChallenge() {
        challengeActive = false;
        clearInterval(challengeTimer);
        $('challengeInput').disabled = true;
        $('btnStartChallenge').style.display = '';
        $('btnCheckChallenge').style.display = 'none';
        var total = challengeCorrect + challengeWrong;
        var msg = '闯关结束！得分: ' + challengeScore + '，正确: ' + challengeCorrect + '/' + total;
        showToast(msg, 'info');
        $('challengeResult').innerHTML = '<span style="color:var(--primary);font-weight:600">' + msg + '</span>';
    }

    function nextChallengeWord() {
        if (!vocabulary.length || !challengeActive) return;
        challengeWord = vocabulary[Math.floor(Math.random() * vocabulary.length)];
        $('challengeDef').textContent = challengeWord.definition;
        $('challengePhonetic').textContent = challengeWord.phonetic || '';
        $('challengeInput').value = '';
        $('challengeResult').innerHTML = '';
        $('challengeInput').focus();
    }

    function checkChallenge() {
        if (!challengeWord || !challengeActive) return;
        var input = $('challengeInput').value.trim().toLowerCase();
        if (!input) { nextChallengeWord(); return; }
        if (input === challengeWord.word.toLowerCase()) {
            challengeCorrect++;
            challengeScore += 10;
            $('challengeResult').innerHTML = '<span style="color:var(--success);font-weight:600"> 正确！+10</span>';
            updateReviewData(challengeWord.word, 4);
        } else {
            challengeWrong++;
            $('challengeResult').innerHTML = '<span style="color:var(--danger);font-weight:600"> 错误！正确: ' + challengeWord.word + '</span>';
            addErrorWord(challengeWord);
            updateReviewData(challengeWord.word, 1);
        }
        saveData();
        $('challengeScore').textContent = challengeScore;
        $('challengeCorrect').textContent = challengeCorrect;
        $('challengeWrong').textContent = challengeWrong;
        var total = challengeCorrect + challengeWrong;
        $('challengeRate').textContent = total > 0 ? Math.round(challengeCorrect / total * 100) + '%' : '0%';
        setTimeout(nextChallengeWord, 800);
    }

    var errorCountFilter = 'all';
    var errorTimeFilter = 'all';

    function setErrorCountFilter(val, el) {
        errorCountFilter = val;
        var chips = el.parentNode.children;
        for (var i = 0; i < chips.length; i++) {
            chips[i].classList.remove('eink-chip-active');
        }
        el.classList.add('eink-chip-active');
        renderErrors();
    }

    function setErrorTimeFilter(val, el) {
        errorTimeFilter = val;
        var chips = el.parentNode.children;
        for (var i = 0; i < chips.length; i++) {
            chips[i].classList.remove('eink-chip-active');
        }
        el.classList.add('eink-chip-active');
        renderErrors();
    }

    function renderErrors() {
        var searchEl = $('errorSearch');
        var searchTerm = (searchEl ? searchEl.value : '').toLowerCase();
        var filtered = errorWords;

        if (searchTerm) {
            filtered = filtered.filter(function(e) {
                return e.word.toLowerCase().indexOf(searchTerm) !== -1 ||
                       e.definition.toLowerCase().indexOf(searchTerm) !== -1;
            });
        }

        if (errorCountFilter !== 'all') {
            filtered = filtered.filter(function(e) {
                var count = e.count || 1;
                if (errorCountFilter === '1') return count === 1;
                if (errorCountFilter === '2-5') return count >= 2 && count <= 5;
                if (errorCountFilter === '5+') return count > 5;
                return true;
            });
        }

        if (errorTimeFilter !== 'all') {
            var now = new Date();
            var today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            filtered = filtered.filter(function(e) {
                if (!e.time) return true;
                var t = new Date(e.time).getTime();
                if (errorTimeFilter === 'today') return t >= today;
                if (errorTimeFilter === 'week') return t >= today - 6 * 86400000;
                if (errorTimeFilter === 'month') return t >= today - 29 * 86400000;
                return true;
            });
        }

        var total = errorWords.length;
        var shown = filtered.length;
        $('errorCount').textContent = '共 ' + total + ' 个错词' + (shown < total ? '（筛选出 ' + shown + ' 个）' : '');
        if ($('einkErrorCount')) $('einkErrorCount').textContent = total;
        if ($('einkMasteryRate')) {
            var rate = vocabulary.length ? Math.round((vocabulary.length - total) / vocabulary.length * 100) : 100;
            $('einkMasteryRate').textContent = rate + '%';
        }

        if (!filtered.length) {
            $('errorList').innerHTML = '<p class="eink-empty">暂无错词，继续加油！</p>';
            return;
        }

        var html = '';
        for (var i = 0; i < filtered.length; i++) {
            var w = filtered[i];
            var diffLabel = (w.difficulty === 'easy') ? '简单' : (w.difficulty === 'hard') ? '困难' : '中等';
            html += '<div class="eink-row">' +
                '<div class="eink-row-l">' +
                '<b>' + w.word + '</b>' +
                (w.count > 1 ? '<span style="font-size:10px;color:#888">×' + w.count + '</span>' : '') +
                '</div>' +
                '<div class="eink-row-r">' + (w.phonetic || w.definition.substring(0, 20) || '') + '</div>' +
                '</div>';
        }
        $('errorList').innerHTML = html;
    }

    function removeErrorWord(word) {
        errorWords = errorWords.filter(function(e) { return e.word !== word; });
        saveData();
        renderErrors();
        showToast('已删除', 'info');
    }

    function reviewErrors() {
        if (!errorWords.length) { showToast('暂无错词需要复习', 'info'); return; }
        var words = [];
        for (var i = 0; i < errorWords.length; i++) {
            var found = vocabulary.find(function(v) { return v.word === errorWords[i].word; });
            if (found) words.push(found);
        }
        if (!words.length) { showToast('错词已不在词汇库中', 'info'); return; }
        filteredWords = shuffle(words);
        currentOrder = 'random';
        currentIndex = 0;
        switchTab('screen-home');
        updateWordCard();
        showToast('开始复习 ' + filteredWords.length + ' 个错词', 'info');
    }

    function exportErrors() {
        if (!errorWords.length) { showToast('暂无错词可导出', 'info'); return; }
        var txt = '英语六级词汇 - 错词本\n';
        txt += '导出时间：' + new Date().toLocaleString() + '\n';
        txt += '共 ' + errorWords.length + ' 个错词\n';
        txt += '='.repeat(50) + '\n\n';

        for (var i = 0; i < errorWords.length; i++) {
            var w = errorWords[i];
            txt += (i + 1) + '. ' + w.word + '\n';
            txt += '   音标：' + (w.phonetic || '无') + '\n';
            txt += '   词性：' + (w.pos || '无') + '\n';
            txt += '   释义：' + w.definition + '\n';
            txt += '   例句：' + (w.example || '无') + '\n';
            txt += '   错误次数：' + (w.count || 1) + '\n';
            txt += '   难度：' + (w.difficulty === 'easy' ? '简单' : w.difficulty === 'hard' ? '困难' : '中等') + '\n';
            txt += '\n';
        }

        var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'CET6_错词本_' + new Date().toISOString().slice(0, 10) + '.txt';
        a.click();
        showToast('错词本已导出，保存在 Download 目录', 'success');
    }

    function shareErrorCard() {
        if (!errorWords.length) { showToast('暂无错词', 'info'); return; }

        var canvas = document.createElement('canvas');
        canvas.width = 400;
        var cardHeight = Math.min(errorWords.length, 10) * 50 + 120;
        canvas.height = cardHeight;
        var ctx = canvas.getContext('2d');

        var grad = ctx.createLinearGradient(0, 0, 0, cardHeight);
        grad.addColorStop(0, '#ef4444');
        grad.addColorStop(1, '#dc2626');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 400, cardHeight);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CET-6 错词本', 200, 35);

        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(new Date().toLocaleDateString() + ' | 共 ' + errorWords.length + ' 个错词', 200, 55);

        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        roundRect(ctx, 20, 70, 360, cardHeight - 90, 10);
        ctx.fill();

        ctx.textAlign = 'left';
        var y = 90;
        var showCount = Math.min(errorWords.length, 10);
        for (var i = 0; i < showCount; i++) {
            var w = errorWords[i];
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(w.word, 35, y);
            ctx.font = '11px sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(w.definition, 35, y + 16);
            if (w.count > 1) {
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.fillText('×' + w.count, 360, y);
            }
            y += 45;
        }
        if (errorWords.length > 10) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('... 还有 ' + (errorWords.length - 10) + ' 个错词', 200, y + 5);
        }

        try {
            canvas.toBlob(function(blob) {
                if (navigator.share && navigator.canShare) {
                    var file = new File([blob], 'CET6错词本.png', { type: 'image/png' });
                    if (navigator.canShare({ files: [file] })) {
                        navigator.share({ files: [file], title: 'CET-6 错词本' }).catch(function() {});
                        return;
                    }
                }
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'CET6_错词本_' + new Date().toISOString().slice(0, 10) + '.png';
                a.click();
                showToast('错词卡片已保存', 'success');
            }, 'image/png');
        } catch(e) {
            showToast('生成失败', 'error');
        }
    }

    function clearErrors() {
        if (errorWords.length === 0) { showToast('错词本已为空', 'info'); return; }
        if (!confirm('确定要清空所有 ' + errorWords.length + ' 个错词吗？此操作不可撤销！')) return;
        errorWords = [];
        saveData();
        renderErrors();
        showToast('错词本已清空', 'info');
    }

    var overviewSelectedWord = null;
    var overviewPageSize = 50;
    var overviewCurrentPage = 1;
    var overviewFilteredData = [];
    var overviewLoading = false;

    function initOverviewFilters() {
        var container = $('overviewLetterChips');
        if (!container || container.children.length > 1) return;
        var html = '<span class="cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium" style="background:var(--primary);color:#fff" onclick="setOverviewLetter(\'all\',this)">全部</span>';
        for (var code = 65; code <= 90; code++) {
            var letter = String.fromCharCode(code);
            html += '<span class="cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium" style="background:rgba(255,255,255,0.3);border:1px solid var(--border)" onclick="setOverviewLetter(\'' + letter + '\',this)">' + letter + '</span>';
        }
        container.innerHTML = html;
    }

    function toggleOverviewFilter() {
        var panel = $('overviewFilterPanel');
        var toggle = $('overviewFilterToggle');
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
            toggle.textContent = '收起';
        } else {
            panel.style.display = 'none';
            toggle.textContent = '展开';
        }
    }

    function setOverviewStatus(val, el) {
        window._overviewStatus = val;
        var chips = el.parentNode.children;
        for (var i = 0; i < chips.length; i++) {
            chips[i].classList.remove('eink-chip-active');
        }
        el.classList.add('eink-chip-active');
        renderOverview();
    }

    function setOverviewDiff(val, el) {
        window._overviewDiff = val;
        var chips = el.parentNode.children;
        for (var i = 0; i < chips.length; i++) {
            chips[i].classList.remove('eink-chip-active');
        }
        el.classList.add('eink-chip-active');
        renderOverview();
    }

    function setOverviewSort(val, el) {
        window._overviewSort = val;
        var chips = el.parentNode.children;
        for (var i = 0; i < chips.length; i++) {
            chips[i].classList.remove('eink-chip-active');
        }
        el.classList.add('eink-chip-active');
        renderOverview();
    }

    function setOverviewLetter(val, el) {
        window._overviewLetter = val;
        var chips = el.parentNode.children;
        for (var i = 0; i < chips.length; i++) {
            chips[i].classList.remove('eink-chip-active');
        }
        el.classList.add('eink-chip-active');
        renderOverview();
    }

    function renderOverview() {
        var searchTerm = ($('overviewSearch').value || '').toLowerCase();
        var statusFilter = window._overviewStatus || 'all';
        var diffFilter = window._overviewDiff || 'all';
        var letterFilter = window._overviewLetter || 'all';
        var sortBy = window._overviewSort || 'abc';

        overviewFilteredData = vocabulary.filter(function(w) {
            if (letterFilter !== 'all' && !w.word.toUpperCase().startsWith(letterFilter)) return false;
            if (diffFilter !== 'all' && getDifficulty(w.word) !== diffFilter) return false;
            if (statusFilter === 'mastered' && masteredWords.indexOf(w.word) === -1) return false;
            if (statusFilter === 'wrong' && !errorWords.some(function(e) { return e.word === w.word; })) return false;
            if (statusFilter === 'new' && (masteredWords.indexOf(w.word) !== -1 || errorWords.some(function(e) { return e.word === w.word; }))) return false;
            if (statusFilter === 'favorite' && favoriteWords.indexOf(w.word) === -1) return false;
            if (searchTerm && w.word.toLowerCase().indexOf(searchTerm) === -1 && w.definition.toLowerCase().indexOf(searchTerm) === -1) return false;
            return true;
        });

        if (sortBy === 'abc') {
            overviewFilteredData.sort(function(a, b) { return a.word.localeCompare(b.word); });
        } else if (sortBy === 'reverse') {
            overviewFilteredData.sort(function(a, b) { return b.word.localeCompare(a.word); });
        } else if (sortBy === 'status') {
            var masterSet = {};
            for (var m = 0; m < masteredWords.length; m++) masterSet[masteredWords[m]] = true;
            var wrongSet = {};
            for (var w = 0; w < errorWords.length; w++) wrongSet[errorWords[w].word] = true;
            overviewFilteredData.sort(function(a, b) {
                var sa = wrongSet[a.word] ? 0 : masterSet[a.word] ? 2 : 1;
                var sb = wrongSet[b.word] ? 0 : masterSet[b.word] ? 2 : 1;
                if (sa !== sb) return sa - sb;
                return a.word.localeCompare(b.word);
            });
        }

        $('overviewCount').textContent = '(' + overviewFilteredData.length + '词)';

        overviewCurrentPage = 1;
        renderOverviewPage();
        initOverviewScrollListener();
    }

    function renderOverviewPage() {
        var endIndex = overviewCurrentPage * overviewPageSize;
        var pageData = overviewFilteredData.slice(0, endIndex);

        if (!pageData.length) {
            $('overviewList').innerHTML = '<p class="eink-empty">没有匹配的单词</p>';
            return;
        }

        var masterSet = {};
        for (var i = 0; i < masteredWords.length; i++) masterSet[masteredWords[i]] = true;
        var wrongSet = {};
        for (var j = 0; j < errorWords.length; j++) wrongSet[errorWords[j].word] = true;

        var html = '';
        for (var k = 0; k < pageData.length; k++) {
            var w = pageData[k];
            var statusLabel;
            if (wrongSet[w.word]) {
                statusLabel = '错词';
            } else if (masterSet[w.word]) {
                statusLabel = '已掌握';
            } else {
                statusLabel = '未学';
            }
            var diffLabel = getDifficulty(w.word) === 'easy' ? '简单' : getDifficulty(w.word) === 'hard' ? '困难' : '中等';

            html += '<div class="overview-word-item eink-row" onclick="showWordDetail(\'' + w.word.replace(/'/g, "\\'") + '\')" data-word="' + w.word.replace(/"/g, '&quot;') + '">' +
                '<div class="eink-row-l"><b>' + w.word + '</b><span style="font-size:10px;color:#888;margin-left:6px">' + (w.phonetic || '') + '</span></div>' +
                '<div class="eink-row-r">' + statusLabel + ' · ' + diffLabel + '</div>' +
                '</div>';
        }
        if (endIndex < overviewFilteredData.length) {
            html += '<div id="overviewLoadMore" class="text-center py-4 text-gray-400 text-sm">滚动加载更多...</div>';
        }
        $('overviewList').innerHTML = html;
        overviewSelectedWord = null;
    }

    function loadMoreOverview() {
        if (overviewLoading) return;
        if (overviewCurrentPage * overviewPageSize >= overviewFilteredData.length) return;
        overviewLoading = true;
        overviewCurrentPage++;
        renderOverviewPage();
        overviewLoading = false;
    }

    function initOverviewScrollListener() {
        var list = $('overviewList');
        if (!list) return;
        list.onscroll = function() {
            if (list.scrollTop + list.clientHeight >= list.scrollHeight - 50) {
                loadMoreOverview();
            }
        };
    }

    function toggleOverviewDetail(el) {
        var detail = el.querySelector('.overview-detail');
        if (detail) {
            var isHidden = detail.classList.contains('hidden');
            var allDetails = document.querySelectorAll('.overview-detail');
            for (var i = 0; i < allDetails.length; i++) {
                allDetails[i].classList.add('hidden');
            }
            if (isHidden) {
                detail.classList.remove('hidden');
                var word = el.getAttribute('data-word');
                if (word) overviewSelectedWord = word;
            }
        }
    }

    function speakOverviewWord() {
        var word = overviewSelectedWord;
        if (!word) return;
        speakWord(word);
    }

    function markOverviewMastered(word) {
        if (masteredWords.indexOf(word) === -1) {
            masteredWords.push(word);
            todayMastered++;
            saveData();
            showToast('已标记为掌握 ', 'success');
            renderOverview();
        }
    }

    function markOverviewWrong(word) {
        if (!errorWords.some(function(e) { return e.word === word; })) {
            var w = vocabulary.find(function(v) { return v.word === word; });
            if (w) {
                errorWords.push({
                    word: w.word,
                    phonetic: w.phonetic || '',
                    pos: w.pos || '',
                    definition: w.definition,
                    example: w.example || '',
                    difficulty: getDifficulty(w.word),
                    time: new Date().toISOString(),
                    count: 1
                });
                saveData();
                showToast('已加入错词本', 'error');
                renderOverview();
            }
        }
    }

    function removeErrorWordFromOverview(word) {
        errorWords = errorWords.filter(function(e) { return e.word !== word; });
        saveData();
        showToast('已移出错词本', 'info');
        renderOverview();
    }

    var checkinData = {};
    function loadCheckinData() {
        try {
            checkinData = JSON.parse(localStorage.getItem('cet6_checkin') || '{}');
        } catch(e) {
            checkinData = {};
        }
    }
    function saveCheckinData() {
        localStorage.setItem('cet6_checkin', JSON.stringify(checkinData));
    }
    function getTodayKey() {
        return new Date().toISOString().slice(0, 10);
    }
    function isCheckedInToday() {
        return !!checkinData[getTodayKey()];
    }
    function getCheckinStreak() {
        var streak = 0;
        var d = new Date();
        while (true) {
            var key = d.toISOString().slice(0, 10);
            if (checkinData[key]) {
                streak++;
                d.setDate(d.getDate() - 1);
            } else {
                break;
            }
        }
        return streak;
    }
    function getMonthCheckins() {
        var now = new Date();
        var year = now.getFullYear();
        var month = now.getMonth();
        var count = 0;
        for (var key in checkinData) {
            if (checkinData[key]) {
                var parts = key.split('-');
                if (parseInt(parts[0]) === year && parseInt(parts[1]) === month + 1) {
                    count++;
                }
            }
        }
        return count;
    }
    function doCheckin() {
        if (isCheckedInToday()) {
            showToast('今日已打卡', 'info');
            return;
        }
        checkinData[getTodayKey()] = { time: new Date().toISOString(), words: todayLearned };
        saveCheckinData();
        showToast('打卡成功！', 'success');
        updateCheckinDisplay();
    }
    function updateCheckinDisplay() {
        var checked = isCheckedInToday();
        var streak = getCheckinStreak();
        var monthCount = getMonthCheckins();
        var now = new Date();
        var daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        var btn = $('checkinBtn');
        var icon = $('checkinIcon');
        if (btn && icon) {
            if (checked) {
                btn.style.background = 'var(--success)';
                btn.style.borderColor = 'var(--success)';
                icon.style.opacity = '1';
                icon.style.color = '#fff';
            } else {
                btn.style.background = 'var(--border-light)';
                btn.style.borderColor = 'var(--border)';
                icon.style.opacity = '0.3';
                icon.style.color = '';
            }
        }

        var statusEl = $('checkinStatus');
        if (statusEl) {
            statusEl.textContent = checked ? '今日已打卡' : '今日未打卡';
            statusEl.style.color = checked ? 'var(--success)' : '';
        }

        var streakEl = $('checkinStreak');
        if (streakEl) streakEl.textContent = '连续 ' + streak + ' 天';

        var historyEl = $('checkinHistory');
        if (historyEl) historyEl.textContent = '本月打卡: ' + monthCount + ' / ' + daysInMonth + ' 天';

        var progressEl = $('checkinProgress');
        if (progressEl) progressEl.style.width = Math.round(monthCount / daysInMonth * 100) + '%';
    }

    function renderLeaderboard() {
        var container = $('leaderboardList');
        if (!container) return;

        var history = JSON.parse(localStorage.getItem('cet6_daily_history') || '{}');
        var totalDays = Object.keys(history).filter(function(k) { return history[k] > 0; }).length;
        var totalWords = masteredWords.length;
        var streakDays = streak;
        var accuracy = totalWords > 0 ? Math.round((totalWords - errorWords.length) / totalWords * 100) : 0;

        var achievements = [
            { label: '词汇掌握', value: totalWords, max: vocabulary.length, unit: '词', icon: 'A' },
            { label: '学习天数', value: totalDays, max: 365, unit: '天', icon: 'B' },
            { label: '连续学习', value: streakDays, max: 30, unit: '天', icon: 'C' },
            { label: '正确率', value: accuracy, max: 100, unit: '%', icon: 'D' },
            { label: '今日学习', value: todayLearned, max: parseInt($('dailyGoal').value) || 50, unit: '词', icon: 'E' }
        ];

        var html = '';
        achievements.forEach(function(a) {
            var pct = Math.min(100, Math.round(a.value / a.max * 100));
            var barColor = pct >= 100 ? 'var(--success)' : pct >= 50 ? 'var(--primary)' : 'var(--warning)';
            html += '<div class="flex items-center gap-3 p-2 rounded" style="background:rgba(255,255,255,0.2);border:1px solid rgba(226,232,240,0.3)">';
            html += '<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:' + barColor + ';color:#fff;flex-shrink:0">' + a.icon + '</div>';
            html += '<div class="flex-1 min-w-0">';
            html += '<div class="flex items-center justify-between">';
            html += '<span class="text-sm font-medium">' + a.label + '</span>';
            html += '<span class="text-xs text-gray-500">' + a.value + '/' + a.max + a.unit + '</span>';
            html += '</div>';
            html += '<div class="progress-bar mt-1" style="height:4px"><div class="progress-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>';
            html += '</div>';
            html += '</div>';
        });

        container.innerHTML = html;
    }

    function renderLearningInsights() {
        var container = $('learningInsights');
        if (!container) return;

        var history = JSON.parse(localStorage.getItem('cet6_daily_history') || '{}');
        var totalDays = Object.keys(history).filter(function(k) { return history[k] > 0; }).length;
        var totalWords = masteredWords.length;
        var totalLearned = Object.values(history).reduce(function(s, v) { return s + v; }, 0) + todayLearned;

        var avgPerDay = totalDays > 0 ? Math.round(totalLearned / totalDays) : 0;
        var remaining = vocabulary.length - totalWords;
        var daysToComplete = avgPerDay > 0 ? Math.ceil(remaining / avgPerDay) : 0;
        var completionDate = new Date();
        completionDate.setDate(completionDate.getDate() + daysToComplete);

        var learnMinutes = Math.floor(learnTime / 60);
        var wordsPerHour = learnMinutes > 0 ? Math.round(totalWords / (learnMinutes / 60)) : 0;

        var dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        var dayCounts = [0, 0, 0, 0, 0, 0, 0];
        Object.keys(history).forEach(function(k) {
            var d = new Date(k + 'T00:00:00');
            dayCounts[d.getDay()] += history[k] || 0;
        });
        var maxDayIndex = dayCounts.indexOf(Math.max.apply(null, dayCounts));

        var html = '';

        html += '<div class="flex items-center gap-3 p-2 rounded" style="background:rgba(255,255,255,0.2);border:1px solid rgba(226,232,240,0.3)">';
        html += '<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:var(--primary);color:#fff;flex-shrink:0">1</div>';
        html += '<div class="flex-1">';
        html += '<div class="text-sm font-medium">日均学习</div>';
        html += '<div class="text-xs text-gray-500">平均每天学习 ' + avgPerDay + ' 个单词</div>';
        html += '</div></div>';

        html += '<div class="flex items-center gap-3 p-2 rounded" style="background:rgba(255,255,255,0.2);border:1px solid rgba(226,232,240,0.3)">';
        html += '<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:var(--success);color:#fff;flex-shrink:0">2</div>';
        html += '<div class="flex-1">';
        html += '<div class="text-sm font-medium">学习效率</div>';
        html += '<div class="text-xs text-gray-500">每小时掌握 ' + wordsPerHour + ' 个单词</div>';
        html += '</div></div>';

        html += '<div class="flex items-center gap-3 p-2 rounded" style="background:rgba(255,255,255,0.2);border:1px solid rgba(226,232,240,0.3)">';
        html += '<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:var(--warning);color:#fff;flex-shrink:0">3</div>';
        html += '<div class="flex-1">';
        html += '<div class="text-sm font-medium">预计完成</div>';
        html += '<div class="text-xs text-gray-500">按当前速度，' + completionDate.toLocaleDateString() + ' 完成全部词汇</div>';
        html += '</div></div>';

        html += '<div class="flex items-center gap-3 p-2 rounded" style="background:rgba(255,255,255,0.2);border:1px solid rgba(226,232,240,0.3)">';
        html += '<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:var(--info);color:#fff;flex-shrink:0">4</div>';
        html += '<div class="flex-1">';
        html += '<div class="text-sm font-medium">最活跃日</div>';
        html += '<div class="text-xs text-gray-500">星期' + dayNames[maxDayIndex] + ' 学习最多</div>';
        html += '</div></div>';

        container.innerHTML = html;
    }

    function renderMasteryChart() {
        var chart = $('masteryChart');
        if (!chart) return;

        var masterSet = {};
        for (var i = 0; i < masteredWords.length; i++) masterSet[masteredWords[i]] = true;
        var wrongSet = {};
        for (var j = 0; j < errorWords.length; j++) wrongSet[errorWords[j].word] = true;

        var data = [
            { label: '简单', easy: { mastered: 0, wrong: 0, new: 0 } },
            { label: '中等', easy: { mastered: 0, wrong: 0, new: 0 } },
            { label: '困难', easy: { mastered: 0, wrong: 0, new: 0 } }
        ];

        for (var k = 0; k < vocabulary.length; k++) {
            var w = vocabulary[k];
            var d = getDifficulty(w.word);
            var idx = d === 'easy' ? 0 : d === 'medium' ? 1 : 2;
            if (masterSet[w.word]) data[idx].easy.mastered++;
            else if (wrongSet[w.word]) data[idx].easy.wrong++;
            else data[idx].easy.new++;
        }

        var html = '<div style="display:flex;gap:8px;height:100%;align-items:flex-end">';
        var colors = { mastered: '#10b981', wrong: '#ef4444', new: '#94a3b8' };
        var labels = ['简单', '中等', '困难'];

        for (var m = 0; m < data.length; m++) {
            var item = data[m];
            var total = item.easy.mastered + item.easy.wrong + item.easy.new;
            if (total === 0) continue;

            html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">';
            html += '<div style="font-size:10px;color:var(--text-secondary)">' + labels[m] + '</div>';
            html += '<div style="flex:1;width:100%;display:flex;flex-direction:column;justify-content:flex-end;gap:1px">';

            if (item.easy.mastered > 0) {
                var h = Math.max(4, Math.round(item.easy.mastered / total * 80));
                html += '<div style="height:' + h + 'px;background:' + colors.mastered + ';border-radius:2px 2px 0 0;display:flex;align-items:center;justify-content:center"><span style="font-size:9px;color:#fff">' + item.easy.mastered + '</span></div>';
            }
            if (item.easy.wrong > 0) {
                var h = Math.max(4, Math.round(item.easy.wrong / total * 80));
                html += '<div style="height:' + h + 'px;background:' + colors.wrong + ';display:flex;align-items:center;justify-content:center"><span style="font-size:9px;color:#fff">' + item.easy.wrong + '</span></div>';
            }
            if (item.easy.new > 0) {
                var h = Math.max(4, Math.round(item.easy.new / total * 80));
                html += '<div style="height:' + h + 'px;background:' + colors.new + ';border-radius:0 0 2px 2px;display:flex;align-items:center;justify-content:center"><span style="font-size:9px;color:#fff">' + item.easy.new + '</span></div>';
            }

            html += '</div>';
            html += '<div style="font-size:10px;color:var(--text-tertiary)">' + total + '</div>';
            html += '</div>';
        }

        html += '</div>';
        html += '<div style="display:flex;gap:12px;justify-content:center;margin-top:8px">';
        html += '<span style="font-size:10px;color:var(--text-tertiary)"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + colors.mastered + '"></span> 已掌握</span>';
        html += '<span style="font-size:10px;color:var(--text-tertiary)"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + colors.wrong + '"></span> 错词</span>';
        html += '<span style="font-size:10px;color:var(--text-tertiary)"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + colors.new + '"></span> 未学</span>';
        html += '</div>';

        chart.innerHTML = html;
    }

    function renderEfficiencyAnalysis() {
        var container = $('efficiencyAnalysis');
        if (!container) return;

        var history = JSON.parse(localStorage.getItem('cet6_daily_history') || '{}');
        var totalDays = Object.keys(history).filter(function(k) { return history[k] > 0; }).length;
        var totalWords = masteredWords.length;
        var learnMinutes = Math.floor(learnTime / 60);
        var wrongCount = errorWords.length;

        var wordsPerHour = learnMinutes > 0 ? Math.round(totalWords / (learnMinutes / 60)) : 0;
        var retentionRate = totalWords > 0 ? Math.round((totalWords - wrongCount) / totalWords * 100) : 0;
        var consistency = totalDays > 0 ? Math.min(100, Math.round(totalDays / 30 * 100)) : 0;
        var goal = parseInt($('dailyGoal').value) || 50;
        var goalAchieved = Object.values(history).filter(function(v) { return v >= goal; }).length;
        var goalRate = totalDays > 0 ? Math.round(goalAchieved / totalDays * 100) : 0;

        var efficiencyScore = Math.round((wordsPerHour * 0.3 + retentionRate * 0.4 + consistency * 0.2 + goalRate * 0.1));
        efficiencyScore = Math.min(100, efficiencyScore);

        var level = '';
        var levelColor = '';
        if (efficiencyScore >= 80) { level = '优秀'; levelColor = 'var(--success)'; }
        else if (efficiencyScore >= 60) { level = '良好'; levelColor = 'var(--primary)'; }
        else if (efficiencyScore >= 40) { level = '一般'; levelColor = 'var(--warning)'; }
        else { level = '需改进'; levelColor = 'var(--danger)'; }

        var recommendations = [];
        if (wordsPerHour < 10) recommendations.push('学习速度较慢，建议提高专注度');
        if (retentionRate < 80) recommendations.push('正确率偏低，建议加强复习');
        if (consistency < 50) recommendations.push('学习不够连续，建议每日坚持');
        if (goalRate < 50) recommendations.push('目标完成率低，建议调整目标');
        if (recommendations.length === 0) recommendations.push('学习状态良好，继续保持！');

        var html = '';

        html += '<div class="text-center mb-4">';
        html += '<div style="width:80px;height:80px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;background:' + levelColor + ';color:#fff">' + efficiencyScore + '</div>';
        html += '<div class="text-sm font-medium mt-2" style="color:' + levelColor + '">' + level + '</div>';
        html += '<div class="text-xs text-gray-400">学习效率评分</div>';
        html += '</div>';

        html += '<div class="grid grid-cols-2 gap-2 mb-3">';
        html += '<div class="p-2 rounded text-center" style="background:rgba(255,255,255,0.2);border:1px solid rgba(226,232,240,0.3)"><div class="text-lg font-bold" style="color:var(--primary)">' + wordsPerHour + '</div><div class="text-xs text-gray-400">每小时掌握</div></div>';
        html += '<div class="p-2 rounded text-center" style="background:rgba(255,255,255,0.2);border:1px solid rgba(226,232,240,0.3)"><div class="text-lg font-bold" style="color:var(--success)">' + retentionRate + '%</div><div class="text-xs text-gray-400">正确率</div></div>';
        html += '<div class="p-2 rounded text-center" style="background:rgba(255,255,255,0.2);border:1px solid rgba(226,232,240,0.3)"><div class="text-lg font-bold" style="color:var(--warning)">' + consistency + '%</div><div class="text-xs text-gray-400">连续性</div></div>';
        html += '<div class="p-2 rounded text-center" style="background:rgba(255,255,255,0.2);border:1px solid rgba(226,232,240,0.3)"><div class="text-lg font-bold" style="color:var(--info)">' + goalRate + '%</div><div class="text-xs text-gray-400">目标达成</div></div>';
        html += '</div>';

        html += '<div class="p-2 rounded" style="background:rgba(255,255,255,0.2);border:1px solid rgba(226,232,240,0.3)">';
        html += '<div class="text-sm font-medium mb-1">学习建议</div>';
        html += '<ul class="text-xs text-gray-500 space-y-1">';
        recommendations.forEach(function(r) {
            html += '<li> ' + r + '</li>';
        });
        html += '</ul></div>';

        container.innerHTML = html;
    }

    function renderLearningPath() {
        var container = $('learningPath');
        if (!container) return;

        var masterSet = {};
        for (var i = 0; i < masteredWords.length; i++) masterSet[masteredWords[i]] = true;
        var wrongSet = {};
        for (var j = 0; j < errorWords.length; j++) wrongSet[errorWords[j].word] = true;

        var stages = [
            { name: '基础词汇', desc: '简单单词 (1-5字母)', color: 'var(--success)', icon: '1' },
            { name: '进阶词汇', desc: '中等单词 (6-8字母)', color: 'var(--primary)', icon: '2' },
            { name: '高阶词汇', desc: '困难单词 (9+字母)', color: 'var(--warning)', icon: '3' }
        ];

        var stageData = [
            { total: 0, mastered: 0, wrong: 0, new: 0 },
            { total: 0, mastered: 0, wrong: 0, new: 0 },
            { total: 0, mastered: 0, wrong: 0, new: 0 }
        ];

        for (var k = 0; k < vocabulary.length; k++) {
            var w = vocabulary[k];
            var d = getDifficulty(w.word);
            var idx = d === 'easy' ? 0 : d === 'medium' ? 1 : 2;
            stageData[idx].total++;
            if (masterSet[w.word]) stageData[idx].mastered++;
            else if (wrongSet[w.word]) stageData[idx].wrong++;
            else stageData[idx].new++;
        }

        var goal = parseInt($('dailyGoal').value) || 50;
        var html = '';

        for (var m = 0; m < stages.length; m++) {
            var stage = stages[m];
            var data = stageData[m];
            var pct = data.total > 0 ? Math.round(data.mastered / data.total * 100) : 0;
            var daysLeft = data.new > 0 ? Math.ceil(data.new / goal) : 0;
            var isActive = data.new > 0 && (m === 0 || stageData[m-1].mastered >= stageData[m-1].total * 0.8);

            html += '<div class="p-3 rounded" style="background:' + (isActive ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)') + ';border:1px solid ' + (isActive ? 'rgba(99,102,241,0.3)' : 'rgba(226,232,240,0.3)') + '">';
            html += '<div class="flex items-center gap-3 mb-2">';
            html += '<div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;background:' + stage.color + ';color:#fff;flex-shrink:0">' + stage.icon + '</div>';
            html += '<div class="flex-1">';
            html += '<div class="flex items-center justify-between">';
            html += '<span class="text-sm font-medium">' + stage.name + '</span>';
            html += '<span class="text-xs" style="color:' + (pct >= 100 ? 'var(--success)' : 'var(--text-tertiary)') + '">' + pct + '%</span>';
            html += '</div>';
            html += '<div class="text-xs text-gray-400">' + stage.desc + '</div>';
            html += '</div>';
            html += '</div>';
            html += '<div class="progress-bar mb-2" style="height:4px"><div class="progress-fill" style="width:' + pct + '%;background:' + stage.color + '"></div></div>';
            html += '<div class="flex justify-between text-xs text-gray-400">';
            html += '<span>已掌握 ' + data.mastered + '/' + data.total + '</span>';
            html += '<span>' + (daysLeft > 0 ? '约需 ' + daysLeft + ' 天' : '已完成') + '</span>';
            html += '</div>';
            html += '</div>';
        }

        container.innerHTML = html;
    }

    function updateStats() {
        $('statTotal').textContent = vocabulary.length;
        $('statMastered').textContent = masteredWords.length;
        $('statWrong').textContent = errorWords.length;
        $('statTime').textContent = Math.floor(learnTime / 60);
        $('statToday').textContent = todayLearned;
        $('statStreak').textContent = streak;
        if ($('statsStreak')) $('statsStreak').textContent = streak;
        $('statTodayGoal').textContent = $('dailyGoal').value || 50;

        var pct = vocabulary.length ? Math.round(masteredWords.length / vocabulary.length * 100) : 0;
        $('progressRing').setAttribute('stroke-dasharray', pct + ' ' + (100 - pct));
        $('progressPercent').textContent = pct + '%';
        $('progressDetail').textContent = '已掌握 ' + masteredWords.length + ' / ' + vocabulary.length;
        $('progressRemaining').textContent = vocabulary.length - masteredWords.length;

        var easyCount = 0, mediumCount = 0, hardCount = 0;
        for (var i = 0; i < vocabulary.length; i++) {
            var d = getDifficulty(vocabulary[i].word);
            if (d === 'easy') easyCount++;
            else if (d === 'hard') hardCount++;
            else mediumCount++;
        }
        $('statEasy').textContent = easyCount;
        $('statMedium').textContent = mediumCount;
        $('statHard').textContent = hardCount;
        renderChart();
        renderStreakCalendar();
        renderWeaknessAnalysis();
        renderDailyChallenges();
        updateCheckinDisplay();
        renderLeaderboard();
        renderLearningInsights();
        renderMasteryChart();
        renderEfficiencyAnalysis();
        renderLearningPath();
    }

    var chartRange = 7;

    function setChartRange(days) {
        chartRange = days;
        $('btnChart7').className = 'eink-chip' + (days === 7 ? ' eink-chip-active' : '');
        $('btnChart30').className = 'eink-chip' + (days === 30 ? ' eink-chip-active' : '');
        $('chartTitle').textContent = '近' + days + '天学习量';
        $('chartDetail').style.display = 'none';
        renderChart();
    }

    function renderChart() {
        var chart = $('weeklyChart');
        if (!chart) return;
        var history = JSON.parse(localStorage.getItem('cet6_daily_history') || '{}');
        var today = new Date();
        var days = [];
        for (var i = chartRange - 1; i >= 0; i--) {
            var d = new Date(today);
            d.setDate(d.getDate() - i);
            var key = d.toISOString().slice(0, 10);
            var label = (d.getMonth() + 1) + '/' + d.getDate();
            var count = history[key] || 0;
            if (i === 0) count = todayLearned;
            days.push({ label: label, key: key, count: count, isToday: i === 0 });
        }
        var maxCount = 1;
        for (var j = 0; j < days.length; j++) {
            if (days[j].count > maxCount) maxCount = days[j].count;
        }
        var html = '';
        var barW = chartRange <= 7 ? '100%' : '80%';
        for (var k = 0; k < days.length; k++) {
            var d = days[k];
            var pct = maxCount > 0 ? Math.round(d.count / maxCount * 100) : 0;
            var barColor = d.isToday ? 'var(--primary)' : 'rgba(99,102,241,0.5)';
            html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer" onclick="showDayDetail(\'' + d.key + '\',' + d.count + ')">';
            html += '<div style="font-size:10px;color:var(--text-secondary)">' + d.count + '</div>';
            html += '<div style="flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center">';
            html += '<div style="width:' + barW + ';height:' + Math.max(2, pct) + '%;background:' + barColor + ';border-radius:3px 3px 0 0;min-height:2px"></div>';
            html += '</div>';
            html += '<div style="font-size:' + (chartRange <= 7 ? '11' : '9') + 'px;color:' + (d.isToday ? 'var(--primary)' : 'var(--text-tertiary)') + ';font-weight:' + (d.isToday ? '700' : '400') + '">' + d.label + '</div>';
            html += '</div>';
        }
        chart.innerHTML = html;
    }

    function showDayDetail(dateKey, count) {
        var detail = $('chartDetail');
        if (!detail) return;
        var d = new Date(dateKey + 'T00:00:00');
        var dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        var title = (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + dayNames[d.getDay()];
        var goal = parseInt($('dailyGoal').value) || 50;
        var pct = Math.min(100, Math.round(count / goal * 100));
        detail.innerHTML = '<div class="flex items-center justify-between mb-2">' +
            '<span class="font-medium">' + title + '</span>' +
            '<span class="text-xs text-gray-400" onclick="$(\'chartDetail\').style.display=\'none\'" style="cursor:pointer">关闭</span></div>' +
            '<div class="flex justify-between text-sm"><span>学习单词</span><span class="font-medium">' + count + ' 个</span></div>' +
            '<div class="flex justify-between text-sm mt-1"><span>每日目标</span><span class="font-medium">' + goal + ' 个</span></div>' +
            '<div class="flex justify-between text-sm mt-1"><span>完成率</span><span class="font-medium">' + pct + '%</span></div>' +
            '<div class="progress-bar mt-2"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
        detail.style.display = 'block';
    }

    function renderStreakCalendar() {
        var cal = $('streakCalendar');
        if (!cal) return;
        var history = JSON.parse(localStorage.getItem('cet6_daily_history') || '{}');
        var today = new Date();
        var html = '';
        var streakDays = 0;
        for (var i = 27; i >= 0; i--) {
            var d = new Date(today);
            d.setDate(d.getDate() - i);
            var key = d.toISOString().slice(0, 10);
            var count = history[key] || 0;
            if (i === 0) count = todayLearned;
            var bg = count > 0 ? 'var(--primary)' : 'var(--border-light)';
            var opacity = count > 0 ? Math.min(1, count / 50) : 0.3;
            var dayNum = d.getDate();
            html += '<div style="aspect-ratio:1;background:' + bg + ';opacity:' + opacity + ';border-radius:3px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;color:' + (count > 0 ? '#fff' : 'var(--text-tertiary)') + '" onclick="showStreakDayDetail(\'' + key + '\',' + count + ')" title="' + key + ': ' + count + '词">' + dayNum + '</div>';
            if (count > 0) streakDays++;
        }
        cal.innerHTML = html;
        $('streakCount').textContent = streakDays + ' 天';
    }

    function showStreakDayDetail(dateKey, count) {
        var d = new Date(dateKey + 'T00:00:00');
        var dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        var title = (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + dayNames[d.getDay()];
        var goal = parseInt($('dailyGoal').value) || 50;
        var pct = count > 0 ? Math.min(100, Math.round(count / goal * 100)) : 0;
        showToast(title + ': 学习' + count + '词, 完成' + pct + '%', count > 0 ? 'success' : 'info');
    }

    function renderWeaknessAnalysis() {
        var container = $('weaknessAnalysis');
        if (!container) return;
        if (!errorWords.length) {
            container.innerHTML = '<p class="text-gray-400 text-sm">暂无错词数据，继续学习吧！</p>';
            return;
        }

        var html = '';

        // 1. 难度分析
        var easyWrong = 0, mediumWrong = 0, hardWrong = 0;
        errorWords.forEach(function(e) {
            var d = e.difficulty || getDifficulty(e.word);
            if (d === 'easy') easyWrong++;
            else if (d === 'hard') hardWrong++;
            else mediumWrong++;
        });
        var totalWrong = errorWords.length;
        html += '<div class="p-3 rounded" style="background:rgba(255,255,255,0.25);border:1px solid rgba(226,232,240,0.3)">';
        html += '<div class="font-medium mb-2">难度分布</div>';
        html += '<div class="flex gap-2 text-sm">';
        html += '<span class="text-green-600">简单: ' + easyWrong + ' (' + Math.round(easyWrong/totalWrong*100) + '%)</span>';
        html += '<span class="text-yellow-600">中等: ' + mediumWrong + ' (' + Math.round(mediumWrong/totalWrong*100) + '%)</span>';
        html += '<span class="text-red-600">困难: ' + hardWrong + ' (' + Math.round(hardWrong/totalWrong*100) + '%)</span>';
        html += '</div></div>';

        // 2. 词性分析
        var posMap = {};
        errorWords.forEach(function(e) {
            var pos = (e.pos || '未知').replace(/[.&]/g, '').trim();
            if (!posMap[pos]) posMap[pos] = 0;
            posMap[pos]++;
        });
        var posArr = Object.keys(posMap).map(function(k) { return { pos: k, count: posMap[k] }; });
        posArr.sort(function(a, b) { return b.count - a.count; });
        html += '<div class="p-3 rounded" style="background:rgba(255,255,255,0.25);border:1px solid rgba(226,232,240,0.3)">';
        html += '<div class="font-medium mb-2">词性分布</div>';
        html += '<div class="flex flex-wrap gap-2 text-sm">';
        posArr.slice(0, 5).forEach(function(p) {
            html += '<span class="px-2 py-1 rounded" style="background:rgba(99,102,241,0.1)">' + p.pos + ': ' + p.count + '</span>';
        });
        html += '</div></div>';

        // 3. 字母组合分析
        var letterMap = {};
        errorWords.forEach(function(e) {
            var w = e.word.toLowerCase();
            for (var i = 0; i < w.length - 1; i++) {
                var pair = w.substring(i, i + 2);
                if (/^[a-z]{2}$/.test(pair)) {
                    if (!letterMap[pair]) letterMap[pair] = 0;
                    letterMap[pair]++;
                }
            }
        });
        var letterArr = Object.keys(letterMap).map(function(k) { return { pair: k, count: letterMap[k] }; });
        letterArr.sort(function(a, b) { return b.count - a.count; });
        html += '<div class="p-3 rounded" style="background:rgba(255,255,255,0.25);border:1px solid rgba(226,232,240,0.3)">';
        html += '<div class="font-medium mb-2">常见错误字母组合</div>';
        html += '<div class="flex flex-wrap gap-2 text-sm">';
        letterArr.slice(0, 8).forEach(function(l) {
            html += '<span class="px-2 py-1 rounded font-mono" style="background:rgba(239,68,68,0.1)">' + l.pair + ': ' + l.count + '</span>';
        });
        html += '</div></div>';

        // 4. 学习建议
        html += '<div class="p-3 rounded" style="background:rgba(255,255,255,0.25);border:1px solid rgba(226,232,240,0.3)">';
        html += '<div class="font-medium mb-2">学习建议</div>';
        html += '<ul class="text-sm space-y-1 list-disc list-inside">';
        if (hardWrong > totalWrong * 0.4) {
            html += '<li>困难单词占比偏高，建议先巩固简单和中等难度单词</li>';
        }
        if (posArr.length > 0 && posArr[0].count > totalWrong * 0.3) {
            html += '<li>' + posArr[0].pos + '类单词错误较多，建议重点复习</li>';
        }
        if (letterArr.length > 0 && letterArr[0].count > 3) {
            html += '<li>含有 "' + letterArr[0].pair + '" 的单词经常出错，建议注意拼写</li>';
        }
        html += '<li>建议每天复习 ' + Math.min(20, totalWrong) + ' 个错词</li>';
        html += '</ul></div>';

        container.innerHTML = html;
    }

    function renderDailyChallenges() {
        var container = $('dailyChallenges');
        if (!container) return;
        var dateEl = $('challengeDate');
        var today = new Date();
        var dateStr = (today.getMonth() + 1) + '月' + today.getDate() + '日';
        if (dateEl) dateEl.textContent = dateStr;

        var goal = parseInt($('dailyGoal').value) || 50;
        var challenges = [
            { id: 'learn_goal', name: '达成目标', desc: '今日学习 ' + goal + ' 个单词', target: goal, current: todayLearned, unit: '个' },
            { id: 'learn_extra', name: '超额学习', desc: '今日学习 ' + Math.round(goal * 1.5) + ' 个单词', target: Math.round(goal * 1.5), current: todayLearned, unit: '个' },
            { id: 'review_errors', name: '错词清零', desc: '复习 10 个错词', target: 10, current: Math.min(10, errorWords.length), unit: '个' },
            { id: 'streak_keep', name: '坚持不懈', desc: '保持连续学习', target: 1, current: streak > 0 ? 1 : 0, unit: '天' },
            { id: 'no_errors', name: '完美通关', desc: '拼写闯关零错误', target: 1, current: 0, unit: '次' }
        ];

        var completed = 0;
        var html = '';
        for (var i = 0; i < challenges.length; i++) {
            var c = challenges[i];
            var done = c.current >= c.target;
            if (done) completed++;
            var pct = Math.min(100, Math.round(c.current / c.target * 100));
            var barColor = done ? 'var(--success)' : 'var(--primary)';
            html += '<div class="flex items-center gap-3 p-2 rounded" style="background:' + (done ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.2)') + ';border:1px solid ' + (done ? 'rgba(16,185,129,0.2)' : 'rgba(226,232,240,0.3)') + '">';
            html += '<div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;background:' + (done ? 'var(--success)' : 'var(--border-light)') + ';color:' + (done ? '#fff' : 'var(--text-tertiary)') + '">' + (done ? 'V' : (i + 1)) + '</div>';
            html += '<div class="flex-1 min-w-0">';
            html += '<div class="flex items-center justify-between">';
            html += '<span class="text-sm font-medium">' + c.name + '</span>';
            html += '<span class="text-xs" style="color:' + (done ? 'var(--success)' : 'var(--text-tertiary)') + '">' + c.current + '/' + c.target + c.unit + '</span>';
            html += '</div>';
            html += '<div class="progress-bar" style="height:4px;margin-top:4px"><div class="progress-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>';
            html += '</div>';
            html += '</div>';
        }
        container.innerHTML = html;
    }

    function generateStatCard() {
        var total = vocabulary.length;
        var mastered = masteredWords.length;
        var wrong = errorWords.length;
        var pct = total > 0 ? Math.round(mastered / total * 100) : 0;
        var streakDays = streak;
        var today = todayLearned;
        var goal = parseInt($('dailyGoal').value) || 50;
        var todayPct = Math.min(100, Math.round(today / goal * 100));

        var canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 560;
        var ctx = canvas.getContext('2d');

        var grad = ctx.createLinearGradient(0, 0, 0, 560);
        grad.addColorStop(0, '#6366f1');
        grad.addColorStop(1, '#8b5cf6');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 400, 560);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CET-6 词汇学习', 200, 50);

        ctx.font = '14px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(new Date().toLocaleDateString(), 200, 75);

        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(200, 180, 70, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(200, 180, 70, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct / 100));
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText(pct + '%', 200, 190);

        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText('掌握进度', 200, 215);

        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        roundRect(ctx, 30, 280, 340, 70, 12);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(mastered + ' / ' + total, 50, 325);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText('已掌握词汇', 50, 340);

        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        roundRect(ctx, 30, 365, 160, 70, 12);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(streakDays, 110, 405);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText('连续天数', 110, 425);

        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        roundRect(ctx, 210, 365, 160, 70, 12);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(today, 290, 405);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText('今日学习', 290, 425);

        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        roundRect(ctx, 30, 450, 340, 50, 12);
        ctx.fill();
        var barWidth = 300 * todayPct / 100;
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        roundRect(ctx, 50, 465, 300, 20, 10);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        if (barWidth > 0) {
            roundRect(ctx, 50, 465, barWidth, 20, 10);
            ctx.fill();
        }
        ctx.font = '11px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.textAlign = 'center';
        ctx.fillText('今日目标: ' + today + '/' + goal, 200, 500);

        try {
            canvas.toBlob(function(blob) {
                if (navigator.share && navigator.canShare) {
                    var file = new File([blob], 'CET6学习统计.png', { type: 'image/png' });
                    if (navigator.canShare({ files: [file] })) {
                        navigator.share({ files: [file], title: 'CET-6 学习统计' }).catch(function() {});
                        return;
                    }
                }
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'CET6_学习统计_' + new Date().toISOString().slice(0, 10) + '.png';
                a.click();
                showToast('统计卡片已保存', 'success');
            }, 'image/png');
        } catch(e) {
            showToast('生成失败', 'error');
        }
    }

    function shareProgress() {
        var total = vocabulary.length;
        var mastered = masteredWords.length;
        var wrong = errorWords.length;
        var pct = total > 0 ? Math.round(mastered / total * 100) : 0;
        var goal = parseInt($('dailyGoal').value) || 50;
        var todayPct = Math.min(100, Math.round(todayLearned / goal * 100));

        var text = 'CET-6 词汇学习进度\n';
        text += '━━━━━━━━━━━━━━\n';
        text += '已掌握: ' + mastered + '/' + total + ' (' + pct + '%)\n';
        text += '今日学习: ' + todayLearned + '/' + goal + ' (' + todayPct + '%)\n';
        text += '连续学习: ' + streak + ' 天\n';
        text += '错词数: ' + wrong + '\n';
        text += '━━━━━━━━━━━━━━\n';
        text += '使用 CET-6 词汇学习系统';

        if (navigator.share) {
            navigator.share({ title: 'CET-6 学习进度', text: text }).catch(function() {});
        } else {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(function() {
                    showToast('进度已复制到剪贴板', 'success');
                });
            } else {
                var ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                showToast('进度已复制到剪贴板', 'success');
            }
        }
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function showStatDetail(type) {
        var panel = $('statDetailPanel');
        var title = $('statDetailTitle');
        var content = $('statDetailContent');
        panel.style.display = 'block';

        if (type === 'mastered') {
            title.textContent = '已掌握单词 (' + masteredWords.length + ')';
            if (!masteredWords.length) { content.innerHTML = '<p class="text-gray-400">暂无已掌握单词</p>'; return; }
            var html = '<div class="max-h-64 overflow-y-auto">';
            for (var i = 0; i < masteredWords.length; i++) {
                var w = vocabulary.find(function(v) { return v.word === masteredWords[i]; });
                if (w) {
                    html += '<div class="flex items-center justify-between py-2 border-b border-gray-100">' +
                        '<div><span class="font-medium">' + w.word + '</span> <span class="text-xs text-gray-400">' + (w.phonetic || '') + '</span></div>' +
                        '<div class="text-sm text-gray-500">' + (w.definition || '') + '</div></div>';
                }
            }
            html += '</div>';
            content.innerHTML = html;
        } else if (type === 'wrong') {
            title.textContent = '错词本 (' + errorWords.length + ')';
            if (!errorWords.length) { content.innerHTML = '<p class="text-gray-400">暂无错词</p>'; return; }
            var html = '<div class="max-h-64 overflow-y-auto">';
            for (var i = 0; i < errorWords.length; i++) {
                var w = errorWords[i];
                html += '<div class="flex items-center justify-between py-2 border-b border-gray-100">' +
                    '<div><span class="font-medium">' + w.word + '</span> <span class="text-xs text-gray-400">' + (w.phonetic || '') + '</span></div>' +
                    '<div class="text-sm text-gray-500">' + (w.definition || '') + '</div></div>';
            }
            html += '</div>';
            content.innerHTML = html;
        } else if (type === 'easy' || type === 'medium' || type === 'hard') {
            var labels = { easy: '简单 (1-5字母)', medium: '中等 (6-8字母)', hard: '困难 (9+字母)' };
            title.textContent = labels[type] + ' 掌握进度';
            var total = 0, mastered = 0, wrong = 0;
            for (var i = 0; i < vocabulary.length; i++) {
                if (getDifficulty(vocabulary[i].word) === type) {
                    total++;
                    if (masteredWords.indexOf(vocabulary[i].word) !== -1) mastered++;
                    if (errorWords.some(function(e) { return e.word === vocabulary[i].word; })) wrong++;
                }
            }
            var pct = total > 0 ? Math.round(mastered / total * 100) : 0;
            var wrongPct = total > 0 ? Math.round(wrong / total * 100) : 0;
            content.innerHTML = '<div class="space-y-3">' +
                '<div class="flex justify-between"><span>总单词数</span><span class="font-medium">' + total + '</span></div>' +
                '<div class="flex justify-between"><span>已掌握</span><span class="font-medium">' + mastered + ' (' + pct + '%)</span></div>' +
                '<div class="flex justify-between"><span>错词</span><span class="font-medium">' + wrong + ' (' + wrongPct + '%)</span></div>' +
                '<div class="flex justify-between"><span>未学习</span><span class="font-medium">' + (total - mastered - wrong) + '</span></div>' +
                '<div class="progress-bar mt-2"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
                '<div class="text-xs text-gray-400 text-center">' + pct + '% 已掌握</div>' +
                '</div>';
        } else if (type === 'time') {
            title.textContent = '学习时长';
            var mins = Math.floor(learnTime / 60);
            var hours = Math.floor(mins / 60);
            var days = Math.floor(hours / 24);
            content.innerHTML = '<div class="space-y-2">' +
                '<div class="flex justify-between"><span>总学习时长</span><span class="font-medium">' + (hours > 0 ? hours + '小时' : '') + (mins % 60) + '分钟</span></div>' +
                '<div class="flex justify-between"><span>今日学习</span><span class="font-medium">' + todayLearned + ' 个单词</span></div>' +
                '<div class="flex justify-between"><span>连续天数</span><span class="font-medium">' + streak + ' 天</span></div>' +
                '</div>';
        } else if (type === 'streak') {
            title.textContent = '连续学习';
            content.innerHTML = '<div class="space-y-2">' +
                '<div class="flex justify-between"><span>当前连续</span><span class="font-medium">' + streak + ' 天</span></div>' +
                '<div class="flex justify-between"><span>今日已学</span><span class="font-medium">' + todayLearned + ' 个</span></div>' +
                '<div class="flex justify-between"><span>每日目标</span><span class="font-medium">' + ($('dailyGoal').value || 50) + ' 个</span></div>' +
                '</div>';
        } else if (type === 'goal') {
            title.textContent = '每日目标';
            var goal = parseInt($('dailyGoal').value) || 50;
            var remaining = Math.max(0, goal - todayLearned);
            content.innerHTML = '<div class="space-y-2">' +
                '<div class="flex justify-between"><span>目标</span><span class="font-medium">' + goal + ' 个/天</span></div>' +
                '<div class="flex justify-between"><span>今日已完成</span><span class="font-medium">' + todayLearned + ' 个</span></div>' +
                '<div class="flex justify-between"><span>还需</span><span class="font-medium">' + remaining + ' 个</span></div>' +
                '<div class="progress-bar mt-2"><div class="progress-fill" style="width:' + Math.min(100, Math.round(todayLearned / goal * 100)) + '%"></div></div>' +
                '</div>';
        } else if (type === 'total') {
            title.textContent = '词汇总览';
            content.innerHTML = '<div class="space-y-2">' +
                '<div class="flex justify-between"><span>总词汇量</span><span class="font-medium">' + vocabulary.length + ' 个</span></div>' +
                '<div class="flex justify-between"><span>已掌握</span><span class="font-medium">' + masteredWords.length + ' 个</span></div>' +
                '<div class="flex justify-between"><span>错词</span><span class="font-medium">' + errorWords.length + ' 个</span></div>' +
                '<div class="flex justify-between"><span>未学习</span><span class="font-medium">' + (vocabulary.length - masteredWords.length) + ' 个</span></div>' +
                '</div>';
        }
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function showStatWordList(container, difficulty) {
        var words = vocabulary.filter(function(w) { return getDifficulty(w.word) === difficulty; });
        if (!words.length) { container.innerHTML = '<p class="text-gray-400">暂无单词</p>'; return; }
        var html = '<div class="max-h-64 overflow-y-auto">';
        for (var i = 0; i < Math.min(words.length, 100); i++) {
            var w = words[i];
            var isMastered = masteredWords.indexOf(w.word) !== -1;
            html += '<div class="flex items-center justify-between py-2 border-b border-gray-100">' +
                '<div><span class="font-medium">' + w.word + '</span> <span class="text-xs text-gray-400">' + (w.phonetic || '') + '</span></div>' +
                '<div>' + (isMastered ? '<span class="text-xs text-green-600">已掌握</span>' : '') + '</div></div>';
        }
        if (words.length > 100) html += '<div class="text-xs text-gray-400 text-center py-2">... 共 ' + words.length + ' 个</div>';
        html += '</div>';
        container.innerHTML = html;
    }

    function startLearningTimer() {
        if (learningTimer) clearInterval(learningTimer);
        learningTimer = setInterval(function() { learnTime += 10; saveData(); }, 10000);
    }

    function setupReminder() {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            Notification.requestPermission().then(function(permission) {
                if (permission === 'granted') {
                    showToast('学习提醒已启用，将在设定时间通知你', 'success');
                }
            });
        }
        setInterval(function() {
            var now = new Date();
            var time = $('reminderTime').value || '09:00';
            var parts = time.split(':');
            var h = parseInt(parts[0]);
            var m = parseInt(parts[1]);
            if (now.getHours() === h && now.getMinutes() === m && $('reminderEnabled').checked) {
                if (Notification.permission === 'granted') {
                    new Notification('CET-6 词汇学习提醒', {
                        body: '今日已学习 ' + todayLearned + ' 个单词，目标 ' + ($('dailyGoal').value || 50) + ' 个，继续加油！',
                        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">A</text></svg>'
                    });
                }
            }
        }, 60000);
    }

    function exportData() {
        var d = {
            errorWords: errorWords, masteredWords: masteredWords,
            learnTime: learnTime, streak: streak, todayLearned: todayLearned,
            lastDate: lastDate, todayMastered: todayMastered,
            settings: {
                dailyGoal: $('dailyGoal').value,
                reminderTime: $('reminderTime').value,
                reminderEnabled: $('reminderEnabled').checked
            }
        };
        showExportModal('CET6 学习数据', JSON.stringify(d, null, 2), 'json');
    }

    function exportFavorites() {
        if (!favoriteWords.length) { showToast('暂无收藏单词', 'info'); return; }
        var txt = 'CET-6 收藏单词导出\n';
        txt += '导出时间：' + new Date().toLocaleString() + '\n';
        txt += '收藏数量：' + favoriteWords.length + '\n';
        txt += '='.repeat(50) + '\n\n';
        for (var i = 0; i < favoriteWords.length; i++) {
            var w = vocabulary.find(function(v) { return v.word === favoriteWords[i]; });
            if (w) {
                txt += (i + 1) + '. ' + w.word + '\n';
                txt += '   音标：' + (w.phonetic || '无') + '\n';
                txt += '   词性：' + (w.pos || '无') + '\n';
                txt += '   释义：' + w.definition + '\n';
                if (w.example) txt += '   例句：' + w.example + '\n';
                txt += '\n';
            }
        }
        showExportModal('收藏单词', txt, 'txt');
    }

    function exportCSV() {
        var lines = ['word,phonetic,pos,definition,example,status'];
        var masterSet = {};
        for (var i = 0; i < masteredWords.length; i++) masterSet[masteredWords[i]] = true;
        var wrongSet = {};
        for (var j = 0; j < errorWords.length; j++) wrongSet[errorWords[j].word] = true;
        for (var k = 0; k < vocabulary.length; k++) {
            var w = vocabulary[k];
            var status = wrongSet[w.word] ? 'wrong' : masterSet[w.word] ? 'mastered' : 'new';
            var row = [
                '"' + w.word.replace(/"/g, '""') + '"',
                '"' + (w.phonetic || '').replace(/"/g, '""') + '"',
                '"' + (w.pos || '').replace(/"/g, '""') + '"',
                '"' + (w.definition || '').replace(/"/g, '""') + '"',
                '"' + (w.example || '').replace(/"/g, '""') + '"',
                status
            ];
            lines.push(row.join(','));
        }
        showExportModal('词汇 CSV', '\uFEFF' + lines.join('\n'), 'csv');
    }

    function exportMarkdown() {
        var masterSet = {};
        for (var i = 0; i < masteredWords.length; i++) masterSet[masteredWords[i]] = true;
        var wrongSet = {};
        for (var j = 0; j < errorWords.length; j++) wrongSet[errorWords[j].word] = true;
        var md = '# CET-6 词汇学习数据\n\n';
        md += '> 导出时间：' + new Date().toLocaleString() + '\n';
        md += '> 总词汇：' + vocabulary.length + ' | 已掌握：' + masteredWords.length + ' | 错词：' + errorWords.length + '\n\n';
        md += '## 已掌握单词 (' + masteredWords.length + ')\n\n';
        if (masteredWords.length) {
            md += '| 单词 | 音标 | 词性 | 释义 |\n';
            md += '|------|------|------|------|\n';
            for (var m = 0; m < masteredWords.length; m++) {
                var w = vocabulary.find(function(v) { return v.word === masteredWords[m]; });
                if (w) md += '| ' + w.word + ' | ' + (w.phonetic || '') + ' | ' + (w.pos || '') + ' | ' + w.definition + ' |\n';
            }
        }
        md += '\n## 错词本 (' + errorWords.length + ')\n\n';
        if (errorWords.length) {
            md += '| 单词 | 音标 | 词性 | 释义 | 错误次数 |\n';
            md += '|------|------|------|------|----------|\n';
            for (var e = 0; e < errorWords.length; e++) {
                var ew = errorWords[e];
                md += '| ' + ew.word + ' | ' + (ew.phonetic || '') + ' | ' + (ew.pos || '') + ' | ' + ew.definition + ' | ' + (ew.count || 1) + ' |\n';
            }
        }
        md += '\n## 未学习单词 (' + (vocabulary.length - masteredWords.length - errorWords.length) + ')\n\n';
        var newWords = vocabulary.filter(function(w) { return !masterSet[w.word] && !wrongSet[w.word]; });
        if (newWords.length) {
            md += '| 单词 | 音标 | 词性 | 释义 |\n';
            md += '|------|------|------|------|\n';
            for (var n = 0; n < newWords.length; n++) {
                var nw = newWords[n];
                md += '| ' + nw.word + ' | ' + (nw.phonetic || '') + ' | ' + (nw.pos || '') + ' | ' + nw.definition + ' |\n';
            }
        }
        showExportModal('Markdown 词汇', md, 'md');
    }

    function showExportModal(title, content, ext) {
        var existing = document.getElementById('__exportModal');
        if (existing) existing.remove();
        var modal = document.createElement('div');
        modal.id = '__exportModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:16px';
        var box = document.createElement('div');
        box.style.cssText = 'background:#fff;border-radius:16px;width:100%;max-width:480px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden';
        var header = '<div style="padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between"><span style="font-weight:600;font-size:16px">导出 ' + title + '</span><button onclick="this.closest(\'#__exportModal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#6b7280">X</button></div>';
        var textarea = '<div style="flex:1;overflow:auto;padding:16px"><textarea id="__exportContent" readonly style="width:100%;height:300px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;font-family:monospace;font-size:12px;resize:none;background:#f9fafb">' + content.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</textarea></div>';
        var buttons = '<div style="padding:16px 20px;border-top:1px solid #e5e7eb;display:flex;gap:8px">';
        buttons += '<button onclick="copyExportContent()" style="flex:1;padding:10px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer">复制内容</button>';
        if (navigator.share) {
            buttons += '<button onclick="shareExportContent(\'' + title.replace(/'/g, "\\'") + '\')" style="flex:1;padding:10px;background:#10b981;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer">分享</button>';
        }
        buttons += '<button onclick="this.closest(\'#__exportModal\').remove()" style="flex:1;padding:10px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-weight:600;cursor:pointer">关闭</button>';
        buttons += '</div>';
        box.innerHTML = header + textarea + buttons;
        modal.appendChild(box);
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    }

    function shareExportContent(title) {
        var ta = document.getElementById('__exportContent');
        if (!ta || !navigator.share) return;
        var content = ta.value;
        var blob = new Blob([content], { type: 'text/plain' });
        var file = new File([blob], title + '.txt', { type: 'text/plain' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: title }).catch(function() {});
        } else {
            navigator.share({ title: title, text: content }).catch(function() {});
        }
    }

    function copyExportContent() {
        var ta = document.getElementById('__exportContent');
        if (!ta) return;
        ta.select();
        ta.setSelectionRange(0, 99999);
        if (navigator.clipboard) {
            navigator.clipboard.writeText(ta.value).then(function() {
                showToast('已复制到剪贴板', 'success');
            });
        } else {
            document.execCommand('copy');
            showToast('已复制到剪贴板', 'success');
        }
    }

    function importCSV() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var text = ev.target.result.replace(/^\uFEFF/, '');
                    var lines = text.split(/\r?\n/).filter(function(l) { return l.trim(); });
                    if (lines.length < 2) { showToast('CSV 文件为空', 'error'); return; }
                    var imported = 0;
                    for (var i = 1; i < lines.length; i++) {
                        var cols = parseCSVLine(lines[i]);
                        if (cols.length < 5) continue;
                        var word = cols[0].trim();
                        if (!word) continue;
                        var status = (cols[5] || '').trim();
                        if (status === 'mastered' && masteredWords.indexOf(word) === -1) {
                            masteredWords.push(word);
                            imported++;
                        } else if (status === 'wrong') {
                            if (!errorWords.some(function(ew) { return ew.word === word; })) {
                                var found = vocabulary.find(function(v) { return v.word === word; });
                                errorWords.push({
                                    word: word, phonetic: cols[1] || '', pos: cols[2] || '',
                                    definition: cols[3] || '', example: cols[4] || '',
                                    difficulty: found ? getDifficulty(word) : 'medium',
                                    time: new Date().toISOString(), count: 1
                                });
                                imported++;
                            }
                        }
                    }
                    saveData();
                    updateStats();
                    showToast('CSV 导入完成，处理 ' + imported + ' 个单词', 'success');
                } catch (ex) {
                    showToast('CSV 格式错误：' + ex.message, 'error');
                }
            };
            reader.readAsText(file, 'UTF-8');
        };
        input.click();
    }

    function parseCSVLine(line) {
        var result = [];
        var current = '';
        var inQuotes = false;
        for (var i = 0; i < line.length; i++) {
            var ch = line[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
                    else { inQuotes = false; }
                } else { current += ch; }
            } else {
                if (ch === '"') { inQuotes = true; }
                else if (ch === ',') { result.push(current); current = ''; }
                else { current += ch; }
            }
        }
        result.push(current);
        return result;
    }

    function importData() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var d = JSON.parse(ev.target.result);
                    if (d.errorWords) errorWords = d.errorWords;
                    if (d.masteredWords) masteredWords = d.masteredWords;
                    if (d.learnTime !== undefined) learnTime = d.learnTime;
                    if (d.streak !== undefined) streak = d.streak;
                    if (d.todayLearned !== undefined) todayLearned = d.todayLearned;
                    if (d.lastDate) lastDate = d.lastDate;
                    if (d.todayMastered !== undefined) todayMastered = d.todayMastered;
                    if (d.settings) {
                        $('dailyGoal').value = d.settings.dailyGoal || 50;
                        $('reminderTime').value = d.settings.reminderTime || '09:00';
                        if (d.settings.reminderEnabled !== undefined) $('reminderEnabled').checked = d.settings.reminderEnabled;
                    }
                    saveData();
                    saveSettings();
                    updateStats();
                    renderErrors();
                    showToast('数据导入成功！', 'success');
                } catch (ex) {
                    showToast('数据格式错误，请检查文件', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function importMarkdown() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md,.markdown';
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var text = ev.target.result;
                    var imported = 0;
                    var lines = text.split('\n');
                    var section = '';
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        if (line.indexOf('## 已掌握') !== -1) { section = 'mastered'; continue; }
                        if (line.indexOf('## 错词本') !== -1) { section = 'wrong'; continue; }
                        if (line.indexOf('## 未学习') !== -1) { section = 'new'; continue; }
                        if (!line || line.indexOf('|') === -1 || line.indexOf('---') !== -1 || line.indexOf('单词') === 0) continue;
                        var cols = line.split('|').map(function(c) { return c.trim(); }).filter(function(c) { return c; });
                        if (cols.length < 4) continue;
                        var word = cols[0];
                        if (!word || word.length < 2) continue;
                        if (section === 'mastered' && masteredWords.indexOf(word) === -1) {
                            masteredWords.push(word);
                            imported++;
                        } else if (section === 'wrong') {
                            if (!errorWords.some(function(ew) { return ew.word === word; })) {
                                errorWords.push({
                                    word: word, phonetic: cols[1] || '', pos: cols[2] || '',
                                    definition: cols[3] || '', example: '',
                                    difficulty: getDifficulty(word),
                                    time: new Date().toISOString(), count: parseInt(cols[4]) || 1
                                });
                                imported++;
                            }
                        }
                    }
                    saveData();
                    updateStats();
                    renderErrors();
                    showToast('Markdown 导入完成，处理 ' + imported + ' 个单词', 'success');
                } catch (ex) {
                    showToast('Markdown 格式错误：' + ex.message, 'error');
                }
            };
            reader.readAsText(file, 'UTF-8');
        };
        input.click();
    }

    function importCustomVocab() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.csv,.json';
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var text = ev.target.result;
                    var words = [];
                    if (file.name.endsWith('.json')) {
                        var data = JSON.parse(text);
                        if (Array.isArray(data)) {
                            words = data.map(function(w) {
                                if (typeof w === 'string') return { word: w, phonetic: '', pos: '', definition: '', example: '' };
                                return { word: w.word || '', phonetic: w.phonetic || '', pos: w.pos || '', definition: w.definition || '', example: w.example || '' };
                            });
                        }
                    } else if (file.name.endsWith('.csv')) {
                        var lines = text.split(/\r?\n/).filter(function(l) { return l.trim(); });
                        for (var i = 1; i < lines.length; i++) {
                            var cols = parseCSVLine(lines[i]);
                            if (cols.length >= 1 && cols[0].trim()) {
                                words.push({
                                    word: cols[0].trim(),
                                    phonetic: cols[1] || '',
                                    pos: cols[2] || '',
                                    definition: cols[3] || '',
                                    example: cols[4] || ''
                                });
                            }
                        }
                    } else {
                        var lines = text.split(/\r?\n/).filter(function(l) { return l.trim(); });
                        for (var i = 0; i < lines.length; i++) {
                            var line = lines[i].trim();
                            if (line && line.length > 1) {
                                words.push({ word: line, phonetic: '', pos: '', definition: '', example: '' });
                            }
                        }
                    }
                    if (words.length === 0) { showToast('未找到有效单词', 'error'); return; }
                    localStorage.setItem('cet6_custom_vocab', JSON.stringify(words));
                    updateCustomVocabCount();
                    showToast('已导入 ' + words.length + ' 个单词到自定义词库', 'success');
                } catch (ex) {
                    showToast('导入失败：' + ex.message, 'error');
                }
            };
            reader.readAsText(file, 'UTF-8');
        };
        input.click();
    }

    function exportCustomVocab() {
        var customVocab = JSON.parse(localStorage.getItem('cet6_custom_vocab') || '[]');
        if (!customVocab.length) { showToast('自定义词库为空', 'info'); return; }
        var txt = 'word,phonetic,pos,definition,example\n';
        customVocab.forEach(function(w) {
            txt += '"' + (w.word || '').replace(/"/g, '""') + '",';
            txt += '"' + (w.phonetic || '').replace(/"/g, '""') + '",';
            txt += '"' + (w.pos || '').replace(/"/g, '""') + '",';
            txt += '"' + (w.definition || '').replace(/"/g, '""') + '",';
            txt += '"' + (w.example || '').replace(/"/g, '""') + '"\n';
        });
        var blob = new Blob(['\uFEFF' + txt], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '自定义词库_' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
        showToast('自定义词库已导出', 'success');
    }

    function updateCustomVocabCount() {
        var el = $('customVocabCount');
        if (!el) return;
        var customVocab = JSON.parse(localStorage.getItem('cet6_custom_vocab') || '[]');
        el.textContent = customVocab.length > 0 ? customVocab.length + ' 个单词' : '未导入';
    }

    function resetData() {
        if (!confirm('确定要重置所有学习数据吗？\n\n此操作将清空：\n- 已掌握单词记录\n- 错词本\n- 学习时长\n- 连续天数\n\n此操作不可撤销！')) return;
        errorWords = [];
        masteredWords = [];
        learnTime = 0;
        streak = 0;
        todayLearned = 0;
        todayMastered = 0;
        saveData();
        updateStats();
        renderErrors();
        applyFilter();
        showToast('所有数据已重置', 'info');
    }

    function loadVocabulary() {
        allWords = vocabulary.slice();
                initLetterFilterFromExisting();
                filteredWords = vocabulary.slice();
                filteredWords.sort(function(a, b) { return a.word.localeCompare(b.word); });
                currentIndex = 0;
                $('loading').style.display = 'none';
                updateWordCard();
                updateStats();
                startLearningTimer();
                setupReminder();
                initSwipeGestures();
                initCapacitor();


        console.log('Vocabulary loaded: ' + vocabulary.length + ' words (embedded)');

        var allContents = document.querySelectorAll('.tab-content');
        for (var t = 0; t < allContents.length; t++) {
            allContents[t].style.display = 'none';
        }
        var activeContent = document.querySelector('.tab-content.active');
        if (activeContent) activeContent.style.display = 'block';

        document.body.classList.add('memorize-mode');

        var allTabs = document.querySelectorAll('.nav-tab');
        for (var i = 0; i < allTabs.length; i++) {
            allTabs[i].addEventListener('click', function() {
                switchTab(this.getAttribute('data-tab'));
            });
        }
        setRecallMode(recallMode);

        if (vocabulary.length > 0) {
            showToast('已加载 ' + vocabulary.length + ' 个词汇，开始学习吧！', 'success');
        }
    }

    document.addEventListener('keydown', function(e) {
        var activeTab = document.querySelector('.tab-content.active');
        if (!activeTab) return;
        var tabId = activeTab.id;

        if (tabId === 'memorize') {
            if (e.key === 'ArrowLeft') { e.preventDefault(); prevWord(); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); nextWord(); }
            else if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); toggleWord(); }
            else if (e.key === 's' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); speakWord(); }
        } else if (tabId === 'spell') {
            if (e.key === 'Enter') { e.preventDefault(); checkSpell(); }
        } else if (tabId === 'recall') {
            if (e.key === 'Enter' && recallMode === 'reverse') { e.preventDefault(); checkRecall(); }
        }
    });

    function isCapacitorApp() {
        return typeof Capacitor !== 'undefined' && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform();
    }

    function initCapacitor() {
        if (!isCapacitorApp()) return;
        try {
            if (Capacitor.Plugins && Capacitor.Plugins.StatusBar) {
                Capacitor.Plugins.StatusBar.setStyle({ style: 'DARK' });
                Capacitor.Plugins.StatusBar.setBackgroundColor({ color: '#ede9fe' });
            }
            if (Capacitor.Plugins && Capacitor.Plugins.SplashScreen) {
                Capacitor.Plugins.SplashScreen.hide();
            }
            var body = document.body;
            body.classList.add('capacitor-app');
            body.style.paddingTop = 'env(safe-area-inset-top)';
            body.style.paddingBottom = 'env(safe-area-inset-bottom)';
        } catch(e) {
            console.log('Capacitor init error:', e);
        }
    }

    StorageManager.init(function() {
        loadData();
        loadWordNotes();
        loadCheckinData();
        loadAutoBackupSetting();
        updateCustomVocabCount();
        loadAutoReadSetting();
        checkAchievements();
        try {
            loadVocabulary();
        } catch (e) {
            console.error('词汇加载失败:', e);
            window.onerror(e.message, '', 0, 0, e);
        }
    });

    if ('serviceWorker' in navigator) {
        try {
            navigator.serviceWorker.register('/sw.js').then(function(reg) {
                console.log('Service Worker registered:', reg.scope);
            }).catch(function(err) {
                console.log('Service Worker registration failed:', err);
            });
        } catch (e) {
            console.log('Service Worker not supported in this context:', e.message);
        }
    }

    function setV27Theme(val) {
        try { document.body.setAttribute('data-theme', val); } catch(e) {}
    }

    function applyOrientation() {
        var sel = document.getElementById('orientationSelect');
        if (!sel) return;
        var val = sel.value;
        if (val === 'portrait') {
            try { screen.orientation.lock('portrait'); } catch(e) {}
        } else if (val === 'landscape') {
            try { screen.orientation.lock('landscape'); } catch(e) {}
        } else {
            try { screen.orientation.unlock(); } catch(e) {}
        }
    }


