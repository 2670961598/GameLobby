class Player {
    constructor(x, y, game) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.speed = 5;
        this.trailWidth = 15;
        this.hp = 100;
        this.maxHp = 100;
        this.damage = 20;
        this.bulletSpeed = 6;
        this.attackCooldown = 1000; // 1秒攻击间隔
        this.lastAttackTime = 0;
        this.isInvincible = false;
        this.invincibleTime = 0;
        this.hasBuff = false;
        this.buffEndTime = 0;

        // 创建DOM元素
        this.element = document.getElementById('player');
        this.updatePosition();

        // 创建血条
        this.createHealthBar();

        this.game.paintTrail(this.x, this.y, 'green');
    }

    createHealthBar() {
        this.healthBar = document.createElement('div');
        this.healthBar.className = 'health-bar';
        this.healthBar.innerHTML = `
            <div class="health-bar-bg"></div>
            <div class="health-bar-fill"></div>
        `;
        this.element.appendChild(this.healthBar);
        this.updateHealthBar();
    }

    updateHealthBar() {
        const fill = this.healthBar.querySelector('.health-bar-fill');
        const percentage = (this.hp / this.maxHp) * 100;
        fill.style.width = `${percentage}%`;
        fill.style.backgroundColor = '#AFE59B'; // 始终保持绿色
    }

    update(deltaTime) {
        // 更新位置
        this.move(deltaTime);
        // 更新无敌状态
        if (this.isInvincible) {
            this.invincibleTime -= deltaTime;
            if (this.invincibleTime <= 0) {
                this.isInvincible = false;
                this.element.classList.remove('invincible');
                // 复活时重置血量
                this.hp = this.maxHp;
                this.updateHealthBar();
                // 复活时恢复显示
                this.element.style.visibility = 'visible';
            }
        }
        // 更新Buff状态（不操作visibility）
        // 只有存活时才自动攻击
        if (this.hp > 0) {
            const now = performance.now();
            if (now - this.lastAttackTime >= this.attackCooldown) {
                this.attack();
                this.lastAttackTime = now;
            }
        }
        // 更新位置显示
        this.updatePosition();
    }

    move(deltaTime) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const radius = 22;
        const minX = radius, maxX = this.game.gameArea.offsetWidth - radius;
        const minY = radius, maxY = this.game.gameArea.offsetHeight - radius;
        // 日志：移动前
        console.log(`[Player移动前] x=${this.x}, y=${this.y}, targetX=${this.targetX}, targetY=${this.targetY}`);
        if (distance > 1) {
            const speed = this.speed * (deltaTime / 16.67);
            const ratio = speed / distance;
            let newX = this.x + dx * ratio;
            let newY = this.y + dy * ratio;
            // 边界限制
            newX = Math.max(minX, Math.min(maxX, newX));
            newY = Math.max(minY, Math.min(maxY, newY));
            this.x = newX;
            this.y = newY;
            this.game.paintTrail(this.x, this.y, 'green');
        }
        // 再次边界限制，防止超出
        this.x = Math.max(minX, Math.min(maxX, this.x));
        this.y = Math.max(minY, Math.min(maxY, this.y));
        // 日志：移动后
        console.log(`[Player移动后] x=${this.x}, y=${this.y}`);
    }

    createTrail() {
        const trail = document.createElement('div');
        trail.className = 'trail';
        trail.style.left = `${this.x}px`;
        trail.style.top = `${this.y}px`;
        trail.style.width = `${this.trailWidth}px`;
        trail.style.height = `${this.trailWidth}px`;
        trail.style.backgroundColor = '#AFE59B';
        this.game.trailLayer.appendChild(trail);

        // 淡出动画
        setTimeout(() => {
            trail.style.opacity = '0';
            setTimeout(() => trail.remove(), 1000);
        }, 100);
    }

    attack() {
        // 计算射击方向（向鼠标位置）
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const angle = Math.atan2(dy, dx);

        // 创建子弹
        const bullet = new Bullet(
            this.x,
            this.y,
            angle,
            this.bulletSpeed,
            this.damage,
            this.game,
            this
        );
        this.game.bullets.push(bullet);
    }

    takeDamage(damage) {
        if (this.isInvincible) return;

        this.hp -= damage;
        if (this.hp < 0) this.hp = 0;
        
        // 更新血条
        this.updateHealthBar();
        
        // 受击效果
        this.element.classList.add('hit');
        setTimeout(() => this.element.classList.remove('hit'), 600);

        // 检查是否死亡
        if (this.hp <= 0) {
            this.die();
        }
    }

    die() {
        // 设置无敌状态
        this.isInvincible = true;
        this.invincibleTime = 3000; // 3秒无敌时间
        this.element.classList.add('invincible');
        // 死亡时不重置血量
        this.updateHealthBar();
        // 重置位置
        this.x = this.game.gameArea.offsetWidth / 2;
        this.y = this.game.gameArea.offsetHeight / 2;
        this.updatePosition();
        // 复活后目标点就是当前位置，防止自动飘动
        this.targetX = this.x;
        this.targetY = this.y;
        // 死亡时彻底隐藏角色
        this.element.style.visibility = 'hidden';
    }

    applySpeedBuff(multiplier, duration) {
        console.log('[Buff前] x=' + this.x + ', y=' + this.y + ', speed=' + this.speed + ', visibility=' + this.element.style.visibility);
        if (this.speedBuffTimeout) clearTimeout(this.speedBuffTimeout);
        this.speed = 5 * multiplier;
        this.element.classList.add('buffed');
        this.speedBuffTimeout = setTimeout(() => {
            this.speed = 5;
            this.element.classList.remove('buffed');
            this.element.style.visibility = 'visible';
            console.log('[Buff结束] x=' + this.x + ', y=' + this.y + ', speed=' + this.speed + ', visibility=' + this.element.style.visibility);
        }, duration);
    }

    setTarget(x, y) {
        const radius = 22;
        const minX = radius, maxX = this.game.gameArea.offsetWidth - radius;
        const minY = radius, maxY = this.game.gameArea.offsetHeight - radius;
        this.targetX = Math.max(minX, Math.min(maxX, x));
        this.targetY = Math.max(minY, Math.min(maxY, y));
    }

    updatePosition() {
        const radius = 22;
        const minX = radius, maxX = this.game.gameArea.offsetWidth - radius;
        const minY = radius, maxY = this.game.gameArea.offsetHeight - radius;
        this.x = Math.max(minX, Math.min(maxX, this.x));
        this.y = Math.max(minY, Math.min(maxY, this.y));
        this.element.style.transform = `translate(${this.x - 15}px, ${this.y - 15}px)`;
    }

    checkCollision(object) {
        const dx = this.x - object.x;
        const dy = this.y - object.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < 30; // 碰撞半径
    }
} 