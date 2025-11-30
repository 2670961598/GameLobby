/**
 * 全局游戏配置系统
 * 统一管理所有游戏参数，实现一处修改全局生效
 */

class GameConfig {
    constructor() {
        // =============================================================================
        // 🎯 核心配置区域 - 只需要修改这里就能改变整个游戏
        // =============================================================================
        
        /** 🎮 游戏画布尺寸配置 */
        this.CANVAS_WIDTH = 600;        // 游戏画布宽度
        this.CANVAS_HEIGHT = 600;       // 游戏画布高度
        
        /** 🔲 网格系统配置 */
        this.GRID_SIZE = 10;            // 每个网格单元的像素大小
        
        // =============================================================================
        // ⚙️ 自动计算的配置 - 基于上述核心配置自动计算，无需手动修改
        // =============================================================================
        
        this.calculateDerivedConfig();
    }
    
    /**
     * 计算衍生配置参数
     * 基于核心配置自动计算其他所有相关参数
     */
    calculateDerivedConfig() {
        // 网格系统衍生配置
        this.GRID_WIDTH = Math.floor(this.CANVAS_WIDTH / this.GRID_SIZE);    // 网格宽度数量
        this.GRID_HEIGHT = Math.floor(this.CANVAS_HEIGHT / this.GRID_SIZE);  // 网格高度数量
        
        // 游戏区域中心点
        this.CENTER_X = this.CANVAS_WIDTH / 2;
        this.CENTER_Y = this.CANVAS_HEIGHT / 2;
        
        // 角色初始位置配置
        this.PLAYER_START_X = this.CENTER_X;
        this.PLAYER_START_Y = this.CENTER_Y;
        
        // AI角色初始位置（根据画布大小自动调整）
        const margin = Math.min(this.CANVAS_WIDTH, this.CANVAS_HEIGHT) * 0.25; // 25%边距
        this.AI_POSITIONS = [
            {
                id: 2,
                x: margin,
                y: margin,
                name: 'AI-Purple'
            },
            {
                id: 3, 
                x: this.CANVAS_WIDTH - margin,
                y: this.CANVAS_HEIGHT - margin,
                name: 'AI-Red'
            }
        ];
        
        // Buff生成范围配置
        this.BUFF_SPAWN_MARGIN = Math.max(30, Math.min(this.CANVAS_WIDTH, this.CANVAS_HEIGHT) * 0.05);
        this.BUFF_SPAWN_MIN_X = this.BUFF_SPAWN_MARGIN;
        this.BUFF_SPAWN_MAX_X = this.CANVAS_WIDTH - this.BUFF_SPAWN_MARGIN;
        this.BUFF_SPAWN_MIN_Y = this.BUFF_SPAWN_MARGIN;
        this.BUFF_SPAWN_MAX_Y = this.CANVAS_HEIGHT - this.BUFF_SPAWN_MARGIN;
        
        // AI探索范围配置
        this.AI_EXPLORE_MARGIN = Math.max(50, Math.min(this.CANVAS_WIDTH, this.CANVAS_HEIGHT) * 0.083);
        this.AI_EXPLORE_MIN_X = this.AI_EXPLORE_MARGIN;
        this.AI_EXPLORE_MAX_X = this.CANVAS_WIDTH - this.AI_EXPLORE_MARGIN;
        this.AI_EXPLORE_MIN_Y = this.AI_EXPLORE_MARGIN;
        this.AI_EXPLORE_MAX_Y = this.CANVAS_HEIGHT - this.AI_EXPLORE_MARGIN;
        
        // AI安全位置候选点（根据画布大小自动生成）
        const safeMargin = Math.min(this.CANVAS_WIDTH, this.CANVAS_HEIGHT) * 0.167; // 约16.7%
        this.AI_SAFE_POSITIONS = [
            { x: safeMargin, y: safeMargin },                                    // 左上
            { x: this.CANVAS_WIDTH - safeMargin, y: safeMargin },               // 右上  
            { x: safeMargin, y: this.CANVAS_HEIGHT - safeMargin },              // 左下
            { x: this.CANVAS_WIDTH - safeMargin, y: this.CANVAS_HEIGHT - safeMargin }, // 右下
            { x: this.CENTER_X, y: this.CENTER_Y }                              // 中心
        ];
        
        // 移动端射击目标配置
        this.MOBILE_SHOOT_RANGE = Math.min(this.CANVAS_WIDTH, this.CANVAS_HEIGHT) * 0.333; // 射击范围
    }
    
    /**
     * 获取角色复活位置
     * @param {number} characterId - 角色ID (1=玩家, 2=AI紫, 3=AI红)
     * @returns {Object} 位置坐标 {x, y}
     */
    getRespawnPosition(characterId) {
        if (characterId === 1) {
            // 玩家复活在中心
            return { x: this.PLAYER_START_X, y: this.PLAYER_START_Y };
        }
        
        // AI角色复活在初始位置
        const aiPos = this.AI_POSITIONS.find(pos => pos.id === characterId);
        return aiPos ? { x: aiPos.x, y: aiPos.y } : { x: this.CENTER_X, y: this.CENTER_Y };
    }
    
    /**
     * 获取随机Buff生成位置
     * @returns {Object} 位置坐标 {x, y}
     */
    getRandomBuffPosition() {
        return {
            x: this.BUFF_SPAWN_MIN_X + Math.random() * (this.BUFF_SPAWN_MAX_X - this.BUFF_SPAWN_MIN_X),
            y: this.BUFF_SPAWN_MIN_Y + Math.random() * (this.BUFF_SPAWN_MAX_Y - this.BUFF_SPAWN_MIN_Y)
        };
    }
    
    /**
     * 获取随机AI探索位置
     * @returns {Object} 位置坐标 {x, y}
     */
    getRandomExplorePosition() {
        return {
            x: this.AI_EXPLORE_MIN_X + Math.random() * (this.AI_EXPLORE_MAX_X - this.AI_EXPLORE_MIN_X),
            y: this.AI_EXPLORE_MIN_Y + Math.random() * (this.AI_EXPLORE_MAX_Y - this.AI_EXPLORE_MIN_Y)
        };
    }
    
    /**
     * 重新计算配置（当需要动态改变画布大小时调用）
     * @param {number} newWidth - 新的画布宽度
     * @param {number} newHeight - 新的画布高度
     */
    updateCanvasSize(newWidth, newHeight) {
        this.CANVAS_WIDTH = newWidth;
        this.CANVAS_HEIGHT = newHeight;
        this.calculateDerivedConfig();
        
        // 游戏配置已更新
    }
    
    /**
     * 获取完整配置信息（调试用）
     * @returns {Object} 配置对象
     */
    getConfigSummary() {
        return {
            canvas: {
                width: this.CANVAS_WIDTH,
                height: this.CANVAS_HEIGHT,
                center: { x: this.CENTER_X, y: this.CENTER_Y }
            },
            grid: {
                size: this.GRID_SIZE,
                width: this.GRID_WIDTH,
                height: this.GRID_HEIGHT,
                totalCells: this.GRID_WIDTH * this.GRID_HEIGHT
            },
            characters: {
                player: { x: this.PLAYER_START_X, y: this.PLAYER_START_Y },
                ais: this.AI_POSITIONS
            },
            areas: {
                buffSpawn: {
                    minX: this.BUFF_SPAWN_MIN_X, maxX: this.BUFF_SPAWN_MAX_X,
                    minY: this.BUFF_SPAWN_MIN_Y, maxY: this.BUFF_SPAWN_MAX_Y
                },
                aiExplore: {
                    minX: this.AI_EXPLORE_MIN_X, maxX: this.AI_EXPLORE_MAX_X,
                    minY: this.AI_EXPLORE_MIN_Y, maxY: this.AI_EXPLORE_MAX_Y
                }
            }
        };
    }
}

// 创建全局配置实例
window.GameConfig = GameConfig;
window.gameConfig = new GameConfig();

// 开发模式下暴露配置信息
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.showGameConfig = () => {
        console.log('游戏配置信息:', window.gameConfig.getConfigSummary());
    };
    
    window.changeCanvasSize = (width, height) => {
        window.gameConfig.updateCanvasSize(width, height);
        
        // 如果游戏已经启动，需要重新初始化相关系统
        if (window.game) {
            console.log('画布大小已更改，建议刷新页面以应用新配置');
        }
    };
} 