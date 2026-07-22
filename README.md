# Agent Minesweeper

**A tactical, real-time multiplayer reinterpretation of Minesweeper built with JavaScript, Node.js, and WebSockets.**

Agent Minesweeper transforms the classic puzzle into an action-oriented survival game. Players move directly across the board, scan tiles, flag suspected mines, build safe-tile streaks, collect EMP charges, and survive hazards that become more aggressive as the mission continues.

The project supports both single-player and shared multiplayer games. In multiplayer mode, a Node.js WebSocket server manages lobby state, generates the common minefield, synchronizes player actions, broadcasts tile updates, checks the win condition, transfers host control, and removes empty lobbies.

**Repository:** https://github.com/Veluna34/MineField

## Project Highlights

* Built a complete Minesweeper implementation with recursive empty-tile reveals
* Added keyboard-controlled player movement instead of mouse-only interaction
* Created three difficulty levels ranging from a 10×10 board to a 22×22 board
* Developed real-time multiplayer lobbies using six-character invite codes
* Designed a server-managed shared board for multiplayer matches
* Synchronized movement, scans, flags, mine collisions, and win state through WebSockets
* Implemented host-only match controls and automatic host reassignment
* Added time-based threat escalation and a final chaos phase
* Created moving drones, proximity mines, anomalies, EMP blackouts, interference, and status hazards
* Added EMP power-ups, streak tracking, timers, notifications, and animated feedback
* Built a custom cyber-noir interface with Bootstrap and JavaScript
* Separated single-player game logic from multiplayer synchronization

## Why I Built It

I built Agent Minesweeper to take a familiar game and explore how its rules change when the player becomes a character inside the board.

Traditional Minesweeper is mostly a static deduction puzzle. In this version, the player must still use mine counts and logical reasoning, but also has to manage movement, time, hazards, and limited defensive resources.

The multiplayer mode introduced a second engineering problem: multiple browsers needed to interact with the same field without drifting into different game states. That required a server to coordinate:

* Lobby creation and joining
* Player identity
* Shared board generation
* Player positions
* Tile reveals
* Flags
* Mine collisions
* Win detection
* Player departures
* Host reassignment
* Lobby cleanup

The result is both a game-design experiment and a practical real-time systems project.

## Gameplay

### Objective

Reveal every safe tile without triggering a standard mine, proximity mine, moving hazard, or trap.

Numbered cells show how many standard mines exist in the surrounding eight cells.

### Single-Player Mode

Single-player games run locally in the browser and support three difficulty levels:

| Difficulty   | Board | Mines |
| ------------ | ----: | ----: |
| Beginner     | 10×10 |    12 |
| Intermediate | 16×16 |    40 |
| Expert       | 22×22 |    99 |

The first scan protects the player's starting area from immediate mine placement.

### Multiplayer Mode

Players can:

1. Enter an agent name
2. Create a new lobby or join with a six-character code
3. Wait for other players in the lobby
4. Start the mission as the host
5. Move across the same shared board
6. Reveal and flag cells in real time
7. See other players' positions and survival state
8. Work toward a shared win condition

The current lobby configuration supports up to four players.

## Controls

| Key        | Action                          |
| ---------- | ------------------------------- |
| Arrow keys | Move across the field           |
| `Space`    | Scan the current tile           |
| `F`        | Toggle a flag                   |
| `E`        | Use an EMP charge               |
| `R`        | Restart a single-player mission |

## Dynamic Threat System

The game becomes more dangerous over time rather than remaining a static puzzle.

### Drones

Drones spawn at the edge of the board and move toward the player. Later phases can introduce an additional drone and activate chaos mode.

### Anomalies

Anomalies appear with countdowns and can reverse progress by covering previously revealed areas. Players can neutralize them by reaching or flagging the affected tile.

### Proximity Mines

Proximity mines arm when the player approaches. If the player remains too close when the countdown expires, the mine can end the mission. Detonations can also hide nearby revealed cells.

### Static Interference

Static interference temporarily obscures information on a random group of revealed tiles.

### EMP Blackouts

EMP blackouts hide revealed board information for several seconds, forcing the player to move from memory.

### Freeze and Slow Hazards

Temporary hazard tiles can:

* Freeze movement briefly
* Increase movement delay for several seconds

### EMP Power-Ups and Traps

EMP power-ups give the player additional defensive charges. Some apparent power-up locations may instead become trap bombs, adding risk to resource collection.

### Threat Levels

The threat meter progresses through:

1. Safe
2. Alert
3. Danger
4. High Alert
5. Critical
6. Chaos

Timed phases increase hazard frequency and introduce new mechanics as the mission continues.

## Multiplayer Architecture

```text
Browser Client
      |
      | WebSocket messages
      v
Node.js WebSocket Server
      |
      +--> Lobby creation and lookup
      +--> Player identity and membership
      +--> Host authorization
      +--> Shared minefield generation
      +--> Movement synchronization
      +--> Tile scan handling
      +--> Recursive reveal calculation
      +--> Flag synchronization
      +--> Mine collision handling
      +--> Shared win detection
      +--> Host reassignment
      +--> Lobby cleanup
      |
      v
Broadcast updated state to lobby players
```

## Server Responsibilities

The WebSocket server maintains active lobbies in memory.

Each lobby stores:

* Lobby code
* Host player ID
* Connected players
* Difficulty
* Maximum player count
* Shared grid data
* Game-start state
* Match start time

### Lobby Lifecycle

The server:

1. Generates a unique six-character lobby code
2. Registers the creator as host
3. Validates join requests
4. Rejects missing, full, or already-started lobbies
5. Allows only the host to start the match
6. Assigns player starting positions
7. Transfers host control when the host leaves
8. Deletes the lobby after the final player disconnects

### Shared Board Generation

For multiplayer matches, the server:

* Creates the grid
* Places the requested number of mines
* Calculates adjacent-mine counts
* Stores reveal and flag state
* Sends the initial game state to connected players

### Recursive Tile Reveals

When a safe tile has no adjacent mines, the server recursively reveals neighboring safe cells and broadcasts the resulting list to every player.

### Shared Win Detection

After each successful scan, the server counts revealed non-mine cells. When that count matches the total number of safe cells, it broadcasts a shared victory event with the match duration.

## WebSocket Events

### Client to Server

| Event          | Purpose                              |
| -------------- | ------------------------------------ |
| `CREATE_LOBBY` | Create a lobby and register the host |
| `JOIN_LOBBY`   | Join an existing lobby               |
| `START_GAME`   | Ask the server to begin the match    |
| `PLAYER_MOVE`  | Update a player's board position     |
| `SCAN_TILE`    | Scan the current cell                |
| `TOGGLE_FLAG`  | Add or remove a flag                 |
| `LEAVE_LOBBY`  | Leave the active lobby               |

### Server to Client

| Event             | Purpose                                   |
| ----------------- | ----------------------------------------- |
| `LOBBY_CREATED`   | Return lobby and host information         |
| `JOINED_LOBBY`    | Return the joining player's ID            |
| `PLAYER_JOINED`   | Broadcast the updated player list         |
| `PLAYER_LEFT`     | Broadcast departures and host changes     |
| `GAME_STARTED`    | Send the shared grid and player positions |
| `PLAYER_MOVED`    | Synchronize another player's movement     |
| `TILES_REVEALED`  | Synchronize revealed cells                |
| `PLAYER_HIT_MINE` | Report a player elimination               |
| `FLAG_TOGGLED`    | Synchronize flag state                    |
| `GAME_WON`        | Report shared mission completion          |
| `ERROR`           | Return lobby or authorization errors      |

## Technology Stack

### Frontend

* HTML5
* CSS3
* Vanilla JavaScript
* Bootstrap 5
* Browser WebSocket API

### Backend

* Node.js
* `ws` WebSocket library

### Development Tools

* npm
* Git
* GitHub

## Project Structure

```text
MineField/
├── index.html          # Interface, single-player logic, hazards, and WebSocket client
├── server.js           # Lobby and multiplayer game-state server
├── package.json        # Dependencies and npm scripts
└── static/
    └── Noir.png        # Story interface artwork
```

## Installation

### Requirements

Install a current Node.js release with npm.

Verify the installation:

```bash
node --version
npm --version
```

### Clone the Repository

```bash
git clone https://github.com/Veluna34/MineField.git
cd MineField
```

### Install Dependencies

```bash
npm install
```

### Start the WebSocket Server

```bash
npm start
```

The WebSocket server listens on:

```text
ws://localhost:8080
```

### Serve the Frontend

In another terminal, serve the project directory with a local static server. For example:

```bash
python -m http.server 3000
```

Open:

```text
http://localhost:3000
```

The client currently expects the WebSocket server to run on port `8080`.

## Engineering Challenges

### Synchronizing Shared Game State

In multiplayer mode, every client must agree on player positions, revealed cells, flags, mine collisions, and the final win state.

The server broadcasts discrete state changes rather than requiring each browser to guess what happened independently.

### Recursive Reveal Logic

Classic Minesweeper reveals connected empty regions. The implementation recursively explores neighboring cells while preventing repeated reveals, flagged-cell reveals, out-of-bounds access, and mine reveals.

### Managing Multiple Timed Systems

The single-player game uses several independent timers for:

* Mission time
* Drone movement
* Drone spawning
* Anomaly spawning and countdowns
* Proximity mines
* Static interference
* EMP blackouts
* EMP power-ups
* Temporary hazards
* Threat-level escalation

Starting or ending a mission requires correctly clearing these timers to prevent old game events from leaking into the next session.

### Supporting Local and Networked Rules

Single-player actions modify browser state directly. Multiplayer actions instead send commands to the server and wait for synchronized updates.

The frontend therefore has to support two execution paths while presenting one consistent control system.

### Handling Player Departure

When a player leaves or disconnects, the server removes that player, transfers host status when necessary, informs the remaining clients, and destroys empty lobbies.

## Current Limitations

Agent Minesweeper is a working prototype, but several areas should be improved before public deployment.

* Multiplayer state is stored only in server memory
* Active lobbies disappear when the server restarts
* The client WebSocket URL is hard-coded to `localhost:8080`
* Incoming messages are parsed without schema validation
* The server should validate movement, scan, and flag coordinates
* The complete multiplayer grid is currently sent to clients, including mine data
* Reconnection and session recovery are not implemented
* Player names are not authenticated
* There is no rate limiting
* There is no automated test suite
* Multiplayer difficulty is currently fixed by the client lobby request
* The server allows the host to start with a single player
* The listed Express dependency is not currently used by `server.js`

## Production Readiness Roadmap

1. Keep mine locations private on the server
2. Send only public cell state to clients
3. Validate all WebSocket messages against a schema
4. Validate movement boundaries and action locations
5. Confirm that scan and flag actions occur at the player's current position
6. Add secure `wss://` configuration
7. Move server URLs and ports into environment configuration
8. Add reconnection tokens and session recovery
9. Add lobby expiration for abandoned sessions
10. Add rate limiting and message-size limits
11. Add configurable multiplayer difficulty
12. Require at least two players for multiplayer matches
13. Add health checks and structured logging
14. Add unit tests for grid generation and recursive reveals
15. Add integration tests for lobby and match events
16. Either remove Express or use it to serve the frontend and health endpoints
17. Split the large frontend file into game, rendering, hazard, and networking modules

## Skills Demonstrated

* JavaScript game development
* Node.js backend development
* Real-time WebSocket communication
* Multiplayer lobby design
* Shared game-state synchronization
* Server-authoritative event handling
* Recursive algorithms
* Grid and adjacency algorithms
* Timers and asynchronous state
* Keyboard input handling
* DOM rendering
* Client-server event protocols
* Disconnect and host-transfer handling
* Dynamic difficulty and hazard design
* UI animation and feedback
* Technical documentation
* Security and production-readiness analysis

## Current Status

Agent Minesweeper is a functional single-player and real-time multiplayer game prototype.

Its strongest engineering areas are:

* Shared multiplayer board state
* WebSocket lobby management
* Recursive tile-reveal logic
* Player and host lifecycle handling
* Timed hazard orchestration
* Supporting local and networked gameplay through the same interface

Future work is focused on stronger server authority, message validation, reconnection, deployment configuration, modular frontend architecture, and automated testing.

## Author

Aiden Figueroa

## License

ISC
::: 
