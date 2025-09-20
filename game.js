class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        this.add.text(400, 300, 'シューティングゲーム', { fontSize: '48px', fill: '#FFF' }).setOrigin(0.5);
        this.add.text(400, 400, 'クリックして開始', { fontSize: '24px', fill: '#FFF' }).setOrigin(0.5);

        this.input.once('pointerdown', () => {
            this.scene.start('GameScene');
        });
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        // --- Minimal Debug Version ---

        // 1. Create a texture for the player
        let g = this.make.graphics();
        g.fillStyle(0xffffff);
        g.fillRect(0, 0, 30, 40);
        g.generateTexture('player', 30, 40);
        g.destroy();

        // 2. Create the player sprite
        this.player = this.physics.add.sprite(400, 550, 'player');
        this.player.setCollideWorldBounds(true);

        // 3. Create input cursors
        this.cursors = this.input.keyboard.createCursorKeys();

        // 4. Add a simple text to confirm create() finished and what to do
        this.add.text(10, 10, 'デバッグバージョン：矢印キーで移動してください。', { fontSize: '16px', fill: '#FFF' });
    }

    update() {
        // 5. Handle player movement
        if (this.cursors && this.cursors.left.isDown) {
            this.player.setVelocityX(-350);
        } else if (this.cursors && this.cursors.right.isDown) {
            this.player.setVelocityX(350);
        } else {
            if (this.player && this.player.body) {
               this.player.setVelocityX(0);
            }
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#000',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }
        }
    },
    scene: [TitleScene, GameScene]
};

const game = new Phaser.Game(config);
