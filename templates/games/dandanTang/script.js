// 游戏配置
const CONFIG = {
    GRAVITY: 0.5,
    CANNON_SIZE: 30,
    BULLET_SIZE: 8,
    TARGET_SIZE: 25,
    CLOUD_COUNT: 5,
    MAX_TARGETS: 3,
    GROUND_HEIGHT: 120
};

// 游戏状态
class GameState {
    constructor() {
        this.score = 0;
        this.hits = 0;
        this.shots = 0;
        this.accuracy = 0;
        this.gameRunning = false;
        this.cannonX = 100;
        this.cannonY = 300;
        this.angle = 45;
        this.power = 50;
        this.bullets = [];
        this.targets = [];
        this.clouds = [];
        this.explosions = [];
        this.terrain = [];
    }

    updateAccuracy() {
        this.accuracy = this.shots > 0 ? Math.round((this.hits / this.shots) * 100) : 0;
    }
}

// 子弹类
class Bullet {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = CONFIG.BULLET_SIZE;
        this.trail = [];
    }

    update() {
        // 添加轨迹点
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 10) {
            this.trail.shift();
        }

        // 更新位置
        this.x += this.vx;
        this.y += this.vy;
        this.vy += CONFIG.GRAVITY;
    }

    draw(ctx) {
        // 绘制轨迹
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < this.trail.length - 1; i++) {
            const alpha = (i + 1) / this.trail.length;
            ctx.globalAlpha = alpha * 0.7;
            ctx.moveTo(this.trail[i].x, this.trail[i].y);
            ctx.lineTo(this.trail[i + 1].x, this.trail[i + 1].y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;

        // 绘制子弹
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    isOutOfBounds(canvasWidth, canvasHeight) {
        return this.x < 0 || this.x > canvasWidth || this.y > canvasHeight;
    }
}

// 目标类
class Target {
    constructor(x, y, value) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.size = CONFIG.TARGET_SIZE;
        this.bobOffset = Math.random() * Math.PI * 2;
        this.bobSpeed = 0.02 + Math.random() * 0.02;
        this.originalY = y;
    }

    update() {
        // 上下浮动效果
        this.y = this.originalY + Math.sin(Date.now() * this.bobSpeed + this.bobOffset) * 5;
    }

    draw(ctx) {
        // 绘制目标（圆形，带数字）
        ctx.fillStyle = this.value >= 50 ? '#FF6B6B' : this.value >= 30 ? '#FFA726' : '#66BB6A';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // 目标边框
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // 目标数字
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.value.toString(), this.x, this.y);
    }

    checkCollision(bullet) {
        const dx = this.x - bullet.x;
        const dy = this.y - bullet.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < this.size + bullet.size;
    }
}

// 云朵类
class Cloud {
    constructor(x, y, size) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.speed = 0.2 + Math.random() * 0.3;
    }

    update(canvasWidth) {
        this.x += this.speed;
        if (this.x > canvasWidth + this.size) {
            this.x = -this.size;
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#FFF';
        ctx.globalAlpha = 0.8;
        
        // 绘制云朵（多个圆形组成）
        const circles = [
            { x: 0, y: 0, r: this.size * 0.6 },
            { x: this.size * 0.4, y: -this.size * 0.1, r: this.size * 0.4 },
            { x: -this.size * 0.3, y: -this.size * 0.2, r: this.size * 0.3 },
            { x: this.size * 0.2, y: this.size * 0.3, r: this.size * 0.35 }
        ];

        circles.forEach(circle => {
            ctx.beginPath();
            ctx.arc(this.x + circle.x, this.y + circle.y, circle.r, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.globalAlpha = 1;
    }
}

// 爆炸效果类
class Explosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.particles = [];
        this.life = 30;
        
        // 创建粒子
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                size: 2 + Math.random() * 4,
                color: `hsl(${Math.random() * 60 + 15}, 100%, 50%)`
            });
        }
    }

    update() {
        this.life--;
        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.2;
            particle.size *= 0.98;
        });
        return this.life > 0;
    }

    draw(ctx) {
        const alpha = this.life / 30;
        this.particles.forEach(particle => {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }
}

// 游戏主类
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = new GameState();
        
        this.initializeElements();
        this.initializeTerrain();
        this.initializeClouds();
        this.spawnTargets();
        this.bindEvents();
        
        // 初始化界面状态
        this.playButton.classList.add('show');
        this.disableControls();
        this.updateUI();
        
        this.gameLoop();
    }

    initializeElements() {
        this.scoreEl = document.getElementById('score');
        this.hitsEl = document.getElementById('hits');
        this.shotsEl = document.getElementById('shots');
        this.accuracyEl = document.getElementById('accuracy');
        this.angleSlider = document.getElementById('angleSlider');
        this.powerSlider = document.getElementById('powerSlider');
        this.angleValue = document.getElementById('angleValue');
        this.powerValue = document.getElementById('powerValue');
        this.leftBtn = document.getElementById('leftBtn');
        this.rightBtn = document.getElementById('rightBtn');
        this.fireBtn = document.getElementById('fireBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.playButton = document.getElementById('playButton');
    }

    initializeTerrain() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // 生成随机地形
        this.state.terrain = [];
        for (let x = 0; x < width; x += 10) {
            const terrainHeight = CONFIG.GROUND_HEIGHT + Math.sin(x * 0.01) * 20 + Math.random() * 10;
            this.state.terrain.push({
                x: x,
                y: height - terrainHeight
            });
        }
    }

    initializeClouds() {
        this.state.clouds = [];
        for (let i = 0; i < CONFIG.CLOUD_COUNT; i++) {
            this.state.clouds.push(new Cloud(
                Math.random() * this.canvas.width,
                50 + Math.random() * 100,
                30 + Math.random() * 20
            ));
        }
    }

    spawnTargets() {
        this.state.targets = [];
        for (let i = 0; i < CONFIG.MAX_TARGETS; i++) {
            const x = 400 + Math.random() * 300;
            const y = 100 + Math.random() * 150;
            const value = [10, 20, 33, 45, 66][Math.floor(Math.random() * 5)];
            this.state.targets.push(new Target(x, y, value));
        }
    }

    bindEvents() {
        // 角度滑块
        this.angleSlider.addEventListener('input', (e) => {
            this.state.angle = parseInt(e.target.value);
            this.angleValue.textContent = this.state.angle + '°';
        });

        // 力度滑块
        this.powerSlider.addEventListener('input', (e) => {
            this.state.power = parseInt(e.target.value);
            this.powerValue.textContent = this.state.power;
        });

        // 移动按钮
        this.leftBtn.addEventListener('click', () => {
            this.state.cannonX = Math.max(50, this.state.cannonX - 20);
        });

        this.rightBtn.addEventListener('click', () => {
            this.state.cannonX = Math.min(200, this.state.cannonX + 20);
        });

        // 发射按钮
        this.fireBtn.addEventListener('click', () => {
            this.fire();
        });

        // 重置按钮
        this.resetBtn.addEventListener('click', () => {
            this.resetGame();
        });

        // 播放按钮
        this.playButton.addEventListener('click', () => {
            this.startGame();
        });

        // 键盘控制
        document.addEventListener('keydown', (e) => {
            if (!this.state.gameRunning) return;
            
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    this.fire();
                    break;
                case 'ArrowLeft':
                    this.state.cannonX = Math.max(50, this.state.cannonX - 20);
                    break;
                case 'ArrowRight':
                    this.state.cannonX = Math.min(200, this.state.cannonX + 20);
                    break;
                case 'ArrowUp':
                    this.state.angle = Math.min(90, this.state.angle + 5);
                    this.angleSlider.value = this.state.angle;
                    this.angleValue.textContent = this.state.angle + '°';
                    break;
                case 'ArrowDown':
                    this.state.angle = Math.max(0, this.state.angle - 5);
                    this.angleSlider.value = this.state.angle;
                    this.angleValue.textContent = this.state.angle + '°';
                    break;
            }
        });
    }

    startGame() {
        this.state.gameRunning = true;
        this.playButton.classList.remove('show');
        this.enableControls();
    }

    fire() {
        if (this.state.bullets.length > 0) return; // 一次只能发射一颗子弹

        const angleRad = (this.state.angle * Math.PI) / 180;
        const powerFactor = this.state.power / 5;
        
        const vx = Math.cos(angleRad) * powerFactor;
        const vy = -Math.sin(angleRad) * powerFactor;
        
        const bullet = new Bullet(
            this.state.cannonX + Math.cos(angleRad) * CONFIG.CANNON_SIZE,
            this.state.cannonY - Math.sin(angleRad) * CONFIG.CANNON_SIZE,
            vx,
            vy
        );
        
        this.state.bullets.push(bullet);
        this.state.shots++;
        this.updateUI();
        
        // 禁用发射按钮直到子弹消失
        this.fireBtn.disabled = true;
    }

    resetGame() {
        this.state = new GameState();
        this.initializeTerrain();
        this.initializeClouds();
        this.spawnTargets();
        this.updateUI();
        this.playButton.classList.add('show');
        this.disableControls();
    }

    enableControls() {
        this.leftBtn.disabled = false;
        this.rightBtn.disabled = false;
        this.fireBtn.disabled = false;
        this.angleSlider.disabled = false;
        this.powerSlider.disabled = false;
    }

    disableControls() {
        this.leftBtn.disabled = true;
        this.rightBtn.disabled = true;
        this.fireBtn.disabled = true;
        this.angleSlider.disabled = true;
        this.powerSlider.disabled = true;
    }

    update() {
        if (!this.state.gameRunning) return;

        // 更新云朵
        this.state.clouds.forEach(cloud => cloud.update(this.canvas.width));

        // 更新目标
        this.state.targets.forEach(target => target.update());

        // 更新子弹
        this.state.bullets = this.state.bullets.filter(bullet => {
            bullet.update();
            
            // 检查边界
            if (bullet.isOutOfBounds(this.canvas.width, this.canvas.height)) {
                this.fireBtn.disabled = false;
                return false;
            }

            // 检查地面碰撞
            if (bullet.y >= this.canvas.height - CONFIG.GROUND_HEIGHT) {
                this.state.explosions.push(new Explosion(bullet.x, bullet.y));
                this.fireBtn.disabled = false;
                return false;
            }

            // 检查目标碰撞
            for (let i = this.state.targets.length - 1; i >= 0; i--) {
                const target = this.state.targets[i];
                if (target.checkCollision(bullet)) {
                    // 击中目标
                    this.state.score += target.value;
                    this.state.hits++;
                    this.state.targets.splice(i, 1);
                    this.state.explosions.push(new Explosion(target.x, target.y));
                    this.fireBtn.disabled = false;
                    
                    // 如果所有目标都被击中，生成新目标
                    if (this.state.targets.length === 0) {
                        setTimeout(() => this.spawnTargets(), 1000);
                    }
                    
                    this.updateUI();
                    return false; // 移除子弹
                }
            }
            
            return true;
        });

        // 更新爆炸效果
        this.state.explosions = this.state.explosions.filter(explosion => explosion.update());
    }

    render() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制背景渐变
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.7, '#87CEEB');
        gradient.addColorStop(0.7, '#90EE90');
        gradient.addColorStop(1, '#8B4513');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制云朵
        this.state.clouds.forEach(cloud => cloud.draw(this.ctx));

        // 绘制地形
        this.ctx.fillStyle = '#8B4513';
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.canvas.height);
        this.state.terrain.forEach(point => {
            this.ctx.lineTo(point.x, point.y);
        });
        this.ctx.lineTo(this.canvas.width, this.canvas.height);
        this.ctx.closePath();
        this.ctx.fill();

        // 绘制草地
        this.ctx.fillStyle = '#228B22';
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.canvas.height - CONFIG.GROUND_HEIGHT);
        this.state.terrain.forEach(point => {
            this.ctx.lineTo(point.x, point.y);
        });
        this.ctx.lineTo(this.canvas.width, this.canvas.height - CONFIG.GROUND_HEIGHT);
        this.ctx.closePath();
        this.ctx.fill();

        // 绘制大炮
        this.drawCannon();

        // 绘制目标
        this.state.targets.forEach(target => target.draw(this.ctx));

        // 绘制子弹
        this.state.bullets.forEach(bullet => bullet.draw(this.ctx));

        // 绘制爆炸效果
        this.state.explosions.forEach(explosion => explosion.draw(this.ctx));

        // 绘制瞄准线
        if (this.state.gameRunning && this.state.bullets.length === 0) {
            this.drawAimLine();
        }
    }

    drawCannon() {
        const ctx = this.ctx;
        const angleRad = (this.state.angle * Math.PI) / 180;
        
        // 大炮底座
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.arc(this.state.cannonX, this.state.cannonY, CONFIG.CANNON_SIZE, 0, Math.PI * 2);
        ctx.fill();
        
        // 大炮炮管
        ctx.strokeStyle = '#2F4F4F';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(this.state.cannonX, this.state.cannonY);
        ctx.lineTo(
            this.state.cannonX + Math.cos(angleRad) * CONFIG.CANNON_SIZE,
            this.state.cannonY - Math.sin(angleRad) * CONFIG.CANNON_SIZE
        );
        ctx.stroke();
        
        // 大炮装饰
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.arc(this.state.cannonX, this.state.cannonY, CONFIG.CANNON_SIZE - 5, 0, Math.PI * 2);
        ctx.fill();
    }

    drawAimLine() {
        const ctx = this.ctx;
        const angleRad = (this.state.angle * Math.PI) / 180;
        const powerFactor = this.state.power / 5;
        
        // 模拟轨迹
        let x = this.state.cannonX + Math.cos(angleRad) * CONFIG.CANNON_SIZE;
        let y = this.state.cannonY - Math.sin(angleRad) * CONFIG.CANNON_SIZE;
        let vx = Math.cos(angleRad) * powerFactor;
        let vy = -Math.sin(angleRad) * powerFactor;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        
        // 绘制预测轨迹
        for (let i = 0; i < 100; i++) {
            x += vx;
            y += vy;
            vy += CONFIG.GRAVITY;
            
            if (x < 0 || x > this.canvas.width || y > this.canvas.height - CONFIG.GROUND_HEIGHT) {
                break;
            }
            
            if (i % 3 === 0) { // 每三个点绘制一次，创建虚线效果
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
    }

    updateUI() {
        this.state.updateAccuracy();
        this.scoreEl.textContent = this.state.score;
        this.hitsEl.textContent = this.state.hits;
        this.shotsEl.textContent = this.state.shots;
        this.accuracyEl.textContent = this.state.accuracy + '%';
    }

    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    new Game();
}); 