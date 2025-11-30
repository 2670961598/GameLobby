class BalloonGame {
    constructor() {
        this.gameArea = document.querySelector('.game-area');
        this.startButton = document.querySelector('.start-button');
        this.scoreDisplay = document.querySelector('.score');
        this.timerDisplay = document.querySelector('.timer');
        this.playerNameInput = document.getElementById('playerName');
        this.leaderboardList = document.getElementById('leaderboardList');
        
        this.score = 0;
        this.timeLeft = 30;
        this.gameInterval = null;
        this.balloonInterval = null;
        this.speed = 2;
        this.isPlaying = false;
        
        this.operations = ['×2', '×3', '×5', '×10', '➗2', '➗3', '➗5', '➗10', '=0'];
        this.serverUrl = 'http://172.18.67.143:11452';
        
        this.init();
    }
    
    init() {
        this.startButton.addEventListener('click', () => this.startGame());
        this.loadLeaderboard();
    }
    
    startGame() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.score = 0;
        this.timeLeft = 30;
        this.speed = 2;
        this.updateScore();
        this.startButton.style.display = 'none';
        
        this.gameInterval = setInterval(() => {
            this.timeLeft--;
            this.timerDisplay.textContent = this.timeLeft;
            
            if (this.timeLeft <= 0) {
                this.endGame();
            }
        }, 1000);
        
        this.balloonInterval = setInterval(() => {
            const balloonCount = Math.floor(Math.random() * 2) + 3;
            for (let i = 0; i < balloonCount; i++) {
                setTimeout(() => {
                    this.createBalloon();
                }, i * 200);
            }
            this.speed += 0.1;
        }, 1000);
    }
    
    createBalloon() {
        const balloon = document.createElement('div');
        balloon.className = 'balloon';
        
        // Random position at bottom
        const x = Math.random() * (this.gameArea.offsetWidth - 60);
        balloon.style.left = `${x}px`;
        balloon.style.bottom = '-80px';
        
        // Random color
        const r = Math.floor(Math.random() * 150) + 50;
        const g = Math.floor(Math.random() * 150) + 50;
        const b = Math.floor(Math.random() * 150) + 50;
        balloon.style.backgroundColor = `rgb(${r},${g},${b})`;
        
        // Random content (number or operation)
        const isOperation = Math.random() < 0.3;
        if (isOperation) {
            balloon.textContent = this.operations[Math.floor(Math.random() * this.operations.length)];
        } else {
            const number = Math.floor(Math.random() * 199) - 99;
            balloon.textContent = number;
        }
        
        this.gameArea.appendChild(balloon);
        
        // Animate balloon
        const duration = 10000 / this.speed;
        balloon.style.transition = `bottom ${duration}ms linear`;
        
        requestAnimationFrame(() => {
            balloon.style.bottom = `${this.gameArea.offsetHeight}px`;
        });
        
        // Remove balloon when it reaches the top
        setTimeout(() => {
            if (balloon.parentNode === this.gameArea) {
                this.gameArea.removeChild(balloon);
            }
        }, duration);
        
        // Click handler
        balloon.addEventListener('click', () => {
            this.popBalloon(balloon);
        });
    }
    
    popBalloon(balloon) {
        // Create explosion effect
        const explosion = document.createElement('div');
        explosion.className = 'explosion';
        explosion.style.left = balloon.style.left;
        explosion.style.bottom = balloon.style.bottom;
        explosion.style.backgroundColor = balloon.style.backgroundColor;
        explosion.style.width = '60px';
        explosion.style.height = '60px';
        explosion.style.borderRadius = '50%';
        
        this.gameArea.appendChild(explosion);
        
        // Remove explosion after animation
        setTimeout(() => {
            if (explosion.parentNode === this.gameArea) {
                this.gameArea.removeChild(explosion);
            }
        }, 500);
        
        // Update score
        const content = balloon.textContent;
        if (content.startsWith('×')) {
            this.score *= parseInt(content.substring(1));
        } else if (content.startsWith('➗')) {
            this.score = Math.floor(this.score / parseInt(content.substring(1)));
        } else if (content === '=0') {
            this.score = 0;
        } else {
            this.score += parseInt(content);
        }
        
        this.updateScore();
        this.gameArea.removeChild(balloon);
    }
    
    updateScore() {
        this.scoreDisplay.textContent = `分数: ${this.score}`;
    }
    
    async endGame() {
        this.isPlaying = false;
        clearInterval(this.gameInterval);
        clearInterval(this.balloonInterval);
        this.startButton.style.display = 'block';
        
        // Remove all balloons
        const balloons = this.gameArea.querySelectorAll('.balloon');
        balloons.forEach(balloon => this.gameArea.removeChild(balloon));
        
        // Automatically submit score
        await this.submitScore();
    }
    
    async submitScore() {
        const playerName = this.playerNameInput.value.trim() || 'Anonymous';
        const score = this.score;
        
        try {
            const response = await fetch(`${this.serverUrl}/scores`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: playerName, score: score })
            });
            
            if (response.ok) {
                this.loadLeaderboard();
            }
        } catch (error) {
            console.error('Error submitting score:', error);
        }
    }
    
    async loadLeaderboard() {
        try {
            const response = await fetch(`${this.serverUrl}/scores`);
            const scores = await response.json();
            
            this.leaderboardList.innerHTML = scores
                .sort((a, b) => b.score - a.score)
                .slice(0, 10)
                .map((score, index) => `
                    <div class="leaderboard-item">
                        ${index + 1}. ${score.name}: ${score.score}
                    </div>
                `).join('');
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        }
    }
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
    new BalloonGame();
}); 