// Variables globales
let sudokuGrid = Array(9).fill().map(() => Array(9).fill(0));
let initialGrid = Array(9).fill().map(() => Array(9).fill(0));
let hintsVisible = false;
let selectedCell = null;

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    createBoard();
    setupEventListeners();
    newGame();
});

// Créer la grille
function createBoard() {
    const board = document.getElementById('sudoku-board');
    board.innerHTML = '';

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.tabIndex = 0;
            cell.addEventListener('click', () => selectCell(cell));
            cell.addEventListener('keydown', handleKeyPress);
            board.appendChild(cell);
        }
    }
}

// Configurer les écouteurs d'événements
function setupEventListeners() {
    document.getElementById('new-game').addEventListener('click', newGame);
    document.getElementById('check-solution').addEventListener('click', checkSolution);
    document.getElementById('clear-grid').addEventListener('click', clearGrid);
    document.getElementById('toggle-hints').addEventListener('click', toggleHints);
}

// Nouvelle partie
function newGame() {
    const difficulty = document.getElementById('difficulty').value;
    generatePuzzle(difficulty);
    updateBoard();
    clearMessage();
    hintsVisible = false;
    document.getElementById('toggle-hints').textContent = 'Afficher Candidats';
}

// Générer un puzzle Sudoku
function generatePuzzle(difficulty) {
    // Réinitialiser la grille
    sudokuGrid = Array(9).fill().map(() => Array(9).fill(0));
    initialGrid = Array(9).fill().map(() => Array(9).fill(0));

    // Remplir la grille avec un puzzle valide
    fillGrid();

    // Supprimer des nombres selon la difficulté
    const cellsToRemove = difficulty === 'easy' ? 40 : difficulty === 'medium' ? 50 : 60;
    removeCells(cellsToRemove);

    // Copier vers initialGrid
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            initialGrid[i][j] = sudokuGrid[i][j];
        }
    }
}

// Remplir la grille avec un Sudoku valide
function fillGrid() {
    // Utiliser un algorithme de génération simple
    // Cette implémentation basique peut créer des puzzles valides
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (sudokuGrid[row][col] === 0) {
                shuffleArray(nums);
                for (let num of nums) {
                    if (isValidMove(row, col, num)) {
                        sudokuGrid[row][col] = num;
                        if (fillGrid()) {
                            return true;
                        }
                        sudokuGrid[row][col] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

// Supprimer des cellules pour créer le puzzle
function removeCells(count) {
    const positions = [];
    for (let i = 0; i < 81; i++) {
        positions.push(i);
    }
    shuffleArray(positions);

    for (let i = 0; i < count; i++) {
        const pos = positions[i];
        const row = Math.floor(pos / 9);
        const col = pos % 9;
        sudokuGrid[row][col] = 0;
    }
}

// Vérifier si un mouvement est valide
function isValidMove(row, col, num) {
    // Vérifier la ligne
    for (let i = 0; i < 9; i++) {
        if (sudokuGrid[row][i] === num) return false;
    }

    // Vérifier la colonne
    for (let i = 0; i < 9; i++) {
        if (sudokuGrid[i][col] === num) return false;
    }

    // Vérifier le bloc 3x3
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (sudokuGrid[startRow + i][startCol + j] === num) return false;
        }
    }

    return true;
}

// Mélanger un tableau (algorithme Fisher-Yates)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Mettre à jour l'affichage de la grille
function updateBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const value = sudokuGrid[row][col];

        cell.textContent = value || '';
        cell.classList.toggle('fixed', initialGrid[row][col] !== 0);

        if (hintsVisible && value === 0) {
            showHints(cell, row, col);
        } else {
            cell.innerHTML = value || '';
        }
    });
}

// Afficher les candidats possibles
function showHints(cell, row, col) {
    const hints = [];
    for (let num = 1; num <= 9; num++) {
        if (isValidMove(row, col, num)) {
            hints.push(num);
        }
    }

    cell.innerHTML = '<div class="hints">' +
        hints.map(num => `<div>${num}</div>`).join('') +
        '</div>';
}

// Sélectionner une cellule
function selectCell(cell) {
    if (selectedCell) {
        selectedCell.classList.remove('selected');
    }
    selectedCell = cell;
    cell.classList.add('selected');
    cell.focus();
    highlightRelated();
}

// Gestion des touches
function handleKeyPress(event) {
    if (!selectedCell) return;

    const row = parseInt(selectedCell.dataset.row);
    const col = parseInt(selectedCell.dataset.col);

    if (initialGrid[row][col] !== 0) return; // Cellule fixe

    const key = event.key;
    if (key >= '1' && key <= '9') {
        sudokuGrid[row][col] = parseInt(key);
        updateBoard();
        clearMessage();
    } else if (key === 'Backspace' || key === 'Delete') {
        sudokuGrid[row][col] = 0;
        updateBoard();
        clearMessage();
    }
}

// Vérifier la solution
function checkSolution() {
    let complete = true;
    let valid = true;

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (sudokuGrid[row][col] === 0) {
                complete = false;
            } else if (!isValidMove(row, col, sudokuGrid[row][col])) {
                valid = false;
            }
        }
    }

    if (!complete) {
        showMessage('La grille n\'est pas complète', 'warning');
    } else if (!valid) {
        showMessage('Solution invalide', 'error');
    } else {
        showMessage('Félicitations ! Solution correcte !', 'success');
    }
}

// Effacer la grille (garder les cellules initiales)
function clearGrid() {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (initialGrid[row][col] === 0) {
                sudokuGrid[row][col] = 0;
            }
        }
    }
    updateBoard();
    clearMessage();
}

// Basculer l'affichage des candidats
function toggleHints() {
    hintsVisible = !hintsVisible;
    document.getElementById('toggle-hints').textContent =
        hintsVisible ? 'Masquer Candidats' : 'Afficher Candidats';
    updateBoard();
}

// Mettre en évidence les cellules liées
function highlightRelated() {
    clearHighlights();

    if (!selectedCell) return;

    const row = parseInt(selectedCell.dataset.row);
    const col = parseInt(selectedCell.dataset.col);

    // Mettre en évidence la ligne
    for (let c = 0; c < 9; c++) {
        document.querySelector(`.cell[data-row="${row}"][data-col="${c}"]`).classList.add('related');
    }

    // Mettre en évidence la colonne
    for (let r = 0; r < 9; r++) {
        document.querySelector(`.cell[data-row="${r}"][data-col="${col}"]`).classList.add('related');
    }

    // Mettre en évidence le bloc 3x3
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            document.querySelector(`.cell[data-row="${startRow + r}"][data-col="${startCol + c}"]`).classList.add('related');
        }
    }
}

// Effacer les mises en évidence
function clearHighlights() {
    document.querySelectorAll('.cell.related').forEach(cell => cell.classList.remove('related'));
}

// Afficher un message
function showMessage(text, type) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = 'message ' + type;
}

// Effacer le message
function clearMessage() {
    document.getElementById('message').textContent = '';
    document.getElementById('message').className = 'message';
}
