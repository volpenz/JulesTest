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
        // --- Procedural Textures ---
        this.createTexture('player', 0xffffff, 30, 40);
        this.createTexture('bullet', 0xffffff, 5, 20);
        this.createTexture('enemy', 0x00ff00, 40, 40);
        this.createTexture('boss', 0xff0000, 120, 100);
        this.createTexture('bossBullet', 0xff0000, 15, 15, true);
        this.createTexture('powerup', 0x0000ff, 30, 30, true);

        // --- Player ---
        this.player = this.physics.add.sprite(400, 550, 'player');
        this.player.setCollideWorldBounds(true);

        // --- Groups ---
        this.bullets = this.physics.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'bullet', maxSize: 50 });
        this.enemies = this.physics.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'enemy', maxSize: 50 });
        this.powerUps = this.physics.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'powerup', maxSize: 5 });
        this.bossBullets = this.physics.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'bossBullet', maxSize: 100 });

        // --- Spawners & UI ---
        const enemySpawnRate = Math.max(200, 1200 - (this.level * 100));
        this.enemySpawner = this.time.addEvent({ delay: enemySpawnRate, callback: this.spawnEnemy, callbackScope: this, loop: true });
        this.time.addEvent({ delay: 15000, callback: this.spawnPowerUp, callbackScope: this, loop: true });
        this.scoreText = this.add.text(16, 16, `Level: ${this.level}\nScore: ${this.score}`, { fontSize: '24px', fill: '#FFF' });
        this.levelText = this.add.text(400, 300, `ステージ ${this.level}`, { fontSize: '48px', fill: '#FFF' }).setOrigin(0.5);
        this.tweens.add({ targets: this.levelText, alpha: 0, duration: 2000, ease: 'Power2' });

        // --- Input & Collisions ---
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.physics.add.overlap(this.bullets, this.enemies, this.hitEnemy, null, this);
        this.physics.add.overlap(this.player, this.powerUps, this.collectPowerUp, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.playerHit, null, this);
    }

    update() {
        if (this.isGameOver) return;

        const bossTriggerScore = 200 + (this.level * 300);
        if (!this.bossActive && this.score >= bossTriggerScore) {
            this.spawnBoss();
        }

        if (this.player.active) {
            this.handlePlayerInput();
        }
        this.cleanup();
    }

    createTexture(key, color, width, height, isCircle = false) {
        if (this.textures.exists(key)) return;
        let g = this.make.graphics();
        g.fillStyle(color);
        if (isCircle) g.fillCircle(width / 2, width / 2, width / 2);
        else g.fillRect(0, 0, width, height);
        g.generateTexture(key, width, height);
        g.destroy();
    }

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
            if (group) {
                group.getChildren().forEach(child => {
                    if (child.active && !Phaser.Geom.Rectangle.Overlaps(this.physics.world.bounds, child.getBounds())) {
                        this.deactivate(child);
                    }
                });
            }
        });
    }

    handlePlayerInput() {
        if (this.cursors.left.isDown) this.player.setVelocityX(-350);
        else if (this.cursors.right.isDown) this.player.setVelocityX(350);
        else this.player.setVelocityX(0);

        if (Phaser.Input.Keyboard.JustDown(this.spacebar)) this.fireBullet();
    }

    fireBullet() {
        if (this.playerPowerUpLevel === 1) {
            [-100, 0, 100].forEach(vx => this.fireSingleBullet(this.player.x, this.player.y - 30, vx, -500 + Math.abs(vx)/2));
        } else {
            this.fireSingleBullet(this.player.x, this.player.y - 30, 0, -500);
        }
    }

    fireSingleBullet(x, y, vx, vy) {
        const bullet = this.bullets.get(x, y, 'bullet');
        if (bullet) {
            bullet.setActive(true).setVisible(true);
            bullet.body.setVelocity(vx, vy);
            bullet.body.setCollideWorldBounds(false);
        }
    }

    spawnEnemy() {
        const x = Phaser.Math.Between(20, 780);
        const enemy = this.enemies.get(x, -50, 'enemy');
        if (enemy) {
            enemy.setActive(true).setVisible(true);
            enemy.body.setVelocityY(100 + this.level * 10);
        }
    }

    spawnPowerUp() {
        const x = Phaser.Math.Between(50, 750);
        const powerUp = this.powerUps.get(x, -50, 'powerup');
        if (powerUp) {
            powerUp.setActive(true).setVisible(true);
            powerUp.body.setVelocityY(100);
        }
    }

    spawnBoss() {
        this.bossActive = true;
        this.enemySpawner.paused = true;
        this.enemies.clear(true, true);

        this.boss = this.physics.add.sprite(400, -150, 'boss');
        this.boss.health = 40 + (this.level * 10);
        this.boss.setCollideWorldBounds(true).setImmovable(true);

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
        if (!this.boss || !this.boss.active) return;
        const bullet = this.bossBullets.get(this.boss.x, this.boss.y + 70, 'bossBullet');
        if (bullet) {
            bullet.setActive(true).setVisible(true);
            this.physics.moveToObject(bullet, this.player, 200 + (this.level * 10));
        }
    }

    hitEnemy(bullet, enemy) {
        this.deactivate(bullet);
        this.deactivate(enemy);
        this.score += 10;
        this.scoreText.setText(`Level: ${this.level}\nScore: ${this.score}`);
    }

    hitBoss(boss, bullet) {
        this.deactivate(bullet);
        boss.health -= 1;

        boss.setTint(0x999999);
        this.time.delayedCall(100, () => boss.clearTint());

        if (boss.health <= 0) {
            this.deactivate(boss);
            if (this.bossAttackTimer) this.bossAttackTimer.remove();
            this.score += 1000;

            if (this.level === 5) {
                this.add.text(400, 300, 'ALL STAGES CLEAR! YOU WIN!', { fontSize: '32px', fill: '#0F0' }).setOrigin(0.5);
                this.physics.pause();
            } else {
                this.add.text(400, 300, 'STAGE CLEAR!', { fontSize: '48px', fill: '#0F0' }).setOrigin(0.5);
                this.time.delayedCall(3000, () => {
                    this.scene.restart({ level: this.level + 1, score: this.score });
                });
            }
        }
    }

    collectPowerUp(player, powerUp) {
        this.deactivate(powerUp);
        this.playerPowerUpLevel = 1;
        if (this.powerUpTimer) this.powerUpTimer.remove(false);
        this.powerUpTimer = this.time.delayedCall(10000, () => { this.playerPowerUpLevel = 0; }, [], this);
    }

    playerHit(player, projectile) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.physics.pause();
        this.deactivate(player);

        this.add.text(400, 300, 'GAME OVER', { fontSize: '64px', fill: '#F00' }).setOrigin(0.5);
        this.add.text(400, 400, 'クリックしてリトライ', { fontSize: '24px', fill: '#FFF' }).setOrigin(0.5);

        this.input.once('pointerdown', () => {
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
    scene: [TitleScene, GameScene]
};

const game = new Phaser.Game(config);
