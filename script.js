// プレイヤーの定数
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

// 視覚化用の色
const COLORS = {
    [EMPTY]: 0xCCCCCC, // 空セルはライトグレー
    [BLACK]: 0x000000, // 黒
    [WHITE]: 0xFFFFFF  // 白
};

// 3Dの26方向
const DIRECTIONS = [];
for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
            if (dx !== 0 || dy !== 0 || dz !== 0) {
                DIRECTIONS.push([dx, dy, dz]);
            }
        }
    }
}

class Othello3D {
    constructor(size = 8) {
        this.size = size;
        this.board = [];
        for (let x = 0; x < size; x++) {
            this.board[x] = [];
            for (let y = 0; y < size; y++) {
                this.board[x][y] = [];
                for (let z = 0; z < size; z++) {
                    this.board[x][y][z] = EMPTY;
                }
            }
        }
        this.currentPlayer = BLACK;
        this.initializeBoard();
        this.historyStack = [];
        this.historyPointer = -1;
        this.saveState(); // 初期状態を保存
    }

    initializeBoard() {
        const mid = Math.floor(this.size / 2);
        // 中央に2x2x2のキューブを配置（黒と白を交互に）
        for (let x = mid - 1; x <= mid; x++) {
            for (let y = mid - 1; y <= mid; y++) {
                for (let z = mid - 1; z <= mid; z++) {
                    this.board[x][y][z] = (x + y + z) % 2 === 0 ? BLACK : WHITE;
                }
            }
        }
    }

    onBoard(x, y, z) {
        return x >= 0 && x < this.size &&
               y >= 0 && y < this.size &&
               z >= 0 && z < this.size;
    }

    opponent(player) {
        return player === BLACK ? WHITE : BLACK;
    }

    validMoves(player) {
        const moves = new Set();
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                for (let z = 0; z < this.size; z++) {
                    if (this.board[x][y][z] === EMPTY && this.canFlip(x, y, z, player)) {
                        moves.add(`${x},${y},${z}`);
                    }
                }
            }
        }
        return Array.from(moves).map(m => m.split(',').map(Number));
    }

    canFlip(x, y, z, player) {
        const opp = this.opponent(player);
        for (const [dx, dy, dz] of DIRECTIONS) {
            let nx = x + dx, ny = y + dy, nz = z + dz;
            let hasOpp = false;
            while (this.onBoard(nx, ny, nz) && this.board[nx][ny][nz] === opp) {
                hasOpp = true;
                nx += dx;
                ny += dy;
                nz += dz;
            }
            if (hasOpp && this.onBoard(nx, ny, nz) && this.board[nx][ny][nz] === player) {
                return true;
            }
        }
        return false;
    }

    makeMove(x, y, z, player) {
        const stonesToFlip = [];
        const opp = this.opponent(player);
        for (const [dx, dy, dz] of DIRECTIONS) {
            let path = [];
            let nx = x + dx, ny = y + dy, nz = z + dz;
            while (this.onBoard(nx, ny, nz) && this.board[nx][ny][nz] === opp) {
                path.push([nx, ny, nz]);
                nx += dx;
                ny += dy;
                nz += dz;
            }
            if (path.length > 0 && this.onBoard(nx, ny, nz) && this.board[nx][ny][nz] === player) {
                stonesToFlip.push(...path);
            }
        }
        if (stonesToFlip.length > 0) {
            this.board[x][y][z] = player;
            for (const [fx, fy, fz] of stonesToFlip) {
                this.board[fx][fy][fz] = player;
            }
            this.saveState(); // 状態を保存
            return true;
        }
        return false;
    }

    switchPlayer() {
        this.currentPlayer = this.opponent(this.currentPlayer);
    }

    hasValidMove(player) {
        return this.validMoves(player).length > 0;
    }

    countStones() {
        let black = 0, white = 0;
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                for (let z = 0; z < this.size; z++) {
                    if (this.board[x][y][z] === BLACK) black++;
                    if (this.board[x][y][z] === WHITE) white++;
                }
            }
        }
        return { black, white };
    }

    // 状態を保存
    saveState() {
        const state = JSON.stringify(this.board);
        // 現在の履歴の先頭までを切り取って新しい状態を追加
        this.historyStack = this.historyStack.slice(0, this.historyPointer + 1);
        this.historyStack.push(state);
        this.historyPointer++;
    }

    // 状態を復元
    loadState(state) {
        this.board = JSON.parse(state);
    }

    // Undo操作
    undo() {
        if (this.historyPointer > 0) {
            this.historyPointer--;
            const state = this.historyStack[this.historyPointer];
            this.loadState(state);
            this.switchPlayer(); // プレイヤーターンも戻す
            return true;
        }
        return false;
    }

    // Redo操作
    redo() {
        if (this.historyPointer < this.historyStack.length - 1) {
            this.historyPointer++;
            const state = this.historyStack[this.historyPointer];
            this.loadState(state);
            this.switchPlayer(); // プレイヤーターンも進める
            return true;
        }
        return false;
    }
}

// Three.jsの変数
let scene, camera, renderer, controls;
let game;
const cubeSize = 2;
const spacing = 0.5;
const spheres = []; // 石のメッシュを保持
let previewSphere = null; // プレビュー用の石

// ゲームとThree.jsを初期化
function init() {
    game = new Othello3D();

    // シーンの設定
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // カメラの設定
    const aspect = window.innerWidth / (window.innerHeight * 0.8);
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(20, 20, 20);

    // レンダラーの設定
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight * 0.8);
    document.getElementById('game-container').appendChild(renderer.domElement);

    // OrbitControlsの追加
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;

    // 環境光の追加
    const ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);

    // 方向光の追加
    const directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    // ボードのグリッドを作成
    const gridHelper = new THREE.GridHelper(game.size * (cubeSize + spacing), game.size, 0x000000, 0x000000);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    // 3Dグリッドを表す透明なキューブを作成
    const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const wireframe = new THREE.WireframeGeometry(cubeGeometry);
    const cubeMaterial = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1 });

    for (let x = 0; x < game.size; x++) {
        for (let y = 0; y < game.size; y++) {
            for (let z = 0; z < game.size; z++) {
                const cube = new THREE.LineSegments(wireframe, cubeMaterial.clone());

                // 原点 (0, 0, 0) のマスを赤色にハイライト
                if (x === 0 && y === 0 && z === 0) {
                    cube.material.color.set(0xff0000); // 赤色
                    cube.material.opacity = 1.0; // 不透明に
                }

                cube.position.set(
                    x * (cubeSize + spacing) - (game.size / 2) * (cubeSize + spacing) + cubeSize / 2,
                    y * (cubeSize + spacing) - (game.size / 2) * (cubeSize + spacing) + cubeSize / 2,
                    z * (cubeSize + spacing) - (game.size / 2) * (cubeSize + spacing) + cubeSize / 2
                );
                scene.add(cube);
            }
        }
    }

    // 初期の石をレンダリング
    renderStones();

    // レンダリング開始
    animate();

    // イベントリスナーの設定
    document.getElementById('make-move').addEventListener('click', handleMove);
    document.getElementById('reset-game').addEventListener('click', resetGame);
    document.getElementById('undo-move').addEventListener('click', handleUndo);
    document.getElementById('redo-move').addEventListener('click', handleRedo);
    window.addEventListener('resize', onWindowResize, false);

    updateUI();
    updateNextMoves();
}

// ボード上に石をレンダリング
function renderStones() {
    // 既存の石を削除
    for (const sphere of spheres) {
        scene.remove(sphere);
    }
    spheres.length = 0;

    // 新しい石を追加
    const sphereGeometry = new THREE.SphereGeometry(cubeSize / 2 - 0.2, 16, 16);
    for (let x = 0; x < game.size; x++) {
        for (let y = 0; y < game.size; y++) {
            for (let z = 0; z < game.size; z++) {
                const cell = game.board[x][y][z];
                if (cell !== EMPTY) {
                    const material = new THREE.MeshPhongMaterial({ color: COLORS[cell] });
                    const sphere = new THREE.Mesh(sphereGeometry, material);
                    sphere.position.set(
                        x * (cubeSize + spacing) - (game.size / 2) * (cubeSize + spacing) + cubeSize / 2,
                        y * (cubeSize + spacing) - (game.size / 2) * (cubeSize + spacing) + cubeSize / 2,
                        z * (cubeSize + spacing) - (game.size / 2) * (cubeSize + spacing) + cubeSize / 2
                    );
                    scene.add(sphere);
                    spheres.push(sphere);
                }
            }
        }
    }
}

// アニメーションループ
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// ウィンドウサイズ変更時の処理
function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight * 0.8;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// 手を打つ処理
function handleMove() {
    const x = parseInt(document.getElementById('x').value);
    const y = parseInt(document.getElementById('y').value);
    const z = parseInt(document.getElementById('z').value);
    const messageEl = document.getElementById('message');

    if (isNaN(x) || isNaN(y) || isNaN(z)) {
        messageEl.textContent = "有効な座標 (0-7) を入力してください。";
        return;
    }

    if (!game.onBoard(x, y, z)) {
        messageEl.textContent = "座標が範囲外です。";
        return;
    }

    if (game.board[x][y][z] !== EMPTY) {
        messageEl.textContent = "セルはすでに占有されています。";
        return;
    }

    if (!game.canFlip(x, y, z, game.currentPlayer)) {
        messageEl.textContent = "不正な手です。反転できる石がありません。";
        return;
    }

    const moveMade = game.makeMove(x, y, z, game.currentPlayer);
    if (moveMade) {
        renderStones();
        game.switchPlayer();
        updateUI();
        updateNextMoves();
        messageEl.textContent = "";
    } else {
        messageEl.textContent = "不正な手です。";
    }
}

// 「Possible Next Moves」を更新
function updateNextMoves() {
    const moves = game.validMoves(game.currentPlayer);
    const movesList = document.getElementById('moves-list');
    movesList.innerHTML = ''; // 既存の内容をクリア

    if (moves.length === 0) {
        movesList.innerHTML = '<p>有効な手がありません。</p>';
        return;
    }

    moves.forEach(move => {
        const [x, y, z] = move;
        const button = document.createElement('button');
        button.textContent = `(${x}, ${y}, ${z})`;

        // マウスオーバー時に石のプレビューを表示
        button.addEventListener('mouseenter', () => {
            if (!previewSphere) {
                previewSphere = createPreviewSphere(x, y, z);
                scene.add(previewSphere);
            }
        });

        // マウスアウト時に石のプレビューを削除
        button.addEventListener('mouseleave', () => {
            if (previewSphere) {
                scene.remove(previewSphere);
                previewSphere = null;
            }
        });

        // ボタンクリック時に石を置く
        button.onclick = () => {
            makeMoveAt(x, y, z);
        };
        movesList.appendChild(button);
    });
}

// 石をプレビューするための球体を作成
function createPreviewSphere(x, y, z) {
    const sphereGeometry = new THREE.SphereGeometry(cubeSize / 2 - 0.2, 16, 16);
    const material = new THREE.MeshPhongMaterial({
        color: COLORS[game.currentPlayer],
        opacity: 0.5,
        transparent: true
    });
    const sphere = new THREE.Mesh(sphereGeometry, material);
    sphere.position.set(
        x * (cubeSize + spacing) - (game.size / 2) * (cubeSize + spacing) + cubeSize / 2,
        y * (cubeSize + spacing) - (game.size / 2) * (cubeSize + spacing) + cubeSize / 2,
        z * (cubeSize + spacing) - (game.size / 2) * (cubeSize + spacing) + cubeSize / 2
    );
    return sphere;
}

// 指定した座標に石を置く処理
function makeMoveAt(x, y, z) {
    const messageEl = document.getElementById('message');

    if (!game.onBoard(x, y, z)) {
        messageEl.textContent = "座標が範囲外です。";
        return;
    }

    if (game.board[x][y][z] !== EMPTY) {
        messageEl.textContent = "セルはすでに占有されています。";
        return;
    }

    if (!game.canFlip(x, y, z, game.currentPlayer)) {
        messageEl.textContent = "不正な手です。反転できる石がありません。";
        return;
    }

    const moveMade = game.makeMove(x, y, z, game.currentPlayer);
    if (moveMade) {
        renderStones();
        game.switchPlayer();
        updateUI();
        updateNextMoves();
        messageEl.textContent = "";
    } else {
        messageEl.textContent = "不正な手です。";
    }
}

// UI要素を更新
function updateUI() {
    const playerEl = document.getElementById('current-player');
    const scoreEl = document.getElementById('score');
    const { black, white } = game.countStones();
    const currentPlayer = game.currentPlayer === BLACK ? '黒' : '白';
    playerEl.textContent = `現在のプレイヤー: ${currentPlayer}`;

    // プレイヤーの色を強調
    if (game.currentPlayer === BLACK) {
        playerEl.classList.remove('white');
        playerEl.classList.add('black');
    } else {
        playerEl.classList.remove('black');
        playerEl.classList.add('white');
    }

    scoreEl.textContent = `黒: ${black} | 白: ${white}`;

    // Undoボタンの無効化
    const undoButton = document.getElementById('undo-move');
    undoButton.disabled = game.historyPointer <= 0;
    undoButton.style.opacity = undoButton.disabled ? 0.5 : 1;
    undoButton.style.cursor = undoButton.disabled ? 'not-allowed' : 'pointer';

    // Redoボタンの無効化
    const redoButton = document.getElementById('redo-move');
    redoButton.disabled = game.historyPointer >= game.historyStack.length - 1;
    redoButton.style.opacity = redoButton.disabled ? 0.5 : 1;
    redoButton.style.cursor = redoButton.disabled ? 'not-allowed' : 'pointer';
}

// ゲームが終了しているかチェック
function checkGameOver() {
    if (!game.hasValidMove(BLACK) && !game.hasValidMove(WHITE)) {
        const { black, white } = game.countStones();
        const messageEl = document.getElementById('message');
        if (black > white) {
            messageEl.textContent = "ゲーム終了。黒の勝ち！";
        } else if (white > black) {
            messageEl.textContent = "ゲーム終了。白の勝ち！";
        } else {
            messageEl.textContent = "ゲーム終了。引き分け！";
        }
    }
}

// Undo操作を処理
function handleUndo() {
    const success = game.undo();
    if (success) {
        renderStones();
        updateUI();
        updateNextMoves();
        document.getElementById('message').textContent = "Undo move.";
    } else {
        document.getElementById('message').textContent = "Undoできる手がありません。";
    }
}

// Redo操作を処理
function handleRedo() {
    const success = game.redo();
    if (success) {
        renderStones();
        updateUI();
        updateNextMoves();
        document.getElementById('message').textContent = "Redo move.";
    } else {
        document.getElementById('message').textContent = "Redoできる手がありません。";
    }
}

// ゲームをリセット
function resetGame() {
    game = new Othello3D();
    renderStones();
    updateUI();
    updateNextMoves();
    document.getElementById('message').textContent = "";
}

// ゲーム開始時に初期化
window.onload = init;
