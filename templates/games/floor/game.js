class StackingGame {
    constructor() {
        this.gameArea = document.getElementById('game-canvas');
        this.startBtn = document.getElementById('start-btn');
        this.dropBtn = document.getElementById('drop-btn');
        this.dropBtnContainer = document.querySelector('.drop-button-container');
        this.restartBtn = document.getElementById('restart-btn');
        this.levelDisplay = document.getElementById('level');
        this.finalScoreDisplay = document.getElementById('final-score');
        this.modal = document.getElementById('game-over-modal');
        this.playerNameInput = document.getElementById('playerName');
        this.submitScoreBtn = document.getElementById('submitScore');
        this.leaderboardBody = document.getElementById('leaderboardBody');

        this.gameWidth = 600;
        this.gameHeight = 500;
        this.pipeHeight = 20;
        this.initialPipeLength = 300;
        this.gripperWidth = 10;
        this.gripperHeight = 40;
        this.maxSpeed = 5;
        this.visiblePipes = 6;
        this.maxPipes = 8; // Maximum number of pipes to keep in the game

        this.pipes = [];
        this.currentLevel = 0;
        this.isGameRunning = false;
        this.moveDirection = 1;
        this.currentSpeed = 1;
        this.currentPipe = null;
        this.gripper = null;
        this.animationId = null;
        this.isDropping = false;
        this.appearFromLeft = true; // Flag to track which side the pipe should appear from

        this.serverUrl = 'http://172.18.67.143:11452';
        this.GAME_ID = 'stackinggame';

        this.bindEvents();
        this.dropBtnContainer.classList.add('hidden'); // Hide drop button initially
        this.loadLeaderboard();
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startGame());
        this.dropBtn.addEventListener('click', () => this.dropPipe());
        this.restartBtn.addEventListener('click', () => this.restartGame());
        this.submitScoreBtn.addEventListener('click', () => this.submitScore());
    }

    startGame() {
        this.resetGame();
        this.isGameRunning = true;
        this.startBtn.classList.add('hidden');
        this.dropBtnContainer.classList.remove('hidden'); // Show drop button
        this.dropBtn.disabled = false;
        this.createNewPipe();
        this.animate();
    }

    resetGame() {
        this.pipes = [];
        this.currentLevel = 0;
        this.currentSpeed = 1;
        this.moveDirection = 1;
        this.levelDisplay.textContent = '0';
        this.gameArea.innerHTML = '';
        this.modal.style.display = 'none';
        this.isDropping = false;
        this.appearFromLeft = true;
        this.startBtn.classList.remove('hidden');
        this.dropBtnContainer.classList.add('hidden'); // Hide drop button
    }

    createNewPipe() {
        const pipeLength = this.pipes.length === 0 ? this.initialPipeLength : this.pipes[this.pipes.length - 1].offsetWidth;
        
        // Create gripper first
        this.gripper = document.createElement('div');
        this.gripper.className = 'gripper';
        this.gripper.style.left = `${pipeLength / 2 - this.gripperWidth / 2}px`;
        this.gripper.style.top = '0px';
        this.gameArea.appendChild(this.gripper);

        // Create pipe below the gripper
        const pipe = document.createElement('div');
        pipe.className = 'pipe';
        pipe.style.width = `${pipeLength}px`;
        pipe.style.height = `${this.pipeHeight}px`;
        
        // Set initial position based on appearFromLeft flag
        if (this.appearFromLeft) {
            pipe.style.left = '0px';
            this.moveDirection = 1; // Move right
        } else {
            pipe.style.left = `${this.gameWidth - pipeLength}px`;
            this.moveDirection = -1; // Move left
        }
        
        pipe.style.top = `${this.gripperHeight}px`;
        this.gameArea.appendChild(pipe);
        this.currentPipe = pipe;

        // Toggle the appearance side for next pipe
        this.appearFromLeft = !this.appearFromLeft;
    }

    animate() {
        if (!this.isGameRunning) return;

        if (!this.isDropping) {
            const currentLeft = parseFloat(this.currentPipe.style.left);
            const newLeft = currentLeft + this.currentSpeed * this.moveDirection;

            if (newLeft <= 0 || newLeft + this.currentPipe.offsetWidth >= this.gameWidth) {
                this.moveDirection *= -1;
            }

            this.currentPipe.style.left = `${newLeft}px`;
            this.gripper.style.left = `${newLeft + this.currentPipe.offsetWidth / 2 - this.gripperWidth / 2}px`;
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    async dropPipe() {
        if (!this.isGameRunning || this.isDropping) return;

        this.isDropping = true;
        const currentPipe = this.currentPipe;
        const currentLeft = parseFloat(currentPipe.style.left);
        const currentWidth = currentPipe.offsetWidth;
        // Calculate target position based on current number of pipes
        const targetY = this.gameHeight - (this.pipes.length + 1) * this.pipeHeight;

        // Calculate overlap with previous pipe
        let newWidth = currentWidth;
        let newLeft = currentLeft;
        let isGameOver = false;

        if (this.pipes.length > 0) {
            const lastPipe = this.pipes[this.pipes.length - 1];
            const lastLeft = parseFloat(lastPipe.style.left);
            const lastWidth = lastPipe.offsetWidth;

            const overlapLeft = Math.max(currentLeft, lastLeft);
            const overlapRight = Math.min(currentLeft + currentWidth, lastLeft + lastWidth);
            const overlap = overlapRight - overlapLeft;

            if (overlap <= 0) {
                isGameOver = true;
            } else {
                newWidth = overlap;
                newLeft = overlapLeft;
            }
        }

        // Animate pipe dropping
        const startY = this.gripperHeight;
        const duration = 500;
        const startTime = performance.now();

        const animateDrop = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease out cubic function for smooth deceleration
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            // Only move the pipe, keep gripper at top
            const newPipeY = startY + (targetY - startY) * easeProgress;
            
            // Update positions
            currentPipe.style.top = `${newPipeY}px`;
            this.gripper.style.top = '0px'; // Keep gripper at top

            if (progress < 1) {
                requestAnimationFrame(animateDrop);
            } else {
                // Animation complete
                currentPipe.style.width = `${newWidth}px`;
                currentPipe.style.left = `${newLeft}px`;
                currentPipe.style.top = `${targetY}px`;

                // Remove gripper
                this.gripper.remove();

                if (isGameOver) {
                    // Show game over after the pipe has finished dropping
                    this.gameOver();
                } else {
                    // Add to pipes array
                    this.pipes.push(currentPipe);
                    this.currentLevel++;
                    this.levelDisplay.textContent = this.currentLevel;

                    // Remove bottom pipe and move others down if we exceed the maximum number of pipes
                    if (this.pipes.length > this.maxPipes) {
                        // Remove the bottom pipe
                        const bottomPipe = this.pipes.shift();
                        bottomPipe.remove();

                        // Move all remaining pipes down by one level
                        this.pipes.forEach((pipe, index) => {
                            const newY = this.gameHeight - (index + 1) * this.pipeHeight;
                            pipe.style.top = `${newY}px`;
                        });
                    }

                    // Increase speed
                    this.currentSpeed = Math.min(this.maxSpeed, 1 + this.currentLevel * 0.2);

                    // Create new pipe
                    this.createNewPipe();
                    this.isDropping = false;

                    // Adjust view to show top pipes
                    if (this.currentLevel > this.visiblePipes) {
                        this.gameArea.scrollTop = (this.currentLevel - this.visiblePipes) * this.pipeHeight;
                    }
                }
            }
        };

        requestAnimationFrame(animateDrop);
    }

    async loadLeaderboard() {
        try {
            const response = await fetch(`${this.serverUrl}/scores?game=${this.GAME_ID}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const leaderboard = await response.json();
            this.leaderboardBody.innerHTML = '';
            
            if (!Array.isArray(leaderboard)) {
                console.error('排行榜数据格式错误:', leaderboard);
                return;
            }
            
            // Sort by score in descending order
            leaderboard.sort((a, b) => b.score - a.score);
            
            leaderboard.forEach((entry, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${entry.name}</td>
                    <td>${entry.score}</td>
                `;
                this.leaderboardBody.appendChild(row);
            });
        } catch (error) {
            console.error('加载排行榜时出错:', error);
            this.leaderboardBody.innerHTML = '<tr><td colspan="3">加载排行榜失败</td></tr>';
        }
    }

    async submitScore() {
        const name = this.playerNameInput.value.trim() || '匿名用户';
        const scoreData = {
            name: name,
            score: this.currentLevel,
            game: this.GAME_ID
        };
        
        try {
            const response = await fetch(`${this.serverUrl}/scores`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(scoreData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            await this.loadLeaderboard();
            this.modal.style.display = 'none';
            this.playerNameInput.value = '';
        } catch (error) {
            console.error('提交分数时出错:', error);
            alert('提交分数失败，请稍后重试');
        }
    }

    gameOver() {
        this.isGameRunning = false;
        cancelAnimationFrame(this.animationId);
        this.dropBtn.disabled = true;
        this.dropBtnContainer.classList.add('hidden'); // Hide drop button
        this.startBtn.classList.remove('hidden');
        this.finalScoreDisplay.textContent = this.currentLevel;
        this.modal.style.display = 'flex';
        this.playerNameInput.value = ''; // Clear the input field
    }

    restartGame() {
        this.startGame();
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new StackingGame();
}); 