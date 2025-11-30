/**
 * AI角色系统
 * 实现AI的智能行为、状态机和策略决策
 */

// AI状态常量
const AIState = {
    EXPLORE: 'explore',     // 探索状态：寻找空白区域
    PURSUE: 'pursue',       // 追击状态：攻击目标
    EVADE: 'evade'         // 回避状态：血量低时逃跑
};

class AICharacter {
    constructor(id, startX, startY) {
        // 基础属性
        this.id = id;                       // AI ID（2=紫色, 3=红色）
        this.x = startX;                    // X坐标
        this.y = startY;                    // Y坐标
        this.radius = 12;                   // 碰撞半径
        this.active = true;                 // 是否活跃
        
        // 移动相关
        this.speed = 5;                     // 移动速度
        this.vx = 0;                        // X方向速度
        this.vy = 0;                        // Y方向速度
        this.targetX = startX;              // 目标X坐标
        this.targetY = startY;              // 目标Y坐标
        
        // 战斗相关
        this.maxHP = 100;                   // 最大生命值
        this.hp = 100;                      // 当前生命值
        this.lastFireTime = 0;              // 上次射击时间
        this.fireInterval = 1000;           // 射击间隔
        this.viewRange = 200;               // 视野范围
        
        // 轨迹相关
        this.baseTrackWidth = 15;           // 基础轨迹宽度
        this.currentTrackWidth = 15;        // 当前轨迹宽度
        this.lastTrackPaint = 0;            // 上次轨迹绘制时间
        this.trackPaintInterval = 50;       // 轨迹绘制间隔
        
        // Buff相关
        this.isBuffed = false;              // 是否有Buff效果
        this.buffEndTime = 0;               // Buff结束时间
        
        // 无敌相关
        this.isInvincible = false;          // 是否无敌
        this.invincibleEndTime = 0;         // 无敌结束时间
        this.invincibleDuration = 3000;     // 无敌持续时间
        
        // 受击效果
        this.hitEffectEndTime = 0;          // 受击效果结束时间
        
        // AI状态机
        this.state = AIState.EXPLORE;       // 当前状态
        this.stateTimer = 0;                // 状态持续时间
        this.lastStateChange = 0;           // 上次状态改变时间
        this.targetEnemy = null;            // 当前目标敌人
        
        // AI决策参数
        this.aggressiveness = 0.5;          // 攻击性（0-1）
        this.pathUpdateInterval = 600;      // 路径更新间隔（10帧）
        this.lastPathUpdate = 0;            // 上次路径更新时间
        this.explorationTarget = null;      // 探索目标点
        
        // DOM元素
        this.element = null;
        
        this.createElement();
    }
    
    /**
     * 创建AI DOM元素
     */
    createElement() {
        const template = document.getElementById('ai-template');
        this.element = template.content.cloneNode(true).firstElementChild;
        
        // 设置AI角色类型样式
        const roleClass = this.id === 2 ? 'role2' : 'role3';
        this.element.classList.add(roleClass);
        
        // 设置初始位置
        this.updateVisual();
        
        // 添加到游戏层
        document.getElementById('game-layer').appendChild(this.element);
    }
    
    /**
     * 更新AI状态
     * @param {number} deltaTime - 时间增量
     * @param {GridSystem} gridSystem - 网格系统
     * @param {PhysicsSystem} physics - 物理系统
     * @param {Player} player - 玩家对象
     * @param {Array} allCharacters - 所有角色数组
     */
    update(deltaTime, gridSystem, physics, player, allCharacters) {
        if (!this.active) return;
        
        // 更新状态机
        this.updateStateMachine(player, allCharacters, gridSystem);
        
        // 更新移动
        this.updateMovement(physics);
        
        // 更新轨迹绘制
        this.updateTrack(gridSystem);
        
        // 更新状态效果
        this.updateEffects();
        
        // 更新视觉表现
        this.updateVisual();
    }
    
    /**
     * 更新AI状态机
     * @param {Player} player - 玩家对象
     * @param {Array} allCharacters - 所有角色
     * @param {GridSystem} gridSystem - 网格系统
     */
    updateStateMachine(player, allCharacters, gridSystem) {
        const currentTime = performance.now();
        this.stateTimer = currentTime - this.lastStateChange;
        
        // 获取当前比分情况
        const scores = gridSystem.getColorPercentages();
        const myScore = scores[this.id];
        const playerScore = scores[1];
        const scoreDiff = myScore - playerScore;
        
        // 根据比分调整策略
        this.adjustStrategy(scoreDiff);
        
        // 状态转换逻辑
        switch (this.state) {
            case AIState.EXPLORE:
                this.handleExploreState(player, allCharacters, gridSystem);
                break;
            case AIState.PURSUE:
                this.handlePursueState(player, allCharacters);
                break;
            case AIState.EVADE:
                this.handleEvadeState(player, allCharacters);
                break;
        }
        
        // 定期更新路径
        if (currentTime - this.lastPathUpdate >= this.pathUpdateInterval) {
            this.updatePath(gridSystem);
            this.lastPathUpdate = currentTime;
        }
    }
    
    /**
     * 处理探索状态
     * @param {Player} player - 玩家对象
     * @param {Array} allCharacters - 所有角色
     * @param {GridSystem} gridSystem - 网格系统
     */
    handleExploreState(player, allCharacters, gridSystem) {
        // 检查是否发现敌人
        const nearbyEnemies = this.findNearbyEnemies(allCharacters);
        
        if (nearbyEnemies.length > 0 && this.hp > 50) {
            // 发现敌人且血量充足，切换到追击状态
            this.targetEnemy = nearbyEnemies[0];
            this.changeState(AIState.PURSUE);
            return;
        }
        
        // 寻找空白区域或敌方区域进行占领
        if (!this.explorationTarget || this.isNearTarget(this.explorationTarget, 50)) {
            this.explorationTarget = this.findExplorationTarget(gridSystem);
        }
        
        if (this.explorationTarget) {
            this.moveTowards(this.explorationTarget.x, this.explorationTarget.y);
        }
    }
    
    /**
     * 处理追击状态
     * @param {Player} player - 玩家对象
     * @param {Array} allCharacters - 所有角色
     */
    handlePursueState(player, allCharacters) {
        // 检查血量，血量过低时撤退
        if (this.hp < 30) {
            this.changeState(AIState.EVADE);
            return;
        }
        
        // 检查目标是否仍在视野内
        if (!this.targetEnemy || !this.targetEnemy.active || 
            this.getDistanceTo(this.targetEnemy) > this.viewRange * 1.5) {
            
            // 重新寻找目标
            const nearbyEnemies = this.findNearbyEnemies(allCharacters);
            if (nearbyEnemies.length > 0) {
                this.targetEnemy = nearbyEnemies[0];
            } else {
                this.changeState(AIState.EXPLORE);
                return;
            }
        }
        
        // 追击目标
        if (this.targetEnemy) {
            this.moveTowards(this.targetEnemy.x, this.targetEnemy.y);
        }
    }
    
    /**
     * 处理回避状态
     * @param {Player} player - 玩家对象
     * @param {Array} allCharacters - 所有角色
     */
    handleEvadeState(player, allCharacters) {
        // 血量恢复且安全时，回到探索状态
        if (this.hp > 60 && this.isSafePosition(allCharacters)) {
            this.changeState(AIState.EXPLORE);
            return;
        }
        
        // 寻找最安全的位置
        const safePosition = this.findSafePosition(allCharacters);
        if (safePosition) {
            this.moveTowards(safePosition.x, safePosition.y);
        }
    }
    
    /**
     * 根据比分差异调整AI策略
     * @param {number} scoreDiff - 与玩家的分数差异
     */
    adjustStrategy(scoreDiff) {
        if (scoreDiff > 10) {
            // 领先时更保守
            this.aggressiveness = 0.3;
            this.fireInterval = 1200;
        } else if (scoreDiff < -10) {
            // 落后时更激进
            this.aggressiveness = 0.8;
            this.fireInterval = 800;
        } else {
            // 相持时平衡策略
            this.aggressiveness = 0.5;
            this.fireInterval = 1000;
        }
    }
    
    /**
     * 寻找附近的敌人
     * @param {Array} allCharacters - 所有角色
     * @returns {Array} 敌人数组
     */
    findNearbyEnemies(allCharacters) {
        const enemies = [];
        
        for (const character of allCharacters) {
            if (character.active && character.id !== this.id) {
                const distance = this.getDistanceTo(character);
                if (distance <= this.viewRange) {
                    enemies.push({...character, distance});
                }
            }
        }
        
        // 按距离排序，最近的敌人优先
        return enemies.sort((a, b) => a.distance - b.distance);
    }
    
    /**
     * 寻找探索目标
     * @param {GridSystem} gridSystem - 网格系统
     * @returns {Object|null} 目标位置 {x, y}
     */
    findExplorationTarget(gridSystem) {
                          // 从全局配置获取随机探索位置
         return window.gameConfig.getRandomExplorePosition();
    }
    
    /**
     * 寻找安全位置
     * @param {Array} allCharacters - 所有角色
     * @returns {Object|null} 安全位置 {x, y}
     */
    findSafePosition(allCharacters) {
                 // 找到距离敌人最远的位置
         let bestPosition = null;
         let maxMinDistance = 0;
         
         // 从全局配置获取安全位置候选点
         const candidates = window.gameConfig.AI_SAFE_POSITIONS;
        
        for (const candidate of candidates) {
            let minDistance = Infinity;
            
            for (const character of allCharacters) {
                if (character.active && character.id !== this.id) {
                    const distance = Math.sqrt(
                        (candidate.x - character.x) ** 2 + 
                        (candidate.y - character.y) ** 2
                    );
                    minDistance = Math.min(minDistance, distance);
                }
            }
            
            if (minDistance > maxMinDistance) {
                maxMinDistance = minDistance;
                bestPosition = candidate;
            }
        }
        
        return bestPosition;
    }
    
    /**
     * 检查当前位置是否安全
     * @param {Array} allCharacters - 所有角色
     * @returns {boolean} 是否安全
     */
    isSafePosition(allCharacters) {
        for (const character of allCharacters) {
            if (character.active && character.id !== this.id) {
                const distance = this.getDistanceTo(character);
                if (distance < 100) { // 100像素内认为不安全
                    return false;
                }
            }
        }
        return true;
    }
    
    /**
     * 向目标移动
     * @param {number} targetX - 目标X坐标
     * @param {number} targetY - 目标Y坐标
     */
    moveTowards(targetX, targetY) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) { // 避免在目标点附近震荡
            this.vx = (dx / distance) * this.speed;
            this.vy = (dy / distance) * this.speed;
        } else {
            this.vx = 0;
            this.vy = 0;
        }
    }
    
    /**
     * 更新移动逻辑
     * @param {PhysicsSystem} physics - 物理系统
     */
    updateMovement(physics) {
        // 更新位置
        this.x += this.vx;
        this.y += this.vy;
        
        // 边界限制
        physics.clampToBounds(this);
    }
    
    /**
     * 更新轨迹绘制
     * @param {GridSystem} gridSystem - 网格系统
     */
    updateTrack(gridSystem) {
        const currentTime = performance.now();
        
        // 检查是否需要绘制轨迹
        if ((this.vx !== 0 || this.vy !== 0) && 
            currentTime - this.lastTrackPaint >= this.trackPaintInterval) {
            
            gridSystem.paintTrack(this.x, this.y, this.id, this.currentTrackWidth);
            this.lastTrackPaint = currentTime;
        }
    }
    
    /**
     * 更新路径（较低频率的复杂决策）
     * @param {GridSystem} gridSystem - 网格系统
     */
    updatePath(gridSystem) {
        // 这里可以实现更复杂的路径规划逻辑
        // 例如A*寻路、避障等
    }
    
    /**
     * 尝试射击
     * @param {BulletSystem} bulletSystem - 子弹系统
     * @param {Array} allCharacters - 所有角色
     * @returns {boolean} 是否成功射击
     */
    tryFire(bulletSystem, allCharacters) {
        const currentTime = performance.now();
        
        // 检查射击冷却
        if (currentTime - this.lastFireTime < this.fireInterval) {
            return false;
        }
        
        // 寻找射击目标
        const target = this.findFireTarget(allCharacters);
        if (!target) return false;
        
        // 发射子弹
        const bullet = bulletSystem.fireBullet(this.x, this.y, target.x, target.y, this.id);
        
        if (bullet) {
            this.lastFireTime = currentTime;
            return true;
        }
        
        return false;
    }
    
    /**
     * 寻找射击目标
     * @param {Array} allCharacters - 所有角色
     * @returns {Object|null} 目标位置 {x, y}
     */
    findFireTarget(allCharacters) {
        // 在追击状态下射击目标敌人
        if (this.state === AIState.PURSUE && this.targetEnemy) {
            // 简单的预测射击：预测目标位置
            const prediction = this.predictTargetPosition(this.targetEnemy);
            return prediction;
        }
        
        // 其他状态下寻找最近的敌人
        const nearbyEnemies = this.findNearbyEnemies(allCharacters);
        if (nearbyEnemies.length > 0) {
            const target = nearbyEnemies[0];
            return this.predictTargetPosition(target);
        }
        
        return null;
    }
    
    /**
     * 预测目标位置（简单的前置量计算）
     * @param {Object} target - 目标对象
     * @returns {Object} 预测位置 {x, y}
     */
    predictTargetPosition(target) {
        // 简单预测：假设目标继续以当前速度移动
        const bulletSpeed = 12; // 子弹速度
        const distance = this.getDistanceTo(target);
        const timeToHit = distance / bulletSpeed;
        
        return {
            x: target.x + (target.vx || 0) * timeToHit,
            y: target.y + (target.vy || 0) * timeToHit
        };
    }
    
    /**
     * 其他方法与Player类似（takeDamage, die, respawn等）
     */
    
    takeDamage(damage) {
        if (this.isInvincible) return false;
        
        this.hp = Math.max(0, this.hp - damage);
        
        this.hitEffectEndTime = performance.now() + 600;
        this.element.classList.add('hit');
        
        if (this.hp <= 0) {
            this.die();
            return true;
        }
        
        return false;
    }
    
    die() {
        this.active = false;
        this.element.style.display = 'none';
    }
    
    respawn(x, y) {
        this.x = x;
        this.y = y;
        this.hp = this.maxHP;
        this.active = true;
        
        this.isInvincible = true;
        this.invincibleEndTime = performance.now() + this.invincibleDuration;
        
        this.element.style.display = 'block';
        this.element.classList.add('invincible');
        this.element.classList.remove('hit');
        
        this.changeState(AIState.EXPLORE);
        this.updateVisual();
    }
    
    updateEffects() {
        const currentTime = performance.now();
        
        if (this.isInvincible && currentTime >= this.invincibleEndTime) {
            this.isInvincible = false;
            this.element.classList.remove('invincible');
        }
        
        if (currentTime >= this.hitEffectEndTime) {
            this.element.classList.remove('hit');
        }
    }
    
    updateVisual() {
        if (!this.element) return;
        this.element.style.transform = `translate(${this.x - this.radius}px, ${this.y - this.radius}px)`;
    }
    
    // 工具方法
    changeState(newState) {
        this.state = newState;
        this.lastStateChange = performance.now();
        this.stateTimer = 0;
    }
    
    getDistanceTo(target) {
        const dx = this.x - target.x;
        const dy = this.y - target.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    isNearTarget(target, threshold) {
        return this.getDistanceTo(target) < threshold;
    }
    
    reset() {
        // 从全局配置获取初始位置
        const aiConfig = window.gameConfig.AI_POSITIONS.find(pos => pos.id === this.id);
        this.x = aiConfig ? aiConfig.x : window.gameConfig.CENTER_X;
        this.y = aiConfig ? aiConfig.y : window.gameConfig.CENTER_Y;
        
        // 重置AI状态，类似Player的reset方法
        this.hp = this.maxHP;
        this.active = true;
        this.vx = 0;
        this.vy = 0;
        
        this.isBuffed = false;
        this.isInvincible = false;
        this.currentTrackWidth = this.baseTrackWidth;
        
        this.changeState(AIState.EXPLORE);
        this.targetEnemy = null;
        this.explorationTarget = null;
        
        this.element.style.display = 'block';
        this.element.className = `character ai ${this.id === 2 ? 'role2' : 'role3'}`;
        
        this.updateVisual();
    }
}

// 导出到全局
window.AICharacter = AICharacter;
window.AIState = AIState; 