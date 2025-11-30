class AI {
    constructor(x, y, game, color) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.color = color;
        this.speed = 5;
        this.trailWidth = 15;
        this.hp = 100;
        this.maxHp = 100;
        this.damage = 20;
        this.bulletSpeed = 6;
        this.attackCooldown = 1000;
        this.lastAttackTime = 0;
        this.isInvincible = false;
        this.invincibleTime = 0;
        this.hasBuff = false;
        this.buffEndTime = 0;

        // AI状态
        this.state = 'EXPLORE';
        this.targetX = x;
        this.targetY = y;
        this.lastStateChange = 0;
        this.stateDuration = 2000; // 状态持续时间
        this.explorePoints = [];
        this.generateExplorePoints();

        // 创建DOM元素
        this.element = document.createElement('div');
        this.element.className = `character ai ai-${color}`;
        this.element.id = `ai-${color}`;
        document.querySelector('.character-layer').appendChild(this.element);
        this.updatePosition();

        // 创建血条
        this.createHealthBar();

        this.game.paintTrail(this.x, this.y, this.color);
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
        // 根据角色颜色设置血条颜色
        fill.style.backgroundColor = this.color === 'purple' ? '#7B75D3' : '#E37A80';
    }

    generateExplorePoints() {
        this.explorePoints = [];
        const margin = this.game.gridCellSize * 2;
        const width = this.game.gameArea.offsetWidth;
        const height = this.game.gameArea.offsetHeight;
        // 生成8个探索点
        for (let i = 0; i < 8; i++) {
            this.explorePoints.push({
                x: margin + Math.random() * (width - 2 * margin),
                y: margin + Math.random() * (height - 2 * margin)
            });
        }
    }

    update(deltaTime) {
        // 更新状态
        this.updateState();
        
        // 根据状态执行行为
        this.executeStateBehavior();
        
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

        // 更新Buff状态
        if (this.hasBuff) {
            if (performance.now() >= this.buffEndTime) {
                this.hasBuff = false;
                this.trailWidth = 15;
            }
        }

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

    updateState() {
        const now = performance.now();
        const scores = this.game.colorSystem.getScores();
        const myScore = this.color === 'purple' ? scores.purple : scores.red;
        const playerScore = scores.green;
        const otherAIScore = this.color === 'purple' ? scores.red : scores.purple;

        // 新增：检测附近子弹，优先躲避
        const dangerBullet = this.game.bullets.find(bullet => {
            if (!bullet.isActive || bullet.owner === this) return false;
            const dx = bullet.x - this.x;
            const dy = bullet.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            // 只检测飞向自己的子弹
            const bulletToAI = Math.atan2(this.y - bullet.y, this.x - bullet.x);
            const angleDiff = Math.abs(bullet.angle - bulletToAI);
            return dist < 100 && angleDiff < Math.PI / 4;
        });
        if (dangerBullet && this.state !== 'EVADE') {
            this.changeState('EVADE');
            return;
        }

        // 状态转换逻辑
        if (this.hp < 30 && this.state !== 'EVADE') {
            this.changeState('EVADE');
        } else if (this.hp > 60 && this.state === 'EVADE') {
            this.changeState('EXPLORE');
        } else if (now - this.lastStateChange >= this.stateDuration) {
            // 基于比分决定新状态
            if (myScore < Math.max(playerScore, otherAIScore) - 10) {
                this.changeState('PURSUE');
            } else if (myScore > Math.max(playerScore, otherAIScore) + 10) {
                this.changeState('EXPLORE');
            } else {
                // 随机选择状态
                const states = ['EXPLORE', 'PURSUE'];
                this.changeState(states[Math.floor(Math.random() * states.length)]);
            }
        }
    }

    changeState(newState) {
        this.state = newState;
        this.lastStateChange = performance.now();
        
        // 状态特定初始化
        switch (newState) {
            case 'EXPLORE':
                this.generateExplorePoints();
                this.setRandomExploreTarget();
                break;
            case 'PURSUE':
                this.findNearestTarget();
                break;
            case 'EVADE':
                this.findSafePosition();
                break;
        }
    }

    executeStateBehavior() {
        switch (this.state) {
            case 'EXPLORE':
                if (this.reachedTarget()) {
                    this.setRandomExploreTarget();
                }
                break;
            case 'PURSUE':
                this.findNearestTarget();
                break;
            case 'EVADE':
                if (this.reachedTarget()) {
                    this.findSafePosition();
                }
                break;
        }
    }

    setTarget(x, y) {
        const radius = 22;
        const minX = radius, maxX = this.game.gameArea.offsetWidth - radius;
        const minY = radius, maxY = this.game.gameArea.offsetHeight - radius;
        this.targetX = Math.max(minX, Math.min(maxX, x));
        this.targetY = Math.max(minY, Math.min(maxY, y));
    }

    setRandomExploreTarget() {
        // 优先选择未被自己颜色覆盖的格子
        const grid = this.game.grid;
        const gridCellSize = this.game.gridCellSize;
        let candidates = [];
        for (let y = 0; y < this.game.gridHeight; y++) {
            for (let x = 0; x < this.game.gridWidth; x++) {
                if (grid[y][x] !== this.color) {
                    candidates.push({
                        x: x * gridCellSize + gridCellSize / 2,
                        y: y * gridCellSize + gridCellSize / 2
                    });
                }
            }
        }
        if (candidates.length > 0) {
            const point = candidates[Math.floor(Math.random() * candidates.length)];
            this.setTarget(point.x, point.y);
        } else {
            // 如果全是自己颜色，随机探索
            const point = this.explorePoints[Math.floor(Math.random() * this.explorePoints.length)];
            this.setTarget(point.x, point.y);
        }
    }

    findNearestTarget() {
        let nearestDist = Infinity;
        let nearestTarget = null;
        // 检查玩家
        const distToPlayer = this.getDistanceTo(this.game.player);
        if (distToPlayer < nearestDist) {
            nearestDist = distToPlayer;
            nearestTarget = this.game.player;
        }
        // 检查其他AI
        this.game.ais.forEach(ai => {
            if (ai !== this) {
                const dist = this.getDistanceTo(ai);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestTarget = ai;
                }
            }
        });
        if (nearestTarget) {
            this.setTarget(nearestTarget.x, nearestTarget.y);
        }
    }

    findSafePosition() {
        const width = this.game.gameArea.offsetWidth;
        const height = this.game.gameArea.offsetHeight;
        const margin = 100;
        let maxMinDist = 0;
        let bestX = this.x;
        let bestY = this.y;
        for (let i = 0; i < 5; i++) {
            const testX = margin + Math.random() * (width - 2 * margin);
            const testY = margin + Math.random() * (height - 2 * margin);
            const minDist = Math.min(
                this.getDistanceToPoint(testX, testY, this.game.player),
                ...this.game.ais.map(ai => this.getDistanceToPoint(testX, testY, ai))
            );
            if (minDist > maxMinDist) {
                maxMinDist = minDist;
                bestX = testX;
                bestY = testY;
            }
        }
        this.setTarget(bestX, bestY);
    }

    getDistanceTo(object) {
        return this.getDistanceToPoint(this.x, this.y, object);
    }

    getDistanceToPoint(x, y, object) {
        const dx = x - object.x;
        const dy = y - object.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    reachedTarget() {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        return Math.sqrt(dx * dx + dy * dy) < 10;
    }

    move(deltaTime) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const radius = 22;
        const minX = radius, maxX = this.game.gameArea.offsetWidth - radius;
        const minY = radius, maxY = this.game.gameArea.offsetHeight - radius;
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
            this.game.paintTrail(this.x, this.y, this.color);
        }
        // 再次边界限制，防止超出
        this.x = Math.max(minX, Math.min(maxX, this.x));
        this.y = Math.max(minY, Math.min(maxY, this.y));
    }

    createTrail() {
        const trail = document.createElement('div');
        trail.className = 'trail';
        trail.style.left = `${this.x}px`;
        trail.style.top = `${this.y}px`;
        trail.style.width = `${this.trailWidth}px`;
        trail.style.height = `${this.trailWidth}px`;
        trail.style.backgroundColor = this.color === 'purple' ? '#7B75D3' : '#E37A80';
        this.game.trailLayer.appendChild(trail);

        // 淡出动画
        setTimeout(() => {
            trail.style.opacity = '0';
            setTimeout(() => trail.remove(), 1000);
        }, 100);
    }

    attack() {
        // 找到最近的目标
        let target = this.game.player;
        let minDist = this.getDistanceTo(this.game.player);

        this.game.ais.forEach(ai => {
            if (ai !== this) {
                const dist = this.getDistanceTo(ai);
                if (dist < minDist) {
                    minDist = dist;
                    target = ai;
                }
            }
        });

        // 计算射击方向
        const dx = target.x - this.x;
        const dy = target.y - this.y;
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
        this.invincibleTime = 3000;
        this.element.classList.add('invincible');
        // 死亡时不重置血量
        this.updateHealthBar();
        // 重置位置到随机位置，避开玩家和其他AI
        const margin = this.game.gridCellSize * 2;
        const width = this.game.gameArea.offsetWidth;
        const height = this.game.gameArea.offsetHeight;
        let tryCount = 0;
        let lastX, lastY, lastTooClose;
        while (true) {
            this.x = margin + Math.random() * (width - 2 * margin);
            this.y = margin + Math.random() * (height - 2 * margin);
            let tooClose = false;
            // 距离玩家
            const dx = this.x - this.game.player.x;
            const dy = this.y - this.game.player.y;
            if (Math.sqrt(dx*dx + dy*dy) < 80) tooClose = true;
            // 距离其他AI
            for (const ai of this.game.ais) {
                if (ai !== this) {
                    const ddx = this.x - ai.x;
                    const ddy = this.y - ai.y;
                    if (Math.sqrt(ddx*ddx + ddy*ddy) < 80) tooClose = true;
                }
            }
            lastX = this.x;
            lastY = this.y;
            lastTooClose = tooClose;
            if (!tooClose || tryCount > 20) break;
            tryCount++;
        }
        console.log(`[AI复活] color=${this.color}, x=${lastX}, y=${lastY}, tooClose=${lastTooClose}, tryCount=${tryCount}`);
        this.updatePosition();
        // 死亡时彻底隐藏角色
        this.element.style.visibility = 'hidden';
    }

    applySpeedBuff(multiplier, duration) {
        if (this.speedBuffTimeout) clearTimeout(this.speedBuffTimeout);
        this.speed = 5 * multiplier;
        this.element.classList.add('buffed');
        this.speedBuffTimeout = setTimeout(() => {
            this.speed = 5;
            this.element.classList.remove('buffed');
            this.element.style.visibility = 'visible';
        }, duration);
    }

    updatePosition() {
        const radius = 22;
        const minX = radius, maxX = this.game.gameArea.offsetWidth - radius;
        const minY = radius, maxY = this.game.gameArea.offsetHeight - radius;
        this.x = Math.max(minX, Math.min(maxX, this.x));
        this.y = Math.max(minY, Math.min(maxY, this.y));
        this.element.style.transform = `translate(${this.x - 15}px, ${this.y - 15}px)`;
        console.log(`[AI位置] color=${this.color}, x=${this.x}, y=${this.y}`);
    }

    checkCollision(object) {
        const dx = this.x - object.x;
        const dy = this.y - object.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < 30;
    }
} 