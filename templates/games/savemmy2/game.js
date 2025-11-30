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
        this.greenLines = new Set(); // Track existing green lines
        this.character4Added = false;
        this.allBlackLinesCut = false;
        this.blackLinesCut = 0;
        
        this.speechTexts = [
            "救命", "剪黄线", "哪里有黄线", "我要点外卖",
            "命运的红线", "大佬救我", "我要爆炸了", "不要啊！"
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
        this.drawConnectionLines();
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
        document.querySelectorAll('.speech-bubble').forEach(bubble => {
            bubble.classList.add('hidden');
        });

        const randomChar = this.characters[Math.floor(Math.random() * this.characters.length)];
        const bubble = randomChar.querySelector('.speech-bubble');
        const text = bubble.querySelector('.speech-text');
        
        const randomText = this.speechTexts[Math.floor(Math.random() * this.speechTexts.length)];
        text.textContent = randomText;
        bubble.classList.remove('hidden');

        // Add click event listener to the bubble if it contains "大佬救我"
        if (randomText === "大佬救我" && !this.character4Added) {
            bubble.style.cursor = 'pointer';
            bubble.addEventListener('click', () => {
                this.addCharacter4();
                bubble.style.cursor = 'default';
            }, { once: true }); // Use once: true to ensure the event listener is only triggered once
        }

        setTimeout(() => {
            bubble.classList.add('hidden');
        }, 1000);
    }

    addCharacter4() {
        const charactersDiv = document.getElementById('characters');
        const char4 = document.createElement('div');
        char4.className = 'character';
        char4.id = 'char4';
        char4.style.position = 'absolute';
        char4.style.right = '20px';
        const bombContainer = document.getElementById('bomb-container');
        const bombRect = bombContainer.getBoundingClientRect();
        const gameRect = this.gameScreen.getBoundingClientRect();
        char4.style.top = (bombRect.top - gameRect.top + bombRect.height / 3) + 'px';
        char4.style.transform = 'translateY(-50%)';
        char4.style.cursor = 'pointer';
        char4.addEventListener('click', () => {
            this.addCharacter4Line();
            char4.style.cursor = 'default';
        }, { once: true });
        char4.innerHTML = `
            <img src="role4.png" alt="角色4">
            <div class="speech-bubble hidden">
                <img src="qipao.png" alt="气泡">
                <span class="speech-text"></span>
            </div>
        `;
        charactersDiv.appendChild(char4);
        this.character4Added = true;
        this.drawConnectionLines();
    }

    addCharacter4Line() {
        const char4 = document.getElementById('char4');
        const char4Rect = char4.getBoundingClientRect();
        const bombContainer = document.getElementById('bomb-container');
        const bombRect = bombContainer.getBoundingClientRect();
        const gameRect = this.gameScreen.getBoundingClientRect();
        
        const char4Center = {
            x: char4Rect.left - gameRect.left + char4Rect.width / 2,
            y: char4Rect.bottom - gameRect.top
        };
        
        const bombCenter = {
            x: bombRect.left - gameRect.left + bombRect.width / 2,
            y: bombRect.top - gameRect.top + bombRect.height / 5
        };

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', char4Center.x);
        line.setAttribute('y1', char4Center.y);
        line.setAttribute('x2', bombCenter.x);
        line.setAttribute('y2', bombCenter.y);
        line.setAttribute('class', 'connection-line');
        line.setAttribute('data-char4', 'true'); // 添加标记以识别角色4的线
        line.style.pointerEvents = 'none';
        
        this.connectionLines.appendChild(line);
    }

    showYellowWire() {
        if (!this.isGameOver && !this.yellowWire.classList.contains('hidden')) {
            return;
        }
        this.yellowWire.classList.remove('hidden');
    }

    cutWire(color) {
        if (this.isGameOver) return;
        this.gameOver();
    }

    handleBlackLineClick(charIndex) {
        if (this.isGameOver) return;

        this.blackLinesCut++;
        
        // Remove the clicked black line using data attribute
        const targetLine = this.connectionLines.querySelector(`.connection-line[data-char-index="${charIndex}"]`);
        if (targetLine) {
            targetLine.remove();
        }
        
        // Add green lines based on which black line was cut with delay
        setTimeout(() => {
            if (charIndex === 0) { // Character 1's line
                this.addGreenLine(0, 1);
            } else if (charIndex === 1) { // Character 2's line
                this.addGreenLine(0, 1);
                this.addGreenLine(1, 2);
            } else if (charIndex === 2) { // Character 3's line
                this.addGreenLine(1, 2);
            }
        }, 500);

        // Check if all black lines are cut
        if (this.blackLinesCut === 3) {
            if (!this.character4Added) {
                this.gameOver();
            } else {
                // 检查角色4的线是否存在
                const char4Line = this.connectionLines.querySelector('.connection-line[data-char4="true"]');
                if (char4Line) {
                    this.win();
                } else {
                    this.gameOver();
                }
            }
        }
    }

    addGreenLine(char1Index, char2Index) {
        const lineKey = `${Math.min(char1Index, char2Index)}-${Math.max(char1Index, char2Index)}`;
        if (this.greenLines.has(lineKey)) return;

        this.greenLines.add(lineKey);
        const char1 = this.characters[char1Index];
        const char2 = this.characters[char2Index];
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        
        const char1Rect = char1.getBoundingClientRect();
        const char2Rect = char2.getBoundingClientRect();
        const gameRect = this.gameScreen.getBoundingClientRect();
        
        const x1 = char1Rect.left - gameRect.left + char1Rect.width / 2;
        const y1 = char1Rect.bottom - gameRect.top - 20; // 提高Y坐标
        const x2 = char2Rect.left - gameRect.left + char2Rect.width / 2;
        const y2 = char2Rect.bottom - gameRect.top - 20; // 提高Y坐标
        
        // 计算中点
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        
        // 计算缩短后的端点
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const newLength = length / 2;
        const angle = Math.atan2(dy, dx);
        
        const newX1 = midX - (newLength / 2) * Math.cos(angle);
        const newY1 = midY - (newLength / 2) * Math.sin(angle);
        const newX2 = midX + (newLength / 2) * Math.cos(angle);
        const newY2 = midY + (newLength / 2) * Math.sin(angle);
        
        line.setAttribute('x1', newX1);
        line.setAttribute('y1', newY1);
        line.setAttribute('x2', newX2);
        line.setAttribute('y2', newY2);
        line.setAttribute('class', 'green-connection-line');
        
        text.setAttribute('x', midX);
        text.setAttribute('y', midY - 10);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', 'green-line-text');
        text.textContent = '老乡别走';
        
        this.connectionLines.appendChild(line);
        this.connectionLines.appendChild(text);
    }

    drawConnectionLines() {
        this.connectionLines.innerHTML = '';

        const gameScreen = document.getElementById('gameScreen');
        const gameRect = gameScreen.getBoundingClientRect();
        const bombContainer = document.getElementById('bomb-container');
        const bombRect = bombContainer.getBoundingClientRect();
        
        const bombCenter = {
            x: bombRect.left - gameRect.left + bombRect.width / 2,
            y: bombRect.top - gameRect.top + bombRect.height / 5
        };

        // 只处理前三个角色
        for (let i = 0; i < 3; i++) {
            const char = this.characters[i];
            const charRect = char.getBoundingClientRect();
            
            const charCenter = {
                x: charRect.left - gameRect.left + charRect.width / 2,
                y: charRect.bottom - gameRect.top
            };

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', charCenter.x);
            line.setAttribute('y1', charCenter.y);
            line.setAttribute('x2', bombCenter.x);
            line.setAttribute('y2', bombCenter.y);
            line.setAttribute('class', 'connection-line');
            line.setAttribute('data-char-index', i); // 添加角色索引属性
            line.style.cursor = 'pointer';
            line.addEventListener('click', () => this.handleBlackLineClick(i));
            
            this.connectionLines.appendChild(line);
        }
    }

    gameOver() {
        this.isGameOver = true;
        clearInterval(this.gameInterval);
        clearInterval(this.speechInterval);
        this.explosion.classList.remove('hidden');
        
        setTimeout(() => {
            this.failModal.classList.remove('hidden');
        }, 2000);
    }

    win() {
        this.isGameOver = true;
        clearInterval(this.gameInterval);
        clearInterval(this.speechInterval);

        // 隐藏角色1-3和所有绿线
        for (let i = 0; i < 3; i++) {
            this.characters[i].style.display = 'none';
        }
        const greenLines = this.connectionLines.querySelectorAll('.green-connection-line, .green-line-text');
        greenLines.forEach(line => line.remove());

        // 延迟显示胜利弹窗
        setTimeout(() => {
            this.winModal.classList.remove('hidden');
            // 隐藏游戏界面，显示开始界面
            this.gameScreen.classList.add('hidden');
            this.startScreen.classList.remove('hidden');
        }, 1000);
    }

    restartGame() {
        this.timeLeft = 60;
        this.isGameOver = false;
        this.greenLines.clear();
        this.character4Added = false;
        this.blackLinesCut = 0;
        this.updateTimer();
        this.explosion.classList.add('hidden');
        this.winModal.classList.add('hidden');
        this.failModal.classList.add('hidden');
        this.yellowWire.classList.add('hidden');
        
        // 恢复角色1-3的显示
        for (let i = 0; i < 3; i++) {
            this.characters[i].style.display = '';
        }
        
        // Remove character 4 if it exists
        const char4 = document.getElementById('char4');
        if (char4) {
            char4.remove();
        }

        // 清除所有绿线和绿线文本
        const greenLines = this.connectionLines.querySelectorAll('.green-connection-line, .green-line-text');
        greenLines.forEach(line => line.remove());

        // 重新绘制连接线
        this.drawConnectionLines();

        // 重新启动计时器和随机对话
        this.startTimer();
        this.startRandomSpeech();
    }
}

// Initialize game
const game = new BombGame(); 