/**
 * 玩家角色系统
 * 处理玩家的移动、射击、状态管理和输入控制
 */

class Player {
    constructor() {
        // 基础属性
        this.id = 1;                    // 玩家ID（对应绿色）
        this.x = window.gameConfig.PLAYER_START_X;  // X坐标（屏幕中心）
        this.y = window.gameConfig.PLAYER_START_Y;  // Y坐标（屏幕中心）
        this.radius = 12;               // 碰撞半径
        this.active = true;             // 是否活跃
        
        // 移动相关
        this.speed = 5;                 // 移动速度（像素/帧）
        this.vx = 0;                    // X方向速度
        this.vy = 0;                    // Y方向速度
        
        // 战斗相关
        this.maxHP = 100;               // 最大生命值
        this.hp = 100;                  // 当前生命值
        this.lastFireTime = 0;          // 上次射击时间
        this.fireInterval = 1000;       // 射击间隔（1秒）
        
        // 轨迹相关
        this.baseTrackWidth = 15;       // 基础轨迹宽度
        this.currentTrackWidth = 15;    // 当前轨迹宽度
        this.lastTrackPaint = 0;        // 上次轨迹绘制时间
        this.trackPaintInterval = 50;   // 轨迹绘制间隔（毫秒）
        
        // Buff相关
        this.isBuffed = false;          // 是否有Buff效果
        this.buffEndTime = 0;           // Buff结束时间
        
        // 无敌相关（复活后）
        this.isInvincible = false;      // 是否无敌
        this.invincibleEndTime = 0;     // 无敌结束时间
        this.invincibleDuration = 3000; // 无敌持续时间（3秒）
        
        // 受击效果
        this.hitEffectEndTime = 0;      // 受击效果结束时间
        
        // 复活相关
        this.isRespawning = false;      // 是否正在复活倒计时
        this.respawnStartTime = 0;      // 复活开始时间
        this.respawnDelay = 3000;       // 复活延迟3秒
        
        // DOM元素
        this.element = null;
        this.healthBar = null;
        this.respawnCountdownElement = null;
        
        // 输入控制
        this.inputHandler = new InputHandler();
        
        this.createElement();
        this.initializeInput();
    }
    
    /**
     * 创建玩家DOM元素
     */
    createElement() {
        const template = document.getElementById('player-template');
        this.element = template.content.cloneNode(true).firstElementChild;
        
        // 设置初始位置
        this.updateVisual();
        
        // 添加到游戏层
        document.getElementById('game-layer').appendChild(this.element);
        
        // 获取血条引用
        this.healthBar = document.getElementById('health-fill');
    }
    
    /**
     * 初始化输入控制
     */
    initializeInput() {
        this.inputHandler.initialize();
        
        // 确保射击目标在玩家初始化时就设置好
        this.inputHandler.updateFireTarget();
    }
    
    /**
     * 更新玩家状态
     * @param {number} deltaTime - 时间增量
     * @param {GridSystem} gridSystem - 网格系统
     * @param {PhysicsSystem} physics - 物理系统
     */
    update(deltaTime, gridSystem, physics) {
        // 更新复活倒计时（不管是否活跃）
        this.updateRespawnCountdown();
        
        if (!this.active) return;
        
        // 更新输入状态
        this.inputHandler.update();
        
        // 处理移动
        this.updateMovement(physics);
        
        // 更新轨迹绘制
        this.updateTrack(gridSystem);
        
        // 更新状态效果
        this.updateEffects();
        
        // 更新视觉表现
        this.updateVisual();
        
        // 更新血条
        this.updateHealthBar();
    }
    
    /**
     * 更新移动逻辑
     * @param {PhysicsSystem} physics - 物理系统
     */
    updateMovement(physics) {
        // 获取输入向量
        const input = this.inputHandler.getMovementVector();
        
        // 计算移动速度
        this.vx = input.x * this.speed;
        this.vy = input.y * this.speed;
        
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
        
        // 检查是否需要绘制轨迹（移动时才绘制）
        if ((this.vx !== 0 || this.vy !== 0) && 
            currentTime - this.lastTrackPaint >= this.trackPaintInterval) {
            
            // 在当前位置绘制轨迹
            gridSystem.paintTrack(this.x, this.y, this.id, this.currentTrackWidth);
            this.lastTrackPaint = currentTime;
        }
    }
    
    /**
     * 更新状态效果
     */
    updateEffects() {
        const currentTime = performance.now();
        
        // 更新无敌状态
        if (this.isInvincible && currentTime >= this.invincibleEndTime) {
            this.isInvincible = false;
            this.element.classList.remove('invincible');
        }
        
        // 更新受击效果
        if (currentTime >= this.hitEffectEndTime) {
            this.element.classList.remove('hit');
        }
    }
    
    /**
     * 更新视觉表现
     */
    updateVisual() {
        if (!this.element) return;
        
        // 更新位置
        this.element.style.transform = `translate(${this.x - this.radius}px, ${this.y - this.radius}px)`;
    }
    
    /**
     * 更新血条显示
     */
    updateHealthBar() {
        if (!this.healthBar) return;
        
        const healthPercent = Math.max(0, this.hp / this.maxHP * 100);
        this.healthBar.style.width = `${healthPercent}%`;
        
        // 根据血量变化血条颜色（通过CSS变量或直接设置）
        if (healthPercent > 60) {
            this.healthBar.style.background = 'linear-gradient(90deg, #44ff44 0%, #44ff44 100%)';
        } else if (healthPercent > 30) {
            this.healthBar.style.background = 'linear-gradient(90deg, #ffaa44 0%, #ffaa44 100%)';
        } else {
            this.healthBar.style.background = 'linear-gradient(90deg, #ff4444 0%, #ff4444 100%)';
        }
    }
    
    /**
     * 寻找最近的敌人目标（用于空格键自动瞄准）
     * @returns {Object|null} 目标位置 {x, y} 或 null
     */
    findNearestEnemyTarget() {
        if (!window.game || !window.game.aiCharacters) {
            return null;
        }
        
        let nearestEnemy = null;
        let minDistance = Infinity;
        
        // 遍历所有AI角色
        for (const ai of window.game.aiCharacters) {
            if (!ai.active) continue;
            
            const distance = Math.sqrt(
                (ai.x - this.x) ** 2 + (ai.y - this.y) ** 2
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestEnemy = ai;
            }
        }
        
        if (nearestEnemy) {
            // 返回敌人当前位置作为射击目标
            return {
                x: nearestEnemy.x,
                y: nearestEnemy.y
            };
        }
        
        return null;
    }

    /**
     * 尝试射击
     * @param {BulletSystem} bulletSystem - 子弹系统
     * @returns {boolean} 是否成功射击
     */
    tryFire(bulletSystem) {
        const currentTime = performance.now();
        
        // 检查射击冷却
        if (currentTime - this.lastFireTime < this.fireInterval) {
            return false;
        }
        
        // 获取射击目标位置
        const target = this.inputHandler.getFireTarget();
        if (!target) {
            return false;
        }
        
        // 发射子弹
        const bullet = bulletSystem.fireBullet(this.x, this.y, target.x, target.y, this.id);
        
        if (bullet) {
            this.lastFireTime = currentTime;
            return true;
        }
        
        return false;
    }
    
    /**
     * 受到伤害
     * @param {number} damage - 伤害值
     * @returns {boolean} 是否死亡
     */
    takeDamage(damage) {
        // 无敌状态不受伤害
        if (this.isInvincible) return false;
        
        this.hp = Math.max(0, this.hp - damage);
        
        // 触发受击效果
        this.hitEffectEndTime = performance.now() + 600; // 0.6秒受击效果
        this.element.classList.add('hit');
        
        // 检查是否死亡
        if (this.hp <= 0) {
            this.die();
            return true;
        }
        
        return false;
    }
    
    /**
     * 死亡处理
     */
    die() {
        this.active = false;
        this.element.style.display = 'none';
        
        // 开始复活倒计时
        this.isRespawning = true;
        this.respawnStartTime = performance.now();
        this.showRespawnCountdown();
    }
    
    /**
     * 显示复活倒计时
     */
    showRespawnCountdown() {
        // 创建倒计时显示元素
        if (!this.respawnCountdownElement) {
            this.respawnCountdownElement = document.createElement('div');
            this.respawnCountdownElement.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 48px;
                font-weight: bold;
                color: #ff6b6b;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                z-index: 10;
                pointer-events: none;
            `;
            document.getElementById('game-container').appendChild(this.respawnCountdownElement);
        }
        this.respawnCountdownElement.style.display = 'block';
    }
    
    /**
     * 隐藏复活倒计时
     */
    hideRespawnCountdown() {
        if (this.respawnCountdownElement) {
            this.respawnCountdownElement.style.display = 'none';
        }
    }
    
    /**
     * 更新复活倒计时
     */
    updateRespawnCountdown() {
        if (!this.isRespawning) return;
        
        const currentTime = performance.now();
        const elapsed = currentTime - this.respawnStartTime;
        const remaining = Math.max(0, this.respawnDelay - elapsed);
        const countdown = Math.ceil(remaining / 1000);
        
        if (this.respawnCountdownElement) {
            if (countdown > 0) {
                this.respawnCountdownElement.textContent = countdown.toString();
            } else {
                this.hideRespawnCountdown();
                this.autoRespawn();
            }
        }
    }
    
    /**
     * 自动复活
     */
    autoRespawn() {
        if (!this.isRespawning) return;
        
        this.isRespawning = false;
        const respawnPos = window.gameConfig.getRespawnPosition(this.id);
        this.respawn(respawnPos.x, respawnPos.y);
    }

    /**
     * 复活
     * @param {number} x - 复活位置X
     * @param {number} y - 复活位置Y
     */
    respawn(x = window.gameConfig.PLAYER_START_X, y = window.gameConfig.PLAYER_START_Y) {
        this.x = x;
        this.y = y;
        this.hp = this.maxHP;
        this.active = true;
        
        // 设置无敌状态
        this.isInvincible = true;
        this.invincibleEndTime = performance.now() + this.invincibleDuration;
        
        // 重置视觉效果
        this.element.style.display = 'block';
        this.element.classList.add('invincible');
        this.element.classList.remove('hit');
        
        this.updateVisual();
        this.updateHealthBar();
    }
    
    /**
     * 重置玩家状态（新游戏）
     */
    reset() {
        this.x = window.gameConfig.PLAYER_START_X;
        this.y = window.gameConfig.PLAYER_START_Y;
        this.hp = this.maxHP;
        this.active = true;
        this.vx = 0;
        this.vy = 0;
        
        // 重置状态
        this.isBuffed = false;
        this.isInvincible = false;
        this.currentTrackWidth = this.baseTrackWidth;
        
        // 重置复活相关
        this.isRespawning = false;
        this.respawnStartTime = 0;
        this.hideRespawnCountdown();
        
        // 重置时间
        this.lastFireTime = 0;
        this.lastTrackPaint = 0;
        this.buffEndTime = 0;
        this.invincibleEndTime = 0;
        this.hitEffectEndTime = 0;
        
        // 重置视觉
        this.element.style.display = 'block';
        this.element.className = 'character player';
        
        this.updateVisual();
        this.updateHealthBar();
    }
    
    /**
     * 获取玩家状态信息
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            hp: this.hp,
            maxHP: this.maxHP,
            active: this.active,
            isBuffed: this.isBuffed,
            isInvincible: this.isInvincible,
            trackWidth: this.currentTrackWidth
        };
    }
}

/**
 * 输入处理器 - 统一处理键盘和触摸输入
 */
class InputHandler {
    constructor() {
        // 键盘状态
        this.keys = {};
        
        // 鼠标/触摸状态
        this.mouseX = 0;
        this.mouseY = 0;
        this.isMouseDown = false;
        
        // 移动端移动摇杆状态
        this.moveJoystickActive = false;
        this.moveJoystickX = 0;
        this.moveJoystickY = 0;
        
        // 移动端射击摇杆状态
        this.fireJoystickActive = false;
        this.fireJoystickX = 0;
        this.fireJoystickY = 0;
        
        // 射击状态
        this.isFiring = false;
        this.fireTarget = null;
        
        // 检测设备类型
        this.isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                       ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        
        // 设置默认鼠标位置（画布中心），确保空格键射击有默认目标
        this.mouseX = window.gameConfig?.CANVAS_WIDTH / 2 || 300;
        this.mouseY = window.gameConfig?.CANVAS_HEIGHT / 2 || 300;
    }
    
    /**
     * 初始化输入监听
     */
    initialize() {
        this.initKeyboardEvents();
        this.initMouseEvents();
        
        if (this.isMobile) {
            this.initTouchEvents();
        }
        
        // 初始化射击目标
        this.updateFireTarget();
    }
    
    /**
     * 初始化键盘事件
     */
    initKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            e.preventDefault();
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            e.preventDefault();
        });
    }
    
    /**
     * 初始化鼠标事件
     */
    initMouseEvents() {
        const gameContainer = document.getElementById('game-container');
        
        gameContainer.addEventListener('mousemove', (e) => {
            // 始终更新鼠标位置，不检查游戏状态
            const rect = gameContainer.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            
            // 立即更新射击目标
            this.updateFireTarget();
        });
        
        gameContainer.addEventListener('mousedown', (e) => {
            // 只响应左键，移除游戏状态检查
            if (e.button === 0) {
                this.isMouseDown = true;
                this.updateFireTarget();
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        gameContainer.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.isMouseDown = false;
                e.preventDefault();
            }
        });
        
        // 防止右键菜单干扰
        gameContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // 鼠标离开游戏区域时停止射击
        gameContainer.addEventListener('mouseleave', () => {
            this.isMouseDown = false;
        });
    }
    
    /**
     * 初始化触摸事件（移动端）
     */
    initTouchEvents() {
        const moveJoystick = document.getElementById('move-joystick');
        const fireJoystick = document.getElementById('fire-joystick');
        
        if (moveJoystick) {
            this.initMoveJoystick(moveJoystick);
        }
        
        if (fireJoystick) {
            this.initFireJoystick(fireJoystick);
        }
    }
    
    /**
     * 初始化移动摇杆
     * @param {HTMLElement} joystick - 移动摇杆元素
     */
    initMoveJoystick(joystick) {
        const knob = document.getElementById('move-joystick-knob');
        const centerX = 40; // 摇杆中心点
        const centerY = 40;
        const maxDistance = 25; // 摇杆最大移动距离
        
        const handleTouch = (e) => {
            e.preventDefault();
            const touch = e.touches[0] || e.changedTouches[0];
            const joystickRect = joystick.getBoundingClientRect();
            
            const dx = touch.clientX - joystickRect.left - centerX;
            const dy = touch.clientY - joystickRect.top - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= maxDistance) {
                this.moveJoystickX = dx / maxDistance;
                this.moveJoystickY = dy / maxDistance;
                knob.style.transform = `translate(${dx}px, ${dy}px)`;
            } else {
                // 限制在圆形范围内
                const angle = Math.atan2(dy, dx);
                const limitedX = Math.cos(angle) * maxDistance;
                const limitedY = Math.sin(angle) * maxDistance;
                
                this.moveJoystickX = limitedX / maxDistance;
                this.moveJoystickY = limitedY / maxDistance;
                knob.style.transform = `translate(${limitedX}px, ${limitedY}px)`;
            }
            
            this.moveJoystickActive = true;
        };
        
        const resetJoystick = () => {
            this.moveJoystickActive = false;
            this.moveJoystickX = 0;
            this.moveJoystickY = 0;
            knob.style.transform = 'translate(0px, 0px)';
        };
        
        joystick.addEventListener('touchstart', handleTouch, {passive: false});
        joystick.addEventListener('touchmove', handleTouch, {passive: false});
        joystick.addEventListener('touchend', resetJoystick, {passive: false});
        joystick.addEventListener('touchcancel', resetJoystick, {passive: false});
    }
    
    /**
     * 初始化射击摇杆
     * @param {HTMLElement} fireJoystick - 射击摇杆元素
     */
    initFireJoystick(fireJoystick) {
        const knob = document.getElementById('fire-joystick-knob');
        const centerX = 40; // 摇杆中心点
        const centerY = 40;
        const maxDistance = 25; // 摇杆最大移动距离
        const deadZone = 0.3; // 死区，小于此值不触发射击
        
        const handleTouch = (e) => {
            e.preventDefault();
            const touch = e.touches[0] || e.changedTouches[0];
            const joystickRect = fireJoystick.getBoundingClientRect();
            
            const dx = touch.clientX - joystickRect.left - centerX;
            const dy = touch.clientY - joystickRect.top - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= maxDistance) {
                this.fireJoystickX = dx / maxDistance;
                this.fireJoystickY = dy / maxDistance;
                knob.style.transform = `translate(${dx}px, ${dy}px)`;
            } else {
                // 限制在圆形范围内
                const angle = Math.atan2(dy, dx);
                const limitedX = Math.cos(angle) * maxDistance;
                const limitedY = Math.sin(angle) * maxDistance;
                
                this.fireJoystickX = limitedX / maxDistance;
                this.fireJoystickY = limitedY / maxDistance;
                knob.style.transform = `translate(${limitedX}px, ${limitedY}px)`;
            }
            
            // 检查是否超过死区
            const joystickDistance = Math.sqrt(this.fireJoystickX * this.fireJoystickX + this.fireJoystickY * this.fireJoystickY);
            if (joystickDistance > deadZone) {
                this.fireJoystickActive = true;
                this.isFiring = true;
                fireJoystick.classList.add('active');
                this.updateFireTarget();
            } else {
                this.isFiring = false;
                fireJoystick.classList.remove('active');
            }
        };
        
        const resetJoystick = () => {
            this.fireJoystickActive = false;
            this.fireJoystickX = 0;
            this.fireJoystickY = 0;
            this.isFiring = false;
            knob.style.transform = 'translate(0px, 0px)';
            fireJoystick.classList.remove('active');
        };
        
        fireJoystick.addEventListener('touchstart', handleTouch, {passive: false});
        fireJoystick.addEventListener('touchmove', handleTouch, {passive: false});
        fireJoystick.addEventListener('touchend', resetJoystick, {passive: false});
        fireJoystick.addEventListener('touchcancel', resetJoystick, {passive: false});
    }
    
    /**
     * 更新输入状态
     */
    update() {
        // 强制每帧都更新射击目标
        this.updateFireTarget();
    }
    
    /**
     * 获取移动向量
     * @returns {Object} 移动向量 {x, y}
     */
    getMovementVector() {
        let x = 0, y = 0;
        
        if (this.isMobile && this.moveJoystickActive) {
            // 移动端使用移动摇杆
            x = this.moveJoystickX;
            y = this.moveJoystickY;
        } else {
            // PC端使用键盘
            if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
            if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
            if (this.keys['KeyW'] || this.keys['ArrowUp']) y -= 1;
            if (this.keys['KeyS'] || this.keys['ArrowDown']) y += 1;
        }
        
        // 标准化对角线移动
        if (x !== 0 && y !== 0) {
            const length = Math.sqrt(x * x + y * y);
            x /= length;
            y /= length;
        }
        
        return {x, y};
    }
    
    /**
     * 获取射击目标
     * @returns {Object|null} 目标位置 {x, y} 或 null
     */
    getFireTarget() {
        // 检查玩家是否活跃（通过全局游戏对象）
        const player = window.game?.player;
        if (!player || !player.active) {
            return null;
        }
        
        // 检查是否有射击输入
        const hasShootInput = this.keys['Space'] || this.isMouseDown;
        
        // 分别处理不同的射击输入
        // 空格键：自动瞄准最近目标
        if (this.keys['Space']) {
            const autoTarget = player.findNearestEnemyTarget();
            if (autoTarget) {
                return autoTarget;
            }
        }
        
        // 鼠标左键：射向鼠标位置
        if (this.isMouseDown) {
            // 确保射击目标存在
            if (!this.fireTarget) {
                this.updateFireTarget();
            }
            return this.fireTarget;
        }
        
        // 移动端：射击摇杆激活
        if (this.isMobile && this.isFiring) {
            return this.fireTarget;
        }
        
        return null;
    }
    
    /**
     * 更新射击目标位置
     */
    updateFireTarget() {
        if (this.isMobile && this.fireJoystickActive) {
            // 移动端使用射击摇杆方向
            const player = window.game?.player;
            if (player) {
                const shootRange = window.gameConfig.MOBILE_SHOOT_RANGE;
                this.fireTarget = {
                    x: player.x + this.fireJoystickX * shootRange,
                    y: player.y + this.fireJoystickY * shootRange
                };
            }
        } else {
            // PC端使用鼠标位置作为射击目标
            this.fireTarget = {x: this.mouseX, y: this.mouseY};
        }
    }
}

// 导出到全局
window.Player = Player;
window.InputHandler = InputHandler; 