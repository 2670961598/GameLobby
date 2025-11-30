// 子弹对象池
const bulletPool = {
    pool: [],
    maxSize: 100,
    
    get() {
        return this.pool.pop() || null;
    },
    
    release(bullet) {
        if (this.pool.length < this.maxSize) {
            bullet.reset();
            this.pool.push(bullet);
        }
    }
};

class Bullet {
    constructor(x, y, angle, speed, damage, game, owner) {
        // 参数验证
        if (!game || !owner) {
            throw new Error('Bullet requires game and owner parameters');
        }
        if (typeof x !== 'number' || typeof y !== 'number' || 
            typeof angle !== 'number' || typeof speed !== 'number' || 
            typeof damage !== 'number') {
            throw new Error('Invalid bullet parameters');
        }

        this.reset(x, y, angle, speed, damage, game, owner);
    }

    reset(x, y, angle, speed, damage, game, owner) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.damage = damage;
        this.game = game;
        this.owner = owner;
        this.lifeTime = 1000;
        this.createdAt = performance.now();
        this.isActive = true;
        this.collided = false;

        // 创建或重用DOM元素
        if (!this.element) {
            this.element = document.createElement('div');
            this.element.className = 'bullet';
        }
        
        // 设置子弹颜色
        let color = '#AFE59B';
        if (owner && owner.color === 'purple') color = '#7B75D3';
        if (owner && owner.color === 'red') color = '#E37A80';
        this.element.style.setProperty('--bullet-color', color);
        
        if (!this.element.parentElement && this.game && this.game.effectLayer) {
            this.game.effectLayer.appendChild(this.element);
        }
        
        this.updatePosition();
    }

    static create(x, y, angle, speed, damage, game, owner) {
        let bullet = bulletPool.get();
        if (!bullet) {
            bullet = new Bullet(x, y, angle, speed, damage, game, owner);
        } else {
            bullet.reset(x, y, angle, speed, damage, game, owner);
        }
        return bullet;
    }

    update(deltaTime) {
        if (!this.isActive) return true;

        // 更新位置
        const speed = this.speed * (deltaTime / 16.67);
        this.x += Math.cos(this.angle) * speed;
        this.y += Math.sin(this.angle) * speed;
        
        // 检查边界
        if (this.isOutOfBounds()) {
            this.deactivate();
            return true;
        }

        // 检查碰撞
        this.checkCollisions();
        
        // 更新显示
        this.updatePosition();

        // 检查生命周期
        if (performance.now() - this.createdAt >= this.lifeTime) {
            this.deactivate();
            return true;
        }

        return false;
    }

    checkCollisions() {
        if (this.collided) return;
        if (!this.game || typeof this.game.getCollidableObjects !== 'function') return;
        // 检查与其他游戏对象的碰撞
        const gameObjects = this.game.getCollidableObjects();
        for (const obj of gameObjects) {
            if (obj !== this.owner && this.isCollidingWith(obj)) {
                this.handleCollision(obj);
                break;
            }
        }
    }

    isCollidingWith(obj) {
        // 简单的圆形碰撞检测
        const dx = this.x - obj.x;
        const dy = this.y - obj.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (obj.radius || 20); // 假设碰撞半径为20，或使用对象的实际半径
    }

    handleCollision(obj) {
        this.collided = true;
        if (obj.takeDamage) {
            obj.takeDamage(this.damage, this.owner);
        }
        this.deactivate();
    }

    deactivate() {
        this.isActive = false;
        this.element.style.display = 'none';
        bulletPool.release(this);
    }

    updatePosition() {
        if (this.element && this.isActive) {
            this.element.style.display = 'block';
            this.element.style.transform = `translate(${this.x - 5}px, ${this.y - 5}px)`;
        }
    }

    isOutOfBounds() {
        if (!this.game || !this.game.gameArea) return true;
        return this.x < 0 || 
               this.x > this.game.gameArea.offsetWidth ||
               this.y < 0 || 
               this.y > this.game.gameArea.offsetHeight;
    }

    remove() {
        if (this.element && this.element.parentElement) {
            this.element.remove();
        }
        this.game = null;
        this.owner = null;
        this.isActive = false;
    }
} 