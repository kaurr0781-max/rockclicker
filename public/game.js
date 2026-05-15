class RockClickerGame {
    constructor() {
        this.playerId = this.generatePlayerId();
        this.gameState = null;
        this.perSecondValue = 0;
        this.tickInterval = null;
        this.autoSaveInterval = null;
        
        this.init();
    }

    generatePlayerId() {
        // Generate unique ID for this session
        let id = localStorage.getItem('rockClickerId');
        if (!id) {
            id = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('rockClickerId', id);
        }
        return id;
    }

    async init() {
        // Load game state from server
        await this.loadGameState();
        this.setupEventListeners();
        this.startGameLoop();
        this.updateUI();
    }

    async loadGameState() {
        try {
            const response = await fetch(`/api/game/${this.playerId}`);
            this.gameState = await response.json();
        } catch (error) {
            console.error('Failed to load game state:', error);
        }
    }

    setupEventListeners() {
        // Rock button click
        document.getElementById('rockButton').addEventListener('click', (e) => this.clickRock(e));

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Building purchases
        document.querySelectorAll('.buy-btn:not(.upgrade-buy)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const building = e.currentTarget.dataset.building;
                this.buyBuilding(building);
            });
        });

        // Upgrade purchases
        document.querySelectorAll('.upgrade-buy').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const upgrade = e.currentTarget.dataset.upgrade;
                this.buyUpgrade(upgrade);
            });
        });
    }

    async clickRock(event) {
        try {
            const response = await fetch(`/api/game/${this.playerId}/click`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            this.gameState = data.state;
            this.updateUI();
            this.floatingText(event.clientX, event.clientY);
        } catch (error) {
            console.error('Click failed:', error);
        }
    }

    async buyBuilding(buildingType) {
        try {
            const response = await fetch(`/api/game/${this.playerId}/buy-building`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ buildingType })
            });
            const data = await response.json();
            
            if (data.success) {
                this.gameState = data.state;
                this.updateUI();
            } else {
                this.showNotification(data.error || 'Purchase failed');
            }
        } catch (error) {
            console.error('Building purchase failed:', error);
        }
    }

    async buyUpgrade(upgradeType) {
        try {
            const response = await fetch(`/api/game/${this.playerId}/buy-upgrade`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ upgradeType })
            });
            const data = await response.json();
            
            if (data.success) {
                this.gameState = data.state;
                this.updateUI();
                this.showNotification('Upgrade purchased! 🎉');
            } else {
                this.showNotification(data.error || 'Purchase failed');
            }
        } catch (error) {
            console.error('Upgrade purchase failed:', error);
        }
    }

    startGameLoop() {
        // Tick every 100ms
        this.tickInterval = setInterval(() => this.gameTick(), 100);
        
        // Auto-save every 10 seconds
        this.autoSaveInterval = setInterval(() => this.saveGameState(), 10000);
    }

    async gameTick() {
        try {
            const response = await fetch(`/api/game/${this.playerId}/tick`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            this.gameState = data.state;
            this.updateUI();
        } catch (error) {
            console.error('Game tick failed:', error);
        }
    }

    async saveGameState() {
        try {
            await fetch(`/api/game/${this.playerId}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('Save failed:', error);
        }
    }

    updateUI() {
        if (!this.gameState) return;

        // Update rock count
        document.getElementById('rockCount').textContent = this.formatNumber(this.gameState.rocks);
        document.getElementById('totalEarned').textContent = this.formatNumber(this.gameState.totalRocksEarned);
        document.getElementById('clickCount').textContent = this.gameState.clickCount;

        // Update multiplier display
        document.getElementById('multiplierDisplay').textContent = `×${this.gameState.rockPerClick.toFixed(1)}`;

        // Calculate and display per second
        let incomePerSec = 0;
        for (const building in this.gameState.buildings) {
            const b = this.gameState.buildings[building];
            incomePerSec += b.owned * b.income;
        }
        document.getElementById('perSecond').textContent = this.formatNumber(incomePerSec);

        // Update building displays
        for (const building in this.gameState.buildings) {
            const b = this.gameState.buildings[building];
            const owned = document.getElementById(`${building}-owned`);
            if (owned) owned.textContent = b.owned;

            // Update button costs and states
            const btn = document.querySelector(`[data-building="${building}"]`);
            if (btn) {
                const cost = b.cost * Math.pow(1.15, b.owned);
                btn.querySelector('.cost').textContent = this.formatNumber(Math.ceil(cost));
                btn.disabled = this.gameState.rocks < cost;
            }
        }

        // Update upgrade buttons
        for (const upgrade in this.gameState.upgrades) {
            const upg = this.gameState.upgrades[upgrade];
            const btn = document.querySelector(`[data-upgrade="${upgrade}"]`);
            if (btn) {
                if (upg.purchased) {
                    btn.textContent = '✓ Purchased';
                    btn.disabled = true;
                    btn.style.background = '#ccc';
                } else {
                    btn.querySelector('.cost').textContent = upg.cost;
                    btn.disabled = this.gameState.rocks < upg.cost;
                }
            }
        }
    }

    switchTab(tabName) {
        // Deactivate all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Activate selected tab
        document.getElementById(`${tabName}-tab`).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    formatNumber(num) {
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return Math.floor(num).toString();
    }

    floatingText(x, y) {
        const text = document.createElement('div');
        text.textContent = `+${this.gameState.rockPerClick.toFixed(1)}`;
        text.style.position = 'fixed';
        text.style.left = x + 'px';
        text.style.top = y + 'px';
        text.style.pointerEvents = 'none';
        text.style.fontSize = '24px';
        text.style.fontWeight = 'bold';
        text.style.color = '#f5576c';
        text.style.textShadow = '0 2px 4px rgba(0,0,0,0.3)';
        text.style.animation = 'popUp 0.6s ease-out forwards';
        document.body.appendChild(text);
        setTimeout(() => text.remove(), 600);
    }

    showNotification(message) {
        // Simple notification (can be enhanced)
        alert(message);
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new RockClickerGame();
});
