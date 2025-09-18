class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        // --- Display Loading Bar ---
        let progressBar = this.add.graphics();
        let progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(240, 270, 320, 50);

        let width = this.cameras.main.width;
        let height = this.cameras.main.height;
        let loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: 'Loading...',
            style: {
                font: '20px monospace',
                fill: '#ffffff'
            }
        }).setOrigin(0.5);

        this.load.on('progress', function (value) {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(250, 280, 300 * value, 30);
        });

        this.load.on('complete', function () {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
        });

        // --- Load Assets ---
        // (The user needs to provide these assets in an 'assets' folder)
        this.load.image('background', 'assets/darkPurple.png');
        this.load.image('player', 'assets/playerShip1_blue.png');
        this.load.image('bullet', 'assets/laserBlue01.png');
        this.load.image('enemy', 'assets/enemyRed1.png');
        this.load.image('boss', 'assets/enemyBlack5.png');
        this.load.image('powerup', 'assets/powerupBlue_bolt.png');
        this.load.spritesheet('explosion', 'assets/explosion.png', { frameWidth: 16, frameHeight: 16 });

        this.load.audio('sfx_laser', 'assets/sfx_laser1.ogg');
        this.load.audio('sfx_explosion', 'assets/sfx_explosion.ogg');
        this.load.audio('sfx_powerup', 'assets/sfx_powerup.ogg');
        this.load.audio('bgm', 'assets/bgm.ogg');
    }

    create() {
        // --- Create Animations ---
        this.anims.create({
            key: 'explode',
            frames: this.anims.generateFrameNumbers('explosion', { start: 0, end: 15 }),
            frameRate: 24,
            repeat: 0,
            hideOnComplete: true
        });

        this.scene.start('TitleScene');
    }
}


class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        this.add.text(400, 300, 'シューティングゲーム', { fontSize: '48px', fill: '#FFF' }).setOrigin(0.5);
        this.add.text(400, 400, 'クリックして開始', { fontSize: '24px', fill: '#FFF' }).setOrigin(0.5);

        this.input.once('pointerdown', () => {
            this.scene.start('GameScene', { level: 1, score: 0 });
        });
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        this.level = data.level;
        this.score = data.score;
        this.playerPowerUpLevel = 0;
        this.bossActive = false;
        this.isGameOver = false;
    }

    create() {
        // --- Background ---
        this.background = this.add.tileSprite(400, 300, 800, 600, 'background');

        // --- Sound ---
        this.sfx = {
            laser: this.sound.add('sfx_laser'),
            explosion: this.sound.add('sfx_explosion'),
            powerup: this.sound.add('sfx_powerup')
        };
        if (!this.sound.get('bgm_music')) {
            let music = this.sound.add('bgm', { loop: true, volume: 0.5 });
            music.play();
        }

        // --- Player ---
        this.player = this.physics.add.sprite(400, 550, 'player').setScale(0.7);
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(this.player.width * 0.8, this.player.height * 0.8);

        // --- Groups ---
        this.bullets = this.physics.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'bullet', maxSize: 50 });
        this.enemies = this.physics.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'enemy', maxSize: 50 });
        this.powerUps = this.physics.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'powerup', maxSize: 5 });
        this.bossBullets = this.physics.add.group({ classType: Phaser.GameObjects.Sprite, maxSize: 100 });
        this.explosions = this.physics.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'explosion', maxSize: 50 });

        // --- Spawners & UI ---
        const enemySpawnRate = Math.max(200, 1200 - (this.level * 100));
        this.enemySpawner = this.time.addEvent({ delay: enemySpawnRate, callback: this.spawnEnemy, callbackScope: this, loop: true });
        this.time.addEvent({ delay: 15000, callback: this.spawnPowerUp, callbackScope: this, loop: true });
        this.scoreText = this.add.text(16, 16, `Level: ${this.level}\nScore: ${this.score}`, { fontSize: '24px', fill: '#FFF' });
        this.levelText = this.add.text(400, 300, `ステージ ${this.level}`, { fontSize: '48px', fill: '#FFF' }).setOrigin(0.5);
        this.tweens.add({ targets: this.levelText, alpha: 0, duration: 2000 });

        // --- Input & Collisions ---
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.physics.add.overlap(this.bullets, this.enemies, this.hitEnemy, null, this);
        this.physics.add.overlap(this.player, this.powerUps, this.collectPowerUp, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.playerHit, null, this);
    }

    update() {
        if (this.isGameOver) return;
        this.background.tilePositionY -= 0.5;

        const bossTriggerScore = 200 + (this.level * 300);
        if (!this.bossActive && this.score >= bossTriggerScore) this.spawnBoss();

        this.handlePlayerInput();
        this.cleanup();
    }

    // --- Helper Functions ---
    deactivate(gameObject) {
        if (!gameObject) return;
        gameObject.setActive(false).setVisible(false);
        if (gameObject.body) {
            gameObject.body.stop();
            gameObject.x = -200;
        }
    }

    cleanup() {
        [this.bullets, this.enemies, this.powerUps, this.bossBullets].forEach(group => {
            group.getChildren().forEach(child => {
                if (child.active && !Phaser.Geom.Rectangle.Overlaps(this.physics.world.bounds, child.getBounds())) {
                    this.deactivate(child);
                }
            });
        });
    }

    playExplosion(x, y) {
        let explosion = this.explosions.get(x, y, 'explosion');
        if (explosion) {
            explosion.setActive(true).setVisible(true).setScale(3).play('explode');
            this.sfx.explosion.play({volume: 0.5});
            explosion.on('animationcomplete', () => this.deactivate(explosion));
        }
    }

    // --- Input & Spawning ---
    handlePlayerInput() {
        if (this.cursors.left.isDown) this.player.setVelocityX(-350);
        else if (this.cursors.right.isDown) this.player.setVelocityX(350);
        else this.player.setVelocityX(0);

        if (Phaser.Input.Keyboard.JustDown(this.spacebar)) this.fireBullet();
    }

    fireBullet() {
        this.sfx.laser.play({volume: 0.3});
        if (this.playerPowerUpLevel === 1) {
            [-100, 0, 100].forEach(vx => this.fireSingleBullet(this.player.x, this.player.y - 30, vx, -500 + Math.abs(vx)/2));
        } else {
            this.fireSingleBullet(this.player.x, this.player.y - 30, 0, -500);
        }
    }

    fireSingleBullet(x, y, vx, vy) {
        const bullet = this.bullets.get(x, y, 'bullet');
        if (bullet) bullet.setActive(true).setVisible(true).setVelocity(vx, vy).setAngle(vx/10).body.setCollideWorldBounds(false);
    }

    spawnEnemy() {
        const x = Phaser.Math.Between(20, 780);
        const enemy = this.enemies.get(x, -50, 'enemy');
        if (enemy) enemy.setActive(true).setVisible(true).setVelocityY(100 + this.level * 10).setScale(0.8);
    }

    spawnPowerUp() {
        const x = Phaser.Math.Between(50, 750);
        const powerUp = this.powerUps.get(x, -50, 'powerup');
        if (powerUp) powerUp.setActive(true).setVisible(true).setVelocityY(100);
    }

    spawnBoss() {
        this.bossActive = true;
        this.enemySpawner.paused = true;
        this.enemies.clear(true, true);

        this.boss = this.physics.add.sprite(400, -150, 'boss');
        this.boss.health = 40 + (this.level * 10);
        this.boss.setCollideWorldBounds(true).setImmovable(true);
        this.boss.body.setSize(this.boss.width * 0.9, this.boss.height * 0.9);

        this.physics.add.overlap(this.player, this.boss, this.playerHit, null, this);
        this.physics.add.overlap(this.bullets, this.boss, this.hitBoss, null, this);
        this.physics.add.overlap(this.player, this.bossBullets, this.playerHit, null, this);

        this.tweens.add({
            targets: this.boss, y: 150, duration: 2000, ease: 'Power2',
            onComplete: () => {
                this.tweens.add({ targets: this.boss, x: 700, duration: 3000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
                const fireRate = Math.max(500, 2500 - (this.level * 250));
                this.bossAttackTimer = this.time.addEvent({ delay: fireRate, callback: this.bossFire, callbackScope: this, loop: true });
            }
        });
    }

    bossFire() {
        if (!this.boss.active) return;
        const bullet = this.bossBullets.get(this.boss.x, this.boss.y + 70, 'bullet');
        if (bullet) {
            bullet.setActive(true).setVisible(true).setScale(1.5).setTint(0xff8888);
            this.physics.moveToObject(bullet, this.player, 200 + (this.level * 10));
        }
    }

    // --- Collision Handlers ---
    hitEnemy(bullet, enemy) {
        this.playExplosion(enemy.x, enemy.y);
        this.deactivate(bullet);
        this.deactivate(enemy);
        this.score += 10;
        this.scoreText.setText(`Level: ${this.level}\nScore: ${this.score}`);
    }

    hitBoss(boss, bullet) {
        this.playExplosion(bullet.x, bullet.y);
        this.deactivate(bullet);
        boss.health -= 1;

        boss.setTint(0xff9999);
        this.time.delayedCall(100, () => boss.clearTint());

        if (boss.health <= 0) {
            this.playExplosion(boss.x, boss.y);
            this.deactivate(boss);
            if (this.bossAttackTimer) this.bossAttackTimer.remove();
            this.score += 1000;

            if (this.level === 5) {
                this.add.text(400, 300, 'ALL STAGES CLEAR! YOU WIN!', { fontSize: '32px', fill: '#0F0' }).setOrigin(0.5);
                this.physics.pause();
                this.sound.stopAll();
            } else {
                this.add.text(400, 300, 'STAGE CLEAR!', { fontSize: '48px', fill: '#0F0' }).setOrigin(0.5);
                this.time.delayedCall(3000, () => {
                    this.scene.restart({ level: this.level + 1, score: this.score });
                });
            }
        }
    }

    collectPowerUp(player, powerUp) {
        this.sfx.powerup.play();
        this.deactivate(powerUp);
        this.playerPowerUpLevel = 1;
        if (this.powerUpTimer) this.powerUpTimer.remove(false);
        this.powerUpTimer = this.time.delayedCall(10000, () => { this.playerPowerUpLevel = 0; }, [], this);
    }

    playerHit(player, projectile) {
        if (this.isGameOver) return;
        this.playExplosion(player.x, player.y);
        this.isGameOver = true;
        this.physics.pause();
        player.setTint(0xff0000);

        this.add.text(400, 300, 'GAME OVER', { fontSize: '64px', fill: '#F00' }).setOrigin(0.5);
        this.add.text(400, 400, 'クリックしてリトライ', { fontSize: '24px', fill: '#FFF' }).setOrigin(0.5);

        this.input.once('pointerdown', () => {
            this.sound.stopAll();
            this.scene.start('TitleScene');
        });
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
    scene: [PreloadScene, TitleScene, GameScene]
};

const game = new Phaser.Game(config);
