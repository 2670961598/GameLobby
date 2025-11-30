class ColorSystem {
    constructor(game) {
        this.game = game;
        this.scores = {
            green: 0,
            purple: 0,
            red: 0
        };
    }

    update() {
        // 遍历game.grid统计颜色
        let green = 0, purple = 0, red = 0, total = 0;
        for (let y = 0; y < this.game.gridHeight; y++) {
            for (let x = 0; x < this.game.gridWidth; x++) {
                const color = this.game.grid[y][x];
                if (color === 'green') green++;
                else if (color === 'purple') purple++;
                else if (color === 'red') red++;
                if (color) total++;
            }
        }
        if (total > 0) {
            this.scores.green = (green / total) * 100;
            this.scores.purple = (purple / total) * 100;
            this.scores.red = (red / total) * 100;
        } else {
            this.scores.green = this.scores.purple = this.scores.red = 0;
        }
        console.log('分数统计:', {green, purple, red, total, scores: {...this.scores}});
    }

    getScores() {
        return this.scores;
    }
} 