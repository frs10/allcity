// ===== GAME STATE =====
const GRID_WIDTH = 12;
const GRID_HEIGHT = 10;
const METRO_STATIONS = 10;
const WINNING_HEXES = 40;

const ACTIONS = {
    tag: { cost: 20, damage: 1, turns: 1, catchChance: 0.6 },
    throwup: { cost: 50, damage: 3, turns: 1, catchChance: 0.8 },
    burner: { cost: 150, damage: 10, turns: 2, catchChance: 0.95 }
};

const COLORS = ['#FF0066', '#00FF88', '#FFDD00', '#00BBFF', '#FF4400', '#AA00FF'];

let gameState = {
    gameCode: null,
    isHost: false,
    players: [],
    currentPlayerId: null,
    myPlayerId: null,
    hexGrid: [],
    policePosition: null,
    selectedHex: null,
    selectedAction: null,
    turnCount: 0,
    gameStarted: false,
    actionHistory: []
};

// ===== UTILITY FUNCTIONS =====
function generateGameCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getHexCoord(q, r) {
    return `${q},${r}`;
}

function getHexByCoord(q, r) {
    return gameState.hexGrid.find(h => h.q === q && h.r === r);
}

function getNeighborCoords(q, r) {
    const directions = [
        [+1, 0], [+1, -1], [0, -1],
        [-1, 0], [-1, +1], [0, +1]
    ];
    return directions.map(([dq, dr]) => [q + dq, r + dr])
        .filter(([nq, nr]) => {
            const hex = getHexByCoord(nq, nr);
            return hex !== undefined;
        });
}

function calculateIncome(playerId) {
    let income = 20; // Base income
    const playerHexes = gameState.hexGrid.filter(h => h.owner === playerId);

    playerHexes.forEach(hex => {
        if (hex.isMetro) {
            income += 15; // Metro station
        } else {
            income += 5; // Standard hex
        }
    });

    return income;
}

function addToFeed(message, type = 'normal') {
    const feedContent = document.getElementById('feed-content');
    const feedItem = document.createElement('div');
    feedItem.className = `feed-item ${type}`;
    feedItem.textContent = message;
    feedContent.insertBefore(feedItem, feedContent.firstChild);

    // Keep only last 50 items
    while (feedContent.children.length > 50) {
        feedContent.removeChild(feedContent.lastChild);
    }
}

function getPlayer(playerId) {
    return gameState.players.find(p => p.id === playerId);
}

function getCurrentPlayer() {
    return getPlayer(gameState.currentPlayerId);
}

function isMyTurn() {
    return gameState.currentPlayerId === gameState.myPlayerId;
}

// ===== HEX GRID INITIALIZATION =====
function initializeHexGrid() {
    const hexGrid = [];

    // Create hex grid
    for (let r = 0; r < GRID_HEIGHT; r++) {
        for (let q = 0; q < GRID_WIDTH; q++) {
            hexGrid.push({
                q, r,
                owner: null,
                damage: 0,
                isMetro: false
            });
        }
    }

    // Place metro stations randomly
    const positions = [...hexGrid];
    for (let i = 0; i < METRO_STATIONS; i++) {
        const idx = Math.floor(Math.random() * positions.length);
        positions[idx].isMetro = true;
        positions.splice(idx, 1);
    }

    // Assign random starting positions for each player
    gameState.players.forEach(player => {
        if (positions.length > 0) {
            const idx = Math.floor(Math.random() * positions.length);
            const startHex = positions[idx];
            startHex.owner = player.id;
            startHex.damage = 10;
            player.hexCount = 1;
            positions.splice(idx, 1);
        }
    });

    // Place police randomly
    if (positions.length > 0) {
        const policeIdx = Math.floor(Math.random() * positions.length);
        gameState.policePosition = {
            q: positions[policeIdx].q,
            r: positions[policeIdx].r
        };
    }

    gameState.hexGrid = hexGrid;
}

function renderHexGrid() {
    const board = document.getElementById('game-board');
    board.innerHTML = '';

    const hexSize = 80;
    const hexWidth = hexSize * 0.866;
    const hexHeight = hexSize;

    gameState.hexGrid.forEach(hex => {
        const hexEl = document.createElement('div');
        hexEl.className = 'hex';
        if (hex.isMetro) hexEl.classList.add('metro');

        // Mark my owned hexes
        if (hex.owner === gameState.myPlayerId) {
            hexEl.classList.add('my-hex');
        }

        // Mark actionable hexes (not owned by me)
        if (isMyTurn() && hex.owner !== gameState.myPlayerId) {
            hexEl.classList.add('actionable');
        }

        if (gameState.policePosition &&
            gameState.policePosition.q === hex.q &&
            gameState.policePosition.r === hex.r) {
            hexEl.classList.add('police-hex');
        }
        if (gameState.selectedHex &&
            gameState.selectedHex.q === hex.q &&
            gameState.selectedHex.r === hex.r) {
            hexEl.classList.add('selected');
        }

        // Calculate position (offset coordinates for isometric)
        const x = hexWidth * (hex.q + hex.r * 0.5);
        const y = hexHeight * 0.75 * hex.r;

        hexEl.style.left = x + 'px';
        hexEl.style.top = y + 'px';

        const hexInner = document.createElement('div');
        hexInner.className = 'hex-inner';

        const hexShape = document.createElement('div');
        hexShape.className = 'hex-shape';

        // Add owner color
        if (hex.owner) {
            const owner = getPlayer(hex.owner);
            if (owner) {
                const ownerDiv = document.createElement('div');
                ownerDiv.className = 'hex-owner';
                ownerDiv.style.background = owner.color;
                hexShape.appendChild(ownerDiv);
            }
        }

        // Add "YOU" marker for my hexes
        if (hex.owner === gameState.myPlayerId && hex.damage >= 10) {
            const youMarker = document.createElement('div');
            youMarker.className = 'hex-icon';
            youMarker.textContent = '⭐';
            youMarker.style.fontSize = '1.2rem';
            hexShape.appendChild(youMarker);
        }

        // Add metro icon
        if (hex.isMetro && !hex.owner) {
            const icon = document.createElement('div');
            icon.className = 'hex-icon';
            icon.textContent = '🚇';
            hexShape.appendChild(icon);
        }

        // Add police icon
        if (gameState.policePosition &&
            gameState.policePosition.q === hex.q &&
            gameState.policePosition.r === hex.r) {
            const icon = document.createElement('div');
            icon.className = 'hex-icon';
            icon.textContent = '🚔';
            hexShape.appendChild(icon);
        }

        // Add damage indicator
        if (hex.damage > 0 && hex.damage < 10) {
            const damageDiv = document.createElement('div');
            damageDiv.className = 'hex-damage';
            damageDiv.textContent = `${hex.damage}/10`;
            hexShape.appendChild(damageDiv);
        }

        hexInner.appendChild(hexShape);
        hexEl.appendChild(hexInner);

        // Click handler
        hexEl.addEventListener('click', () => handleHexClick(hex));

        board.appendChild(hexEl);
    });
}

function handleHexClick(hex) {
    if (!isMyTurn()) {
        addToFeed('Det er ikke din tur!', 'normal');
        return;
    }

    const me = getPlayer(gameState.myPlayerId);
    if (me.bustedTurns > 0) {
        addToFeed('Du er busted og kan ikke spille!', 'normal');
        return;
    }

    gameState.selectedHex = hex;
    updateHexInfo(hex);
    renderHexGrid();
}

function updateHexInfo(hex) {
    const hexDetails = document.getElementById('hex-details');

    if (!hex) {
        hexDetails.innerHTML = 'Klik på en hex...';
        return;
    }

    let html = `<div class="info-line"><strong>Koordinat:</strong> (${hex.q}, ${hex.r})</div>`;
    html += `<div class="info-line"><strong>Type:</strong> ${hex.isMetro ? '🚇 Metro Station' : 'Standard'}</div>`;
    html += `<div class="info-line"><strong>Damage:</strong> ${hex.damage}/10</div>`;

    if (hex.owner) {
        const owner = getPlayer(hex.owner);
        html += `<div class="info-line"><strong>Ejer:</strong> <span style="color: ${owner.color}">${owner.name}</span></div>`;
    } else {
        html += `<div class="info-line"><strong>Ejer:</strong> Ingen</div>`;
    }

    if (hex.isMetro) {
        html += `<div class="info-line" style="color: #00FF88"><strong>Indkomst:</strong> +15 points/tur</div>`;
    } else {
        html += `<div class="info-line"><strong>Indkomst:</strong> +5 points/tur</div>`;
    }

    hexDetails.innerHTML = html;
}

// ===== ACTION HANDLING =====
function setupActionButtons() {
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            selectAction(action);
        });
    });
}

function selectAction(action) {
    if (!isMyTurn()) {
        addToFeed('Det er ikke din tur!', 'normal');
        return;
    }

    const me = getPlayer(gameState.myPlayerId);
    if (!me) {
        console.error('Could not find player:', gameState.myPlayerId);
        return;
    }

    if (me.bustedTurns > 0) {
        addToFeed('Du er busted!', 'normal');
        return;
    }

    const actionData = ACTIONS[action];
    if (me.points < actionData.cost) {
        addToFeed(`Ikke nok points! Du har ${me.points}, men ${action.toUpperCase()} koster ${actionData.cost}`, 'normal');
        return;
    }

    gameState.selectedAction = action;

    // Update button states
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.querySelector(`[data-action="${action}"]`).classList.add('selected');

    // If hex is selected, try to execute
    if (gameState.selectedHex) {
        executeAction();
    }
}

function executeAction() {
    if (!gameState.selectedHex || !gameState.selectedAction) {
        addToFeed('Vælg både en hex og en aktion!', 'normal');
        return;
    }

    const hex = gameState.selectedHex;
    const action = gameState.selectedAction;
    const actionData = ACTIONS[action];
    const me = getPlayer(gameState.myPlayerId);

    // Check if player has enough points
    if (me.points < actionData.cost) {
        addToFeed('Ikke nok points!', 'normal');
        return;
    }

    // Check if hex is owned by me (can't attack own hex)
    if (hex.owner === gameState.myPlayerId) {
        addToFeed('Du kan ikke angribe din egen hex!', 'normal');
        return;
    }

    // Deduct points
    me.points -= actionData.cost;

    // Apply damage
    hex.damage += actionData.damage;

    // Check if hex is captured
    let captured = false;
    let beefAlert = false;
    let previousOwner = hex.owner;

    if (hex.damage >= 10) {
        if (hex.owner && hex.owner !== gameState.myPlayerId) {
            // Beef!
            beefAlert = true;
            const victim = getPlayer(hex.owner);
            victim.hexCount--;
            showBeefAlert(me.name, victim.name, hex);
        }

        hex.owner = gameState.myPlayerId;
        hex.damage = 10;
        me.hexCount++;
        captured = true;
    }

    // Log action
    const actionName = action === 'tag' ? 'TAG' : action === 'throwup' ? 'THROW-UP' : 'BURNER';
    let feedMessage = `${me.name} brugte ${actionName} på (${hex.q}, ${hex.r})`;
    if (captured) {
        feedMessage += ` og indtog hex!`;
    }
    addToFeed(feedMessage, beefAlert ? 'beef' : 'normal');

    // Store action in history (for potential bust rollback)
    gameState.actionHistory.push({
        playerId: me.id,
        turn: gameState.turnCount,
        hexCoord: getHexCoord(hex.q, hex.r),
        damage: actionData.damage,
        captured: captured,
        previousOwner: previousOwner
    });

    // Check for police catch
    const onPoliceHex = gameState.policePosition.q === hex.q &&
                        gameState.policePosition.r === hex.r;

    if (onPoliceHex) {
        const catchRoll = Math.random();
        if (catchRoll < actionData.catchChance) {
            handleBusted(me);
            updateUI();
            return; // Don't advance turn yet
        } else {
            addToFeed(`${me.name} undslap politiet!`, 'normal');
        }
    }

    // Check for win condition
    if (me.hexCount >= WINNING_HEXES) {
        showVictory(me);
        return;
    }

    // Move police
    movePolice();

    // Clear selection
    gameState.selectedHex = null;
    gameState.selectedAction = null;

    // Handle burner (2 turns)
    if (action === 'burner') {
        me.burnerTurnsLeft = 2;
    }

    if (me.burnerTurnsLeft) {
        me.burnerTurnsLeft--;
        if (me.burnerTurnsLeft > 0) {
            // Still doing burner, don't advance turn
            addToFeed(`${me.name} fortsætter BURNER (${me.burnerTurnsLeft} tur tilbage)`, 'normal');
            updateUI();
            return;
        }
    }

    // Advance to next turn
    nextTurn();
}

function handleBusted(player) {
    addToFeed(`${player.name} blev BUSTED af politiet!`, 'busted');

    // Show busted overlay
    showBustedOverlay(player);

    // Set busted turns
    player.bustedTurns = 5;

    // Rollback last 5 turns of actions
    const cutoffTurn = gameState.turnCount - 5;
    gameState.actionHistory.forEach(action => {
        if (action.playerId === player.id && action.turn > cutoffTurn) {
            const [q, r] = action.hexCoord.split(',').map(Number);
            const hex = getHexByCoord(q, r);
            if (hex) {
                if (action.captured) {
                    // Revert capture
                    hex.owner = action.previousOwner;
                    hex.damage = Math.max(0, hex.damage - action.damage);
                    player.hexCount--;

                    if (action.previousOwner) {
                        const prevOwner = getPlayer(action.previousOwner);
                        if (prevOwner) prevOwner.hexCount++;
                    }
                } else {
                    // Just remove damage
                    hex.damage = Math.max(0, hex.damage - action.damage);
                }
            }
        }
    });

    // Remove old actions from history
    gameState.actionHistory = gameState.actionHistory.filter(a =>
        a.playerId !== player.id || a.turn <= cutoffTurn
    );
}

function showBustedOverlay(player) {
    const overlay = document.getElementById('busted-overlay');
    const message = document.getElementById('busted-message');
    const countdown = document.getElementById('busted-countdown');

    message.textContent = `${player.name} blev fanget af politiet!`;
    countdown.textContent = `Ude i ${player.bustedTurns} ture`;

    overlay.classList.remove('hidden');
    overlay.classList.add('active');

    setTimeout(() => {
        overlay.classList.remove('active');
        overlay.classList.add('hidden');
        nextTurn();
    }, 3000);
}

function showBeefAlert(attacker, victim, hex) {
    const alert = document.getElementById('beef-alert');
    const message = document.getElementById('beef-message');

    message.innerHTML = `<span style="color: ${getPlayer(gameState.myPlayerId).color}">${attacker}</span> startede BEEF med <span style="color: ${getPlayer(victim).color}">${victim}</span> over hex (${hex.q}, ${hex.r})!`;

    alert.classList.remove('hidden');

    setTimeout(() => {
        alert.classList.add('hidden');
    }, 3000);
}

function movePolice() {
    const current = gameState.policePosition;
    const neighbors = getNeighborCoords(current.q, current.r);

    if (neighbors.length === 0) return;

    // 70% random, 30% toward recent activity
    const roll = Math.random();

    if (roll < 0.7 || gameState.actionHistory.length === 0) {
        // Random movement
        const [nq, nr] = neighbors[Math.floor(Math.random() * neighbors.length)];
        gameState.policePosition = { q: nq, r: nr };
    } else {
        // Move toward last action
        const lastAction = gameState.actionHistory[gameState.actionHistory.length - 1];
        const [targetQ, targetR] = lastAction.hexCoord.split(',').map(Number);

        // Find neighbor closest to target
        let closest = neighbors[0];
        let minDist = Math.abs(closest[0] - targetQ) + Math.abs(closest[1] - targetR);

        neighbors.forEach(([nq, nr]) => {
            const dist = Math.abs(nq - targetQ) + Math.abs(nr - targetR);
            if (dist < minDist) {
                minDist = dist;
                closest = [nq, nr];
            }
        });

        gameState.policePosition = { q: closest[0], r: closest[1] };
    }

    const policePos = document.getElementById('police-position');
    policePos.textContent = `Hex (${gameState.policePosition.q}, ${gameState.policePosition.r})`;
}

function nextTurn() {
    // Find next player who is not busted
    let nextPlayerIndex = gameState.players.findIndex(p => p.id === gameState.currentPlayerId);
    let attempts = 0;

    do {
        nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
        attempts++;

        if (attempts > gameState.players.length) {
            // All players are busted? Just advance normally
            break;
        }
    } while (gameState.players[nextPlayerIndex].bustedTurns > 0);

    const nextPlayer = gameState.players[nextPlayerIndex];
    gameState.currentPlayerId = nextPlayer.id;
    gameState.turnCount++;

    // Decrease busted turns for all players
    gameState.players.forEach(p => {
        if (p.bustedTurns > 0) {
            p.bustedTurns--;
            if (p.bustedTurns === 0) {
                addToFeed(`${p.name} er tilbage i spillet!`, 'normal');
            }
        }
    });

    // Give income to current player
    nextPlayer.points += calculateIncome(nextPlayer.id);

    updateUI();
}

// ===== UI UPDATES =====
function updateUI() {
    updateScoreboard();
    updateResources();
    updateCurrentTurnDisplay();
    renderHexGrid();
    updateActionButtons();
}

function updateScoreboard() {
    const scoresDiv = document.getElementById('player-scores');
    scoresDiv.innerHTML = '';

    // Sort by hex count
    const sorted = [...gameState.players].sort((a, b) => b.hexCount - a.hexCount);

    sorted.forEach(player => {
        const item = document.createElement('div');
        item.className = 'score-item';
        item.style.borderLeftColor = player.color;

        if (player.id === gameState.currentPlayerId) {
            item.classList.add('active');
        }

        if (player.bustedTurns > 0) {
            item.classList.add('busted');
        }

        const colorDiv = document.createElement('div');
        colorDiv.className = 'score-color';
        colorDiv.style.background = player.color;

        const nameDiv = document.createElement('div');
        nameDiv.className = 'score-name';
        nameDiv.textContent = player.name;

        if (player.bustedTurns > 0) {
            nameDiv.textContent += ` (BUSTED ${player.bustedTurns})`;
        }

        const hexDiv = document.createElement('div');
        hexDiv.className = 'score-hexes';
        hexDiv.textContent = `${player.hexCount} hex`;

        item.appendChild(colorDiv);
        item.appendChild(nameDiv);
        item.appendChild(hexDiv);

        scoresDiv.appendChild(item);
    });
}

function updateResources() {
    const me = getPlayer(gameState.myPlayerId);
    if (!me) return;

    document.getElementById('player-points').textContent = me.points;
    document.getElementById('player-hexes').textContent = me.hexCount;
    document.getElementById('player-income').textContent = '+' + calculateIncome(me.id);
}

function updateCurrentTurnDisplay() {
    const current = getCurrentPlayer();
    if (!current) return;

    const nameSpan = document.getElementById('current-player-name');
    nameSpan.textContent = current.name;
    nameSpan.style.color = current.color;

    const display = document.getElementById('current-turn-display');
    display.style.borderColor = current.color;
    display.style.background = `${current.color}22`;
}

function updateActionButtons() {
    const me = getPlayer(gameState.myPlayerId);
    const myTurn = isMyTurn();
    const busted = me && me.bustedTurns > 0;

    document.querySelectorAll('.action-btn').forEach(btn => {
        const cost = parseInt(btn.dataset.cost);
        const canAfford = me && me.points >= cost;

        // Visual feedback instead of disabling
        if (!myTurn || busted || !canAfford) {
            btn.style.opacity = '0.5';
        } else {
            btn.style.opacity = '1';
        }

        // Keep buttons enabled so they can show feedback messages
        btn.disabled = false;
    });
}

// ===== VICTORY =====
function showVictory(winner) {
    const victoryScreen = document.getElementById('victory-screen');
    const winnerDisplay = document.getElementById('winner-display');
    const statsDisplay = document.getElementById('victory-stats');

    winnerDisplay.innerHTML = `<span style="color: ${winner.color}; font-size: 2.5rem;">${winner.name}</span><br>ER ALL CITY KING!`;

    // Calculate stats
    const actions = gameState.actionHistory.filter(a => a.playerId === winner.id);
    const tags = actions.filter(a => a.damage === 1).length;
    const throwups = actions.filter(a => a.damage === 3).length;
    const burners = actions.filter(a => a.damage === 10).length;

    statsDisplay.innerHTML = `
        <div>Total Hex: ${winner.hexCount}</div>
        <div>Tags: ${tags}</div>
        <div>Throw-ups: ${throwups}</div>
        <div>Burners: ${burners}</div>
    `;

    victoryScreen.classList.add('active');
}

// ===== LOBBY & MULTIPLAYER =====
function setupLobby() {
    document.getElementById('host-btn').addEventListener('click', () => {
        document.querySelector('.lobby-options').style.display = 'none';
        document.getElementById('host-panel').classList.remove('hidden');
    });

    document.getElementById('join-btn').addEventListener('click', () => {
        document.querySelector('.lobby-options').style.display = 'none';
        document.getElementById('join-panel').classList.remove('hidden');
    });

    // Color selection for host
    document.querySelectorAll('#host-panel .color-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#host-panel .color-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            document.getElementById('host-selected-color').style.background = btn.dataset.color;
        });
    });

    document.getElementById('create-game-btn').addEventListener('click', createGame);
    document.getElementById('connect-btn').addEventListener('click', joinGame);
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('confirm-crew-btn').addEventListener('click', confirmCrew);
    document.getElementById('new-game-btn').addEventListener('click', () => location.reload());
}

function createGame() {
    const crewName = document.getElementById('host-crew-name').value.trim();
    const selectedColor = document.querySelector('#host-panel .color-option.selected');

    if (!crewName) {
        alert('Indtast et crew navn!');
        return;
    }

    if (!selectedColor) {
        alert('Vælg en farve!');
        return;
    }

    gameState.isHost = true;
    gameState.gameCode = generateGameCode();
    gameState.myPlayerId = 'player1';

    const hostPlayer = {
        id: 'player1',
        name: crewName,
        color: selectedColor.dataset.color,
        points: 100,
        hexCount: 0,
        bustedTurns: 0,
        burnerTurnsLeft: 0
    };

    gameState.players = [hostPlayer];

    document.getElementById('host-panel').classList.add('hidden');
    document.getElementById('waiting-room').classList.remove('hidden');
    document.getElementById('game-code-display').textContent = gameState.gameCode;
    document.getElementById('waiting-game-code').textContent = gameState.gameCode;

    updatePlayersList();

    // Show start button when 2+ players
    if (gameState.players.length >= 2) {
        document.getElementById('start-game-btn').classList.remove('hidden');
    }
}

function joinGame() {
    const code = document.getElementById('join-code-input').value.trim();

    if (!code || code.length !== 6) {
        alert('Indtast en gyldig 6-cifret kode!');
        return;
    }

    // In a real implementation, this would connect to a server
    // For now, simulate with localStorage
    gameState.gameCode = code;
    gameState.isHost = false;

    document.getElementById('join-panel').classList.add('hidden');
    document.getElementById('crew-setup-panel').classList.remove('hidden');

    // Show available colors
    showAvailableColors();
}

function showAvailableColors() {
    const container = document.getElementById('available-colors');
    container.innerHTML = '';

    // In real implementation, get used colors from server
    const usedColors = gameState.players.map(p => p.color);

    COLORS.forEach(color => {
        const btn = document.createElement('button');
        btn.className = 'color-option';
        btn.dataset.color = color;
        btn.style.background = color;

        if (usedColors.includes(color)) {
            btn.classList.add('disabled');
            btn.disabled = true;
        }

        btn.addEventListener('click', () => {
            document.querySelectorAll('#available-colors .color-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });

        container.appendChild(btn);
    });
}

function confirmCrew() {
    const crewName = document.getElementById('crew-name-input').value.trim();
    const selectedColor = document.querySelector('#available-colors .color-option.selected');

    if (!crewName) {
        alert('Indtast et crew navn!');
        return;
    }

    if (!selectedColor) {
        alert('Vælg en farve!');
        return;
    }

    gameState.myPlayerId = 'player' + (gameState.players.length + 1);

    const newPlayer = {
        id: gameState.myPlayerId,
        name: crewName,
        color: selectedColor.dataset.color,
        points: 100,
        hexCount: 0,
        bustedTurns: 0,
        burnerTurnsLeft: 0
    };

    gameState.players.push(newPlayer);

    document.getElementById('crew-setup-panel').classList.add('hidden');
    document.getElementById('waiting-room').classList.remove('hidden');
    document.getElementById('waiting-game-code').textContent = gameState.gameCode;

    updatePlayersList();
}

function updatePlayersList() {
    const list = document.getElementById('players-list');
    list.innerHTML = '';

    gameState.players.forEach(player => {
        const item = document.createElement('div');
        item.className = 'player-item';

        const colorDiv = document.createElement('div');
        colorDiv.className = 'player-color';
        colorDiv.style.background = player.color;

        const nameDiv = document.createElement('div');
        nameDiv.className = 'player-name';
        nameDiv.textContent = player.name;

        item.appendChild(colorDiv);
        item.appendChild(nameDiv);

        list.appendChild(item);
    });

    if (gameState.isHost && gameState.players.length >= 2) {
        document.getElementById('start-game-btn').classList.remove('hidden');
    }
}

function startGame() {
    if (gameState.players.length < 2) {
        alert('Mindst 2 spillere krævet!');
        return;
    }

    gameState.gameStarted = true;
    gameState.currentPlayerId = gameState.players[0].id;

    initializeHexGrid();

    document.getElementById('lobby-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');

    addToFeed('Spillet starter! Tag over byen!', 'normal');

    updateUI();
}

// ===== DEMO MODE (for testing without multiplayer) =====
function startDemoGame() {
    // Create 3 AI players for demo
    gameState.players = [
        {
            id: 'player1',
            name: 'BRONX KINGS',
            color: '#FF0066',
            points: 100,
            hexCount: 0,
            bustedTurns: 0,
            burnerTurnsLeft: 0
        },
        {
            id: 'player2',
            name: 'QUEENS CREW',
            color: '#00FF88',
            points: 100,
            hexCount: 0,
            bustedTurns: 0,
            burnerTurnsLeft: 0
        },
        {
            id: 'player3',
            name: 'BROOKLYN BOMBERS',
            color: '#FFDD00',
            points: 100,
            hexCount: 0,
            bustedTurns: 0,
            burnerTurnsLeft: 0
        }
    ];

    gameState.myPlayerId = 'player1';
    gameState.currentPlayerId = 'player1';
    gameState.gameStarted = true;
    gameState.gameCode = 'DEMO';

    initializeHexGrid();

    document.getElementById('lobby-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');

    addToFeed('DEMO MODE - Tag over byen!', 'normal');

    updateUI();
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    setupLobby();
    setupActionButtons();

    // For testing: Start demo game automatically after 2 seconds if no action
    setTimeout(() => {
        if (!gameState.gameStarted && gameState.players.length === 0) {
            console.log('Starting demo game...');
            startDemoGame();
        }
    }, 2000);
});
