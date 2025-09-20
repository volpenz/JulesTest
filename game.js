class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        this.add.text(this.scale.width / 2, this.scale.height / 2 - 50, 'シューティングゲーム', { fontSize: '48px', fill: '#FFF' }).setOrigin(0.5);
        this.add.text(this.scale.width / 2, this.scale.height / 2 + 50, 'クリックして開始', { fontSize: '24px', fill: '#FFF' }).setOrigin(0.5);

        this.input.once('pointerdown', () => {
            this.scene.start('GameScene', { level: 1, score: 0, lives: 5 });
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
        this.lives = data.lives;

        this.playerPowerUpType = 'none';
        this.bossActive = false;
        this.isGameOver = false;
    }

    create() {
        // --- Textures ---
        this.createTexture('player', 0xffffff, 30, 40);
        this.createTexture('bullet', 0xffffff, 5, 20);
        this.createTexture('enemy', 0x00ff00, 40, 40);
        this.createTexture('enemyBullet', 0xff8800, 10, 10, true);
        this.createTexture('boss', 0xff0000, 120, 100);
        this.createTexture('bossBullet', 0xff0000, 15, 15, true);
        this.createTexture('powerup_triple', 0x0000ff, 30, 30, true);
        this.createTexture('powerup_big', 0xffff00, 30, 30, false);

        // --- Player ---
        this.player = this.physics.add.sprite(this.scale.width / 2, this.scale.height - 100, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.isInvincible = false;

        // --- Groups ---
        this.bullets = this.physics.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'bullet', maxSize: 50 });
        this.enemies = this.physics.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'enemy', maxSize: 50 });
        this.enemyBullets = this.physics.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'enemyBullet', maxSize: 100 });
        this.powerUps = this.physics.add.group({ classType: Phaser.GameObjects.Sprite, maxSize: 5 });
        this.bossBullets = this.physics.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'bossBullet', maxSize: 100 });

        // --- UI ---
        this.scoreText = this.add.text(16, 16, `Score: ${this.score}`, { fontSize: '24px', fill: '#FFF' });
        this.livesText = this.add.text(16, 50, `Lives: ${this.lives}`, { fontSize: '24px', fill: '#FFF' });
        this.levelText = this.add.text(this.scale.width / 2, this.scale.height / 2, `ステージ ${this.level}`, { fontSize: '48px', fill: '#FFF' }).setOrigin(0.5);
        this.tweens.add({ targets: this.levelText, alpha: 0, duration: 2000, ease: 'Power2' });

        // --- Input & Collisions ---
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.physics.add.overlap(this.bullets, this.enemies, this.hitEnemy, null, this);
        this.physics.add.overlap(this.player, this.powerUps, this.collectPowerUp, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.playerHit, null, this);
        this.physics.add.overlap(this.player, this.enemyBullets, this.playerHit, null, this);

        // --- Timers ---
        const enemySpawnRate = Math.max(200, 1200 - (this.level * 100));
        this.enemySpawner = this.time.addEvent({ delay: enemySpawnRate, callback: this.spawnEnemy, callbackScope: this, loop: true });
        this.time.addEvent({ delay: 10000, callback: this.spawnPowerUp, callbackScope: this, loop: true });
    }

    update() {
        if (this.isGameOver) return;
        const bossTriggerScore = 200 + (this.level * 300);
        if (!this.bossActive && this.score >= bossTriggerScore) this.spawnBoss();
        if (this.player.active) this.handlePlayerInput();
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
        if (gameObject.fireTimer) gameObject.fireTimer.remove(false);
        gameObject.setActive(false).setVisible(false);
        if (gameObject.body) {
            gameObject.body.stop();
            gameObject.x = -200;
        }
    }

    cleanup() {
        [this.bullets, this.enemies, this.powerUps, this.bossBullets, this.enemyBullets].forEach(group => {
            if (group) group.getChildren().forEach(child => {
                if (child.active && (child.y > this.scale.height + 100 || child.y < -100)) this.deactivate(child);
            });
        });
    }

    handlePlayerInput() {
        if (this.cursors.left.isDown) this.player.setVelocityX(-400);
        else if (this.cursors.right.isDown) this.player.setVelocityX(400);
        else this.player.setVelocityX(0);
        if (Phaser.Input.Keyboard.JustDown(this.spacebar)) this.fireBullet();
    }

    fireBullet() {
        let bullet;
        if (this.playerPowerUpType === 'triple') {
            [-100, 0, 100].forEach(vx => this.fireSingleBullet(this.player.x, this.player.y - 30, vx, -600));
        } else if (this.playerPowerUpType === 'big') {
            bullet = this.fireSingleBullet(this.player.x, this.player.y - 30, 0, -600);
            if (bullet) bullet.setScale(2.5, 2.5);
        } else {
            bullet = this.fireSingleBullet(this.player.x, this.player.y - 30, 0, -600);
            if (bullet) bullet.setScale(1, 1);
        }
    }

    fireSingleBullet(x, y, vx, vy) {
        const bullet = this.bullets.get(x, y, 'bullet');
        if (bullet) {
            bullet.setActive(true).setVisible(true);
            bullet.body.setVelocity(vx, vy);
        }
        return bullet;
    }

    spawnEnemy() {
        const x = Phaser.Math.Between(50, this.scale.width - 50);
        const enemy = this.enemies.get(x, -50, 'enemy');
        if (enemy) {
            enemy.setActive(true).setVisible(true);
            enemy.body.setVelocityY(150 + this.level * 10);
            enemy.fireTimer = this.time.addEvent({
                delay: 2000,
                callback: () => { if (enemy.active) this.enemyFire(enemy); },
                loop: true
            });
        }
    }

    enemyFire(enemy) {
        const bullet = this.enemyBullets.get(enemy.x, enemy.y + 20, 'enemyBullet');
        if (bullet) {
            bullet.setActive(true).setVisible(true);
            bullet.body.setVelocityY(350);
        }
    }

    spawnPowerUp() {
        const x = Phaser.Math.Between(50, this.scale.width - 50);
        const type = Phaser.Math.RND.pick(['triple', 'big']);
        const textureKey = `powerup_${type}`;
        const powerUp = this.powerUps.get(x, -50, textureKey);
        if (powerUp) {
            powerUp.powerUpType = type;
            powerUp.setActive(true).setVisible(true);
            powerUp.body.setVelocityY(100);
        }
    }

    spawnBoss() {
        this.bossActive = true;
        this.enemySpawner.paused = true;
        this.enemies.clear(true, true);
        this.boss = this.physics.add.sprite(this.scale.width / 2, -150, 'boss');
        this.boss.health = 40 + (this.level * 10);
        this.boss.maxHealth = this.boss.health;
        this.boss.setCollideWorldBounds(true).setImmovable(true);
        this.physics.add.overlap(this.player, this.boss, this.playerHit, null, this);
        this.physics.add.overlap(this.bullets, this.boss, this.hitBoss, null, this);
        this.physics.add.overlap(this.player, this.bossBullets, this.playerHit, null, this);

        // Create Boss Health Bar
        const barWidth = this.scale.width * 0.8;
        this.bossHealthBarBG = this.add.graphics().fillStyle(0x800000).fillRect(0, 0, barWidth, 20);
        this.bossHealthBar = this.add.graphics().fillStyle(0x00ff00).fillRect(0, 0, barWidth, 20);
        this.bossHealthBarContainer = this.add.container((this.scale.width - barWidth) / 2, 30, [this.bossHealthBarBG, this.bossHealthBar]);

        this.tweens.add({
            targets: this.boss, y: 150, duration: 2000, ease: 'Power2',
            onComplete: () => {
                this.tweens.add({ targets: this.boss, x: this.scale.width - 100, duration: 3000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
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
            this.physics.moveToObject(bullet, this.player, 250 + (this.level * 10));
        }
    }

    hitEnemy(bullet, enemy) {
        this.deactivate(bullet);
        this.deactivate(enemy);
        this.score += 10;
        this.scoreText.setText(`Score: ${this.score}`);
    }

    hitBoss(boss, bullet) {
        this.deactivate(bullet);
        boss.health -= 1;
        boss.setTint(0x999999);
        this.time.delayedCall(100, () => boss.clearTint());

        // Update health bar
        const healthPercentage = boss.health / boss.maxHealth;
        this.bossHealthBar.setScale(healthPercentage, 1);

        if (boss.health <= 0) {
            this.deactivate(boss);
            if (this.bossAttackTimer) this.bossAttackTimer.remove();
            if (this.bossHealthBarContainer) this.bossHealthBarContainer.destroy();
            this.score += 1000;
            if (this.level === 5) {
                this.add.text(this.scale.width / 2, this.scale.height / 2, 'ALL STAGES CLEAR! YOU WIN!', { fontSize: '40px', fill: '#0F0' }).setOrigin(0.5);
                this.physics.pause();
            } else {
                this.add.text(this.scale.width / 2, this.scale.height / 2, 'STAGE CLEAR!', { fontSize: '48px', fill: '#0F0' }).setOrigin(0.5);
                this.time.delayedCall(3000, () => {
                    this.scene.restart({ level: this.level + 1, score: this.score, lives: this.lives });
                });
            }
        }
    }

    collectPowerUp(player, powerUp) {
        this.deactivate(powerUp);
        this.playerPowerUpType = powerUp.powerUpType;
        if (this.powerUpTimer) this.powerUpTimer.remove(false);
        this.powerUpTimer = this.time.delayedCall(10000, () => { this.playerPowerUpType = 'none'; }, [], this);
    }

    playerHit(player, projectile) {
        if (player.isInvincible) return;
        this.deactivate(projectile);
        this.lives--;
        this.livesText.setText(`Lives: ${this.lives}`);
        if (this.lives <= 0) {
            this.isGameOver = true;
            this.physics.pause();
            this.deactivate(player);
            if (this.bossHealthBarContainer) this.bossHealthBarContainer.destroy();
            this.add.text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER', { fontSize: '64px', fill: '#F00' }).setOrigin(0.5);
            this.add.text(this.scale.width / 2, this.scale.height / 2 + 60, 'クリックしてリトライ', { fontSize: '24px', fill: '#FFF' }).setOrigin(0.5);
            this.input.once('pointerdown', () => this.scene.start('TitleScene'));
        } else {
            player.isInvincible = true;
            this.tweens.add({
                targets: player, alpha: 0.5, duration: 200, ease: 'Sine.easeInOut', yoyo: true, repeat: 5,
                onComplete: () => {
                    player.alpha = 1;
                    player.isInvincible = false;
                }
            });
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: 600,
    height: 900,
    parent: 'game-container',
    backgroundColor: '#000',
    physics: { default: 'arcade', arcade: { gravity: { y: 0 } } },
    scene: [TitleScene, GameScene]
};

const game = new Phaser.Game(config);
