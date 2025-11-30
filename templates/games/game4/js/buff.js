// 新Buff实现：明显可见、发光动画、5秒自动消失
class Buff {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.game = game;
        this.createdAt = performance.now();
        this.duration = 5000; // 5秒
        // 创建明显可见的DOM元素
        this.element = document.createElement('div');
        this.element.className = 'buff-new';
        this.game.buffLayer.appendChild(this.element);
        this.updatePosition();
    }
    updatePosition() {
        this.element.style.left = (this.x - 20) + 'px';
        this.element.style.top = (this.y - 20) + 'px';
    }
    isExpired() {
        return performance.now() - this.createdAt >= this.duration;
    }
    remove() {
        if (this.element && this.element.parentElement) {
            console.log('[Buff.remove] 移除buff element:', this.element);
            const playerElement = document.getElementById('player');
            console.log('[Buff.remove] 当前主角element:', playerElement);
            this.element.remove();
        }
    }
} 