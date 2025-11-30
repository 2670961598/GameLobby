class BombGame {
    constructor() {
        this.startScreen = document.getElementById('startScreen');
        this.gameScreen = document.getElementById('gameScreen');
        this.startButton = document.getElementById('startButton');
        this.timer = document.getElementById('timer');
        this.redWire = document.getElementById('red-wire');
        this.blueWire = document.getElementById('blue-wire');
        this.yellowWire = document.getElementById('yellow-wire');
        this.bomb = document.getElementById('bomb');
        this.explosion = document.getElementById('explosion');
        this.winModal = document.getElementById('winModal');
        this.failModal = document.getElementById('failModal');
        this.restartButton = document.getElementById('restartButton');
        this.failRestartButton = document.getElementById('failRestartButton');
        this.characters = document.querySelectorAll('.character');
        this.connectionLines = document.getElementById('connection-lines');
        
        this.timeLeft = 60;
        this.gameInterval = null;
        this.speechInterval = null;
        this.isGameOver = false;
        
        this.speechTexts = [
            "剪红色！", "剪蓝色！", "不要剪红色！", "不要剪蓝色！",
            "救我！", "快点！", "没时间了！", "KMY大改！"
        ];

        this.initializeEventListeners();
        this.drawConnectionLines();
    }

    initializeEventListeners() {
        this.startButton.addEventListener('click', () => this.startGame());
        this.restartButton.addEventListener('click', () => this.restartGame());
        this.failRestartButton.addEventListener('click', () => this.restartGame());
        this.redWire.addEventListener('click', () => this.cutWire('red'));
        this.blueWire.addEventListener('click', () => this.cutWire('blue'));
        this.yellowWire.addEventListener('click', () => this.cutWire('yellow'));
        this.bomb.addEventListener('click', () => this.showYellowWire());
    }

    startGame() {
        this.startScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');
        this.startTimer();
        this.startRandomSpeech();
        // 等待DOM更新后再绘制线条
        requestAnimationFrame(() => {
            this.drawConnectionLines();
        });
    }

    startTimer() {
        this.gameInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimer();
            
            if (this.timeLeft <= 0) {
                this.gameOver();
            }
        }, 1000);
    }

    updateTimer() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        this.timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    startRandomSpeech() {
        this.speechInterval = setInterval(() => {
            if (!this.isGameOver) {
                this.showRandomSpeech();
            }
        }, 1500);
    }

    showRandomSpeech() {
        // 隐藏所有气泡
        document.querySelectorAll('.speech-bubble').forEach(bubble => {
            bubble.classList.add('hidden');
        });

        // 随机选择一个角色
        const randomChar = this.characters[Math.floor(Math.random() * this.characters.length)];
        const bubble = randomChar.querySelector('.speech-bubble');
        const text = bubble.querySelector('.speech-text');
        
        // 显示随机文本
        text.textContent = this.speechTexts[Math.floor(Math.random() * this.speechTexts.length)];
        bubble.classList.remove('hidden');

        // 1秒后隐藏气泡
        setTimeout(() => {
            bubble.classList.add('hidden');
        }, 1000);
    }

    showYellowWire() {
        if (!this.isGameOver && !this.yellowWire.classList.contains('hidden')) {
            return;
        }
        this.yellowWire.classList.remove('hidden');
    }

    cutWire(color) {
        if (this.isGameOver) return;

        if (color === 'yellow') {
            this.win();
        } else {
            this.gameOver();
        }
    }

    gameOver() {
        this.isGameOver = true;
        clearInterval(this.gameInterval);
        clearInterval(this.speechInterval);
        this.explosion.classList.remove('hidden');
        
        // 2秒后显示失败弹窗
        setTimeout(() => {
            this.failModal.classList.remove('hidden');
        }, 2000);
    }

    win() {
        this.isGameOver = true;
        clearInterval(this.gameInterval);
        clearInterval(this.speechInterval);
        this.winModal.classList.remove('hidden');
    }

    restartGame() {
        this.timeLeft = 60;
        this.isGameOver = false;
        this.updateTimer();
        this.explosion.classList.add('hidden');
        this.winModal.classList.add('hidden');
        this.failModal.classList.add('hidden');
        this.yellowWire.classList.add('hidden');
        this.startScreen.classList.remove('hidden');
        this.gameScreen.classList.add('hidden');
    }

    drawConnectionLines() {
        // 清空现有的线条
        this.connectionLines.innerHTML = '';

        const gameScreen = document.getElementById('gameScreen');
        const gameRect = gameScreen.getBoundingClientRect();
        const bombContainer = document.getElementById('bomb-container');
        const bombRect = bombContainer.getBoundingClientRect();
        
        // 计算炸弹的位置（相对于游戏界面），将连接点下移到炸弹中间
        const bombCenter = {
            x: bombRect.left - gameRect.left + bombRect.width / 2,
            y: bombRect.top - gameRect.top + bombRect.height / 5  // 修改这里，使用炸弹高度的一半
        };

        this.characters.forEach((char) => {
            const charRect = char.getBoundingClientRect();
            
            // 计算角色的位置（相对于游戏界面）
            const charCenter = {
                x: charRect.left - gameRect.left + charRect.width / 2,
                y: charRect.bottom - gameRect.top
            };

            // 创建SVG线条
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', charCenter.x);
            line.setAttribute('y1', charCenter.y);
            line.setAttribute('x2', bombCenter.x);
            line.setAttribute('y2', bombCenter.y);
            line.setAttribute('class', 'connection-line');
            
            this.connectionLines.appendChild(line);
        });
    }
}

// 初始化游戏
const game = new BombGame(); 