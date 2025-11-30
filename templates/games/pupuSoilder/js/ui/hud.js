/**
 * HUD用户界面系统
 * 处理游戏内的UI元素显示和更新
 */

class HUDSystem {
    constructor() {
        // DOM元素引用
        this.timerElement = null;
        this.scoreElements = {
            green: null,
            purple: null,
            red: null
        };
        
        // 游戏状态
        this.gameStartTime = 0;
        this.gameDuration = 60000;          // 游戏总时长（60秒）
        this.isGameActive = false;
        
        // 更新频率控制
        this.lastScoreUpdate = 0;
        this.scoreUpdateInterval = 500;     // 每500ms更新一次比分（约2次/秒）
        
        // 紧张状态标记
        this.panicModeActive = false;
        this.panicThreshold = 10000;        // 最后10秒开启紧张模式
        
        this.initializeElements();
    }
    
    /**
     * 初始化HUD元素
     */
    initializeElements() {
        // 获取计时器元素
        this.timerElement = document.getElementById('timer');
        
        // 获取比分元素
        this.scoreElements.green = document.querySelector('.score-green');
        this.scoreElements.purple = document.querySelector('.score-purple');
        this.scoreElements.red = document.querySelector('.score-red');
        
        // 验证元素是否存在
        if (!this.timerElement) {
            console.warn('计时器元素未找到');
        }
        
        if (!this.scoreElements.green || !this.scoreElements.purple || !this.scoreElements.red) {
            console.warn('比分元素未完全找到');
        }
    }
    
    /**
     * 开始新游戏
     */
    startGame() {
        this.gameStartTime = performance.now();
        this.isGameActive = true;
        this.panicModeActive = false;
        this.lastScoreUpdate = 0;
        
        // 重置显示
        this.updateTimer(this.gameDuration);
        this.updateScores([0, 0, 0, 0]); // [空, 绿, 紫, 红]
        
        // 移除紧张模式样式
        document.body.classList.remove('panic');
    }
    
    /**
     * 结束游戏
     */
    endGame() {
        this.isGameActive = false;
        this.panicModeActive = false;
        document.body.classList.remove('panic');
    }
    
    /**
     * 更新HUD显示
     * @param {GridSystem} gridSystem - 网格系统
     */
    update(gridSystem) {
        if (!this.isGameActive) return;
        
        const currentTime = performance.now();
        const elapsedTime = currentTime - this.gameStartTime;
        const remainingTime = Math.max(0, this.gameDuration - elapsedTime);
        
        // 更新计时器
        this.updateTimer(remainingTime);
        
        // 检查并激活紧张模式
        this.updatePanicMode(remainingTime);
        
        // 更新比分（降低频率以提高性能）
        if (currentTime - this.lastScoreUpdate >= this.scoreUpdateInterval) {
            const percentages = gridSystem.getColorPercentages();
            this.updateScores(percentages);
            this.lastScoreUpdate = currentTime;
        }
        
        // 检查游戏是否结束
        if (remainingTime <= 0) {
            return true; // 返回true表示游戏结束
        }
        
        return false;
    }
    
    /**
     * 更新计时器显示
     * @param {number} remainingTime - 剩余时间（毫秒）
     */
    updateTimer(remainingTime) {
        if (!this.timerElement) return;
        
        // 转换为秒并向上取整
        const seconds = Math.ceil(remainingTime / 1000);
        
        // 格式化显示（确保至少显示0）
        const displaySeconds = Math.max(0, seconds);
        
        // 更新文本
        this.timerElement.textContent = displaySeconds.toString();
        
        // 添加数字动画效果（最后10秒）
        if (displaySeconds <= 10 && displaySeconds > 0) {
            this.timerElement.style.animation = 'none'; // 重置动画
            // 强制重新计算样式以重新触发动画
            this.timerElement.offsetHeight;
            this.timerElement.style.animation = '';
        }
    }
    
    /**
     * 更新比分显示
     * @param {Array<number>} percentages - 颜色占比数组 [空, 绿, 紫, 红]
     */
    updateScores(percentages) {
        // 更新绿色（玩家）比分
        if (this.scoreElements.green) {
            this.scoreElements.green.textContent = `${percentages[1]}%`;
        }
        
        // 更新紫色（AI）比分
        if (this.scoreElements.purple) {
            this.scoreElements.purple.textContent = `${percentages[2]}%`;
        }
        
        // 更新红色（AI）比分
        if (this.scoreElements.red) {
            this.scoreElements.red.textContent = `${percentages[3]}%`;
        }
    }
    
    /**
     * 更新紧张模式状态
     * @param {number} remainingTime - 剩余时间（毫秒）
     */
    updatePanicMode(remainingTime) {
        if (remainingTime <= this.panicThreshold && !this.panicModeActive) {
            // 激活紧张模式
            this.panicModeActive = true;
            document.body.classList.add('panic');
            
            console.log('紧张模式已激活！'); // 调试信息
        } else if (remainingTime > this.panicThreshold && this.panicModeActive) {
            // 取消紧张模式（一般不会发生，但作为安全检查）
            this.panicModeActive = false;
            document.body.classList.remove('panic');
        }
    }
    
    /**
     * 获取当前游戏剩余时间
     * @returns {number} 剩余时间（毫秒）
     */
    getRemainingTime() {
        if (!this.isGameActive) return 0;
        
        const currentTime = performance.now();
        const elapsedTime = currentTime - this.gameStartTime;
        return Math.max(0, this.gameDuration - elapsedTime);
    }
    
    /**
     * 获取游戏进行时间
     * @returns {number} 游戏进行时间（毫秒）
     */
    getElapsedTime() {
        if (!this.isGameActive) return 0;
        
        const currentTime = performance.now();
        return currentTime - this.gameStartTime;
    }
    
    /**
     * 检查游戏是否结束
     * @returns {boolean} 是否结束
     */
    isGameEnded() {
        return this.getRemainingTime() <= 0;
    }
    
    /**
     * 强制更新所有HUD元素
     * @param {GridSystem} gridSystem - 网格系统
     * @param {number} remainingTime - 剩余时间（可选）
     */
    forceUpdate(gridSystem, remainingTime = null) {
        if (remainingTime !== null) {
            this.updateTimer(remainingTime);
        } else if (this.isGameActive) {
            const remaining = this.getRemainingTime();
            this.updateTimer(remaining);
            this.updatePanicMode(remaining);
        }
        
        // 强制更新比分
        const percentages = gridSystem.getColorPercentages(true); // 强制更新
        this.updateScores(percentages);
    }
    
    /**
     * 重置HUD状态
     */
    reset() {
        this.isGameActive = false;
        this.panicModeActive = false;
        this.gameStartTime = 0;
        this.lastScoreUpdate = 0;
        
        // 重置显示
        if (this.timerElement) {
            this.timerElement.textContent = '60';
        }
        
        this.updateScores([0, 0, 0, 0]);
        
        // 移除特殊样式
        document.body.classList.remove('panic');
    }
    
    /**
     * 设置游戏时长
     * @param {number} duration - 游戏时长（毫秒）
     */
    setGameDuration(duration) {
        this.gameDuration = duration;
    }
    
    /**
     * 获取HUD统计信息（调试用）
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            isGameActive: this.isGameActive,
            remainingTime: this.getRemainingTime(),
            elapsedTime: this.getElapsedTime(),
            panicModeActive: this.panicModeActive,
            gameDuration: this.gameDuration
        };
    }
}

/**
 * 玩家血条管理器
 * 独立处理血条显示逻辑
 */
class HealthBarManager {
    constructor() {
        this.healthBar = null;
        this.healthFill = null;
        
        this.initializeElements();
    }
    
    /**
     * 初始化血条元素
     */
    initializeElements() {
        this.healthBar = document.getElementById('health-bar');
        this.healthFill = document.getElementById('health-fill');
        
        if (!this.healthBar || !this.healthFill) {
            console.warn('血条元素未找到');
        }
    }
    
    /**
     * 更新血条显示
     * @param {number} currentHP - 当前生命值
     * @param {number} maxHP - 最大生命值
     */
    updateHealth(currentHP, maxHP) {
        if (!this.healthFill) return;
        
        // 计算血量百分比
        const healthPercent = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));
        
        // 更新宽度
        this.healthFill.style.width = `${healthPercent}%`;
        
        // 根据血量改变颜色
        this.updateHealthColor(healthPercent);
    }
    
    /**
     * 根据血量百分比更新颜色
     * @param {number} healthPercent - 血量百分比（0-100）
     */
    updateHealthColor(healthPercent) {
        if (!this.healthFill) return;
        
        let color;
        if (healthPercent > 60) {
            // 健康状态 - 绿色
            color = '#44ff44';
        } else if (healthPercent > 30) {
            // 警告状态 - 橙色
            color = '#ffaa44';
        } else {
            // 危险状态 - 红色
            color = '#ff4444';
        }
        
        this.healthFill.style.backgroundColor = color;
    }
    
    /**
     * 显示血条
     */
    show() {
        if (this.healthBar) {
            this.healthBar.style.display = 'block';
        }
    }
    
    /**
     * 隐藏血条
     */
    hide() {
        if (this.healthBar) {
            this.healthBar.style.display = 'none';
        }
    }
    
    /**
     * 重置血条
     */
    reset() {
        this.updateHealth(100, 100);
        this.show();
    }
}

// 导出到全局
window.HUDSystem = HUDSystem;
window.HealthBarManager = HealthBarManager; 