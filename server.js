const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

let lobbies = {};

function generateLobbyCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    if (lobbies[code]) {
        return generateLobbyCode();
    }

    return code;
}

function broadcastToLobby(lobbyCode, message) {
    const lobby = lobbies[lobbyCode];
    if (!lobby) return;

    lobby.players.forEach(player => {
        if (player.socket && player.socket.readyState === WebSocket.OPEN) {
            player.socket.send(JSON.stringify(message));
        }
    });
}

function generateMineGrid(difficulty) {
    const difficultySettings = {
        beginner: { rows: 10, cols: 10, mines: 12 },
        intermediate: { rows: 16, cols: 16, mines: 40 },
        expert: { rows: 22, cols: 22, mines: 99 }
    };
    
    const config = difficultySettings[difficulty] || difficultySettings.intermediate;
    const { rows, cols, mines } = config;
    
    const grid = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push({
                mine: false,
                revealed: false,
                flagged: false,
                adjacentMines: 0
            });
        }
        grid.push(row);
    }
    
    let placedMines = 0;
    while (placedMines < mines) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        
        if (!grid[r][c].mine) {
            grid[r][c].mine = true;
            placedMines++;
        }
    }
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!grid[r][c].mine) {
                let count = 0;
                
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        
                        const nr = r + dr;
                        const nc = c + dc;
                        
                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                            if (grid[nr][nc].mine) count++;
                        }
                    }
                }
                
                grid[r][c].adjacentMines = count;
            }
        }
    }
    
    return {
        grid: grid,
        rows: rows,
        cols: cols,
        mineCount: mines
    };
}

function revealCell(lobby, row, col) {
    if (row < 0 || row >= lobby.gridData.rows || col < 0 || col >= lobby.gridData.cols) return [];
    
    const cell = lobby.gridData.grid[row][col];
    if (cell.revealed || cell.flagged || cell.mine) return [];
    
    cell.revealed = true;
    const revealed = [{row, col, adjacentMines: cell.adjacentMines}];
    
    if (cell.adjacentMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const cascaded = revealCell(lobby, row + dr, col + dc);
                revealed.push(...cascaded);
            }
        }
    }
    
    return revealed;
}

wss.on('connection', (ws) => {
    console.log('New client connected');
    let currentLobby = null;
    let playerId = 'player_' + Math.random().toString(36).substr(2, 9);

    ws.on('message', (message) => {
        console.log('Received:', message.toString());
        const data = JSON.parse(message);

        switch(data.type) {
            case 'CREATE_LOBBY':
                const lobbyCode = generateLobbyCode();

                lobbies[lobbyCode] = {
                    id: lobbyCode,
                    host: playerId,
                    players: [{
                        id: playerId,
                        name: data.playerName,
                        socket: ws,
                        row: 0,
                        col: 0,
                        alive: true
                    }],
                    difficulty: data.difficulty || 'intermediate',
                    gameStarted: false,
                    maxPlayers: data.maxPlayers || 4,
                    createdAt: Date.now()
                };

                currentLobby = lobbyCode;

                console.log(`Lobby ${lobbyCode} created by ${data.playerName}`);

                ws.send(JSON.stringify({
                    type: 'LOBBY_CREATED',
                    lobbyCode: lobbyCode,
                    playerId: playerId,
                    isHost: true,
                    players: [{id: playerId, name: data.playerName}]
                }));
                break;

            case 'JOIN_LOBBY':
                const joinCode = data.lobbyCode.toUpperCase();

                if (!lobbies[joinCode]) {
                    ws.send(JSON.stringify({
                        type: 'ERROR',
                        message: 'Lobby not found'
                    }));
                    return;
                }

                const lobby = lobbies[joinCode];

                if (lobby.gameStarted) {
                    ws.send(JSON.stringify({
                        type: 'ERROR',
                        message: 'Game already started'
                    }));
                    return;
                }

                if (lobby.players.length >= lobby.maxPlayers) {
                    ws.send(JSON.stringify({
                        type: 'ERROR',
                        message: 'Lobby is full'
                    }));
                    return;
                }

                lobby.players.push({
                    id: playerId,
                    name: data.playerName,
                    socket: ws,
                    row: 0,
                    col: 0,
                    alive: true
                });

                currentLobby = joinCode;

                console.log(`${data.playerName} joined lobby ${joinCode}`);

                // Send playerId to the joining player
                ws.send(JSON.stringify({
                    type: 'JOINED_LOBBY',
                    playerId: playerId
                }));

                broadcastToLobby(joinCode, {
                    type: 'PLAYER_JOINED',
                    players: lobby.players.map(p => ({id: p.id, name: p.name})),
                    newPlayer: data.playerName
                });
                break;

            case 'START_GAME':
                if (!currentLobby) return;
                const gameLobby = lobbies[currentLobby];

                if (gameLobby.host !== playerId) {
                    ws.send(JSON.stringify({
                        type: 'ERROR',
                        message: 'Only host can start the game'
                    }));
                    return;
                }

                if (gameLobby.players.length < 1) {
                    ws.send(JSON.stringify({
                        type: 'ERROR',
                        message: 'Need at least 1 player'
                    }));
                    return;
                }

                gameLobby.gameStarted = true;
                gameLobby.gridData = generateMineGrid(gameLobby.difficulty);
                gameLobby.startTime = Date.now();
                
                // Set starting positions for all players
                const startRow = Math.floor(gameLobby.gridData.rows / 2);
                const startCol = Math.floor(gameLobby.gridData.cols / 2);
                
                gameLobby.players.forEach((player, index) => {
                    player.row = startRow;
                    player.col = startCol + index; // Offset slightly for each player
                });

                console.log(`Game started in lobby ${currentLobby}`);

                broadcastToLobby(currentLobby, {
                    type: 'GAME_STARTED',
                    gridData: gameLobby.gridData,
                    players: gameLobby.players.map(p => ({
                        id: p.id,
                        name: p.name,
                        row: p.row,
                        col: p.col,
                        alive: p.alive
                    }))
                });
                break;

            case 'PLAYER_MOVE':
                if (!currentLobby) return;
                const moveLobby = lobbies[currentLobby];
                if (!moveLobby.gameStarted) return;
                
                const player = moveLobby.players.find(p => p.id === playerId);
                
                if (player && player.alive) {
                    player.row = data.row;
                    player.col = data.col;
                    
                    broadcastToLobby(currentLobby, {
                        type: 'PLAYER_MOVED',
                        playerId: playerId,
                        row: data.row,
                        col: data.col
                    });
                }
                break;

            case 'SCAN_TILE':
                if (!currentLobby) return;
                const scanLobby = lobbies[currentLobby];
                if (!scanLobby.gameStarted) return;
                
                const scanPlayer = scanLobby.players.find(p => p.id === playerId);
                if (!scanPlayer || !scanPlayer.alive) return;
                
                const cell = scanLobby.gridData.grid[data.row][data.col];
                
                if (cell.revealed || cell.flagged) return;
                
                if (cell.mine) {
                    // Player hit a mine
                    cell.revealed = true;
                    scanPlayer.alive = false;
                    
                    broadcastToLobby(currentLobby, {
                        type: 'PLAYER_HIT_MINE',
                        playerId: playerId,
                        playerName: scanPlayer.name,
                        row: data.row,
                        col: data.col
                    });
                } else {
                    // Safe tile - reveal with cascade
                    const revealedCells = revealCell(scanLobby, data.row, data.col);
                    
                    broadcastToLobby(currentLobby, {
                        type: 'TILES_REVEALED',
                        playerId: playerId,
                        cells: revealedCells
                    });
                    
                    // Check win condition
                    const totalCells = scanLobby.gridData.rows * scanLobby.gridData.cols;
                    const nonMineCells = totalCells - scanLobby.gridData.mineCount;
                    let revealedCount = 0;
                    
                    for (let r = 0; r < scanLobby.gridData.rows; r++) {
                        for (let c = 0; c < scanLobby.gridData.cols; c++) {
                            if (scanLobby.gridData.grid[r][c].revealed && !scanLobby.gridData.grid[r][c].mine) {
                                revealedCount++;
                            }
                        }
                    }
                    
                    if (revealedCount === nonMineCells) {
                        broadcastToLobby(currentLobby, {
                            type: 'GAME_WON',
                            time: Math.floor((Date.now() - scanLobby.startTime) / 1000)
                        });
                    }
                }
                break;

            case 'TOGGLE_FLAG':
                if (!currentLobby) return;
                const flagLobby = lobbies[currentLobby];
                if (!flagLobby.gameStarted) return;
                
                const flagCell = flagLobby.gridData.grid[data.row][data.col];
                
                if (!flagCell.revealed) {
                    flagCell.flagged = !flagCell.flagged;
                    
                    broadcastToLobby(currentLobby, {
                        type: 'FLAG_TOGGLED',
                        playerId: playerId,
                        row: data.row,
                        col: data.col,
                        flagged: flagCell.flagged
                    });
                }
                break;

            case 'LEAVE_LOBBY':
                if (currentLobby && lobbies[currentLobby]) {
                    const leaveLobby = lobbies[currentLobby];
                    leaveLobby.players = leaveLobby.players.filter(p => p.id !== playerId);

                    if (leaveLobby.players.length === 0) {
                        delete lobbies[currentLobby];
                        console.log(`Lobby ${currentLobby} deleted (empty)`);
                    } else {
                        if (leaveLobby.host === playerId) {
                            leaveLobby.host = leaveLobby.players[0].id;
                        }
                        
                        broadcastToLobby(currentLobby, {
                            type: 'PLAYER_LEFT',
                            players: leaveLobby.players.map(p => ({id: p.id, name: p.name})),
                            newHost: leaveLobby.host
                        });
                    }
                    
                    currentLobby = null;
                }
                break;
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (currentLobby && lobbies[currentLobby]) {
            const lobby = lobbies[currentLobby];
            lobby.players = lobby.players.filter(p => p.id !== playerId);
            
            if (lobby.players.length === 0) {
                delete lobbies[currentLobby];
                console.log(`Lobby ${currentLobby} deleted (empty)`);
            } else {
                if (lobby.host === playerId) {
                    lobby.host = lobby.players[0].id;
                }
                
                broadcastToLobby(currentLobby, {
                    type: 'PLAYER_LEFT',
                    players: lobby.players.map(p => ({id: p.id, name: p.name})),
                    newHost: lobby.host
                });
            }
        }
    });
});

console.log('WebSocket server running on port 8080');