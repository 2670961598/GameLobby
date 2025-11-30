/**
 * 对象池系统 - 用于复用游戏对象，避免频繁创建/销毁导致的GC抖动
 */

/**
 * 通用对象池基类
 */
class ObjectPool {
    constructor(createFn, resetFn, initialSize = 50) {
        this.createFn = createFn;     // 创建对象的函数
        this.resetFn = resetFn;       // 重置对象的函数
        this.pool = [];               // 空闲对象池
        this.active = [];             // 活跃对象列表
        
        // 预先创建一些对象
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
        }
    }
    
    /**
     * 获取一个对象
     * @returns {Object} 可用的对象
     */
    acquire() {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            obj = this.createFn(); // 池空时创建新对象
        }
        
        this.active.push(obj);
        return obj;
    }
    
    /**
     * 归还对象到池中
     * @param {Object} obj - 要归还的对象
     */
    release(obj) {
        const index = this.active.indexOf(obj);
        if (index !== -1) {
            this.active.splice(index, 1);
            this.resetFn(obj);      // 重置对象状态
            this.pool.push(obj);    // 放回池中
        }
    }
    
    /**
     * 获取活跃对象列表（只读）
     * @returns {Array} 活跃对象数组的副本
     */
    getActive() {
        return [...this.active];
    }
    
    /**
     * 清空所有活跃对象
     */
    releaseAll() {
        while (this.active.length > 0) {
            this.release(this.active[0]);
        }
    }
    
    /**
     * 获取池状态信息（调试用）
     * @returns {Object} 包含池状态的对象
     */
    getStats() {
        return {
            poolSize: this.pool.length,
            activeCount: this.active.length,
            totalSize: this.pool.length + this.active.length
        };
    }
}

/**
 * 子弹对象池
 */
class BulletPool extends ObjectPool {
    constructor() {
        super(
            // 创建子弹元素
            () => {
                const template = document.getElementById('bullet-template');
                const bullet = template.content.cloneNode(true).firstElementChild;
                document.getElementById('game-layer').appendChild(bullet);
                return {
                    element: bullet,
                    x: 0, y: 0,
                    vx: 0, vy: 0,
                    damage: 20,
                    maxDistance: 600,
                    traveledDistance: 0,
                    ownerId: 0,        // 发射者ID
                    active: false
                };
            },
            // 重置子弹状态
            (bullet) => {
                bullet.element.style.display = 'none';
                bullet.active = false;
                bullet.traveledDistance = 0;
            },
            100 // 预创建100个子弹
        );
    }
}

/**
 * Buff对象池
 */
class BuffPool extends ObjectPool {
    constructor() {
        super(
            // 创建Buff元素
            () => {
                const template = document.getElementById('buff-template');
                const buff = template.content.cloneNode(true).firstElementChild;
                document.getElementById('game-layer').appendChild(buff);
                return {
                    element: buff,
                    x: 0, y: 0,
                    effectDuration: 5000,  // 效果持续5秒
                    active: false
                };
            },
            // 重置Buff状态
            (buff) => {
                buff.element.style.display = 'none';
                buff.active = false;
            },
            10 // Buff数量较少，预创建10个即可
        );
    }
}

// 导出到全局
window.ObjectPool = ObjectPool;
window.BulletPool = BulletPool;
window.BuffPool = BuffPool; 