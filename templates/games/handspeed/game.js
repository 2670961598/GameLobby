document.addEventListener('DOMContentLoaded', () => {
    const clickButton = document.querySelector('.click-button');
    const ripple = document.querySelector('.ripple');
    const clickCountElement = document.getElementById('clickCount');
    const timeLeftElement = document.getElementById('timeLeft');
    
    let clickCount = 0;
    let timeLeft = 10;
    let gameStarted = false;
    let timer = null;
    
    function startGame() {
        if (!gameStarted) {
            gameStarted = true;
            timer = setInterval(() => {
                timeLeft--;
                timeLeftElement.textContent = timeLeft;
                
                if (timeLeft <= 0) {
                    endGame();
                }
            }, 1000);
        }
    }
    
    function endGame() {
        clearInterval(timer);
        const clicksPerSecond = (clickCount / 10).toFixed(2);
        alert(`手速：${clicksPerSecond}次/秒`);
        
        // Reset game
        clickCount = 0;
        timeLeft = 10;
        gameStarted = false;
        clickCountElement.textContent = clickCount;
        timeLeftElement.textContent = timeLeft;
    }
    
    function animateRipple() {
        ripple.classList.remove('active');
        // Force reflow
        void ripple.offsetWidth;
        ripple.classList.add('active');
    }
    
    clickButton.addEventListener('click', () => {
        startGame();
        clickCount++;
        clickCountElement.textContent = clickCount;
        animateRipple();
    });
}); 