/**
 * 游戏主循环系统
 * 实现固定时间步进的游戏循环，保证逻辑更新的一致性
 */

class GameLoop {
    constructor() {
        this.TICK_RATE = 60;                    // 目标帧率60FPS
        this.TICK_INTERVAL = 1000 / this.TICK_RATE; // 每帧时间间隔
        
        this.isRunning = false;                 // 循环是否运行中
        this.lastTime = 0;                      // 上次更新时间
        this.accumulator = 0;                   // 时间累积器
        
        // 性能监控
        this.frameCount = 0;
        this.fpsUpdateTime = 0;
        this.currentFPS = 60;
        this.performanceWarningShown = false;
        
        // 回调函数
        this.updateCallback = null;             // 逻辑更新回调
        this.renderCallback = null;             // 渲染回调
        
        this.boundLoop = this.loop.bind(this);
    }
    
    /**
     * 设置更新回调函数
     * @param {Function} callback - 逻辑更新函数
     */
    setUpdateCallback(callback) {
        this.updateCallback = callback;
    }
    
    /**
     * 设置渲染回调函数
     * @param {Function} callback - 渲染函数
     */
    setRenderCallback(callback) {
        this.renderCallback = callback;
    }
    
    /**
     * 开始游戏循环
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.frameCount = 0;
        this.fpsUpdateTime = this.lastTime;
        
        requestAnimationFrame(this.boundLoop);
    }
    
    /**
     * 停止游戏循环
     */
    stop() {
        this.isRunning = false;
    }
    
    /**
     * 暂停游戏循环
     */
    pause() {
        this.isRunning = false;
    }
    
    /**
     * 恢复游戏循环
     */
    resume() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame(this.boundLoop);
    }
    
    /**
     * 主循环函数
     * @param {number} currentTime - 当前时间戳
     */
    loop(currentTime) {
        if (!this.isRunning) return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        this.accumulator += deltaTime;
        
        // 固定时间步进 - 确保逻辑更新的一致性
        while (this.accumulator >= this.TICK_INTERVAL) {
            if (this.updateCallback) {
                this.updateCallback(this.TICK_INTERVAL);
            }
            this.accumulator -= this.TICK_INTERVAL;
        }
        
        // 渲染（可变时间步进）
        if (this.renderCallback) {
            this.renderCallback(deltaTime);
        }
        
        // 性能监控
        this.updatePerformanceStats(currentTime);
        
        // 继续下一帧
        requestAnimationFrame(this.boundLoop);
    }
    
    /**
     * 更新性能统计
     * @param {number} currentTime - 当前时间
     */
    updatePerformanceStats(currentTime) {
        this.frameCount++;
        
        // 每秒更新一次FPS统计
        if (currentTime - this.fpsUpdateTime >= 1000) {
            this.currentFPS = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateTime = currentTime;
            
            // 检查性能警告
            this.checkPerformanceWarning();
        }
    }
    
    /**
     * 检查是否需要显示性能警告
     */
    checkPerformanceWarning() {
        const warningElement = document.getElementById('performance-warning');
        
        if (this.currentFPS < 50 && !this.performanceWarningShown) {
            // 帧率过低，显示警告
            warningElement?.classList.remove('hidden');
            this.performanceWarningShown = true;
            
            // 3秒后自动隐藏警告
            setTimeout(() => {
                warningElement?.classList.add('hidden');
                this.performanceWarningShown = false;
            }, 3000);
        }
    }
    
    /**
     * 获取当前FPS
     * @returns {number} 当前帧率
     */
    getFPS() {
        return this.currentFPS;
    }
    
    /**
     * 获取是否正在运行
     * @returns {boolean} 是否运行中
     */
    getIsRunning() {
        return this.isRunning;
    }
    
    /**
     * 重置循环状态
     */
    reset() {
        this.stop();
        this.accumulator = 0;
        this.frameCount = 0;
        this.currentFPS = 60;
        this.performanceWarningShown = false;
    }
}

// 导出到全局
window.GameLoop = GameLoop; 