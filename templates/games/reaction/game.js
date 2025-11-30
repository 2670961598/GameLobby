class ReactionGame {
    constructor() {
        this.gameContainer = document.querySelector('.game-container');
        this.startButton = document.querySelector('.start-button');
        this.statsDisplay = document.querySelector('.stats');
        this.caughtArea = document.querySelector('.caught-area');
        
        this.totalSticks = 10;
        this.caughtSticks = 0;
        this.droppedSticks = 0;
        this.isPlaying = false;
        this.sticks = [];
        this.dropTimeout = null;
        this.isDropping = false;
        this.gravity = 0.5; // 重力加速度
        this.initialSpeed = 0; // 初始速度
        
        this.init();
    }
    
    init() {
        this.startButton.addEventListener('click', () => this.startGame());
    }
    
    startGame() {
        if (this.isPlaying) return;
        
        // 重置游戏状态
        this.isPlaying = true;
        this.caughtSticks = 0;
        this.droppedSticks = 0;
        this.sticks = [];
        this.isDropping = false;
        this.updateStats();
        this.startButton.style.display = 'none';
        this.caughtArea.innerHTML = '';
        
        // 创建初始的10根棒子
        this.createInitialSticks();
        
        // 开始随机掉落棒子
        this.scheduleNextDrop();
    }
    
    createInitialSticks() {
        const containerWidth = this.gameContainer.offsetWidth;
        const stickWidth = 40;
        const spacing = (containerWidth - (this.totalSticks * stickWidth)) / (this.totalSticks + 1);
        
        for (let i = 0; i < this.totalSticks; i++) {
            const stick = document.createElement('div');
            stick.className = 'stick';
            stick.style.left = `${spacing + i * (stickWidth + spacing)}px`;
            stick.style.top = '20px'; // 天花板高度
            
            this.gameContainer.appendChild(stick);
            this.sticks.push(stick);
        }
    }
    
    scheduleNextDrop() {
        if (!this.isPlaying) return;
        
        // 随机生成0.5-3秒的延迟
        const delay = Math.random() * 2500 + 500;
        this.dropTimeout = setTimeout(() => {
            this.dropSticks();
        }, delay);
    }
    
    dropSticks() {
        if (this.sticks.length === 0 || this.isDropping) {
            if (this.sticks.length === 0) {
                this.endGame();
            }
            return;
        }
        
        this.isDropping = true;
        
        // 随机选择1-2根棒子掉落
        const dropCount = Math.min(Math.floor(Math.random() * 2) + 1, this.sticks.length);
        
        // 随机选择要掉落的棒子
        const sticksToDrop = [];
        for (let i = 0; i < dropCount; i++) {
            const randomIndex = Math.floor(Math.random() * this.sticks.length);
            sticksToDrop.push(this.sticks[randomIndex]);
            this.sticks.splice(randomIndex, 1);
        }
        
        // 使用Promise.all等待所有棒子掉落完成
        Promise.all(sticksToDrop.map(stick => this.dropStick(stick)))
            .then(() => {
                this.isDropping = false;
                // 安排下一次掉落
                this.scheduleNextDrop();
            });
    }
    
    dropStick(stick) {
        return new Promise((resolve) => {
            this.droppedSticks++;
            this.updateStats();
            
            let speed = this.initialSpeed;
            let position = 0;
            const stickHeight = 150; // 恢复原始棒子高度
            const containerHeight = this.gameContainer.offsetHeight;
            const startTop = parseInt(stick.style.top);
            
            // 添加点击事件
            const clickHandler = (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                this.catchStick(stick, clickHandler);
                resolve();
            };
            stick.addEventListener('click', clickHandler);
            
            // 使用requestAnimationFrame实现重力加速度
            const animate = () => {
                if (!stick.parentNode) {
                    resolve();
                    return;
                }
                
                speed += this.gravity;
                position += speed;
                
                if (startTop + position >= containerHeight - stickHeight) {
                    // 棒子落地
                    stick.removeEventListener('click', clickHandler);
                    this.gameContainer.removeChild(stick);
                    resolve();
                    return;
                }
                
                stick.style.top = `${startTop + position}px`;
                requestAnimationFrame(animate);
            };
            
            requestAnimationFrame(animate);
        });
    }
    
    catchStick(stick, clickHandler) {
        // 移除点击事件
        stick.removeEventListener('click', clickHandler);
        
        // 创建接住的棒子显示在右下角
        const caughtStick = document.createElement('div');
        caughtStick.className = 'caught-stick';
        this.caughtArea.appendChild(caughtStick);
        
        // 移除原棒子
        this.gameContainer.removeChild(stick);
        
        // 更新统计
        this.caughtSticks++;
        this.updateStats();
        
        // 检查游戏是否结束
        if (this.sticks.length === 0 && this.droppedSticks === this.totalSticks) {
            this.endGame();
        }
    }
    
    updateStats() {
        this.statsDisplay.textContent = `接住: ${this.caughtSticks}/${this.droppedSticks}`;
    }
    
    endGame() {
        this.isPlaying = false;
        if (this.dropTimeout) {
            clearTimeout(this.dropTimeout);
        }
        this.startButton.style.display = 'block';
        
        // 显示自定义弹窗
        const modal = document.getElementById('resultModal');
        const modalTitle = document.getElementById('modalTitle');
        modalTitle.textContent = this.caughtSticks === this.totalSticks ? '你真棒！' : '垃圾';
        modal.style.display = 'flex';
    }
}

// 初始化游戏
window.addEventListener('load', () => {
    new ReactionGame();
}); 