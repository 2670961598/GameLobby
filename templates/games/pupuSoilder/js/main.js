/**
 * 主游戏控制器
 * 整合所有系统，实现完整的游戏流程
 */

class Game {
    constructor() {
        // 核心系统
        this.gameLoop = null;
        this.gridSystem = null;
        this.physics = null;
        
        // 对象池
        this.bulletPool = null;
        this.buffPool = null;
        
        // 游戏系统
        this.bulletSystem = null;
        this.buffSystem = null;
        
        // 游戏实体
        this.player = null;
        this.aiCharacters = [];
        
        // UI系统
        this.hudSystem = null;
        this.healthBarManager = null;
        this.screenManager = null;
        
        // 游戏状态
        this.gameState = 'menu';        // 'menu', 'playing', 'ended'
        this.isPaused = false;
        
        // 复活相关
        this.respawnDelay = 3000;       // 复活延迟3秒
        this.pendingRespawns = [];      // 待复活的角色列表
        
        this.initializeSystems();
    }
    
    /**
     * 初始化所有游戏系统
     */
    initializeSystems() {
        console.log('初始化游戏系统...');
        
        try {
            // 更新CSS变量以匹配配置
            this.updateCSSVariables();
            
            // 核心系统初始化
            this.initializeCoreSystem();
            
            // 游戏系统初始化
            this.initializeGameSystems();
            
            // 实体初始化
            this.initializeEntities();
            
            // UI系统初始化
            this.initializeUI();
            
            // 绑定游戏循环
            this.bindGameLoop();
            
            // 游戏系统初始化完成
            
        } catch (error) {
            console.error('游戏初始化失败:', error);
        }
    }
    
    /**
     * 更新CSS变量以匹配游戏配置
     */
    updateCSSVariables() {
        const root = document.documentElement;
        const config = window.gameConfig;
        
        // 更新游戏画布尺寸相关的CSS变量
        root.style.setProperty('--game-width', `${config.CANVAS_WIDTH}px`);
        root.style.setProperty('--game-height', `${config.CANVAS_HEIGHT}px`);
        
        // CSS变量已更新
    }

    /**
     * 初始化核心系统
     */
    initializeCoreSystem() {
        // 创建核心系统
        this.gameLoop = new GameLoop();
        this.gridSystem = new GridSystem();
        this.physics = new PhysicsSystem();
        
        // 创建对象池
        this.bulletPool = new BulletPool();
        this.buffPool = new BuffPool();
    }
    
    /**
     * 初始化游戏系统
     */
    initializeGameSystems() {
        // 创建游戏系统
        this.bulletSystem = new BulletSystem();
        this.buffSystem = new BuffSystem();
        
        // 初始化系统间的依赖关系
        this.bulletSystem.initialize(this.bulletPool, this.physics);
        this.buffSystem.initialize(this.buffPool, this.physics);
    }
    
    /**
     * 初始化游戏实体
     */
    initializeEntities() {
        // 创建玩家
        this.player = new Player();
        
        // 从全局配置创建AI角色
        this.aiCharacters = [];
        for (const aiConfig of window.gameConfig.AI_POSITIONS) {
            this.aiCharacters.push(new AICharacter(aiConfig.id, aiConfig.x, aiConfig.y));
        }
    }
    
    /**
     * 初始化UI系统
     */
    initializeUI() {
        // 创建UI系统
        this.hudSystem = new HUDSystem();
        this.healthBarManager = new HealthBarManager();
        this.screenManager = new ScreenManager();
        
        // 设置界面回调
        this.screenManager.setCallbacks(
            () => this.startGame(),        // 开始游戏
            () => this.restartGame(),      // 重新开始
            () => this.returnToMenu()      // 返回主页
        );
    }
    
    /**
     * 绑定游戏循环
     */
    bindGameLoop() {
        // 设置游戏循环回调
        this.gameLoop.setUpdateCallback((deltaTime) => {
            this.updateGame(deltaTime);
        });
        
        this.gameLoop.setRenderCallback((deltaTime) => {
            this.renderGame(deltaTime);
        });
    }
    
    /**
     * 开始新游戏
     */
    startGame() {
        // 开始新游戏
        
        // 重置游戏状态
        this.resetGameState();
        
        // 启动各个系统
        this.hudSystem.startGame();
        this.buffSystem.startGame();
        
        // 启动游戏循环
        this.gameLoop.start();
        
        // 设置游戏状态
        this.gameState = 'playing';
        this.isPaused = false;
    }
    
    /**
     * 重新开始游戏
     */
    restartGame() {
        // 重新开始游戏
        
        // 停止当前游戏
        this.endGame(false); // 不显示结果界面
        
        // 开始新游戏
        this.startGame();
    }
    
    /**
     * 结束游戏
     * @param {boolean} showResults - 是否显示结果界面
     */
    endGame(showResults = true) {
        // 游戏结束
        
        // 停止游戏循环
        this.gameLoop.stop();
        
        // 停止各个系统
        this.hudSystem.endGame();
        
        // 设置游戏状态
        this.gameState = 'ended';
        
        if (showResults) {
            // 计算最终结果
            const finalScores = this.gridSystem.getColorPercentages(true);
            const winner = determineWinner(finalScores);
            
            // 显示结果界面
            this.screenManager.showEndScreen(finalScores, winner);
        }
    }
    
    /**
     * 返回主菜单
     */
    returnToMenu() {
        // 返回主菜单
        
        // 停止游戏（如果正在进行）
        if (this.gameState === 'playing') {
            this.endGame(false);
        }
        
        // 重置所有状态
        this.resetGameState();
        
        // 显示开始界面
        this.screenManager.showStartScreen();
        this.gameState = 'menu';
    }
    
    /**
     * 重置游戏状态
     */
    resetGameState() {
        // 重置网格
        this.gridSystem.reset();
        
        // 重置游戏实体
        this.player.reset();
        this.aiCharacters.forEach(ai => ai.reset());
        
        // 清空子弹和Buff
        this.bulletSystem.clear();
        this.buffSystem.clearAllBuffs();
        
        // 重置UI
        this.hudSystem.reset();
        this.healthBarManager.reset();
        
        // 清空待复活列表
        this.pendingRespawns.length = 0;
    }
    
    /**
     * 更新游戏逻辑
     * @param {number} deltaTime - 时间增量
     */
    updateGame(deltaTime) {
        if (this.gameState !== 'playing' || this.isPaused) return;
        
        // 更新游戏实体
        this.updateEntities(deltaTime);
        
        // 更新游戏系统
        this.updateSystems(deltaTime);
        
        // 处理碰撞
        this.handleCollisions();
        
        // 更新UI
        this.updateUI();
        
        // 处理复活
        this.handleRespawns();
        
        // 检查游戏结束条件
        this.checkGameEnd();
    }
    
    /**
     * 更新游戏实体
     * @param {number} deltaTime - 时间增量
     */
    updateEntities(deltaTime) {
        const allCharacters = [this.player, ...this.aiCharacters];
        
        // 更新玩家
        this.player.update(deltaTime, this.gridSystem, this.physics);
        
        // 更新AI角色
        for (const ai of this.aiCharacters) {
            ai.update(deltaTime, this.gridSystem, this.physics, this.player, allCharacters);
        }
        
        // 处理射击
        this.handleShooting(allCharacters);
        
        // 更新角色Buff状态
        this.buffSystem.updateCharacterBuffs(allCharacters);
    }
    
    /**
     * 处理角色射击
     * @param {Array} allCharacters - 所有角色
     */
    handleShooting(allCharacters) {
        // 玩家射击
        this.player.tryFire(this.bulletSystem);
        
        // AI射击
        for (const ai of this.aiCharacters) {
            ai.tryFire(this.bulletSystem, allCharacters);
        }
    }
    
    /**
     * 更新游戏系统
     * @param {number} deltaTime - 时间增量
     */
    updateSystems(deltaTime) {
        const allCharacters = [this.player, ...this.aiCharacters];
        
        // 更新子弹系统
        this.bulletSystem.update(deltaTime);
        
        // 更新Buff系统
        this.buffSystem.update(deltaTime, allCharacters);
    }
    
    /**
     * 处理所有碰撞检测
     */
    handleCollisions() {
        const allCharacters = [this.player, ...this.aiCharacters];
        const activeCharacters = allCharacters.filter(char => char.active);
        
        // 子弹与角色碰撞
        this.handleBulletCollisions(activeCharacters);
        
        // Buff与角色碰撞
        this.handleBuffCollisions(activeCharacters);
    }
    
    /**
     * 处理子弹碰撞
     * @param {Array} characters - 活跃角色数组
     */
    handleBulletCollisions(characters) {
        const collisions = this.bulletSystem.checkCollisions(characters);
        
        for (const collision of collisions) {
            const { bullet, target, damage } = collision;
            
            // 应用伤害
            const isDead = target.takeDamage(damage);
            
            // 移除子弹
            this.bulletSystem.removeBullet(bullet, this.bulletSystem.bullets.indexOf(bullet));
            
            // 处理角色死亡
            if (isDead) {
                this.handleCharacterDeath(target);
            }
        }
    }
    
    /**
     * 处理Buff碰撞
     * @param {Array} characters - 活跃角色数组
     */
    handleBuffCollisions(characters) {
        const collisions = this.buffSystem.checkCollisions(characters);
        
        for (const collision of collisions) {
            const { buff, character } = collision;
            
            // 收集Buff
            this.buffSystem.collectBuff(buff, character);
        }
    }
    
    /**
     * 处理角色死亡
     * @param {Object} character - 死亡的角色
     */
    handleCharacterDeath(character) {
        // 玩家有自己的复活系统，AI角色使用旧的复活系统
        if (character.id === 1) {
            // 玩家死亡由自己的系统处理，无需添加到待复活列表
            return;
        }
        
        // AI角色添加到待复活列表
        this.pendingRespawns.push({
            character: character,
            respawnTime: performance.now() + this.respawnDelay
        });
    }
    
    /**
     * 处理角色复活
     */
    handleRespawns() {
        const currentTime = performance.now();
        
        // 检查待复活的角色
        for (let i = this.pendingRespawns.length - 1; i >= 0; i--) {
            const respawn = this.pendingRespawns[i];
            
            if (currentTime >= respawn.respawnTime) {
                // 复活角色
                this.respawnCharacter(respawn.character);
                
                // 从待复活列表移除
                this.pendingRespawns.splice(i, 1);
            }
        }
    }
    
    /**
     * 复活角色
     * @param {Object} character - 要复活的角色
     */
    respawnCharacter(character) {
        // 从全局配置获取复活位置
        const respawnPos = window.gameConfig.getRespawnPosition(character.id);
        
        character.respawn(respawnPos.x, respawnPos.y);
    }
    
    /**
     * 更新UI
     */
    updateUI() {
        // 更新HUD
        const gameEnded = this.hudSystem.update(this.gridSystem);
        
        // 更新玩家血条
        this.healthBarManager.updateHealth(this.player.hp, this.player.maxHP);
        
        // 检查游戏是否因时间结束
        if (gameEnded) {
            this.endGame(true);
        }
    }
    
    /**
     * 检查其他游戏结束条件
     */
    checkGameEnd() {
        // 当前实现只有时间结束一种条件
        // 可以在这里添加其他结束条件，如某种颜色占比达到特定值等
    }
    
    /**
     * 渲染游戏
     * @param {number} deltaTime - 时间增量
     */
    renderGame(deltaTime) {
        // 渲染网格脏区域
        this.gridSystem.renderDirtyCells();
        
        // 其他渲染逻辑（如粒子效果等）可以在这里添加
    }
    
    /**
     * 暂停/恢复游戏
     */
    togglePause() {
        if (this.gameState !== 'playing') return;
        
        if (this.isPaused) {
            this.gameLoop.resume();
            this.isPaused = false;
        } else {
            this.gameLoop.pause();
            this.isPaused = true;
        }
    }
    
    /**
     * 获取游戏统计信息（调试用）
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            gameState: this.gameState,
            isPaused: this.isPaused,
            fps: this.gameLoop.getFPS(),
            gridStats: this.gridSystem.getColorPercentages(true),
            bulletStats: this.bulletSystem.getStats(),
            buffStats: this.buffSystem.getStats(),
            hudStats: this.hudSystem.getStats(),
            pendingRespawns: this.pendingRespawns.length
        };
    }
}

/**
 * 游戏初始化和启动
 */
document.addEventListener('DOMContentLoaded', () => {
    try {
        // 创建全局游戏实例
        window.game = new Game();
        
        // 开发模式下暴露调试接口
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            window.debugGame = () => {
                console.log('游戏统计信息:', window.game.getStats());
            };
        }
        
    } catch (error) {
        console.error('游戏启动失败:', error);
        
        // 显示错误信息给用户
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #1a1a2e; color: white; font-family: Arial, sans-serif;">
                <div style="text-align: center;">
                    <h1>游戏加载失败</h1>
                    <p>请刷新页面重试，或检查浏览器兼容性。</p>
                    <p style="color: #ff6b6b; font-size: 12px;">错误信息: ${error.message}</p>
                    <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px; background: #AFE59B; border: none; border-radius: 5px; cursor: pointer;">
                        刷新页面
                    </button>
                </div>
            </div>
        `;
    }
});

// 导出到全局（用于调试和扩展）
window.Game = Game; 