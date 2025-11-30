// 创建模态框
const modal = document.createElement('div');
modal.className = 'modal';
modal.innerHTML = `
    <div class="modal-content">
        <h2>你的时间：<span id="timeResult"></span>秒</h2>
        <p>请输入你的名字：</p>
        <input type="text" id="playerName" placeholder="输入名字">
        <button id="submitScore">提交</button>
    </div>
`;
document.body.appendChild(modal);

// 获取DOM元素
const timerButton = document.getElementById('timerButton');
const leaderboardBody = document.getElementById('leaderboardBody');
const timeResult = document.getElementById('timeResult');
const playerNameInput = document.getElementById('playerName');
const submitScoreButton = document.getElementById('submitScore');

let startTime;
let isRunning = false;
const serverUrl = 'http://172.18.67.143:11452';
const GAME_ID = 'heartcounttime';

// 从服务器加载排行榜数据
async function loadLeaderboard() {
    try {
        console.log('正在加载排行榜数据...');
        const response = await fetch(`${serverUrl}/scores?game=${GAME_ID}`);
        console.log('服务器响应状态:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const leaderboard = await response.json();
        console.log('获取到的排行榜数据:', leaderboard);
        
        leaderboardBody.innerHTML = '';
        
        if (!Array.isArray(leaderboard)) {
            console.error('排行榜数据格式错误:', leaderboard);
            return;
        }
        
        leaderboard.sort((a, b) => {
            const errorA = Math.abs(a.score / 1000 - 10);
            const errorB = Math.abs(b.score / 1000 - 10);
            return errorA - errorB; // 误差小的排前面
        }); // 按误差升序
        
        leaderboard.forEach((entry, index) => {
            const timeSec = entry.score / 1000;
            const errorSec = Math.abs(timeSec - 10);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${entry.name}</td>
                <td>${timeSec.toFixed(3)}</td>
                <td>${errorSec.toFixed(3)}</td>
            `;
            leaderboardBody.appendChild(row);
        });
    } catch (error) {
        console.error('加载排行榜时出错:', error);
        leaderboardBody.innerHTML = '<tr><td colspan="4">加载排行榜失败</td></tr>';
    }
}

// 保存分数到服务器
async function saveScore(name, time) {
    const error = time - 10;
    const scoreData = {
        name: name || '匿名用户',
        score: Math.round(time * 1000), // 以毫秒整数保存
        game: GAME_ID
    };
    
    try {
        console.log('正在提交分数:', scoreData);
        const response = await fetch(`${serverUrl}/scores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(scoreData)
        });
        
        console.log('服务器响应状态:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('服务器响应:', result);
        
        await loadLeaderboard();
    } catch (error) {
        console.error('提交分数时出错:', error);
        alert('提交分数失败，请稍后重试');
    }
}

// 获取用户IP地址
async function getUserIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        return '未知用户';
    }
}

// 计时器按钮点击事件
timerButton.addEventListener('click', async () => {
    if (!isRunning) {
        // 开始计时
        startTime = Date.now();
        timerButton.textContent = 'Stop';
        timerButton.classList.add('stop');
        isRunning = true;
    } else {
        // 停止计时
        const endTime = Date.now();
        const timeElapsed = (endTime - startTime) / 1000;
        
        timerButton.textContent = 'Start';
        timerButton.classList.remove('stop');
        isRunning = false;
        
        // 显示结果
        timeResult.textContent = timeElapsed.toFixed(3);
        modal.style.display = 'flex';
    }
});

// 提交分数
submitScoreButton.addEventListener('click', async () => {
    const time = parseFloat(timeResult.textContent);
    let name = playerNameInput.value.trim();
    
    if (!name) {
        name = await getUserIP();
    }
    
    await saveScore(name, time);
    modal.style.display = 'none';
    playerNameInput.value = '';
});

// 初始加载排行榜
loadLeaderboard(); 