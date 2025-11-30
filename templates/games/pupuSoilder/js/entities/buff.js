/**
 * Buff增益系统
 * 处理Buff的生成、收集和效果应用
 */

class BuffSystem {
    constructor() {
        this.buffs = [];                // 活跃的Buff列表
        this.buffPool = null;           // Buff对象池
        this.physics = null;            // 物理系统引用
        
        // Buff属性常量
        this.BUFF_RADIUS = 15;          // Buff碰撞半径
        this.BUFF_EFFECT_DURATION = 5000; // Buff效果持续时间（5秒）
        this.BUFF_SPAWN_TIMES = [20000, 25000]; // Buff生成时间（20秒和25秒）
        this.MAX_CONCURRENT_BUFFS = 4;  // 最大同时存在的Buff数量
        this.MIN_SPAWN_DISTANCE = 50;   // 与角色的最小生成距离
        
        // 游戏状态
        this.gameStartTime = 0;
        this.lastSpawnCheck = 0;
        this.spawnedAtTimes = new Set(); // 记录已生成的时间点
    }
    
    /**
     * 初始化Buff系统
     * @param {BuffPool} buffPool - Buff对象池
     * @param {PhysicsSystem} physics - 物理系统
     */
    initialize(buffPool, physics) {
        this.buffPool = buffPool;
        this.physics = physics;
    }
    
    /**
     * 开始新游戏
     */
    startGame() {
        this.gameStartTime = performance.now();
        this.lastSpawnCheck = this.gameStartTime;
        this.spawnedAtTimes.clear();
        this.clearAllBuffs();
    }
    
    /**
     * 更新Buff系统
     * @param {number} deltaTime - 时间增量
     * @param {Array} characters - 角色数组（用于避免重叠生成）
     */
    update(deltaTime, characters = []) {
        const currentTime = performance.now();
        const gameTime = currentTime - this.gameStartTime;
        
        // 检查是否需要生成新Buff
        this.checkBuffSpawn(gameTime, characters);
        
        // 更新现有Buff（暂时没有需要更新的逻辑，Buff是静态的）
        this.updateBuffVisuals();
    }
    
    /**
     * 检查是否需要生成Buff
     * @param {number} gameTime - 游戏进行时间
     * @param {Array} characters - 角色数组
     */
    checkBuffSpawn(gameTime, characters) {
        for (const spawnTime of this.BUFF_SPAWN_TIMES) {
            // 检查是否到达生成时间且尚未生成
            if (gameTime >= spawnTime && !this.spawnedAtTimes.has(spawnTime)) {
                this.spawnBuffs(2, characters); // 每次生成2个Buff
                this.spawnedAtTimes.add(spawnTime);
            }
        }
    }
    
    /**
     * 生成指定数量的Buff
     * @param {number} count - 生成数量
     * @param {Array} characters - 角色数组（用于避免重叠）
     */
    spawnBuffs(count, characters = []) {
        // 检查当前Buff数量限制
        const currentBuffCount = this.buffs.filter(buff => buff.active).length;
        const maxNewBuffs = this.MAX_CONCURRENT_BUFFS - currentBuffCount;
        const actualCount = Math.min(count, maxNewBuffs);
        
        for (let i = 0; i < actualCount; i++) {
            this.spawnSingleBuff(characters);
        }
    }
    
    /**
     * 生成单个Buff
     * @param {Array} characters - 角色数组
     */
    spawnSingleBuff(characters = []) {
        if (!this.buffPool || !this.physics) {
            console.warn('Buff系统未完全初始化');
            return;
        }
        
        // 寻找合适的生成位置
        const position = this.findValidSpawnPosition(characters);
        if (!position) {
            console.warn('无法找到合适的Buff生成位置');
            return;
        }
        
        // 从对象池获取Buff
        const buff = this.buffPool.acquire();
        
        // 设置Buff属性
        buff.x = position.x;
        buff.y = position.y;
        buff.active = true;
        buff.radius = this.BUFF_RADIUS;
        buff.effectDuration = this.BUFF_EFFECT_DURATION;
        
        // 设置视觉效果
        buff.element.style.display = 'block';
        this.updateBuffVisual(buff);
        
        // 添加到活跃列表
        this.buffs.push(buff);
    }
    
    /**
     * 寻找有效的Buff生成位置
     * @param {Array} characters - 角色数组
     * @returns {Object|null} 位置坐标 {x, y} 或 null
     */
    findValidSpawnPosition(characters) {
        const maxAttempts = 50; // 最大尝试次数，避免死循环
        
                 for (let attempt = 0; attempt < maxAttempts; attempt++) {
             // 从全局配置获取随机Buff生成位置
             const position = window.gameConfig.getRandomBuffPosition();
             const x = position.x;
             const y = position.y;
            
            // 检查是否与角色距离足够远
            let tooClose = false;
            for (const character of characters) {
                if (character.active) {
                    const distance = this.physics.distance(x, y, character.x, character.y);
                    if (distance < this.MIN_SPAWN_DISTANCE) {
                        tooClose = true;
                        break;
                    }
                }
            }
            
            // 检查是否与现有Buff距离足够远
            if (!tooClose) {
                for (const existingBuff of this.buffs) {
                    if (existingBuff.active) {
                        const distance = this.physics.distance(x, y, existingBuff.x, existingBuff.y);
                        if (distance < this.BUFF_RADIUS * 3) { // Buff之间保持3倍半径的距离
                            tooClose = true;
                            break;
                        }
                    }
                }
            }
            
            if (!tooClose) {
                return {x, y};
            }
        }
        
        return null; // 找不到合适位置
    }
    
    /**
     * 更新所有Buff的视觉效果
     */
    updateBuffVisuals() {
        for (const buff of this.buffs) {
            if (buff.active) {
                this.updateBuffVisual(buff);
            }
        }
    }
    
    /**
     * 更新单个Buff的视觉位置
     * @param {Object} buff - Buff对象
     */
    updateBuffVisual(buff) {
        const element = buff.element;
        element.style.transform = `translate(${buff.x - this.BUFF_RADIUS}px, ${buff.y - this.BUFF_RADIUS}px)`;
    }
    
    /**
     * 检测Buff与角色的碰撞
     * @param {Array} characters - 角色数组
     * @returns {Array} 碰撞事件数组 [{buff, character}]
     */
    checkCollisions(characters) {
        const collisions = [];
        
        for (const buff of this.buffs) {
            if (!buff.active) continue;
            
            for (const character of characters) {
                if (!character.active) continue;
                
                // 检测圆形碰撞
                if (this.physics.checkCircleCollision(buff, character)) {
                    collisions.push({
                        buff: buff,
                        character: character
                    });
                }
            }
        }
        
        return collisions;
    }
    
    /**
     * 收集Buff（移除Buff并应用效果）
     * @param {Object} buff - 被收集的Buff
     * @param {Object} character - 收集者
     */
    collectBuff(buff, character) {
        // 应用Buff效果到角色
        this.applyBuffEffect(character);
        
        // 移除Buff
        this.removeBuff(buff);
    }
    
    /**
     * 应用Buff效果到角色
     * @param {Object} character - 目标角色
     */
    applyBuffEffect(character) {
        if (!character) return;
        
        // 设置Buff效果时间
        character.buffEndTime = performance.now() + this.BUFF_EFFECT_DURATION;
        character.isBuffed = true;
        
        // 更新轨迹宽度（加倍）
        character.currentTrackWidth = character.baseTrackWidth * 2;
        
        // 添加视觉效果
        if (character.element) {
            character.element.classList.add('buffed');
        }
    }
    
    /**
     * 移除Buff
     * @param {Object} buff - 要移除的Buff
     */
    removeBuff(buff) {
        const index = this.buffs.indexOf(buff);
        if (index !== -1) {
            // 从活跃列表移除
            this.buffs.splice(index, 1);
            
            // 归还到对象池
            if (this.buffPool) {
                this.buffPool.release(buff);
            }
        }
    }
    
    /**
     * 检查并更新角色的Buff状态
     * @param {Array} characters - 角色数组
     */
    updateCharacterBuffs(characters) {
        const currentTime = performance.now();
        
        for (const character of characters) {
            if (character.isBuffed && character.buffEndTime <= currentTime) {
                // Buff效果结束
                character.isBuffed = false;
                character.currentTrackWidth = character.baseTrackWidth;
                
                // 移除视觉效果
                if (character.element) {
                    character.element.classList.remove('buffed');
                }
            }
        }
    }
    
    /**
     * 获取所有活跃Buff
     * @returns {Array} 活跃Buff数组
     */
    getActiveBuffs() {
        return this.buffs.filter(buff => buff.active);
    }
    
    /**
     * 清空所有Buff
     */
    clearAllBuffs() {
        // 归还所有Buff到对象池
        for (const buff of this.buffs) {
            if (this.buffPool) {
                this.buffPool.release(buff);
            }
        }
        
        this.buffs.length = 0;
    }
    
    /**
     * 获取统计信息（调试用）
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            activeBuffs: this.buffs.filter(buff => buff.active).length,
            totalBuffs: this.buffs.length,
            spawnedTimes: Array.from(this.spawnedAtTimes),
            poolStats: this.buffPool ? this.buffPool.getStats() : null
        };
    }
}

// 导出到全局
window.BuffSystem = BuffSystem; 