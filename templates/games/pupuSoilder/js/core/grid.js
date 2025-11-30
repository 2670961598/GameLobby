/**
 * 网格管理系统
 * 负责管理地板网格的颜色状态和统计
 * 每个网格单元大小为10x10像素
 */

// 网格系统配置常量 - 从全局配置获取
const getGridConfig = () => window.gameConfig;
const GRID_SIZE = () => getGridConfig().GRID_SIZE;
const GRID_WIDTH = () => getGridConfig().GRID_WIDTH;
const GRID_HEIGHT = () => getGridConfig().GRID_HEIGHT;

// 颜色常量定义 - 对应角色类型
const COLOR_EMPTY = 0;          // 未染色
const COLOR_PLAYER = 1;         // 玩家绿色
const COLOR_AI_PURPLE = 2;      // AI紫色
const COLOR_AI_RED = 3;         // AI红色

// 颜色映射表 - 用于渲染时获取实际颜色值
const COLOR_MAP = {
    [COLOR_EMPTY]: '#34495e',     // 默认地板色
    [COLOR_PLAYER]: '#AFE59B',    // 玩家绿色
    [COLOR_AI_PURPLE]: '#7B75D3', // AI紫色
    [COLOR_AI_RED]: '#E37A80'     // AI红色
};

/**
 * 网格系统类
 * 管理整个游戏区域的颜色网格状态
 */
class GridSystem {
    constructor() {
        // 初始化网格数组 - 使用Uint8Array节省内存
        this.grid = Array.from({length: GRID_HEIGHT()}, () => new Uint8Array(GRID_WIDTH()));
        
        // 脏区域数组 - 存储需要重绘的网格坐标
        this.dirtyCells = [];
        
        // 颜色统计缓存 - 避免每次都重新计算
        this.colorCounts = [0, 0, 0, 0];
        this.lastUpdateTime = 0;
        this.statsUpdateInterval = 166; // 每166ms更新一次统计（约6次/秒）
        
        // Canvas渲染上下文
        this.canvas = null;
        this.ctx = null;
        
        this.initCanvas();
    }
    
    /**
     * 初始化Canvas渲染上下文
     */
    initCanvas() {
        this.canvas = document.getElementById('ground');
        if (this.canvas) {
            // 设置canvas尺寸为配置中的尺寸
            this.canvas.width = getGridConfig().CANVAS_WIDTH;
            this.canvas.height = getGridConfig().CANVAS_HEIGHT;
            
            this.ctx = this.canvas.getContext('2d');
            this.ctx.imageSmoothingEnabled = false; // 确保像素完美渲染
            this.renderAllCells(); // 初始渲染整个网格
        }
    }
    
    /**
     * 在指定像素位置染色
     * @param {number} xPx - X坐标（像素）
     * @param {number} yPx - Y坐标（像素）
     * @param {number} colorId - 颜色ID (1=玩家, 2=AI紫, 3=AI红)
     */
    paintAt(xPx, yPx, colorId) {
        // 转换像素坐标到网格坐标
        const gridX = Math.floor(xPx / GRID_SIZE());
        const gridY = Math.floor(yPx / GRID_SIZE());
        
        // 边界检查
        if (gridX < 0 || gridX >= GRID_WIDTH() || gridY < 0 || gridY >= GRID_HEIGHT()) {
            return; // 超出边界，不进行染色
        }
        
        // 只有颜色发生变化时才需要更新
        if (this.grid[gridY][gridX] !== colorId) {
            this.grid[gridY][gridX] = colorId;
            
            // 添加到脏区域列表，等待渲染
            this.dirtyCells.push([gridX, gridY, colorId]);
        }
    }
    
    /**
     * 根据角色位置和轨迹宽度进行染色
     * @param {number} xPx - 角色X坐标（像素）
     * @param {number} yPx - 角色Y坐标（像素）
     * @param {number} colorId - 颜色ID
     * @param {number} trackWidth - 轨迹宽度（像素，默认15）
     */
    paintTrack(xPx, yPx, colorId, trackWidth = 15) {
        const radius = Math.ceil(trackWidth / 2 / GRID_SIZE()); // 计算需要染色的网格半径
        const centerX = Math.floor(xPx / GRID_SIZE());
        const centerY = Math.floor(yPx / GRID_SIZE());
        
        // 在圆形区域内染色
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                // 检查是否在圆形范围内
                if (dx * dx + dy * dy <= radius * radius) {
                    const gridX = centerX + dx;
                    const gridY = centerY + dy;
                    
                    // 边界检查
                    if (gridX >= 0 && gridX < GRID_WIDTH() && gridY >= 0 && gridY < GRID_HEIGHT()) {
                        if (this.grid[gridY][gridX] !== colorId) {
                            this.grid[gridY][gridX] = colorId;
                            this.dirtyCells.push([gridX, gridY, colorId]);
                        }
                    }
                }
            }
        }
    }
    
    /**
     * 获取指定位置的颜色
     * @param {number} xPx - X坐标（像素）
     * @param {number} yPx - Y坐标（像素）
     * @returns {number} 颜色ID
     */
    getColorAt(xPx, yPx) {
        const gridX = Math.floor(xPx / GRID_SIZE());
        const gridY = Math.floor(yPx / GRID_SIZE());
        
        if (gridX < 0 || gridX >= GRID_WIDTH() || gridY < 0 || gridY >= GRID_HEIGHT()) {
            return COLOR_EMPTY; // 超出边界返回空颜色
        }
        
        return this.grid[gridY][gridX];
    }
    
    /**
     * 统计各颜色的占比
     * @param {boolean} forceUpdate - 是否强制更新统计
     * @returns {Array<number>} 各颜色占比数组 [空, 绿, 紫, 红]
     */
    getColorPercentages(forceUpdate = false) {
        const now = performance.now();
        
        // 检查是否需要更新统计（节省性能）
        if (!forceUpdate && now - this.lastUpdateTime < this.statsUpdateInterval) {
            return this.calculatePercentages();
        }
        
        // 重新统计颜色数量
        this.colorCounts.fill(0);
        
        for (let y = 0; y < GRID_HEIGHT(); y++) {
            for (let x = 0; x < GRID_WIDTH(); x++) {
                this.colorCounts[this.grid[y][x]]++;
            }
        }
        
        this.lastUpdateTime = now;
        return this.calculatePercentages();
    }
    
    /**
     * 根据颜色数量计算百分比
     * @returns {Array<number>} 百分比数组 [空, 绿, 紫, 红]
     */
    calculatePercentages() {
        const total = GRID_WIDTH() * GRID_HEIGHT();
        return this.colorCounts.map(count => +(count * 100 / total).toFixed(1));
    }
    
    /**
     * 渲染脏区域（需要更新的网格单元）
     */
    renderDirtyCells() {
        if (!this.ctx || this.dirtyCells.length === 0) {
            return; // 没有需要渲染的内容
        }
        
        // 渲染所有脏区域
        for (const [gridX, gridY, colorId] of this.dirtyCells) {
            this.ctx.fillStyle = COLOR_MAP[colorId];
                            this.ctx.fillRect(
                gridX * GRID_SIZE(),
                gridY * GRID_SIZE(),
                GRID_SIZE(),
                GRID_SIZE()
            );
        }
        
        // 清空脏区域列表
        this.dirtyCells.length = 0;
    }
    
    /**
     * 渲染整个网格（初始化时使用）
     */
    renderAllCells() {
        if (!this.ctx) return;
        
        // 先填充默认背景色
        this.ctx.fillStyle = COLOR_MAP[COLOR_EMPTY];
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 渲染所有非空网格
        for (let y = 0; y < GRID_HEIGHT(); y++) {
            for (let x = 0; x < GRID_WIDTH(); x++) {
                const colorId = this.grid[y][x];
                if (colorId !== COLOR_EMPTY) {
                    this.ctx.fillStyle = COLOR_MAP[colorId];
                    this.ctx.fillRect(x * GRID_SIZE(), y * GRID_SIZE(), GRID_SIZE(), GRID_SIZE());
                }
            }
        }
    }
    
    /**
     * 重置网格（游戏重新开始时调用）
     */
    reset() {
        // 重新初始化网格数组（以防尺寸发生变化）
        this.grid = Array.from({length: GRID_HEIGHT()}, () => new Uint8Array(GRID_WIDTH()));
        
        // 清空所有网格
        for (let y = 0; y < GRID_HEIGHT(); y++) {
            this.grid[y].fill(COLOR_EMPTY);
        }
        
        // 重置统计
        this.colorCounts.fill(0);
        this.dirtyCells.length = 0;
        this.lastUpdateTime = 0;
        
        // 重新渲染
        this.renderAllCells();
    }
    
    /**
     * 获取指定颜色的总面积（调试用）
     * @param {number} colorId - 颜色ID
     * @returns {number} 该颜色的网格数量
     */
    getColorCount(colorId) {
        return this.colorCounts[colorId] || 0;
    }
}

// 导出常量和类
window.GridSystem = GridSystem;
window.GRID_CONSTANTS = {
    GRID_SIZE,
    GRID_WIDTH,
    GRID_HEIGHT,
    COLOR_EMPTY,
    COLOR_PLAYER,
    COLOR_AI_PURPLE,
    COLOR_AI_RED,
    COLOR_MAP
}; 