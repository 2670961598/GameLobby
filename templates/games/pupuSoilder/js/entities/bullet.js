/**
 * 子弹实体系统
 * 处理子弹的创建、移动、碰撞检测和销毁
 */

class BulletSystem {
    constructor() {
        this.bullets = [];              // 活跃的子弹列表
        this.bulletPool = null;         // 子弹对象池
        this.physics = null;            // 物理系统引用
        
        // 子弹属性常量
        this.BULLET_SPEED = 12;         // 子弹速度（像素/帧）
        this.BULLET_DAMAGE = 20;        // 子弹伤害
        this.BULLET_MAX_DISTANCE = 600; // 子弹最大飞行距离
        this.BULLET_RADIUS = 5;         // 子弹碰撞半径
    }
    
    /**
     * 初始化子弹系统
     * @param {BulletPool} bulletPool - 子弹对象池
     * @param {PhysicsSystem} physics - 物理系统
     */
    initialize(bulletPool, physics) {
        this.bulletPool = bulletPool;
        this.physics = physics;
    }
    
    /**
     * 发射子弹
     * @param {number} x - 发射位置X
     * @param {number} y - 发射位置Y  
     * @param {number} targetX - 目标位置X
     * @param {number} targetY - 目标位置Y
     * @param {number} ownerId - 发射者ID（1=玩家, 2=AI紫, 3=AI红）
     * @returns {Object|null} 创建的子弹对象或null
     */
    fireBullet(x, y, targetX, targetY, ownerId) {
        if (!this.bulletPool) {
            console.warn('子弹池未初始化');
            return null;
        }
        
        // 从对象池获取子弹
        const bullet = this.bulletPool.acquire();
        
        // 计算发射方向
        const angle = this.physics.angle(x, y, targetX, targetY);
        const velocity = this.physics.normalize(
            Math.cos(angle) * this.BULLET_SPEED,
            Math.sin(angle) * this.BULLET_SPEED
        );
        
        // 设置子弹属性
        bullet.x = x;
        bullet.y = y;
        bullet.vx = velocity.x * this.BULLET_SPEED;
        bullet.vy = velocity.y * this.BULLET_SPEED;
        bullet.damage = this.BULLET_DAMAGE;
        bullet.maxDistance = this.BULLET_MAX_DISTANCE;
        bullet.traveledDistance = 0;
        bullet.ownerId = ownerId;
        bullet.active = true;
        bullet.radius = this.BULLET_RADIUS;
        
        // 设置视觉样式
        const colorClass = this.getColorClass(ownerId);
        bullet.element.className = `bullet ${colorClass}`;
        bullet.element.style.display = 'block';
        
        // 更新视觉位置
        this.updateBulletVisual(bullet);
        
        // 添加到活跃列表
        this.bullets.push(bullet);
        
        return bullet;
    }
    
    /**
     * 更新所有子弹
     * @param {number} deltaTime - 时间增量（毫秒）
     */
    update(deltaTime) {
        // 反向遍历，便于安全删除
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            if (!bullet.active) {
                this.removeBullet(bullet, i);
                continue;
            }
            
            // 更新位置
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
            
            // 更新飞行距离
            const frameDistance = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
            bullet.traveledDistance += frameDistance;
            
            // 检查是否超出最大距离
            if (bullet.traveledDistance >= bullet.maxDistance) {
                this.removeBullet(bullet, i);
                continue;
            }
            
            // 检查边界碰撞
            const boundary = this.physics.checkBoundaryCollision(bullet);
            if (boundary.left || boundary.right || boundary.top || boundary.bottom) {
                this.removeBullet(bullet, i);
                continue;
            }
            
            // 更新视觉位置
            this.updateBulletVisual(bullet);
        }
    }
    
    /**
     * 更新子弹的视觉位置
     * @param {Object} bullet - 子弹对象
     */
    updateBulletVisual(bullet) {
        const element = bullet.element;
        element.style.transform = `translate(${bullet.x - this.BULLET_RADIUS}px, ${bullet.y - this.BULLET_RADIUS}px)`;
    }
    
    /**
     * 移除子弹
     * @param {Object} bullet - 子弹对象
     * @param {number} index - 在数组中的索引
     */
    removeBullet(bullet, index) {
        // 从活跃列表移除
        this.bullets.splice(index, 1);
        
        // 归还到对象池
        if (this.bulletPool) {
            this.bulletPool.release(bullet);
        }
    }
    
    /**
     * 根据拥有者ID获取颜色类名
     * @param {number} ownerId - 拥有者ID
     * @returns {string} CSS类名
     */
    getColorClass(ownerId) {
        switch (ownerId) {
            case 1: return 'role1';   // 玩家绿色
            case 2: return 'role2';   // AI紫色
            case 3: return 'role3';   // AI红色
            default: return 'role1';
        }
    }
    
    /**
     * 获取所有活跃子弹（用于碰撞检测）
     * @returns {Array} 活跃子弹数组
     */
    getActiveBullets() {
        return this.bullets.filter(bullet => bullet.active);
    }
    
    /**
     * 检测子弹与目标的碰撞
     * @param {Array} targets - 目标对象数组
     * @returns {Array} 碰撞事件数组 [{bullet, target}]
     */
    checkCollisions(targets) {
        const collisions = [];
        
        for (const bullet of this.bullets) {
            if (!bullet.active) continue;
            
            for (const target of targets) {
                if (!target.active || target.id === bullet.ownerId) {
                    continue; // 跳过非活跃目标和自己发射的子弹
                }
                
                // 检测圆形碰撞
                if (this.physics.checkCircleCollision(bullet, target)) {
                    collisions.push({
                        bullet: bullet,
                        target: target,
                        damage: bullet.damage
                    });
                }
            }
        }
        
        return collisions;
    }
    
    /**
     * 清空所有子弹
     */
    clear() {
        // 归还所有子弹到对象池
        for (const bullet of this.bullets) {
            if (this.bulletPool) {
                this.bulletPool.release(bullet);
            }
        }
        
        this.bullets.length = 0;
    }
    
    /**
     * 获取统计信息（调试用）
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            activeBullets: this.bullets.length,
            poolStats: this.bulletPool ? this.bulletPool.getStats() : null
        };
    }
}

// 导出到全局
window.BulletSystem = BulletSystem; 