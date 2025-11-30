/**
 * 物理系统 - 碰撞检测和空间分割
 */

/**
 * 四叉树节点类 - 用于空间分割优化碰撞检测
 */
class QuadTreeNode {
    constructor(x, y, width, height, maxObjects = 10, maxLevels = 5, level = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.maxObjects = maxObjects;
        this.maxLevels = maxLevels;
        this.level = level;
        this.objects = [];
        this.nodes = [];
    }
    
    /**
     * 清空节点
     */
    clear() {
        this.objects = [];
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].clear();
        }
        this.nodes = [];
    }
    
    /**
     * 分割节点为四个子节点
     */
    split() {
        const subWidth = this.width / 2;
        const subHeight = this.height / 2;
        const x = this.x;
        const y = this.y;
        
        this.nodes[0] = new QuadTreeNode(x + subWidth, y, subWidth, subHeight, this.maxObjects, this.maxLevels, this.level + 1);
        this.nodes[1] = new QuadTreeNode(x, y, subWidth, subHeight, this.maxObjects, this.maxLevels, this.level + 1);
        this.nodes[2] = new QuadTreeNode(x, y + subHeight, subWidth, subHeight, this.maxObjects, this.maxLevels, this.level + 1);
        this.nodes[3] = new QuadTreeNode(x + subWidth, y + subHeight, subWidth, subHeight, this.maxObjects, this.maxLevels, this.level + 1);
    }
    
    /**
     * 获取对象应该放入的子节点索引
     */
    getIndex(obj) {
        let index = -1;
        const verticalMidpoint = this.x + (this.width / 2);
        const horizontalMidpoint = this.y + (this.height / 2);
        
        const topQuadrant = obj.y < horizontalMidpoint && obj.y + obj.height < horizontalMidpoint;
        const bottomQuadrant = obj.y > horizontalMidpoint;
        
        if (obj.x < verticalMidpoint && obj.x + obj.width < verticalMidpoint) {
            if (topQuadrant) index = 1;
            else if (bottomQuadrant) index = 2;
        } else if (obj.x > verticalMidpoint) {
            if (topQuadrant) index = 0;
            else if (bottomQuadrant) index = 3;
        }
        
        return index;
    }
    
    /**
     * 插入对象到四叉树
     */
    insert(obj) {
        if (this.nodes.length > 0) {
            const index = this.getIndex(obj);
            if (index !== -1) {
                this.nodes[index].insert(obj);
                return;
            }
        }
        
        this.objects.push(obj);
        
        if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
            if (this.nodes.length === 0) {
                this.split();
            }
            
            let i = 0;
            while (i < this.objects.length) {
                const index = this.getIndex(this.objects[i]);
                if (index !== -1) {
                    this.nodes[index].insert(this.objects.splice(i, 1)[0]);
                } else {
                    i++;
                }
            }
        }
    }
    
    /**
     * 获取可能碰撞的对象列表
     */
    retrieve(returnObjects, obj) {
        const index = this.getIndex(obj);
        if (index !== -1 && this.nodes.length > 0) {
            this.nodes[index].retrieve(returnObjects, obj);
        }
        
        returnObjects.push(...this.objects);
        return returnObjects;
    }
}

/**
 * 物理系统类
 */
class PhysicsSystem {
    constructor() {
        // 从全局配置获取画布尺寸
        this.width = window.gameConfig.CANVAS_WIDTH;
        this.height = window.gameConfig.CANVAS_HEIGHT;
        this.quadTree = new QuadTreeNode(0, 0, this.width, this.height);
    }
    
    /**
     * 检测两个圆形对象是否碰撞
     * @param {Object} obj1 - 对象1 {x, y, radius}
     * @param {Object} obj2 - 对象2 {x, y, radius}
     * @returns {boolean} 是否碰撞
     */
    checkCircleCollision(obj1, obj2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (obj1.radius + obj2.radius);
    }
    
    /**
     * 检测点是否在圆内
     * @param {number} px - 点X坐标
     * @param {number} py - 点Y坐标
     * @param {Object} circle - 圆形对象 {x, y, radius}
     * @returns {boolean} 是否在圆内
     */
    pointInCircle(px, py, circle) {
        const dx = px - circle.x;
        const dy = py - circle.y;
        return (dx * dx + dy * dy) <= (circle.radius * circle.radius);
    }
    
    /**
     * 更新四叉树并检测碰撞
     * @param {Array} objects - 需要检测碰撞的对象数组
     * @returns {Array} 碰撞对列表
     */
    updateAndDetectCollisions(objects) {
        // 清空并重建四叉树
        this.quadTree.clear();
        
        // 将所有对象添加到四叉树
        for (const obj of objects) {
            if (obj.active) {
                this.quadTree.insert({
                    x: obj.x - obj.radius,
                    y: obj.y - obj.radius,
                    width: obj.radius * 2,
                    height: obj.radius * 2,
                    obj: obj
                });
            }
        }
        
        const collisions = [];
        
        // 检测每个对象的碰撞
        for (const obj of objects) {
            if (!obj.active) continue;
            
            const returnObjects = [];
            this.quadTree.retrieve(returnObjects, {
                x: obj.x - obj.radius,
                y: obj.y - obj.radius,
                width: obj.radius * 2,
                height: obj.radius * 2
            });
            
            // 检测与邻近对象的碰撞
            for (const candidate of returnObjects) {
                if (candidate.obj !== obj && candidate.obj.active) {
                    if (this.checkCircleCollision(obj, candidate.obj)) {
                        collisions.push([obj, candidate.obj]);
                    }
                }
            }
        }
        
        return collisions;
    }
    
    /**
     * 检测边界碰撞
     * @param {Object} obj - 对象 {x, y, radius}
     * @returns {Object} 碰撞信息 {left, right, top, bottom}
     */
    checkBoundaryCollision(obj) {
        return {
            left: obj.x - obj.radius <= 0,
            right: obj.x + obj.radius >= this.width,
            top: obj.y - obj.radius <= 0,
            bottom: obj.y + obj.radius >= this.height
        };
    }
    
    /**
     * 将对象限制在边界内
     * @param {Object} obj - 对象 {x, y, radius}
     */
    clampToBounds(obj) {
        obj.x = Math.max(obj.radius, Math.min(this.width - obj.radius, obj.x));
        obj.y = Math.max(obj.radius, Math.min(this.height - obj.radius, obj.y));
    }
    
    /**
     * 计算两点间距离
     * @param {number} x1 - 点1 X坐标
     * @param {number} y1 - 点1 Y坐标
     * @param {number} x2 - 点2 X坐标
     * @param {number} y2 - 点2 Y坐标
     * @returns {number} 距离
     */
    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * 计算角度
     * @param {number} x1 - 起点X
     * @param {number} y1 - 起点Y
     * @param {number} x2 - 终点X
     * @param {number} y2 - 终点Y
     * @returns {number} 角度（弧度）
     */
    angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    }
    
    /**
     * 标准化向量
     * @param {number} x - X分量
     * @param {number} y - Y分量
     * @returns {Object} 标准化后的向量 {x, y}
     */
    normalize(x, y) {
        const length = Math.sqrt(x * x + y * y);
        if (length === 0) return {x: 0, y: 0};
        return {x: x / length, y: y / length};
    }
}

// 导出到全局
window.PhysicsSystem = PhysicsSystem; 