class Game {
    constructor() {
        // 游戏状态
        this.isRunning = false;
        this.gameTime = 60;
        this.timeRemaining = 60;
        this.lastUpdate = 0;
        this.lastColorUpdate = 0;
        this.colorUpdateInterval = 1000 / 6; // 每秒6次颜色统计
        this.warningActive = false;

        // 游戏元素
        this.gameArea = document.getElementById('gameArea');
        this.trailLayer = document.querySelector('.trail-layer');
        this.buffLayer = document.querySelector('.buff-layer');
        this.effectLayer = document.querySelector('.effect-layer');
        
        // 游戏对象
        this.player = null;
        this.ais = [];
        this.bullets = [];
        this.buffs = [];
        this.colorSystem = null;
        this.buff20Created = false;
        this.buff40Created = false;

        // 绑定事件处理器
        this.bindEvents();
    }

    bindEvents() {
        // 开始按钮
        document.getElementById('startButton').addEventListener('click', () => this.startGame());
        
        // 重新开始按钮
        document.getElementById('restartButton').addEventListener('click', () => this.restartGame());
        
        // 返回主页按钮
        document.getElementById('homeButton').addEventListener('click', () => this.showStartScreen());

        // 游戏区域事件
        this.gameArea.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.gameArea.addEventListener('touchmove', (e) => this.handleTouchMove(e));

        // 新增：键盘wasd控制
        this.keyState = { w: false, a: false, s: false, d: false };
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    startGame() {
        // 先显示游戏界面，确保gameArea有实际宽高
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameScreen').classList.remove('hidden');
        document.getElementById('endScreen').classList.add('hidden');

        // 再初始化游戏
        this.initializeGame();

        // 开始游戏循环
        this.isRunning = true;
        this.lastUpdate = performance.now();
        requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
    }

    initializeGame() {
        // 重置游戏状态
        this.timeRemaining = this.gameTime;
        console.log('[初始化] this.timeRemaining =', this.timeRemaining, 'this.gameTime =', this.gameTime);
        this.bullets = [];
        this.buffs = [];
        this.lastColorUpdate = 0;

        // 先初始化地板网格
        this.gridCellSize = 50;
        this.gridWidth = Math.ceil(this.gameArea.offsetWidth / this.gridCellSize);
        this.gridHeight = Math.ceil(this.gameArea.offsetHeight / this.gridCellSize);
        this.grid = [];
        for (let y = 0; y < this.gridHeight; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.gridWidth; x++) {
                this.grid[y][x] = null; // 初始无颜色
            }
        }

        // 添加canvas用于轨迹渲染
        if (!this.trailCanvas) {
            this.trailCanvas = document.createElement('canvas');
            this.trailCanvas.className = 'trail-canvas';
            this.trailLayer.appendChild(this.trailCanvas);
        }
        this.syncCanvasSize();
        this.trailCtx = this.trailCanvas.getContext('2d');
        this.clearTrailCanvas();

        // 初始化玩家
        this.player = new Player(
            this.gameArea.offsetWidth / 2,
            this.gameArea.offsetHeight / 2,
            this
        );

        // AI出生点分散
        const margin = this.gridCellSize * 2;
        this.ais = [
            new AI(margin, margin, this, 'purple'),
            new AI(this.gameArea.offsetWidth - margin, margin, this, 'red')
        ];

        // 初始化颜色系统
        this.colorSystem = new ColorSystem(this);

        // 重绘所有轨迹
        this.redrawTrailCanvas();

        // 更新UI
        this.updateTimer();
        this.updateScores();
    }

    syncCanvasSize() {
        this.trailCanvas.width = this.gameArea.offsetWidth;
        this.trailCanvas.height = this.gameArea.offsetHeight;
        console.log('Canvas尺寸同步:', this.trailCanvas.width, this.trailCanvas.height);
    }

    gameLoop(timestamp) {
        if (!this.isRunning) return;

        const deltaTime = timestamp - this.lastUpdate;
        this.lastUpdate = timestamp;

        // 更新游戏状态，传递timestamp
        this.update(deltaTime, timestamp);

        // 检查游戏是否结束
        if (this.timeRemaining <= 0) {
            this.endGame();
            return;
        }

        // 继续游戏循环
        requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
    }

    update(deltaTime, timestamp) {
        // 新增：处理wasd移动
        this.handleWASDMove(deltaTime);

        // 更新计时器
        this.timeRemaining -= deltaTime / 1000;
        if (this.timeRemaining < 0) this.timeRemaining = 0;
        this.updateTimer();

        // 更新颜色统计
        if (timestamp - this.lastColorUpdate >= this.colorUpdateInterval) {
            this.colorSystem.update();
            this.updateScores();
            this.lastColorUpdate = timestamp;
        }

        // 更新游戏对象
        this.player.update(deltaTime);
        this.ais.forEach(ai => ai.update(deltaTime));
        this.updateBullets(deltaTime);
        this.handleBuffs();

        // 检查碰撞
        this.checkCollisions();

        this.updateHealthPanel();
    }

    updateTimer() {
        const timerElement = document.querySelector('.timer');
        const time = Math.ceil(this.timeRemaining);
        timerElement.textContent = time;
        
        // 最后10秒添加动画效果
        if (time <= 10 && !this.warningActive) {
            this.warningActive = true;
            timerElement.style.color = '#E37A80';
            timerElement.classList.add('warning');
            this.gameArea.classList.add('warning');
        } else if (time > 10 && this.warningActive) {
            this.warningActive = false;
            timerElement.style.color = '';
            timerElement.classList.remove('warning');
            this.gameArea.classList.remove('warning');
        }
    }

    updateScores() {
        const scores = this.colorSystem.getScores();
        document.querySelector('.score.green').textContent = `${scores.green.toFixed(1)}%`;
        document.querySelector('.score.purple').textContent = `${scores.purple.toFixed(1)}%`;
        document.querySelector('.score.red').textContent = `${scores.red.toFixed(1)}%`;
    }

    updateBullets(deltaTime) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.update(deltaTime);
            
            // 移除超出范围的子弹
            if (bullet.isOutOfBounds()) {
                bullet.remove();
                this.bullets.splice(i, 1);
            }
        }
    }

    handleBuffs() {
        console.log('[handleBuffs] 当前剩余时间:', this.timeRemaining);
        // 只在20秒和40秒生成buff，且只生成一次
        const centerX = this.gameArea.offsetWidth / 2;
        const centerY = this.gameArea.offsetHeight / 2;
        if (this.timeRemaining <= 40 && !this.buff40Created) {
            console.log('生成buff@40s', centerX, centerY, 'timeRemaining:', this.timeRemaining);
            this.buffs.push(new Buff(centerX, centerY, this));
            this.buff40Created = true;
        }
        if (this.timeRemaining <= 20 && !this.buff20Created) {
            console.log('生成buff@20s', centerX, centerY, 'timeRemaining:', this.timeRemaining);
            this.buffs.push(new Buff(centerX, centerY, this));
            this.buff20Created = true;
        }
        // buff超时自动消失
        for (let i = this.buffs.length - 1; i >= 0; i--) {
            const buff = this.buffs[i];
            if (buff.isExpired()) {
                buff.remove();
                this.buffs.splice(i, 1);
            }
        }
    }

    checkCollisions() {
        // 检查子弹碰撞
        this.bullets.forEach(bullet => {
            // 检查与玩家的碰撞
            if (bullet.owner !== this.player && this.player.checkCollision(bullet)) {
                this.player.takeDamage(bullet.damage);
                bullet.remove();
            }

            // 检查与AI的碰撞
            this.ais.forEach(ai => {
                if (bullet.owner !== ai && ai.checkCollision(bullet)) {
                    ai.takeDamage(bullet.damage);
                    bullet.remove();
                }
            });
        });

        // 检查Buff碰撞
        for (let i = this.buffs.length - 1; i >= 0; i--) {
            const buff = this.buffs[i];
            if (this.player.checkCollision(buff)) {
                this.player.applySpeedBuff(2, 10000); // 2倍速，10秒
                buff.remove();
                this.buffs.splice(i, 1);
                continue;
            }
            for (const ai of this.ais) {
                if (ai.checkCollision(buff)) {
                    ai.applySpeedBuff(2, 10000);
                    buff.remove();
                    this.buffs.splice(i, 1);
                    break;
                }
            }
        }
    }

    handleMouseMove(e) {
        if (!this.isRunning) return;
        const rect = this.gameArea.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.player.setTarget(x, y);
    }

    handleTouchMove(e) {
        if (!this.isRunning) return;
        e.preventDefault();
        const touch = e.touches[0];
        const rect = this.gameArea.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        this.player.setTarget(x, y);
    }

    handleKeyDown(e) {
        if (!this.isRunning) return;
        const key = e.key.toLowerCase();
        if (['w', 'a', 's', 'd'].includes(key)) {
            this.keyState[key] = true;
        }
    }

    handleKeyUp(e) {
        if (!this.isRunning) return;
        const key = e.key.toLowerCase();
        if (['w', 'a', 's', 'd'].includes(key)) {
            this.keyState[key] = false;
        }
    }

    handleWASDMove(deltaTime) {
        if (!this.isRunning) return;
        const speed = this.player.speed * (deltaTime / 16.67);
        let dx = 0, dy = 0;
        if (this.keyState.w) dy -= speed;
        if (this.keyState.s) dy += speed;
        if (this.keyState.a) dx -= speed;
        if (this.keyState.d) dx += speed;
        if (dx !== 0 || dy !== 0) {
            // 归一化方向
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
                dx /= len;
                dy /= len;
            }
            const newX = this.player.x + dx * speed;
            const newY = this.player.y + dy * speed;
            this.player.setTarget(newX, newY);
        }
    }

    endGame() {
        this.isRunning = false;
        
        // 添加游戏结束动画
        this.gameArea.classList.add('game-over');
        
        // 计算最终得分
        const scores = this.colorSystem.getScores();
        const winner = this.determineWinner(scores);
        
        // 延迟显示结束界面，等待动画完成
        setTimeout(() => {
            // 显示结束界面
            document.getElementById('gameScreen').classList.add('hidden');
            document.getElementById('endScreen').classList.remove('hidden');
            
            // 更新结果
            const resultTitle = document.getElementById('resultTitle');
            const finalScore = document.getElementById('finalScore');
            
            if (winner === 'player') {
                resultTitle.textContent = '胜利！';
                resultTitle.style.color = '#AFE59B';
            } else {
                resultTitle.textContent = '失败';
                resultTitle.style.color = '#E37A80';
            }
            
            finalScore.innerHTML = `
                最终得分：<br>
                绿色：${scores.green.toFixed(1)}%<br>
                紫色：${scores.purple.toFixed(1)}%<br>
                红色：${scores.red.toFixed(1)}%
            `;
            
            // 移除游戏结束动画
            this.gameArea.classList.remove('game-over');
        }, 500);
    }

    determineWinner(scores) {
        const maxScore = Math.max(scores.green, scores.purple, scores.red);
        return maxScore === scores.green ? 'player' : 'ai';
    }

    restartGame() {
        // 移除所有警告效果
        const timerElement = document.querySelector('.timer');
        timerElement.style.color = '';
        timerElement.classList.remove('warning');
        this.gameArea.classList.remove('warning');
        this.warningActive = false;
        
        // 重新开始游戏
        this.startGame();
    }

    showStartScreen() {
        document.getElementById('endScreen').classList.add('hidden');
        document.getElementById('startScreen').classList.remove('hidden');
    }

    clearTrailCanvas() {
        this.trailCtx.clearRect(0, 0, this.trailCanvas.width, this.trailCanvas.height);
    }

    // 玩家/AI移动时调用
    paintTrail(x, y, color) {
        const cellX = Math.floor(x / this.gridCellSize);
        const cellY = Math.floor(y / this.gridCellSize);
        if (cellX < 0 || cellX >= this.gridWidth || cellY < 0 || cellY >= this.gridHeight) return;
        if (this.grid[cellY][cellX] === color) return;
        this.grid[cellY][cellX] = color;
        this.trailCtx.fillStyle = color === 'green' ? '#AFE59B' : color === 'purple' ? '#7B75D3' : '#E37A80';
        this.trailCtx.fillRect(cellX * this.gridCellSize, cellY * this.gridCellSize, this.gridCellSize, this.gridCellSize);
        console.log('轨迹绘制:', cellX, cellY, color);
    }

    redrawTrailCanvas() {
        this.clearTrailCanvas();
        let count = 0;
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const color = this.grid[y][x];
                if (color) {
                    this.trailCtx.fillStyle = color === 'green' ? '#AFE59B' : color === 'purple' ? '#7B75D3' : '#E37A80';
                    this.trailCtx.fillRect(x * this.gridCellSize, y * this.gridCellSize, this.gridCellSize, this.gridCellSize);
                    count++;
                }
            }
        }
        console.log('轨迹重绘完成，总格子数:', count);
    }

    updateHealthPanel() {
        // 玩家
        const player = this.player;
        const playerFill = document.querySelector('.player-fill');
        const playerText = document.querySelector('.player-text');
        const playerBar = playerFill.parentElement;
        
        if (player.hp > 0) {
            // 角色存活时显示血条
            playerFill.style.display = '';
            playerBar.style.display = '';
            playerText.style.display = 'none';
            const playerPercent = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
            playerFill.style.width = playerPercent + '%';
        } else {
            // 角色死亡时隐藏血条，显示复活倒计时
            playerFill.style.display = 'none';
            playerBar.style.display = '';
            playerText.style.display = '';
            if (player.isInvincible && player.invincibleTime > 0) {
                const sec = Math.ceil(player.invincibleTime / 1000);
                playerText.textContent = `${sec}s`;
                playerText.style.color = '#FFD700'; // 倒计时文字颜色为金色
                playerText.style.fontWeight = 'bold';
            } else {
                playerText.textContent = '';
            }
        }

        // AI紫色
        const aiPurple = this.ais.find(ai => ai.color === 'purple');
        const aiPurpleFill = document.querySelector('.ai-purple-fill');
        const aiPurpleText = document.querySelector('.ai-purple-text');
        const aiPurpleBar = aiPurpleFill.parentElement;
        
        if (aiPurple.hp > 0) {
            // AI存活时显示血条
            aiPurpleFill.style.display = '';
            aiPurpleBar.style.display = '';
            aiPurpleText.style.display = 'none';
            const aiPurplePercent = Math.max(0, Math.min(100, (aiPurple.hp / aiPurple.maxHp) * 100));
            aiPurpleFill.style.width = aiPurplePercent + '%';
        } else {
            // AI死亡时隐藏血条，显示复活倒计时
            aiPurpleFill.style.display = 'none';
            aiPurpleBar.style.display = '';
            aiPurpleText.style.display = '';
            if (aiPurple.isInvincible && aiPurple.invincibleTime > 0) {
                const sec = Math.ceil(aiPurple.invincibleTime / 1000);
                aiPurpleText.textContent = `${sec}s`;
                aiPurpleText.style.color = '#FFD700';
                aiPurpleText.style.fontWeight = 'bold';
            } else {
                aiPurpleText.textContent = '';
            }
        }

        // AI红色
        const aiRed = this.ais.find(ai => ai.color === 'red');
        const aiRedFill = document.querySelector('.ai-red-fill');
        const aiRedText = document.querySelector('.ai-red-text');
        const aiRedBar = aiRedFill.parentElement;
        
        if (aiRed.hp > 0) {
            // AI存活时显示血条
            aiRedFill.style.display = '';
            aiRedBar.style.display = '';
            aiRedText.style.display = 'none';
            const aiRedPercent = Math.max(0, Math.min(100, (aiRed.hp / aiRed.maxHp) * 100));
            aiRedFill.style.width = aiRedPercent + '%';
        } else {
            // AI死亡时隐藏血条，显示复活倒计时
            aiRedFill.style.display = 'none';
            aiRedBar.style.display = '';
            aiRedText.style.display = '';
            if (aiRed.isInvincible && aiRed.invincibleTime > 0) {
                const sec = Math.ceil(aiRed.invincibleTime / 1000);
                aiRedText.textContent = `${sec}s`;
                aiRedText.style.color = '#FFD700';
                aiRedText.style.fontWeight = 'bold';
            } else {
                aiRedText.textContent = '';
            }
        }
    }

    getCollidableObjects() {
        // 返回所有可被子弹碰撞的对象（玩家和AI）
        return [this.player, ...this.ais];
    }
}

// 当页面加载完成后初始化游戏
window.addEventListener('load', () => {
    window.game = new Game();
});

// 监听窗口resize
window.addEventListener('resize', () => {
    if (window.game && window.game.trailCanvas) {
        window.game.syncCanvasSize();
        window.game.redrawTrailCanvas();
    }
}); 