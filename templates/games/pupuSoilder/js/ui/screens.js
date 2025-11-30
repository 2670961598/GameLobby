/**
 * 界面屏幕管理系统
 * 处理游戏的各种界面状态转换和用户交互
 */

class ScreenManager {
    constructor() {
        // 界面元素
        this.startScreen = null;
        this.endScreen = null;
        this.currentScreen = null;
        
        // 按钮元素
        this.startButton = null;
        this.restartButton = null;
        this.homeButton = null;
        
        // 结束界面元素
        this.resultTitle = null;
        this.finalScores = null;
        
        // 回调函数
        this.onStartGame = null;
        this.onRestartGame = null;
        this.onReturnHome = null;
        
        this.initializeElements();
        this.bindEvents();
    }
    
    /**
     * 初始化界面元素
     */
    initializeElements() {
        // 获取主要界面
        this.startScreen = document.getElementById('start-screen');
        this.endScreen = document.getElementById('end-screen');
        
        // 获取按钮
        this.startButton = document.getElementById('start-button');
        this.restartButton = document.getElementById('restart-button');
        this.homeButton = document.getElementById('home-button');
        
        // 获取结束界面元素
        this.resultTitle = document.getElementById('result-title');
        this.finalScores = document.getElementById('final-scores');
        
        // 验证元素存在性
        if (!this.startScreen || !this.endScreen) {
            console.error('关键界面元素未找到');
        }
        
        // 设置初始界面
        this.currentScreen = 'start';
        this.showStartScreen();
    }
    
    /**
     * 绑定按钮事件
     */
    bindEvents() {
        // 开始游戏按钮
        if (this.startButton) {
            this.startButton.addEventListener('click', () => {
                this.handleStartGame();
            });
        }
        
        // 重新开始按钮
        if (this.restartButton) {
            this.restartButton.addEventListener('click', () => {
                this.handleRestartGame();
            });
        }
        
        // 返回主页按钮
        if (this.homeButton) {
            this.homeButton.addEventListener('click', () => {
                this.handleReturnHome();
            });
        }
        
        // 键盘事件（只用回车键，避免与游戏内空格键冲突）
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Enter') {
                if (this.currentScreen === 'start') {
                    this.handleStartGame();
                    e.preventDefault();
                } else if (this.currentScreen === 'end') {
                    this.handleRestartGame();
                    e.preventDefault();
                }
            }
        });
    }
    
    /**
     * 显示开始界面
     */
    showStartScreen() {
        this.hideAllScreens();
        
        if (this.startScreen) {
            this.startScreen.classList.add('active');
        }
        
        this.currentScreen = 'start';
        
        // 聚焦到开始按钮以便键盘操作
        if (this.startButton) {
            setTimeout(() => {
                this.startButton.focus();
            }, 100);
        }
    }
    
    /**
     * 显示结束界面
     * @param {Array<number>} scores - 最终比分 [空, 绿, 紫, 红]
     * @param {string} winner - 获胜者 ('player', 'ai-purple', 'ai-red', 'tie')
     */
    showEndScreen(scores, winner) {
        this.hideAllScreens();
        
        if (this.endScreen) {
            this.endScreen.classList.add('active');
        }
        
        this.currentScreen = 'end';
        
        // 更新结果显示
        this.updateEndScreenContent(scores, winner);
        
        // 聚焦到重新开始按钮
        if (this.restartButton) {
            setTimeout(() => {
                this.restartButton.focus();
            }, 100);
        }
    }
    
    /**
     * 隐藏所有界面
     */
    hideAllScreens() {
        const screens = [this.startScreen, this.endScreen];
        
        for (const screen of screens) {
            if (screen) {
                screen.classList.remove('active');
            }
        }
    }
    
    /**
     * 更新结束界面内容
     * @param {Array<number>} scores - 最终比分
     * @param {string} winner - 获胜者
     */
    updateEndScreenContent(scores, winner) {
        // 更新标题
        this.updateResultTitle(winner);
        
        // 更新比分显示
        this.updateFinalScores(scores, winner);
    }
    
    /**
     * 更新结果标题
     * @param {string} winner - 获胜者
     */
    updateResultTitle(winner) {
        if (!this.resultTitle) return;
        
        let title = '';
        let titleClass = '';
        
        switch (winner) {
            case 'player':
                title = '胜利！';
                titleClass = 'victory';
                this.resultTitle.style.color = '#AFE59B'; // 绿色
                break;
            case 'ai-purple':
                title = '失败';
                titleClass = 'defeat';
                this.resultTitle.style.color = '#7B75D3'; // 紫色
                break;
            case 'ai-red':
                title = '失败';
                titleClass = 'defeat';
                this.resultTitle.style.color = '#E37A80'; // 红色
                break;
            case 'tie':
                title = '平局';
                titleClass = 'tie';
                this.resultTitle.style.color = '#cccccc'; // 灰色
                break;
            default:
                title = '游戏结束';
                titleClass = 'default';
                this.resultTitle.style.color = '#ffffff';
        }
        
        this.resultTitle.textContent = title;
        this.resultTitle.className = titleClass;
    }
    
    /**
     * 更新最终比分显示
     * @param {Array<number>} scores - 比分数组
     * @param {string} winner - 获胜者
     */
    updateFinalScores(scores) {
        if (!this.finalScores) return;
        
        const scoreElements = this.finalScores.querySelectorAll('.final-score');
        
        // 更新各颜色的比分
        if (scoreElements.length >= 3) {
            // 绿色（玩家）
            const greenPercent = scoreElements[0].querySelector('.color-percent');
            if (greenPercent) {
                greenPercent.textContent = `${scores[1]}%`;
            }
            
            // 紫色（AI）
            const purplePercent = scoreElements[1].querySelector('.color-percent');
            if (purplePercent) {
                purplePercent.textContent = `${scores[2]}%`;
            }
            
            // 红色（AI）
            const redPercent = scoreElements[2].querySelector('.color-percent');
            if (redPercent) {
                redPercent.textContent = `${scores[3]}%`;
            }
        }
        
        // 高亮获胜者分数
        this.highlightWinnerScore(scores);
    }
    
    /**
     * 高亮获胜者分数
     * @param {Array<number>} scores - 比分数组
     */
    highlightWinnerScore(scores) {
        const scoreElements = this.finalScores?.querySelectorAll('.final-score');
        if (!scoreElements) return;
        
        // 找出最高分
        const maxScore = Math.max(scores[1], scores[2], scores[3]);
        
        scoreElements.forEach((element, index) => {
            element.classList.remove('winner');
            
            // 比较对应的分数（index 0,1,2 对应 scores[1,2,3]）
            if (scores[index + 1] === maxScore && maxScore > 0) {
                element.classList.add('winner');
            }
        });
    }
    
    /**
     * 处理开始游戏
     */
    handleStartGame() {
        // 添加点击反馈
        if (this.startButton) {
            this.startButton.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.startButton.style.transform = '';
            }, 100);
        }
        
        // 调用回调函数
        if (this.onStartGame) {
            this.onStartGame();
        }
        
        // 隐藏开始界面
        this.hideAllScreens();
    }
    
    /**
     * 处理重新开始游戏
     */
    handleRestartGame() {
        // 添加点击反馈
        if (this.restartButton) {
            this.restartButton.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.restartButton.style.transform = '';
            }, 100);
        }
        
        // 调用回调函数
        if (this.onRestartGame) {
            this.onRestartGame();
        }
        
        // 隐藏结束界面
        this.hideAllScreens();
    }
    
    /**
     * 处理返回主页
     */
    handleReturnHome() {
        // 添加点击反馈
        if (this.homeButton) {
            this.homeButton.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.homeButton.style.transform = '';
            }, 100);
        }
        
        // 调用回调函数
        if (this.onReturnHome) {
            this.onReturnHome();
        } else {
            // 默认行为：显示开始界面
            this.showStartScreen();
        }
    }
    
    /**
     * 设置回调函数
     * @param {Function} onStartGame - 开始游戏回调
     * @param {Function} onRestartGame - 重新开始回调
     * @param {Function} onReturnHome - 返回主页回调
     */
    setCallbacks(onStartGame, onRestartGame, onReturnHome) {
        this.onStartGame = onStartGame;
        this.onRestartGame = onRestartGame;
        this.onReturnHome = onReturnHome;
    }
    
    /**
     * 检查当前是否在游戏中（没有界面显示）
     * @returns {boolean} 是否在游戏中
     */
    isInGame() {
        return this.currentScreen === null || this.currentScreen === 'hidden';
    }
    
    /**
     * 显示暂停界面（如果需要的话）
     */
    showPauseScreen() {
        // 这里可以实现暂停界面逻辑
        // 当前设计中没有暂停功能，但预留接口
    }
    
    /**
     * 获取当前界面状态
     * @returns {string} 当前界面名称
     */
    getCurrentScreen() {
        return this.currentScreen;
    }
    
    /**
     * 重置界面管理器
     */
    reset() {
        this.hideAllScreens();
        this.showStartScreen();
    }
    
    /**
     * 设置界面可见性
     * @param {boolean} visible - 是否可见
     */
    setVisible(visible) {
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.style.display = visible ? 'block' : 'none';
        }
    }
}

/**
 * 确定获胜者的工具函数
 * @param {Array<number>} scores - 比分数组 [空, 绿, 紫, 红]
 * @returns {string} 获胜者标识
 */
function determineWinner(scores) {
    const playerScore = scores[1];      // 绿色（玩家）
    const aiPurpleScore = scores[2];    // 紫色（AI）
    const aiRedScore = scores[3];       // 红色（AI）
    
    const maxScore = Math.max(playerScore, aiPurpleScore, aiRedScore);
    
    // 检查是否有平局
    const winners = [];
    if (playerScore === maxScore) winners.push('player');
    if (aiPurpleScore === maxScore) winners.push('ai-purple');
    if (aiRedScore === maxScore) winners.push('ai-red');
    
    if (winners.length > 1) {
        return 'tie'; // 平局
    }
    
    return winners[0]; // 唯一获胜者
}

// 导出到全局
window.ScreenManager = ScreenManager;
window.determineWinner = determineWinner; 