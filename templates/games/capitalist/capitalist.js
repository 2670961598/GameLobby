class CapitalistGame {
    constructor() {
        this.gameContainer = document.querySelector('.game-container');
        this.startScreen = document.querySelector('.start-screen');
        this.gameScreen = document.querySelector('.game-screen');
        this.startButton = document.querySelector('.start-button');
        this.housesContainer = document.querySelector('.houses-container');
        this.progressBar = document.querySelector('.progress-bar');
        this.statusText = document.querySelector('.status-text');
        
        this.statusMessages = [
            "正在准备资金布局",
            "正在分析市场",
            "正在调动资金",
            "正在操纵舆论",
            "正在启动收割程序",
            "正在实施最终计划",
            "做局即将完成"
        ];
        
        this.init();
    }
    
    init() {
        this.startButton.addEventListener('click', () => this.startGame());
    }
    
    startGame() {
        // 隐藏开始界面，显示游戏界面
        this.startScreen.style.display = 'none';
        this.gameScreen.style.display = 'flex';
        
        // 创建房子
        this.createHouses();
        
        // 开始进度条
        this.startProgress();
    }
    
    createHouses() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeead', '#ff9999', '#99b898'];
        const containerWidth = this.housesContainer.offsetWidth;
        const containerHeight = this.housesContainer.offsetHeight;
        const houseSize = 60;
        const housesPerRow = Math.floor(containerWidth / (houseSize * 1.5));
        const rows = Math.floor(containerHeight / (houseSize * 1.5));
        
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < housesPerRow; j++) {
                const house = document.createElement('div');
                house.className = 'house';
                house.style.left = `${j * houseSize * 1.5}px`;
                house.style.top = `${i * houseSize * 1.5}px`;
                house.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                this.housesContainer.appendChild(house);
            }
        }
    }
    
    startProgress() {
        const duration = 15000; // 15秒
        const interval = 100; // 更新间隔
        const steps = duration / interval;
        const increment = 100 / steps;
        let currentStep = 0;
        
        const progressInterval = setInterval(() => {
            currentStep++;
            const progress = Math.min(currentStep * increment, 100);
            this.progressBar.style.width = `${progress}%`;
            
            // 更新状态文本
            const messageIndex = Math.floor(progress / (100 / (this.statusMessages.length - 1)));
            if (messageIndex < this.statusMessages.length) {
                this.statusText.textContent = this.statusMessages[messageIndex];
            }
            
            if (progress >= 100) {
                clearInterval(progressInterval);
                this.showResult();
            }
        }, interval);
    }
    
    showResult() {
        const modal = document.getElementById('resultModal');
        modal.style.display = 'flex';
    }
}

// 初始化游戏
window.addEventListener('load', () => {
    new CapitalistGame();
}); 