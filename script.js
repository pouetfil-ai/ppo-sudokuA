// Variables globales
let sudokuGrid = Array(9).fill().map(() => Array(9).fill(0));
let initialGrid = Array(9).fill().map(() => Array(9).fill(0));
let solutionGrid = Array(9).fill().map(() => Array(9).fill(0)); // Grille de solution complète
let hintsVisible = false;
let selectedCell = null;
let selectedValue = 0;
let history = [];
let historyIndex = -1;
const SAVED_GRIDS_KEY = 'sudoku_saved_grids';
let savedGrids = [];
let maskedCandidates = Array(9).fill().map(() => Array(9).fill().map(() => Array(10).fill(false))); // index 1-9: true si candidat masqué
let maskMode = false; // Mode pour masquer un candidat
let highlightedCandidates = Array(9).fill().map(() => Array(9).fill().map(() => Array(10).fill(false))); // index 1-9: true si candidat marqué en jaune
let highlightMode = false; // Mode pour marquer un candidat
let redMarkedCandidates = Array(9).fill().map(() => Array(9).fill().map(() => Array(10).fill(false))); // index 1-9: true si candidat marqué en rouge
let redMode = false; // Mode pour marquer un candidat en rouge
let isCustomMode = false; // Mode création de grille personnalisée

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    // Enregistrer le service worker pour PWA avec gestion des mises à jour
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => {
                // Vérifier les mises à jour du service worker
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // Nouvelle version disponible
                                showUpdateNotification();
                            }
                        });
                    }
                });

                // Écouter les messages du service worker
                navigator.serviceWorker.addEventListener('message', event => {
                    if (event.data && event.data.type === 'SW_UPDATE_READY') {
                        showUpdateNotification();
                    }
                });
            });
    }
});

// Afficher une notification de mise à jour disponible
function showUpdateNotification() {
    // Créer la notification de mise à jour
    const updateDiv = document.createElement('div');
    updateDiv.id = 'update-notification';
    updateDiv.className = 'update-notification';
    updateDiv.innerHTML = `
        <div class="update-content">
            <p>Une nouvelle version est disponible !</p>
            <button id="update-btn" class="update-btn">Mettre à jour</button>
        </div>
    `;

    document.body.appendChild(updateDiv);

    // Ajouter l'événement au bouton de mise à jour
    document.getElementById('update-btn').addEventListener('click', () => {
        window.location.reload();
    });
}

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
            cell.addEventListener('touchstart', (e) => { e.preventDefault(); selectCell(cell); });
            cell.addEventListener('keydown', handleKeyPress);
            board.appendChild(cell);
        }
    }
}

// Créer le numéro-pad
function createNumberPad() {
    const pad = document.getElementById('number-pad');
    pad.innerHTML = '';

    for (let num = 1; num <= 9; num++) {
        const button = document.createElement('button');
        button.className = 'number-pad-button';
        button.textContent = num;
        button.addEventListener('click', () => onNumberPadClick(num));
        button.addEventListener('touchstart', (e) => { e.preventDefault(); onNumberPadClick(num); });
        pad.appendChild(button);
    }
}

// Configurer les écouteurs d'événements
function setupEventListeners() {
    const addTouchAndClick = (elementId, handler) => {
        const element = document.getElementById(elementId);
        element.addEventListener('click', handler);
        element.addEventListener('touchstart', (e) => { e.preventDefault(); handler(); });
    };

    addTouchAndClick('start-game', startGame);
    addTouchAndClick('create-custom', startCustomGridCreator);
    addTouchAndClick('start-custom-game', startCustomGame);
    addTouchAndClick('menu-btn', showMenu);
    addTouchAndClick('undo', undo);
    addTouchAndClick('redo', redo);
    addTouchAndClick('clear-grid', clearGrid);
    addTouchAndClick('hints-indicator', toggleHints);
    addTouchAndClick('save-grid-btn', showSaveDialog);
    addTouchAndClick('my-grids-btn', showSavedGrids);
    addTouchAndClick('back-to-menu-btn', showMenu);
    addTouchAndClick('mask-hint', () => {
        maskMode = !maskMode;
        if (maskMode) highlightMode = false;
        updateCandidateBtnStates();
        if (selectedCell) selectedCell.focus();
    });
    addTouchAndClick('highlight-hint', () => {
        highlightMode = !highlightMode;
        if (highlightMode) maskMode = false;
        if (highlightMode) redMode = false;
        updateCandidateBtnStates();
        if (selectedCell) selectedCell.focus();
    });
    addTouchAndClick('red-hint', () => {
        redMode = !redMode;
        if (redMode) maskMode = false;
        if (redMode) highlightMode = false;
        updateCandidateBtnStates();
        if (selectedCell) selectedCell.focus();
    });
}

function startGame() {
    // Récupérer la difficulté sélectionnée dans le menu
    const selectedDifficulty = document.getElementById('menu-difficulty').value;

    // Masquer le menu et afficher le jeu
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');

    // Masquer explicitement le titre du jeu
    document.getElementById('game-title').classList.add('hidden');

    // Synchroniser la difficulté dans le sélecteur caché du jeu
    document.getElementById('difficulty').value = selectedDifficulty;

    // Créer la grille et démarrer la partie
    createBoard();
    createNumberPad();
    newGame();
}

// Démarrer le créateur de grille personnalisée
function startCustomGridCreator() {
    // Activer le mode création personnalisée
    isCustomMode = true;

    // Masquer le menu et afficher le jeu
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');

    // Masquer explicitement le titre du jeu
    document.getElementById('game-title').classList.add('hidden');

    // Créer la grille vide et initialiser le mode création
    createBoard();
    createNumberPad();
    initializeCustomGrid();
}

// Initialiser une grille complètement vide pour le mode création personnalisée
function initializeCustomGrid() {
    // Réinitialiser toutes les grilles à zéro (aucune cellule fixe)
    sudokuGrid = Array(9).fill().map(() => Array(9).fill(0));
    initialGrid = Array(9).fill().map(() => Array(9).fill(0));
    solutionGrid = Array(9).fill().map(() => Array(9).fill(0));

    // Réinitialiser l'historique pour ce mode
    history = [];
    historyIndex = -1;

    // Ajouter l'état initial à l'historique
    const initialState = {
        grid: JSON.parse(JSON.stringify(sudokuGrid)),
        maskedCandidates: JSON.parse(JSON.stringify(maskedCandidates)),
        highlightedCandidates: JSON.parse(JSON.stringify(highlightedCandidates)),
        redMarkedCandidates: JSON.parse(JSON.stringify(redMarkedCandidates))
    };
    history.push(initialState);
    historyIndex = 0;

    // Mettre à jour l'affichage
    updateBoard();
    updateHintsIndicator();
    updateControlButtonsVisibility();
    clearMessage();

    // Afficher le bouton "Démarrer le Jeu"
    document.getElementById('start-custom-game').classList.remove('hidden');

    // Afficher un message d'instruction
    showMessage("Mode Création : Remplissez librement la grille avec vos chiffres, puis cliquez sur 'Démarrer le Jeu' pour jouer.", "info");
}

// Démarrer le jeu avec une grille personnalisée
function startCustomGame() {
    // Vérifier s'il y a au moins quelques chiffres dans la grille
    let filledCells = 0;
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (sudokuGrid[row][col] !== 0) {
                filledCells++;
            }
        }
    }

    if (filledCells < 5) {
        showMessage("Votre grille doit contenir au minimum 5 chiffres pour pouvoir jouer !", "error");
        return;
    }

    // Vérifier que la grille n'a pas de conflits évidents
    if (hasConflicts()) {
        showMessage("Votre grille contient des conflits ! Vérifiez que les chiffres ne se répètent pas dans les mêmes lignes, colonnes ou blocs 3×3.", "error");
        return;
    }

    // Sauvegarder la grille saisie comme grille initiale
    initialGrid = sudokuGrid.map(row => row.slice());

    // Tenter de générer une solution complète
    if (!generateSolutionFromCustomGrid()) {
        showMessage("Impossible de générer une solution valide à partir de votre grille. Vérifiez qu'elle est correcte !", "error");
        return;
    }

    // Passer du mode création au mode jeu normal
    isCustomMode = false;

    // Réinitialiser l'historique pour le jeu normal
    history = [JSON.parse(JSON.stringify({
        grid: sudokuGrid,
        maskedCandidates: maskedCandidates,
        highlightedCandidates: highlightedCandidates,
        redMarkedCandidates: redMarkedCandidates
    }))];
    historyIndex = 0;

    // Mettre à jour l'affichage et les contrôles
    updateBoard();
    updateHintsIndicator();
    updateNumberPadState();

    // Cacher le bouton "Démarrer le Jeu" une fois lancé
    document.getElementById('start-custom-game').classList.add('hidden');

    // Afficher un message de succès
    showMessage("Jeu démarré ! Bonne chance !", "success");
}

// Vérifier s'il y a des conflits évidents dans la grille actuelle
function hasConflicts() {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const value = sudokuGrid[row][col];
            if (value !== 0) {
                // Vérifier temporairement
                sudokuGrid[row][col] = 0;
                if (!isValidMove(row, col, value)) {
                    sudokuGrid[row][col] = value; // remettre
                    return true;
                }
                sudokuGrid[row][col] = value;
            }
        }
    }
    return false;
}

// Générer une solution complète à partir de la grille personnalisée partiellement remplie
function generateSolutionFromCustomGrid() {
    // Sauvegarder la grille personnalisée
    const customGrid = sudokuGrid.map(row => row.slice());

    // Essayer de résoudre avec la fonction de résolution existante
    const result = solveSudoku(customGrid);
    if (result) {
        // Copier la solution vers solutionGrid
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                solutionGrid[i][j] = customGrid[i][j];
            }
        }
        return true;
    }

    return false;
}

// Nouvelle partie
function newGame() {
    const difficulty = document.getElementById('difficulty').value;
    generatePuzzle(difficulty);
    updateBoard();
    updateHintsIndicator();
    clearMessage();
    hintsVisible = false;
    // Réinitialiser l'historique
    const initialState = {
        grid: JSON.parse(JSON.stringify(sudokuGrid)),
        maskedCandidates: JSON.parse(JSON.stringify(maskedCandidates)),
        highlightedCandidates: JSON.parse(JSON.stringify(highlightedCandidates)),
        redMarkedCandidates: JSON.parse(JSON.stringify(redMarkedCandidates))
    };
    history = [initialState];
    historyIndex = 0;
    // Réinitialiser les masquages de candidats
    maskedCandidates = Array(9).fill().map(() => Array(9).fill().map(() => Array(10).fill(false)));
    highlightMode = false;
    highlightedCandidates = Array(9).fill().map(() => Array(9).fill().map(() => Array(10).fill(false)));
    maskMode = false;
    redMode = false;
    redMarkedCandidates = Array(9).fill().map(() => Array(9).fill().map(() => Array(10).fill(false)));
    // Réinitialiser les indicateurs actifs
    updateCandidateBtnStates();
}

// Générer un puzzle Sudoku
function generatePuzzle(difficulty) {
    // Réinitialiser la grille
    sudokuGrid = Array(9).fill().map(() => Array(9).fill(0));
    initialGrid = Array(9).fill().map(() => Array(9).fill(0));

    // Remplir la grille avec un puzzle valide
    fillGrid();

    // Sauvegarder la solution complète
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            solutionGrid[i][j] = sudokuGrid[i][j];
        }
    }

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

// Remplir la grille avec un Sudoku valide en utilisant backtracking classique
function fillGrid() {
    // Fonction helper pour trouver la prochaine cellule vide
    function findEmptyCell() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (sudokuGrid[row][col] === 0) {
                    return { row, col };
                }
            }
        }
        return null; // Grille complète
    }

    // Algorithme de backtracking récursif
    function fill() {
        const emptyCell = findEmptyCell();

        // Si aucune cellule vide, grille complète
        if (!emptyCell) {
            return true;
        }

        const { row, col } = emptyCell;
        const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        shuffleArray(nums); // Mélanger pour variété

        // Essayer chaque chiffre dans un ordre aléatoire
        for (let num of nums) {
            if (isValidMove(row, col, num)) {
                sudokuGrid[row][col] = num;

                // Récursivement remplir les cellules suivantes
                if (fill()) {
                    return true; // Succès
                }

                // Échec, backtrack
                sudokuGrid[row][col] = 0;
            }
        }

        return false; // Aucun chiffre ne convient
    }

    return fill();
}

// Résoudre le Sudoku et compter les solutions (pour vérifier l'unicité)
function solveSudoku(grid, findAllSolutions = false, maxSolutions = 1) {
    let solutionsCount = 0;

    function backtrack() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (grid[row][col] === 0) {
                    // Essayer chaque nombre possible
                    for (let num = 1; num <= 9; num++) {
                        if (isValidMoveInGrid(grid, row, col, num)) {
                            grid[row][col] = num;

                            // Si on cherche toutes les solutions, continuer récursivement
                            if (findAllSolutions) {
                                backtrack();
                                if (solutionsCount >= maxSolutions) return;
                            } else {
                                // Sinon, juste continuer jusqu'à trouver une solution ou pas
                                if (backtrack()) return true;
                            }

                            // Backtrack
                            grid[row][col] = 0;
                        }
                    }
                    return false; // Pas de solution trouvée pour cette position
                }
            }
        }

        // Grille complète trouvée
        solutionsCount++;
        return findAllSolutions ? true : !findAllSolutions; // Retourner false si on cherche juste une, pour continuer à chercher
    }

    backtrack();

    return findAllSolutions ? solutionsCount : (solutionsCount > 0);
}

// Vérifier si un mouvement est valide pour une grille donnée (utilité pour solveSudoku)
function isValidMoveInGrid(grid, row, col, num) {
    // Vérifier la ligne
    for (let i = 0; i < 9; i++) {
        if (grid[row][i] === num) return false;
    }

    // Vérifier la colonne
    for (let i = 0; i < 9; i++) {
        if (grid[i][col] === num) return false;
    }

    // Vérifier le bloc 3x3
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (grid[startRow + i][startCol + j] === num) return false;
        }
    }

    return true;
}

// Vérifier si la victoire est atteinte
function checkWin() {
    // Vérifier si toutes les cellules sont remplies et correctes
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (sudokuGrid[row][col] === 0 || sudokuGrid[row][col] !== solutionGrid[row][col]) {
                return false;
            }
        }
    }
    return true;
}

// Supprimer des cellules pour créer le puzzle avec vérification d'unicité
function removeCells(targetRemovedCount) {
    const positions = [];
    for (let i = 0; i < 81; i++) {
        positions.push(i);
    }
    shuffleArray(positions);

    let removedCount = 0;
    let attempts = 0;
    const maxAttempts = positions.length * 2; // Limiter pour éviter une boucle infinie

    for (let i = 0; i < positions.length && removedCount < targetRemovedCount && attempts < maxAttempts; i++, attempts++) {
        const pos = positions[i];
        const row = Math.floor(pos / 9);
        const col = pos % 9;

        // Sauter si déjà vide
        if (sudokuGrid[row][col] === 0) continue;

        // Sauvegarder la valeur avant de la supprimer
        const originalValue = sudokuGrid[row][col];
        sudokuGrid[row][col] = 0;

        // Créer une copie de la grille pour tester
        const testGrid = sudokuGrid.map(r => r.slice());

        // Vérifier l'unicité de la solution
        const solutionsCount = solveSudoku(testGrid, true, 2); // Chercher au plus 2 solutions

        if (solutionsCount === 1) {
            // Unique solution, garder la suppression
            removedCount++;
        } else {
            // Plusieurs solutions ou impossible, restaurer
            sudokuGrid[row][col] = originalValue;
        }
    }

    // Si on n'a pas atteint le nombre cible, procéder avec les suppressions restantes
    // de manière plus agressive (sans vérifier l'unicité) pour éviter de rester bloqué
    if (removedCount < targetRemovedCount) {
        for (let i = 0; i < positions.length && removedCount < targetRemovedCount; i++) {
            const pos = positions[i];
            const row = Math.floor(pos / 9);
            const col = pos % 9;
            if (sudokuGrid[row][col] !== 0) {
                sudokuGrid[row][col] = 0;
                removedCount++;
            }
        }
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

        // Déterminer la couleur du texte
        let textColor = 'black'; // Couleur par défaut
        let isIncorrect = false;
        if (value !== 0 && initialGrid[row][col] === 0) { // Cellule remplie par le joueur
            if (value === solutionGrid[row][col]) {
                textColor = 'black'; // Correct
            } else {
                textColor = 'red'; // Incorrect
                isIncorrect = true;
            }
        }

        cell.style.color = textColor;
        cell.textContent = value || '';
        cell.classList.toggle('fixed', initialGrid[row][col] !== 0);
        cell.classList.toggle('incorrect', isIncorrect);

        if (hintsVisible && value === 0) {
            showHints(cell, row, col);
        } else {
            cell.innerHTML = value || '';
        }
    });
}

// Afficher les candidats possibles
function showHints(cell, row, col) {
    const hints = Array(9).fill(null);
    for (let num = 1; num <= 9; num++) {
        if (isValidMove(row, col, num) && !maskedCandidates[row][col][num]) {
            // Position dans la mini-grille 3x3 : transform(K, B=3) → (K+1-1)%B, floor((K+1-1)/B)
            // Pour K=num-1: ligne = floor((num-1)/3), colonne = (num-1)%3
            const hintIndex = num - 1;
            hints[hintIndex] = num;
        }
    }

    // Créer les divs avec fond couleur si marqués
    const hintDivs = hints.map((num, index) => {
        const numValue = index + 1;
        let className = '';
        if (highlightedCandidates[row][col][numValue]) {
            className = 'hint-highlighted';
        } else if (redMarkedCandidates[row][col][numValue]) {
            className = 'hint-red';
        }
        return `<div class="${className}">${num || ''}</div>`;
    });

    cell.innerHTML = '<div class="hints">' + hintDivs.join('') + '</div>';
}

// Sélectionner une cellule
function selectCell(cell) {
    if (selectedCell) {
        selectedCell.classList.remove('selected');
    }
    selectedCell = cell;
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    selectedValue = sudokuGrid[row][col];
    cell.classList.add('selected');
    cell.focus();
    highlightRelated();
    updateHintsHighlighting();
    updateNumberPadState();
}

// Gestion des touches
function handleKeyPress(event) {
    if (!selectedCell) return;

    const row = parseInt(selectedCell.dataset.row);
    const col = parseInt(selectedCell.dataset.col);

    if (initialGrid[row][col] !== 0) return; // Cellule fixe

    const key = event.key;

    if (isCustomMode) {
        // Mode création personnalisée : insertion libre sans vérification de validité + modes crayon
        if (highlightMode && key >= '1' && key <= '9') {
            // (Dé)marquer un candidat en jaune
            const num = parseInt(key);
            highlightedCandidates[row][col][num] = !highlightedCandidates[row][col][num];
            updateBoard();
            updateCandidateBtnStates();
            addToHistory(sudokuGrid, maskedCandidates, highlightedCandidates);
            clearMessage();
        } else if (redMode && key >= '1' && key <= '9') {
            // (Dé)marquer un candidat en rouge
            const num = parseInt(key);
            redMarkedCandidates[row][col][num] = !redMarkedCandidates[row][col][num];
            updateBoard();
            updateCandidateBtnStates();
            addToHistory(sudokuGrid, maskedCandidates, highlightedCandidates, redMarkedCandidates);
            clearMessage();
        } else if (maskMode && key >= '1' && key <= '9') {
            // Masquer un candidat
            const num = parseInt(key);
            if (!maskedCandidates[row][col][num]) {
                maskedCandidates[row][col][num] = true;
                updateBoard();
                updateCandidateBtnStates();
                addToHistory(sudokuGrid, maskedCandidates, highlightedCandidates);
                clearMessage();
            }
        } else if (key >= '1' && key <= '9') {
            sudokuGrid[row][col] = parseInt(key);
            updateBoard();
            addToHistory(sudokuGrid);
            clearMessage();
        } else if (key === 'Backspace' || key === 'Delete') {
            sudokuGrid[row][col] = 0;
            updateBoard();
            addToHistory(sudokuGrid);
            clearMessage();
        }
    } else {
        // Mode jeu normal : vérifications de validité
        if (highlightMode && key >= '1' && key <= '9') {
            // (Dé)marquer un candidat en jaune
            const num = parseInt(key);
            if (isValidMove(row, col, num)) {
                highlightedCandidates[row][col][num] = !highlightedCandidates[row][col][num];
                updateBoard();
                updateCandidateBtnStates();
                addToHistory(sudokuGrid, maskedCandidates, highlightedCandidates);
                clearMessage();
            }
        } else if (redMode && key >= '1' && key <= '9') {
            // (Dé)marquer un candidat en rouge
            const num = parseInt(key);
            if (isValidMove(row, col, num)) {
                redMarkedCandidates[row][col][num] = !redMarkedCandidates[row][col][num];
                updateBoard();
                updateCandidateBtnStates();
                addToHistory(sudokuGrid, maskedCandidates, highlightedCandidates, redMarkedCandidates);
                clearMessage();
            }
        } else if (maskMode && key >= '1' && key <= '9') {
            // Masquer un candidat
            const num = parseInt(key);
            if (isValidMove(row, col, num) && !maskedCandidates[row][col][num]) {
                maskedCandidates[row][col][num] = true;
                updateBoard();
                updateCandidateBtnStates();
                addToHistory(sudokuGrid, maskedCandidates, highlightedCandidates);
                clearMessage();
            }
        } else if (key >= '1' && key <= '9') {
            const oldValue = sudokuGrid[row][col];
            sudokuGrid[row][col] = parseInt(key);
            updateBoard();
            addToHistory(sudokuGrid);
            clearMessage();
            // Vérifier la victoire automatiquement
            if (checkWin()) {
                showMessage('Félicitations ! Solution correcte !', 'success');
            }
        } else if (key === 'Backspace' || key === 'Delete') {
            const oldValue = sudokuGrid[row][col];
            sudokuGrid[row][col] = 0;
            updateBoard();
            addToHistory(sudokuGrid);
            clearMessage();
        }
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
    updateHintsIndicator();
    updateBoard();
}

// Mettre à jour l'indicateur des candidats
function updateHintsIndicator() {
    const indicator = document.getElementById('hints-indicator');
    if (hintsVisible) {
        indicator.classList.add('active');
    } else {
        indicator.classList.remove('active');
    }
}

// Mettre à jour l'état visuel des boutons candidats
function updateCandidateBtnStates() {
    const maskBtn = document.getElementById('mask-hint');
    const highlightBtn = document.getElementById('highlight-hint');
    const redBtn = document.getElementById('red-hint');
    if (maskMode) {
        maskBtn.classList.add('active');
    } else {
        maskBtn.classList.remove('active');
    }
    if (highlightMode) {
        highlightBtn.classList.add('active');
    } else {
        highlightBtn.classList.remove('active');
    }
    if (redMode) {
        redBtn.classList.add('active');
    } else {
        redBtn.classList.remove('active');
    }
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

    // Mettre en évidence les autres cellules avec la même valeur
    if (selectedValue !== 0) {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (sudokuGrid[r][c] === selectedValue && (r !== row || c !== col)) {
                    document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`).classList.add('same-value');
                }
            }
        }
    }
}

// Effacer les mises en évidence
function clearHighlights() {
    document.querySelectorAll('.cell.related').forEach(cell => cell.classList.remove('related'));
    document.querySelectorAll('.cell.same-value').forEach(cell => cell.classList.remove('same-value'));
}

// Mettre à jour la mise en évidence des candidats
function updateHintsHighlighting() {
    // Effacer toutes les classes hint-selected
    document.querySelectorAll('.hint-selected').forEach(hint => hint.classList.remove('hint-selected'));

    if (selectedValue === 0 || !hintsVisible) return;

    // Ajouter la classe hint-selected aux candidats correspondants dans les cases vides
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        if (sudokuGrid[row][col] === 0) {
            const candidateDivs = cell.querySelectorAll('.hints > div');
            candidateDivs.forEach(div => {
                if (div.textContent === selectedValue.toString()) {
                    div.classList.add('hint-selected');
                }
            });
        }
    });
}

// Afficher un message
function showMessage(text, type) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = 'message ' + type;
}

// Ajouter à l'historique
function addToHistory(grid, masked = null, highlighted = null, red = null) {
    // Supprimer tout ce qui vient après l'index actuel
    history = history.slice(0, historyIndex + 1);
    // Ajouter le nouvel état (grille et candidats masqués)
    const state = {
        grid: JSON.parse(JSON.stringify(grid)),
        maskedCandidates: masked ? JSON.parse(JSON.stringify(masked)) : JSON.parse(JSON.stringify(maskedCandidates)),
        highlightedCandidates: highlighted ? JSON.parse(JSON.stringify(highlighted)) : JSON.parse(JSON.stringify(highlightedCandidates)),
        redMarkedCandidates: red ? JSON.parse(JSON.stringify(red)) : JSON.parse(JSON.stringify(redMarkedCandidates))
    };
    history.push(state);
    historyIndex = history.length - 1;
}

// Annuler
function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        const prevState = history[historyIndex];
        sudokuGrid = JSON.parse(JSON.stringify(prevState.grid));
        maskedCandidates = JSON.parse(JSON.stringify(prevState.maskedCandidates));
        highlightedCandidates = JSON.parse(JSON.stringify(prevState.highlightedCandidates));
        redMarkedCandidates = JSON.parse(JSON.stringify(prevState.redMarkedCandidates));
        updateBoard();
        clearMessage();
    }
}

// Rétablir
function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        const nextState = history[historyIndex];
        sudokuGrid = JSON.parse(JSON.stringify(nextState.grid));
        maskedCandidates = JSON.parse(JSON.stringify(nextState.maskedCandidates));
        highlightedCandidates = JSON.parse(JSON.stringify(nextState.highlightedCandidates));
        redMarkedCandidates = JSON.parse(JSON.stringify(nextState.redMarkedCandidates));
        updateBoard();
        clearMessage();
    }
}

// Retour au menu
function showMenu() {
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('game-container').classList.add('hidden');
    // Réafficher le titre du jeu
    document.getElementById('game-title').classList.remove('hidden');
    // Cacher le bouton "Démarrer le Jeu" quand on retourne au menu
    document.getElementById('start-custom-game').classList.add('hidden');
}

// Mettre à jour l'état des boutons du numéro-pad
function updateNumberPadState() {
    const buttons = document.querySelectorAll('.number-pad-button');

    if (!selectedCell) {
        // Aucune cellule sélectionnée, tous les boutons actifs
        buttons.forEach(btn => btn.classList.remove('invalid'));
        return;
    }

    const row = parseInt(selectedCell.dataset.row);
    const col = parseInt(selectedCell.dataset.col);

    // Si cellule fixe, tous les boutons invalides
    if (initialGrid[row][col] !== 0) {
        buttons.forEach(btn => btn.classList.add('invalid'));
        return;
    }

    // Pour chaque bouton, vérifier si le chiffre est valide
    buttons.forEach(button => {
        const num = parseInt(button.textContent);
        if (isValidMove(row, col, num)) {
            button.classList.remove('invalid');
        } else {
            button.classList.add('invalid');
        }
    });
}

// Gestionnaire d'événement pour les boutons du numéro-pad
function onNumberPadClick(num) {
    if (!selectedCell) return;

    const row = parseInt(selectedCell.dataset.row);
    const col = parseInt(selectedCell.dataset.col);

    if (initialGrid[row][col] !== 0) return; // Cellule fixe

    if (isCustomMode) {
        // Mode création personnalisée : insertion libre + modes crayon
        if (highlightMode && isValidMove(row, col, num)) {
            // (Dé)marquer un candidat en jaune avec les boutons du pad
            highlightedCandidates[row][col][num] = !highlightedCandidates[row][col][num];
            updateBoard();
            updateCandidateBtnStates();
            addToHistory(sudokuGrid, maskedCandidates, highlightedCandidates);
            clearMessage();
        } else if (redMode && isValidMove(row, col, num)) {
            // (Dé)marquer un candidat en rouge avec les boutons du pad
            redMarkedCandidates[row][col][num] = !redMarkedCandidates[row][col][num];
            updateBoard();
            updateCandidateBtnStates();
            addToHistory(sudokuGrid, maskedCandidates, highlightedCandidates, redMarkedCandidates);
            clearMessage();
        } else if (maskMode && isValidMove(row, col, num) && !maskedCandidates[row][col][num]) {
            // Masquer un candidat en mode crayon avec les boutons du pad
            maskedCandidates[row][col][num] = true;
            updateBoard();
            updateCandidateBtnStates();
            addToHistory(sudokuGrid, maskedCandidates);
            clearMessage();
        } else if (!maskMode && !highlightMode && !redMode) {
            // Mode insertion normale : insertion libre
            sudokuGrid[row][col] = num;
            updateBoard();
            addToHistory(sudokuGrid);
            clearMessage();
        }
    } else {
        // Mode jeu normal : vérifications de validité
        if (highlightMode && isValidMove(row, col, num)) {
            // (Dé)marquer un candidat en jaune avec les boutons du pad
            highlightedCandidates[row][col][num] = !highlightedCandidates[row][col][num];
            updateBoard();
            updateCandidateBtnStates();
            addToHistory(sudokuGrid, maskedCandidates, highlightedCandidates);
            clearMessage();
        } else if (redMode && isValidMove(row, col, num)) {
            // (Dé)marquer un candidat en rouge avec les boutons du pad
            redMarkedCandidates[row][col][num] = !redMarkedCandidates[row][col][num];
            updateBoard();
            updateCandidateBtnStates();
            addToHistory(sudokuGrid, maskedCandidates, highlightedCandidates, redMarkedCandidates);
            clearMessage();
        } else if (maskMode && isValidMove(row, col, num) && !maskedCandidates[row][col][num]) {
            // Masquer un candidat en mode crayon
            maskedCandidates[row][col][num] = true;
            updateBoard();
            updateCandidateBtnStates();
            addToHistory(sudokuGrid, maskedCandidates);
            clearMessage();
        } else if (!maskMode && !isValidMove(row, col, num)) {
            return; // Mouvement invalide, ne rien faire
        } else if (!maskMode) {
            // Placer le chiffre si mode normal et mouvement valide
            sudokuGrid[row][col] = num;
            selectedValue = num; // Mettre à jour la valeur sélectionnée
            updateBoard();
            updateHintsHighlighting(); // Mettre à jour la mise en évidence des candidats
            addToHistory(sudokuGrid);
            clearMessage();
            updateNumberPadState(); // Mettre à jour après insertion
            // Vérifier la victoire automatiquement
            if (checkWin()) {
                showMessage('Félicitations ! Solution correcte !', 'success');
            }
        }
    }
}

// Effacer le message
function clearMessage() {
    document.getElementById('message').textContent = '';
    document.getElementById('message').className = 'message';
}

// Système d'indices intelligents

// Écouteur d'événement pour le bouton indice
document.getElementById('hint-btn').addEventListener('click', provideHint);

// Calculer tous les candidats possibles pour la grille actuelle
function calculateCandidates() {
    const candidates = Array(9).fill().map(() => Array(9).fill().map(() => []));

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (sudokuGrid[row][col] === 0) {
                candidates[row][col] = [];
                for (let num = 1; num <= 9; num++) {
                    if (isValidMove(row, col, num)) {
                        candidates[row][col].push(num);
                    }
                }
            }
        }
    }

    return candidates;
}

// Offrir un indice au joueur
function provideHint() {
    const hintMessage = document.getElementById('hint-message');

    // Si un indice est déjà affiché, le masquer
    if (hintMessage.classList.contains('visible')) {
        hintMessage.classList.remove('visible');
        // Supprimer la mise en évidence des cellules
        document.querySelectorAll('.hint-highlight').forEach(cell => {
            cell.classList.remove('hint-highlight');
        });
        return;
    }

    // Vérifier d'abord les techniques faciles
    const hint = findEasyHint();

    if (hint) {
        // Afficher le message d'indice
        hintMessage.innerHTML = hint.message;
        hintMessage.classList.add('visible');

        // Mettre en évidence les cellules concernées si nécessaire
        if (hint.cellsToHighlight) {
            hint.cellsToHighlight.forEach(cell => {
                cell.classList.add('hint-highlight');
            });
        }
    } else {
        hintMessage.innerHTML = "<strong>Aucune technique d'indice disponible pour le moment.</strong> Essayez d'activer l'affichage des candidats (🔢) pour découvrir plus de possibilités.";
        hintMessage.classList.add('visible');
    }
    // Plus de timeout - l'indice reste visible jusqu'au prochain clic
}

// Trouver un indice facile
function findEasyHint() {
    const candidates = calculateCandidates();

    // 1. Recherche des "Single Candidates" (cellules avec un seul candidat possible)
    const singleCandidate = findSingleCandidate(candidates);
    if (singleCandidate) {
        return {
            message: `La cellule <strong>${getCellNotation(singleCandidate.row, singleCandidate.col)}</strong> n'accepte que le chiffre <strong>${singleCandidate.value}</strong>. C'est un candidat unique (nude single).`,
            cellsToHighlight: [document.querySelector(`.cell[data-row="${singleCandidate.row}"][data-col="${singleCandidate.col}"]`)]
        };
    }

    // 2. Recherche des "Hidden Singles" (candidats qui n'apparaissent qu'une fois dans une unité)
    const hiddenSingle = findHiddenSingle(candidates);
    if (hiddenSingle) {
        return {
            message: `Dans ${hiddenSingle.unitType}, le chiffre <strong>${hiddenSingle.digit}</strong> ne peut être placé que dans la cellule <strong>${getCellNotation(hiddenSingle.row, hiddenSingle.col)}</strong>. C'est un candidat caché (hidden single).`,
            cellsToHighlight: [document.querySelector(`.cell[data-row="${hiddenSingle.row}"][data-col="${hiddenSingle.col}"]`)]
        };
    }

    // 3. Recherche des cellules manquant un dernier chiffre possible
    const lastDigitInUnit = findLastDigitInUnit(candidates);
    if (lastDigitInUnit) {
        return {
            message: `Dans ${lastDigitInUnit.unitType}, il ne manque que le chiffre <strong>${lastDigitInUnit.digit}</strong> à placer. Il va dans la cellule <strong>${getCellNotation(lastDigitInUnit.row, lastDigitInUnit.col)}</strong>.`,
            cellsToHighlight: [document.querySelector(`.cell[data-row="${lastDigitInUnit.row}"][data-col="${lastDigitInUnit.col}"]`)]
        };
    }

    // 4. Recherche des paires nues simples
    const nakedPair = findNakedPair(candidates);
    if (nakedPair) {
        const cells = nakedPair.cells.map(([r, c]) => document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`));
        return {
            message: `Les cellules <strong>${nakedPair.cells.map(([r, c]) => getCellNotation(r, c)).join(' et ')}</strong> forment une paire nue avec les chiffres <strong>${nakedPair.digits.join(' et ')}</strong>. Ces chiffres ne peuvent pas être utilisés ailleurs dans leurs unités.`,
            cellsToHighlight: cells
        };
    }

    // 4b. Recherche des triplets nus
    const nakedTriple = findNakedTriple(candidates);
    if (nakedTriple) {
        const cells = nakedTriple.cells.map(([r, c]) => document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`));
        return {
            message: `Les cellules <strong>${nakedTriple.cells.map(([r, c]) => getCellNotation(r, c)).join(', ')}</strong> forment un triplet nu avec les chiffres <strong>${nakedTriple.digits.sort().join(', ')}</strong>. Ces chiffres ne peuvent pas être utilisés ailleurs dans leur ${nakedTriple.unitType}.`,
            cellsToHighlight: cells
        };
    }

    // 4c. Recherche des triplets cachés
    const hiddenTriple = findHiddenTriple(candidates);
    if (hiddenTriple) {
        const cells = hiddenTriple.cells.map(([r, c]) => document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`));
        return {
            message: `Dans ${hiddenTriple.unitType}, les cellules <strong>${hiddenTriple.cells.map(([r, c]) => getCellNotation(r, c)).join(', ')}</strong> ne peuvent contenir que les chiffres <strong>${hiddenTriple.digits.sort().join(', ')}</strong>. C'est un triplet caché.`,
            cellsToHighlight: cells
        };
    }

    // 5. Recherche d'un Y-Wing (technique avancée)
    const yWing = findYWing(candidates);
    if (yWing) {
        const cells = yWing.cells.map(([r, c]) => document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`));
        return {
            message: `Y-Wing détecté ! Les cellules <strong>${yWing.cells.map(([r, c]) => getCellNotation(r, c)).join(', ')}</strong> forment un triangle. Le chiffre <strong>${yWing.digitToEliminate}</strong> peut être éliminé de la cellule <strong>${getCellNotation(yWing.eliminationCell[0], yWing.eliminationCell[1])}</strong>.`,
            cellsToHighlight: cells
        };
    }

    // 6. Recherche d'un X-Wing (technique avancée - Fish 2x2)
    const xWing = findXWing(candidates);
    if (xWing) {
        const cells = xWing.cells.map(([r, c]) => document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`));
        return {
            message: `X-Wing détecté ! Pour le chiffre <strong>${xWing.digit}</strong>, les cellules <strong>${xWing.cells.map(([r, c]) => getCellNotation(r, c)).join(', ')}</strong> forment un rectangle. Ce chiffre peut être éliminé des autres cellules dans ces mêmes <strong>${xWing.type}es</strong>.`,
            cellsToHighlight: cells
        };
    }

    // 7. Recherche d'un Swordfish (technique avancée - Fish 3x3)
    const swordfish = findSwordfish(candidates);
    if (swordfish) {
        const cells = swordfish.cells.map(([r, c]) => document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`));
        return {
            message: `Swordfish détecté ! Pour le chiffre <strong>${swordfish.digit}</strong>, les cellules <strong>${swordfish.cells.map(([r, c]) => getCellNotation(r, c)).join(', ')}</strong> forment un motif "poisson". Ce chiffre peut être éliminé des autres cellules dans ces mêmes <strong>${swordfish.type}es</strong>.`,
            cellsToHighlight: cells
        };
    }

    // 8. Recherche d'un Gratte-ciel (Skyscraper - technique Fish avancée)
    const skyscraper = findSkyscraper(candidates);
    if (skyscraper) {
        const cells = skyscraper.cells.map(([r, c]) => document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`));
        return {
            message: `Gratte-ciel détecté ! Pour le chiffre <strong>${skyscraper.digit}</strong>, les cellules <strong>${skyscraper.cells.map(([r, c]) => getCellNotation(r, c)).join(', ')}</strong> forment un motif en "L". Ce chiffre peut être éliminé de la cellule <strong>${getCellNotation(skyscraper.eliminationCell[0], skyscraper.eliminationCell[1])}</strong>.`,
            cellsToHighlight: cells
        };
    }

    // 9. Recherche d'un Jellyfish (technique ultime - Fish 4x4)
    const jellyfish = findJellyfish(candidates);
    if (jellyfish) {
        const cells = jellyfish.cells.map(([r, c]) => document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`));
        return {
            message: `Jellyfish détecté ! Pour le chiffre <strong>${jellyfish.digit}</strong>, les cellules <strong>${jellyfish.cells.map(([r, c]) => getCellNotation(r, c)).join(', ')}</strong> forment un patron extraordinaire de méduse. Ce chiffre peut être éliminé des autres cellules dans ces <strong>${jellyfish.type}es</strong>.`,
            cellsToHighlight: cells
        };
    }

    return null;
}

// Trouver un candidat unique (Nude Single)
function findSingleCandidate(candidates) {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (sudokuGrid[row][col] === 0 && candidates[row][col].length === 1) {
                return {
                    row: row,
                    col: col,
                    value: candidates[row][col][0]
                };
            }
        }
    }
    return null;
}

// Trouver un candidat caché (Hidden Single)
function findHiddenSingle(candidates) {
    // Vérifier les lignes
    for (let row = 0; row < 9; row++) {
        const digitCounts = {};
        const digitPositions = {};

        for (let digit = 1; digit <= 9; digit++) {
            digitCounts[digit] = 0;
            digitPositions[digit] = [];
        }

        for (let col = 0; col < 9; col++) {
            if (sudokuGrid[row][col] === 0) {
                candidates[row][col].forEach(digit => {
                    if (!digitCounts[digit]) digitCounts[digit] = 0;
                    if (!digitPositions[digit]) digitPositions[digit] = [];
                    digitCounts[digit]++;
                    digitPositions[digit].push([row, col]);
                });
            }
        }

        for (let digit = 1; digit <= 9; digit++) {
            if (digitCounts[digit] === 1) {
                return {
                    row: digitPositions[digit][0][0],
                    col: digitPositions[digit][0][1],
                    digit: digit,
                    unitType: 'cette ligne'
                };
            }
        }
    }

    // Vérifier les colonnes
    for (let col = 0; col < 9; col++) {
        const digitCounts = {};
        const digitPositions = {};

        for (let digit = 1; digit <= 9; digit++) {
            digitCounts[digit] = 0;
            digitPositions[digit] = [];
        }

        for (let row = 0; row < 9; row++) {
            if (sudokuGrid[row][col] === 0) {
                candidates[row][col].forEach(digit => {
                    if (!digitCounts[digit]) digitCounts[digit] = 0;
                    if (!digitPositions[digit]) digitPositions[digit] = [];
                    digitCounts[digit]++;
                    digitPositions[digit].push([row, col]);
                });
            }
        }

        for (let digit = 1; digit <= 9; digit++) {
            if (digitCounts[digit] === 1) {
                return {
                    row: digitPositions[digit][0][0],
                    col: digitPositions[digit][0][1],
                    digit: digit,
                    unitType: 'cette colonne'
                };
            }
        }
    }

    // Vérifier les blocs 3x3
    for (let blockRow = 0; blockRow < 3; blockRow++) {
        for (let blockCol = 0; blockCol < 3; blockCol++) {
            const digitCounts = {};
            const digitPositions = {};

            for (let digit = 1; digit <= 9; digit++) {
                digitCounts[digit] = 0;
                digitPositions[digit] = [];
            }

            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const row = blockRow * 3 + r;
                    const col = blockCol * 3 + c;
                    if (sudokuGrid[row][col] === 0) {
                        candidates[row][col].forEach(digit => {
                            if (!digitCounts[digit]) digitCounts[digit] = 0;
                            if (!digitPositions[digit]) digitPositions[digit] = [];
                            digitCounts[digit]++;
                            digitPositions[digit].push([row, col]);
                        });
                    }
                }
            }

            for (let digit = 1; digit <= 9; digit++) {
                if (digitCounts[digit] === 1) {
                    return {
                        row: digitPositions[digit][0][0],
                        col: digitPositions[digit][0][1],
                        digit: digit,
                        unitType: 'ce bloc 3×3'
                    };
                }
            }
        }
    }

    return null;
}

// Trouver la dernière position d'un chiffre dans une unité
function findLastDigitInUnit(candidates) {
    // Fonction helper pour trouver les chiffres manquants et leur emplacement possible
    function findMissingDigitInUnit(positions) {
        const digitsPresent = new Set();
        const digitToPosition = {};

        positions.forEach(([row, col]) => {
            if (sudokuGrid[row][col] !== 0) {
                digitsPresent.add(sudokuGrid[row][col]);
            } else {
                candidates[row][col].forEach(digit => {
                    if (!digitToPosition[digit]) digitToPosition[digit] = [];
                    digitToPosition[digit].push([row, col]);
                });
            }
        });

        for (let digit = 1; digit <= 9; digit++) {
            if (!digitsPresent.has(digit) && digitToPosition[digit] && digitToPosition[digit].length === 1) {
                return {
                    digit: digit,
                    row: digitToPosition[digit][0][0],
                    col: digitToPosition[digit][0][1]
                };
            }
        }

        return null;
    }

    // Vérifier les lignes
    for (let row = 0; row < 9; row++) {
        const positions = [];
        for (let col = 0; col < 9; col++) {
            positions.push([row, col]);
        }

        const result = findMissingDigitInUnit(positions);
        if (result) {
            return Object.assign(result, { unitType: `la ligne ${row + 1}` });
        }
    }

    // Vérifier les colonnes
    for (let col = 0; col < 9; col++) {
        const positions = [];
        for (let row = 0; row < 9; row++) {
            positions.push([row, col]);
        }

        const result = findMissingDigitInUnit(positions);
        if (result) {
            return Object.assign(result, { unitType: `la colonne ${String.fromCharCode(65 + col)}` });
        }
    }

    // Vérifier les blocs
    for (let blockRow = 0; blockRow < 3; blockRow++) {
        for (let blockCol = 0; blockCol < 3; blockCol++) {
            const positions = [];
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    positions.push([blockRow * 3 + r, blockCol * 3 + c]);
                }
            }

            const result = findMissingDigitInUnit(positions);
            if (result) {
                return Object.assign(result, { unitType: `le bloc 3×3 en position ${blockRow + 1},${blockCol + 1}` });
            }
        }
    }

    return null;
}

// Trouver une paire nue
function findNakedPair(candidates) {
    for (let row = 0; row < 9; row++) {
        for (let col1 = 0; col1 < 9; col1++) {
            if (sudokuGrid[row][col1] !== 0 || candidates[row][col1].length !== 2) continue;

            for (let col2 = col1 + 1; col2 < 9; col2++) {
                if (sudokuGrid[row][col2] !== 0 || candidates[row][col2].length !== 2) continue;

                // Vérifier si les candidats sont identiques
                if (JSON.stringify(candidates[row][col1].sort()) === JSON.stringify(candidates[row][col2].sort())) {
                    // Paire nue trouvée
                    return {
                        cells: [[row, col1], [row, col2]],
                        digits: candidates[row][col1].slice(),
                        unitType: 'ligne'
                    };
                }
            }
        }
    }

    return null;
}

// Trouver un triplet nu
function findNakedTriple(candidates) {
    for (let row = 0; row < 9; row++) {
        for (let col1 = 0; col1 < 9; col1++) {
            if (sudokuGrid[row][col1] !== 0 || candidates[row][col1].length < 2 || candidates[row][col1].length > 3) continue;

            for (let col2 = col1 + 1; col2 < 9; col2++) {
                if (sudokuGrid[row][col2] !== 0 || candidates[row][col2].length < 2 || candidates[row][col2].length > 3) continue;

                for (let col3 = col2 + 1; col3 < 9; col3++) {
                    if (sudokuGrid[row][col3] !== 0 || candidates[row][col3].length < 2 || candidates[row][col3].length > 3) continue;

                    // Combiner tous les candidats uniques
                    const allCandidates = [...new Set([...candidates[row][col1], ...candidates[row][col2], ...candidates[row][col3]])];

                    // Triplet nu si exactement 3 candidats différents
                    if (allCandidates.length === 3) {
                        return {
                            cells: [[row, col1], [row, col2], [row, col3]],
                            digits: allCandidates,
                            unitType: 'ligne'
                        };
                    }
                }
            }
        }
    }

    return null;
}

// Trouver un triplet caché
function findHiddenTriple(candidates) {
    // Vérifier les lignes
    for (let row = 0; row < 9; row++) {
        const digitCounts = {};
        const digitPositions = {};

        for (let digit = 1; digit <= 9; digit++) {
            digitCounts[digit] = 0;
            digitPositions[digit] = [];
        }

        for (let col = 0; col < 9; col++) {
            if (sudokuGrid[row][col] === 0) {
                candidates[row][col].forEach(digit => {
                    if (!digitCounts[digit]) digitCounts[digit] = 0;
                    if (!digitPositions[digit]) digitPositions[digit] = [];
                    digitCounts[digit]++;
                    digitPositions[digit].push([row, col]);
                });
            }
        }

        // Trouver 3 chiffres qui n'apparaissent que dans 3 cellules exactement
        const tripleCandidates = [];
        for (let digit = 1; digit <= 9; digit++) {
            if (digitCounts[digit] >= 2 && digitCounts[digit] <= 3) {
                tripleCandidates.push(digit);
            }
        }

        if (tripleCandidates.length < 3) continue;

        // Tester toutes les combinaisons de 3 chiffres
        for (let i = 0; i < tripleCandidates.length - 2; i++) {
            for (let j = i + 1; j < tripleCandidates.length - 1; j++) {
                for (let k = j + 1; k < tripleCandidates.length; k++) {
                    const tripleDigits = [tripleCandidates[i], tripleCandidates[j], tripleCandidates[k]];
                    const cellsWithTheseDigits = new Set();

                    tripleDigits.forEach(digit => {
                        digitPositions[digit].forEach(([r, c]) => {
                            cellsWithTheseDigits.add(`${r},${c}`);
                        });
                    });

                    const cellArray = Array.from(cellsWithTheseDigits);
                    const uniqueCells = cellArray.map(cellStr => cellStr.split(',').map(Number));

                    // Si ces 3 chiffres n'apparaissent que dans 3 cellules exactement
                    if (uniqueCells.length === 3) {
                        return {
                            cells: uniqueCells,
                            digits: tripleDigits,
                            unitType: 'cette ligne'
                        };
                    }
                }
            }
        }
    }

    return null;
}

// Trouver un Y-Wing (technique avancée)
function findYWing(candidates) {
    // Un Y-Wing implique 3 cellules A, B, C où :
    // - A (pivot) voit B et C
    // - B et C ne se voient pas directement
    // - A a 2 candidats [x,y]
    // - B a 2 candidats [x,z] avec z ≠ y
    // - C a 2 candidats [y,z] avec z ≠ x
    // - Donc z peut être éliminé des cellules qui voient B ET C

    for (let pivotRow = 0; pivotRow < 9; pivotRow++) {
        for (let pivotCol = 0; pivotCol < 9; pivotCol++) {
            if (sudokuGrid[pivotRow][pivotCol] !== 0 || candidates[pivotRow][pivotCol].length !== 2) continue;

            const [x, y] = candidates[pivotRow][pivotCol];

            // Chercher aile B
            for (let wingBRow = 0; wingBRow < 9; wingBRow++) {
                for (let wingBCol = 0; wingBCol < 9; wingBCol++) {
                    if (sudokuGrid[wingBRow][wingBCol] !== 0 ||
                        candidates[wingBRow][wingBCol].length !== 2 ||
                        (!cellsSeeEachOther(pivotRow, pivotCol, wingBRow, wingBCol))) continue;

                    const bCands = candidates[wingBRow][wingBCol];
                    if (!((bCands.includes(x) && !bCands.includes(y)) || (bCands.includes(y) && !bCands.includes(x)))) continue;

                    let z;
                    if (bCands.includes(x) && !bCands.includes(y)) {
                        z = bCands.find(c => c !== x);
                    } else if (bCands.includes(y) && !bCands.includes(x)) {
                        z = bCands.find(c => c !== y);
                    } else {
                        continue; // Ne devrait pas arriver
                    }

                    // Chercher aile C
                    for (let wingCRow = 0; wingCRow < 9; wingCRow++) {
                        for (let wingCCol = 0; wingCCol < 9; wingCCol++) {
                            if (sudokuGrid[wingCRow][wingCCol] !== 0 ||
                                candidates[wingCRow][wingCCol].length !== 2 ||
                                (!cellsSeeEachOther(pivotRow, pivotCol, wingCRow, wingCCol)) ||
                                cellsSeeEachOther(wingBRow, wingBCol, wingCRow, wingCCol)) continue;

                            const cCands = candidates[wingCRow][wingCCol];
                            let zC;
                            if (bCands.includes(x) && !bCands.includes(y)) {
                                // B a [x,z], donc C doit avoir [y,something]
                                if (!cCands.includes(y) || cCands.includes(x)) continue;
                                zC = cCands.find(c => c !== y);
                            } else {
                                // B a [y,z], donc C doit avoir [x,something]
                                if (!cCands.includes(x) || cCands.includes(y)) continue;
                                zC = cCands.find(c => c !== x);
                            }

                            if (zC !== z) continue; // Les z doivent matcher

                            // Trouver des cellules qui voient B ET C
                            const eliminationCells = findCellsSeeingBoth(wingBRow, wingBCol, wingCRow, wingCCol, z);

                            if (eliminationCells.length > 0) {
                                const [elimRow, elimCol] = eliminationCells[0]; // Prendre la première
                                return {
                                    cells: [[pivotRow, pivotCol], [wingBRow, wingBCol], [wingCRow, wingCCol]],
                                    digitToEliminate: z,
                                    eliminationCell: [elimRow, elimCol]
                                };
                            }
                        }
                    }
                }
            }
        }
    }

    return null;
}

// Vérifier si deux cellules se voient (ligne, colonne ou bloc commun)
function cellsSeeEachOther(r1, c1, r2, c2) {
    if (r1 === r2 && c1 === c2) return false; // Même cellule
    return r1 === r2 || c1 === c2 || (Math.floor(r1/3) === Math.floor(r2/3) && Math.floor(c1/3) === Math.floor(c2/3));
}

// Trouver les cellules qui voient les deux ailes d'un Y-Wing et contiennent le chiffre z
function findCellsSeeingBoth(bRow, bCol, cRow, cCol, z) {
    const cells = [];

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (sudokuGrid[row][col] !== 0) continue;

            // Vérifier que la cellule voit B et C
            const seesB = cellsSeeEachOther(row, col, bRow, bCol);
            const seesC = cellsSeeEachOther(row, col, cRow, cCol);

            if (seesB && seesC && candidates[row][col].includes(z)) {
                cells.push([row, col]);
            }
        }
    }

    return cells;
}

// Trouver un X-Wing (technique avancée - Fish 2x2)
function findXWing(candidates) {
    // X-Wing: 2 lignes et 2 colonnes où un candidat n'apparaît que dans les 4 intersections

    for (let digit = 1; digit <= 9; digit++) {
        // Chercher les lignes où le candidat apparaît exactement 2 fois
        const rowsWithTwoOccurrences = [];
        for (let row = 0; row < 9; row++) {
            let count = 0;
            const positions = [];
            for (let col = 0; col < 9; col++) {
                if (sudokuGrid[row][col] === 0 && candidates[row][col].includes(digit)) {
                    count++;
                    positions.push(col);
                }
            }
            if (count === 2) {
                rowsWithTwoOccurrences.push({ row: row, cols: positions });
            }
        }

        if (rowsWithTwoOccurrences.length >= 2) {
            // Tester toutes les paires de lignes possibles
            for (let i = 0; i < rowsWithTwoOccurrences.length; i++) {
                for (let j = i + 1; j < rowsWithTwoOccurrences.length; j++) {
                    const row1 = rowsWithTwoOccurrences[i];
                    const row2 = rowsWithTwoOccurrences[j];

                    // Les colonnes doivent être identiques (rectangle)
                    if (JSON.stringify(row1.cols.sort()) !== JSON.stringify(row2.cols.sort())) continue;

                    const [col1, col2] = row1.cols.sort();
                    const xwingRows = [row1.row, row2.row];

                    // Vérifier que c'est effectivement un X-Wing (uniquement ces 4 apparitions)
                    let totalOccurrences = 0;
                    for (let r = 0; r < 9; r++) {
                        for (let c = 0; c < 9; c++) {
                            if (sudokuGrid[r][c] === 0 && candidates[r][c].includes(digit)) {
                                totalOccurrences++;
                            }
                        }
                    }

                    // Le X-Wing doit être valide si il apparait exactement 4 fois
                    if (totalOccurrences !== 4) continue;

                    // X-Wing trouvé ! Rechercher les éliminations possibles
                    const eliminationCells = findXWingEliminations(candidates, digit, xwingRows, [col1, col2]);

                    if (eliminationCells.length > 0) {
                        const xwingCells = [[xwingRows[0], col1], [xwingRows[0], col2],
                                          [xwingRows[1], col1], [xwingRows[1], col2]];
                        return {
                            digit: digit,
                            cells: xwingCells,
                            type: 'ligne',
                            eliminationCell: eliminationCells[0]
                        };
                    }
                }
            }
        }

        // Même logique pour les colonnes (chercher les X-Wing basés sur colonnes)
        const colsWithTwoOccurrences = [];
        for (let col = 0; col < 9; col++) {
            let count = 0;
            const positions = [];
            for (let row = 0; row < 9; row++) {
                if (sudokuGrid[row][col] === 0 && candidates[row][col].includes(digit)) {
                    count++;
                    positions.push(row);
                }
            }
            if (count === 2) {
                colsWithTwoOccurrences.push({ col: col, rows: positions });
            }
        }

        if (colsWithTwoOccurrences.length >= 2) {
            // Tester toutes las paires de colonnes
            for (let i = 0; i < colsWithTwoOccurrences.length; i++) {
                for (let j = i + 1; j < colsWithTwoOccurrences.length; j++) {
                    const col1 = colsWithTwoOccurrences[i];
                    const col2 = colsWithTwoOccurrences[j];

                    if (JSON.stringify(col1.rows.sort()) !== JSON.stringify(col2.rows.sort())) continue;

                    const [row1, row2] = col1.rows.sort();
                    const xwingCols = [col1.col, col2.col];

                    // Vérifier total apparitions = 4
                    let totalOccurrences = 0;
                    for (let r = 0; r < 9; r++) {
                        for (let c = 0; c < 9; c++) {
                            if (sudokuGrid[r][c] === 0 && candidates[r][c].includes(digit)) {
                                totalOccurrences++;
                            }
                        }
                    }

                    if (totalOccurrences !== 4) continue;

                    const eliminationCells = findXWingEliminations(candidates, digit, [row1, row2], xwingCols);

                    if (eliminationCells.length > 0) {
                        const xwingCells = [[row1, xwingCols[0]], [row1, xwingCols[1]],
                                          [row2, xwingCols[0]], [row2, xwingCols[1]]];
                        return {
                            digit: digit,
                            cells: xwingCells,
                            type: 'colonne',
                            eliminationCell: eliminationCells[0]
                        };
                    }
                }
            }
        }
    }

    return null;
}

// Trouver les cellules où un candidat peut être éliminé dans un X-Wing
function findXWingEliminations(candidates, digit, rows, cols) {
    const eliminationCells = [];

    // Éliminer le candidat des autres cellules des mêmes lignes
    for (const row of rows) {
        for (let col = 0; col < 9; col++) {
            if (!cols.includes(col) && sudokuGrid[row][col] === 0 && candidates[row][col].includes(digit)) {
                eliminationCells.push([row, col]);
            }
        }
    }

    // Éliminer le candidat des autres cellules des mêmes colonnes
    for (const col of cols) {
        for (let row = 0; row < 9; row++) {
            if (!rows.includes(row) && sudokuGrid[row][col] === 0 && candidates[row][col].includes(digit)) {
                eliminationCells.push([row, col]);
            }
        }
    }

    return eliminationCells;
}

// Trouver un Swordfish (technique avancée - Fish 3x3)
function findSwordfish(candidates) {
    // Swordfish: extension du X-Wing à 3 lignes/colonnes
    // Pour chaque candidat, chercher 3 unités qui satisfont les contraintes du fish

    for (let digit = 1; digit <= 9; digit++) {
        // Chercher les lignes avec 2-3 apparitions du candidat
        const candidateRows = [];
        for (let row = 0; row < 9; row++) {
            let count = 0;
            const positions = [];
            for (let col = 0; col < 9; col++) {
                if (sudokuGrid[row][col] === 0 && candidates[row][col].includes(digit)) {
                    count++;
                    positions.push(col);
                }
            }
            if (count >= 2 && count <= 3) {
                candidateRows.push({ row: row, count: count, positions: positions });
            }
        }

        if (candidateRows.length >= 3) {
            // Tester tous les triplets de lignes possibles
            for (let i = 0; i < candidateRows.length - 2; i++) {
                for (let j = i + 1; j < candidateRows.length - 1; j++) {
                    for (let k = j + 1; k < candidateRows.length; k++) {
                        const selectedRows = [candidateRows[i], candidateRows[j], candidateRows[k]];

                        // Combiner toutes les colonnes uniques apparaissant dans ces 3 lignes
                        const allCols = new Set();
                        selectedRows.forEach(sr => sr.positions.forEach(col => allCols.add(col)));

                        // Pour un swordfish valide, il doit y avoir exactement 3 colonnes
                        if (allCols.size === 3) {
                            const swordfishCols = Array.from(allCols).sort();

                            // Vérifier que chaque ligne contient le candidat dans au plus 3 colonnes
                            // et qu'il n'apparaît ailleurs que dans ces colonnes pour ces lignes
                            let isValidSwordfish = true;
                            const swordfishRows = selectedRows.map(sr => sr.row);

                            // Vérifier les contraintes: maximum 3 apparitions parligne
                            for (const sr of selectedRows) {
                                if (sr.count > 3) {
                                    isValidSwordfish = false;
                                    break;
                                }
                            }

                            if (!isValidSwordfish) continue;

                            // Chercher les éliminations possibles
                            const eliminationCells = findSwordfishEliminations(candidates, digit, swordfishRows, swordfishCols);

                            if (eliminationCells.length > 0) {
                                // Construire la liste des cellules du swordfish (toutes les intersections)
                                const swordfishCells = [];
                                for (const row of swordfishRows) {
                                    for (const col of swordfishCols) {
                                        if (candidates[row][col].includes(digit)) {
                                            swordfishCells.push([row, col]);
                                        }
                                    }
                                }

                                return {
                                    digit: digit,
                                    cells: swordfishCells,
                                    type: 'ligne',
                                    eliminationCell: eliminationCells[0]
                                };
                            }
                        }
                    }
                }
            }
        }

        // Même logique pour les colonnes
        const candidateCols = [];
        for (let col = 0; col < 9; col++) {
            let count = 0;
            const positions = [];
            for (let row = 0; row < 9; row++) {
                if (sudokuGrid[row][col] === 0 && candidates[row][col].includes(digit)) {
                    count++;
                    positions.push(row);
                }
            }
            if (count >= 2 && count <= 3) {
                candidateCols.push({ col: col, count: count, positions: positions });
            }
        }

        if (candidateCols.length >= 3) {
            for (let i = 0; i < candidateCols.length - 2; i++) {
                for (let j = i + 1; j < candidateCols.length - 1; j++) {
                    for (let k = j + 1; k < candidateCols.length; k++) {
                        const selectedCols = [candidateCols[i], candidateCols[j], candidateCols[k]];

                        const allRows = new Set();
                        selectedCols.forEach(sc => sc.positions.forEach(row => allRows.add(row)));

                        if (allRows.size === 3) {
                            const swordfishRows = Array.from(allRows).sort();

                            let isValidSwordfish = true;
                            for (const sc of selectedCols) {
                                if (sc.count > 3) {
                                    isValidSwordfish = false;
                                    break;
                                }
                            }

                            if (!isValidSwordfish) continue;

                            const eliminationCells = findSwordfishEliminations(candidates, digit, swordfishRows, selectedCols.map(sc => sc.col));

                            if (eliminationCells.length > 0) {
                                const swordfishCells = [];
                                for (const row of swordfishRows) {
                                    for (const colIdx in selectedCols.map(sc => sc.col)) {
                                        const col = selectedCols[colIdx].col;
                                        if (candidates[row][col].includes(digit)) {
                                            swordfishCells.push([row, col]);
                                        }
                                    }
                                }

                                return {
                                    digit: digit,
                                    cells: swordfishCells,
                                    type: 'colonne',
                                    eliminationCell: eliminationCells[0]
                                };
                            }
                        }
                    }
                }
            }
        }
    }

    return null;
}

// Trouver les cellules où un candidat peut être éliminé dans un Swordfish
function findSwordfishEliminations(candidates, digit, rows, cols) {
    const eliminationCells = [];

    // Éliminer le candidat des autres cellules des mêmes lignes (pas dans les colonnes du swordfish)
    for (const row of rows) {
        for (let col = 0; col < 9; col++) {
            if (!cols.includes(col) && sudokuGrid[row][col] === 0 && candidates[row][col].includes(digit)) {
                eliminationCells.push([row, col]);
            }
        }
    }

    // Éliminer le candidat des autres cellules des mêmes colonnes (pas dans les lignes du swordfish)
    for (const col of cols) {
        for (let row = 0; row < 9; row++) {
            if (!rows.includes(row) && sudokuGrid[row][col] === 0 && candidates[row][col].includes(digit)) {
                eliminationCells.push([row, col]);
            }
        }
    }

    return eliminationCells;
}

// Trouver un Gratte-ciel (Skyscraper - technique Fish avancée)
function findSkyscraper(candidates) {
    // Un Gratte-ciel se produit quand deux unités (lignes ou colonnes) ont un candidat
    // qui apparaît exactement 2 fois chacune, formant un pattern en "L", et une cellule
    // adjacente peut être éliminée car elle complète virtuellement un rectangle partiel.

    for (let digit = 1; digit <= 9; digit++) {
        // Tester les Gratte-ciel basés sur lignes
        const lineBasedSkyscraper = findLineBasedSkyscraper(candidates, digit);
        if (lineBasedSkyscraper) {
            return lineBasedSkyscraper;
        }

        // Tester les Gratte-ciel basés sur colonnes
        const columnBasedSkyscraper = findColumnBasedSkyscraper(candidates, digit);
        if (columnBasedSkyscraper) {
            return columnBasedSkyscraper;
        }
    }

    return null;
}

// Trouver un Gratte-ciel basé sur les lignes
function findLineBasedSkyscraper(candidates, digit) {
    // Chercher toutes les lignes où le candidat apparaît exactement 2 fois
    const lineCandidates = [];
    for (let row = 0; row < 9; row++) {
        let count = 0;
        const positions = [];
        for (let col = 0; col < 9; col++) {
            if (sudokuGrid[row][col] === 0 && candidates[row][col].includes(digit)) {
                count++;
                positions.push(col);
            }
        }
        if (count === 2) {
            lineCandidates.push({ row: row, cols: positions });
        }
    }

    // Tester toutes les paires de lignes pour former un pattern en "L"
    for (let i = 0; i < lineCandidates.length; i++) {
        for (let j = i + 1; j < lineCandidates.length; j++) {
            const rowA = lineCandidates[i].row;
            const rowB = lineCandidates[j].row;
            const [colA1, colA2] = lineCandidates[i].cols.sort();
            const [colB1, colB2] = lineCandidates[j].cols.sort();

            // Conditions pour un Skyscraper :
            // - Une colonne commune et une colonne différente par ligne
            // - Le pattern forme un "L"
            let pivotCol, endColA, endColB;

            if (colA1 === colB1) {
                // Colonne commune à gauche
                pivotCol = colA1;
                endColA = colA2;
                endColB = colB2;
            } else if (colA1 === colB2) {
                pivotCol = colA1;
                endColA = colA2;
                endColB = colB1;
            } else if (colA2 === colB1) {
                pivotCol = colA2;
                endColA = colA1;
                endColB = colB2;
            } else if (colA2 === colB2) {
                pivotCol = colA2;
                endColA = colA1;
                endColB = colB1;
            } else {
                // Pas de colonne commune, pas un Skyscraper
                continue;
            }

            // Chercher une cellule d'élimination dans la même ligne qui voit les deux extrémités
            // L'élimination peut se produire dans rowA ou rowB
            for (let elimRow of [rowA, rowB]) {
                for (let col = 0; col < 9; col++) {
                    if (sudokuGrid[elimRow][col] === 0 && candidates[elimRow][col].includes(digit)) {
                        // Cette cellule ne doit pas faire partie du Skyscraper
                        if (col === pivotCol || col === endColA || col === endColB) continue;

                        // Vérifier si elle voit les deux extrémités de l'L
                        const seesEndA = cellsSeeEachOther(elimRow, col, rowA === elimRow ? rowA : rowB, endColA);
                        const seesEndB = cellsSeeEachOther(elimRow, col, rowA === elimRow ? rowB : rowA, endColB);

                        if (seesEndA && seesEndB) {
                            // Skyscraper trouvé !
                            return {
                                digit: digit,
                                cells: [
                                    [rowA, colA1], [rowA, colA2],
                                    [rowB, colB1], [rowB, colB2]
                                ],
                                eliminationCell: [elimRow, col]
                            };
                        }
                    }
                }
            }
        }
    }

    return null;
}

function findColumnBasedSkyscraper(candidates, digit) {
    // Même logique pour les colonnes
    const colCandidates = [];
    for (let col = 0; col < 9; col++) {
        let count = 0;
        const positions = [];
        for (let row = 0; row < 9; row++) {
            if (sudokuGrid[row][col] === 0 && candidates[row][col].includes(digit)) {
                count++;
                positions.push(row);
            }
        }
        if (count === 2) {
            colCandidates.push({ col: col, rows: positions });
        }
    }

    // Tester toutes les paires de colonnes pour former un pattern en "L"
    for (let i = 0; i < colCandidates.length; i++) {
        for (let j = i + 1; j < colCandidates.length; j++) {
            const colA = colCandidates[i].col;
            const colB = colCandidates[j].col;
            const [rowA1, rowA2] = colCandidates[i].rows.sort();
            const [rowB1, rowB2] = colCandidates[j].rows.sort();

            // Conditions pour un Skyscraper :
            // - Une ligne commune et une ligne différente par colonne
            let pivotRow, endRowA, endRowB;

            if (rowA1 === rowB1) {
                // Ligne commune en haut
                pivotRow = rowA1;
                endRowA = rowA2;
                endRowB = rowB2;
            } else if (rowA1 === rowB2) {
                pivotRow = rowA1;
                endRowA = rowA2;
                endRowB = rowB1;
            } else if (rowA2 === rowB1) {
                pivotRow = rowA2;
                endRowA = rowA1;
                endRowB = rowB2;
            } else if (rowA2 === rowB2) {
                pivotRow = rowA2;
                endRowA = rowA1;
                endRowB = rowB1;
            } else {
                // Pas de ligne commune, pas un Skyscraper
                continue;
            }

            // Chercher une cellule d'élimination dans la même colonne qui voit les deux extrémités
            for (let elimCol of [colA, colB]) {
                for (let row = 0; row < 9; row++) {
                    if (sudokuGrid[row][elimCol] === 0 && candidates[row][elimCol].includes(digit)) {
                        // Cette cellule ne doit pas faire partie du Skyscraper
                        if (row === pivotRow || row === endRowA || row === endRowB) continue;

                        // Vérifier si elle voit les deux extrémités de l'L
                        const seesEndA = cellsSeeEachOther(row, elimCol, endRowA, colA === elimCol ? colA : colB);
                        const seesEndB = cellsSeeEachOther(row, elimCol, endRowB, colA === elimCol ? colB : colA);

                        if (seesEndA && seesEndB) {
                            // Skyscraper trouvé !
                            return {
                                digit: digit,
                                cells: [
                                    [rowA1, colA], [rowA2, colA],
                                    [rowB1, colB], [rowB2, colB]
                                ],
                                eliminationCell: [row, elimCol]
                            };
                        }
                    }
                }
            }
        }
    }

    return null;
}

// Trouver un Jellyfish (technique ultime - Fish 4x4)
function findJellyfish(candidates) {
    // Jellyfish: extension du Swordfish à 4 lignes/colonnes
    // Même logique que Swordfish mais avec 4 unités au lieu de 3

    for (let digit = 1; digit <= 9; digit++) {
        // Chercher les lignes avec 2-4 apparitions du candidat
        const candidateRows = [];
        for (let row = 0; row < 9; row++) {
            let count = 0;
            const positions = [];
            for (let col = 0; col < 9; col++) {
                if (sudokuGrid[row][col] === 0 && candidates[row][col].includes(digit)) {
                    count++;
                    positions.push(col);
                }
            }
            if (count >= 2 && count <= 4) {
                candidateRows.push({ row: row, count: count, positions: positions });
            }
        }

        if (candidateRows.length >= 4) {
            // Tester tous les quadruplets de lignes possibles
            for (let i = 0; i < candidateRows.length - 3; i++) {
                for (let j = i + 1; j < candidateRows.length - 2; j++) {
                    for (let k = j + 1; k < candidateRows.length - 1; k++) {
                        for (let l = k + 1; l < candidateRows.length; l++) {
                            const selectedRows = [candidateRows[i], candidateRows[j], candidateRows[k], candidateRows[l]];

                            // Combiner toutes les colonnes uniques apparaissant dans ces 4 lignes
                            const allCols = new Set();
                            selectedRows.forEach(sr => sr.positions.forEach(col => allCols.add(col)));

                            // Pour un jellyfish valide, il doit y avoir exactement 4 colonnes
                            if (allCols.size === 4) {
                                const jellyfishCols = Array.from(allCols).sort();

                                let isValidJellyfish = true;
                                const jellyfishRows = selectedRows.map(sr => sr.row);

                                // Vérifier les contraintes: maximum 4 apparitions par ligne
                                for (const sr of selectedRows) {
                                    if (sr.count > 4) {
                                        isValidJellyfish = false;
                                        break;
                                    }
                                }

                                if (!isValidJellyfish) continue;

                                // Chercher les éliminations possibles
                                const eliminationCells = findJellyfishEliminations(candidates, digit, jellyfishRows, jellyfishCols);

                                if (eliminationCells.length > 0) {
                                    // Construire la liste des cellules du jellyfish (toutes les intersections)
                                    const jellyfishCells = [];
                                    for (const row of jellyfishRows) {
                                        for (const col of jellyfishCols) {
                                            if (candidates[row][col].includes(digit)) {
                                                jellyfishCells.push([row, col]);
                                            }
                                        }
                                    }

                                    return {
                                        digit: digit,
                                        cells: jellyfishCells,
                                        type: 'ligne',
                                        eliminationCell: eliminationCells[0]
                                    };
                                }
                            }
                        }
                    }
                }
            }
        }

        // Même logique pour les colonnes
        const candidateCols = [];
        for (let col = 0; col < 9; col++) {
            let count = 0;
            const positions = [];
            for (let row = 0; row < 9; row++) {
                if (sudokuGrid[row][col] === 0 && candidates[row][col].includes(digit)) {
                    count++;
                    positions.push(row);
                }
            }
            if (count >= 2 && count <= 4) {
                candidateCols.push({ col: col, count: count, positions: positions });
            }
        }

        if (candidateCols.length >= 4) {
            for (let i = 0; i < candidateCols.length - 3; i++) {
                for (let j = i + 1; j < candidateCols.length - 2; j++) {
                    for (let k = j + 1; k < candidateCols.length - 1; k++) {
                        for (let l = k + 1; l < candidateCols.length; l++) {
                            const selectedCols = [candidateCols[i], candidateCols[j], candidateCols[k], candidateCols[l]];

                            const allRows = new Set();
                            selectedCols.forEach(sc => sc.positions.forEach(row => allRows.add(row)));

                            if (allRows.size === 4) {
                                const jellyfishRows = Array.from(allRows).sort();

                                let isValidJellyfish = true;
                                for (const sc of selectedCols) {
                                    if (sc.count > 4) {
                                        isValidJellyfish = false;
                                        break;
                                    }
                                }

                                if (!isValidJellyfish) continue;

                                const eliminationCells = findJellyfishEliminations(candidates, digit, jellyfishRows, selectedCols.map(sc => sc.col));

                                if (eliminationCells.length > 0) {
                                    const jellyfishCells = [];
                                    for (const row of jellyfishRows) {
                                        for (const colIdx in selectedCols.map(sc => sc.col)) {
                                            const col = selectedCols[colIdx].col;
                                            if (candidates[row][col].includes(digit)) {
                                                jellyfishCells.push([row, col]);
                                            }
                                        }
                                    }

                                    return {
                                        digit: digit,
                                        cells: jellyfishCells,
                                        type: 'colonne',
                                        eliminationCell: eliminationCells[0]
                                    };
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return null;
}

// Trouver les cellules où un candidat peut être éliminé dans un Jellyfish
function findJellyfishEliminations(candidates, digit, rows, cols) {
    const eliminationCells = [];

    // Éliminer le candidat des autres cellules des mêmes lignes (pas dans les colonnes du jellyfish)
    for (const row of rows) {
        for (let col = 0; col < 9; col++) {
            if (!cols.includes(col) && sudokuGrid[row][col] === 0 && candidates[row][col].includes(digit)) {
                eliminationCells.push([row, col]);
            }
        }
    }

    // Éliminer le candidat des autres cellules des mêmes colonnes (pas dans les lignes du jellyfish)
    for (const col of cols) {
        for (let row = 0; row < 9; row++) {
            if (!rows.includes(row) && sudokuGrid[row][col] === 0 && candidates[row][col].includes(digit)) {
                eliminationCells.push([row, col]);
            }
        }
    }

    return eliminationCells;
}

// Fonction utility pour obtenir la notation d'une cellule (A1, B2, etc.)
function getCellNotation(row, col) {
    const rowLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    return `${rowLetters[row]}${col + 1}`;
}

// ===== GESTION DES GRILLES SAUVEGARDÉES =====

// Charger les grilles sauvegardées depuis localStorage
function loadSavedGrids() {
    try {
        const saved = localStorage.getItem(SAVED_GRIDS_KEY);
        savedGrids = saved ? JSON.parse(saved) : [];
        // Trier par date de création décroissante (plus récent en premier)
        savedGrids.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return savedGrids;
    } catch (error) {
        console.error('Erreur lors du chargement des grilles:', error);
        savedGrids = [];
        return [];
    }
}

// Sauvegarder une grille dans localStorage
function saveGridToStorage(gridName, grid, solution, initialCellsCount) {
    // Calculer une difficulté estimée basée sur le nombre initial de cellules remplies
    let difficulty = 'Faible';
    const filledPercentage = (initialCellsCount / 81) * 100;
    if (filledPercentage < 35) difficulty = 'Élevée';
    else if (filledPercentage < 50) difficulty = 'Moyenne';

    const gridData = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: gridName,
        createdAt: new Date().toISOString(),
        grid: JSON.parse(JSON.stringify(grid)),
        solution: JSON.parse(JSON.stringify(solution)),
        initialCells: initialCellsCount,
        difficulty: difficulty
    };

    // Charger les grilles existantes
    loadSavedGrids();

    // Vérifier la limite (10 grilles maximum)
    if (savedGrids.length >= 10) {
        // Supprimer la plus ancienne
        savedGrids.shift();
    }

    // Ajouter la nouvelle grille
    savedGrids.push(gridData);

    // Sauvegarder dans localStorage
    try {
        localStorage.setItem(SAVED_GRIDS_KEY, JSON.stringify(savedGrids));
        return true;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        showMessage('Erreur lors de la sauvegarde de la grille.', 'error');
        return false;
    }
}

// Charger une grille sauvegardée
function loadGridFromStorage(gridId) {
    loadSavedGrids();
    const gridData = savedGrids.find(grid => grid.id === gridId);
    return gridData || null;
}

// Supprimer une grille sauvegardée
function deleteSavedGrid(gridId) {
    loadSavedGrids();
    savedGrids = savedGrids.filter(grid => grid.id !== gridId);

    try {
        localStorage.setItem(SAVED_GRIDS_KEY, JSON.stringify(savedGrids));
        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        return false;
    }
}

// Calculer le nombre de cellules remplies dans une grille
function countFilledCells(grid) {
    let count = 0;
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (grid[row][col] !== 0) count++;
        }
    }
    return count;
}

// ===== INTERFACE UTILISATEUR POUR LES GRILLES SAUVEGARDÉES =====

// Afficher la boîte de dialogue de sauvegarde
function showSaveDialog() {
    // Vérifier que la grille n'est pas vide
    const filledCells = countFilledCells(sudokuGrid);
    if (filledCells === 0) {
        showMessage('Vous ne pouvez pas sauvegarder une grille vide.', 'error');
        return;
    }

    // Créer la boîte de dialogue
    const dialog = document.createElement('div');
    dialog.className = 'save-dialog-overlay';
    dialog.innerHTML = `
        <div class="save-dialog">
            <h3>💾 Sauvegarder la Grille</h3>
            <input type="text" placeholder="Nom de votre grille" maxlength="50" id="grid-name-input">
            <div class="save-dialog-actions">
                <button class="save-dialog-cancel">Annuler</button>
                <button class="save-dialog-confirm">Sauvegarder</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // Focus sur le champ input
    const inputField = document.getElementById('grid-name-input');
    inputField.focus();

    // Suggérer un nom par défaut
    const now = new Date();
    const defaultName = `Grille ${('0' + now.getDate()).slice(-2)}/${('0' + (now.getMonth() + 1)).slice(-2)} ${('0' + now.getHours()).slice(-2)}:${('0' + now.getMinutes()).slice(-2)}`;
    inputField.value = defaultName;

    // Gestionnaires d'événements
    document.querySelector('.save-dialog-cancel').addEventListener('click', () => {
        document.body.removeChild(dialog);
    });

    document.querySelector('.save-dialog-confirm').addEventListener('click', () => {
        const gridName = inputField.value.trim();
        if (!gridName) {
            alert('Veuillez donner un nom à votre grille.');
            return;
        }

        // Sauvegarder la grille avec sa solution complète
        const success = saveGridToStorage(gridName, sudokuGrid, solutionGrid, filledCells);

        if (success) {
            showMessage(`Grille "${gridName}" sauvegardée avec succès !`, 'success');
            document.body.removeChild(dialog);
        }
    });

    // Fermer avec Échap
    document.addEventListener('keydown', function closeDialog(e) {
        if (e.key === 'Escape') {
            document.body.removeChild(dialog);
            document.removeEventListener('keydown', closeDialog);
        }
    });

    // Fermer en cliquant sur l'overlay
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            document.body.removeChild(dialog);
        }
    });
}

// Afficher l'écran des grilles sauvegardées
function showSavedGrids() {
    // Masquer le menu et afficher l'écran des grilles
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('saved-grids-screen').classList.remove('hidden');

    // Charger et afficher les grilles
    renderSavedGrids();
}

// Masquer l'écran des grilles sauvegardées (retour au menu)
function hideSavedGridsScreen() {
    document.getElementById('saved-grids-screen').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
}

// Afficher les grilles sauvegardées
function renderSavedGrids() {
    const container = document.getElementById('saved-grids-list');
    const emptyMessage = document.getElementById('saved-grids-empty');

    const grids = loadSavedGrids();

    if (grids.length === 0) {
        container.innerHTML = '';
        emptyMessage.style.display = 'block';
        return;
    }

    emptyMessage.style.display = 'none';

    // Générer le HTML pour chaque grille
    container.innerHTML = grids.map(grid => `
        <div class="saved-grid-item" data-id="${grid.id}">
            <div class="saved-grid-name">${grid.name}</div>
            <div class="saved-grid-info">
                ${grid.initialCells} cellules remplies sur 81
            </div>
            <div class="saved-grid-meta">
                <span class="saved-grid-difficulty ${grid.difficulty.toLowerCase()}">${grid.difficulty}</span>
                <span class="saved-grid-date">${formatDate(grid.createdAt)}</span>
            </div>
            <div class="saved-grid-actions">
                <button class="saved-grid-load-btn" onclick="loadAndPlayGrid('${grid.id}')">Charger</button>
                <button class="saved-grid-delete-btn" onclick="confirmDeleteGrid('${grid.id}', '${grid.name}')">Supprimer</button>
            </div>
        </div>
    `).join('');
}

// Charger et démarrer une grille sauvegardée
function loadAndPlayGrid(gridId) {
    const gridData = loadGridFromStorage(gridId);
    if (!gridData) {
        showMessage('Erreur lors du chargement de la grille.', 'error');
        return;
    }

    // Basculer vers le mode création avec la grille chargée
    // Copier la grille sauvegardée
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            sudokuGrid[row][col] = gridData.grid[row][col];
            solutionGrid[row][col] = gridData.solution[row][col];
        }
    }

    // Calculer initialGrid (toutes les cellules sont modifiables en mode création)
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            initialGrid[row][col] = 0; // Tout est modifiable en création
        }
    }

    // Activer le mode création
    isCustomMode = true;

    // Masquer l'écran des grilles et afficher le jeu
    document.getElementById('saved-grids-screen').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');

    // Créer la grille et l'afficher
    createBoard();
    createNumberPad();

    // Réinitialiser l'historique du mode création
    history = [];
    historyIndex = -1;

    // Ajouter l'état initial à l'historique
    const initialState = {
        grid: JSON.parse(JSON.stringify(sudokuGrid)),
        maskedCandidates: JSON.parse(JSON.stringify(maskedCandidates)),
        highlightedCandidates: JSON.parse(JSON.stringify(highlightedCandidates)),
        redMarkedCandidates: JSON.parse(JSON.stringify(redMarkedCandidates))
    };
    history.push(initialState);
    historyIndex = 0;

    // Mettre à jour l'affichage
    updateBoard();

    // Afficher le bouton "Démarrer le Jeu"
    document.getElementById('start-custom-game').classList.remove('hidden');

    showMessage(`Grille "${gridData.name}" chargée. Modifiez-la puis cliquez sur "Démarrer le Jeu".`, 'info');
}

// Confirmer la suppression d'une grille
function confirmDeleteGrid(gridId, gridName) {
    if (confirm(`Voulez-vous vraiment supprimer la grille "${gridName}" ?`)) {
        const success = deleteSavedGrid(gridId);
        if (success) {
            renderSavedGrids(); // Recharger la liste
            showMessage('Grille supprimée avec succès.', 'success');
        } else {
            showMessage('Erreur lors de la suppression.', 'error');
        }
    }
}

// Formater une date pour l'affichage
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        // Aujourd'hui
        return `Aujourd'hui ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays === 1) {
        // Hier
        return `Hier ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays < 7) {
        // Cette semaine
        return `Il y a ${diffDays} jours`;
    } else {
        // Plus vieux
        return date.toLocaleDateString('fr-FR');
    }
}

// Mettre à jour la visibilité des boutons de contrôle selon le mode actif
function updateControlButtonsVisibility() {
    const saveBtn = document.getElementById('save-grid-btn');

    // Le bouton de sauvegarde n'est visible que dans le mode création personnalisée
    if (isCustomMode && document.getElementById('game-container').classList.contains('hidden') === false) {
        saveBtn.classList.remove('hidden');
    } else {
        saveBtn.classList.add('hidden');
    }
}

// Ajouter le style CSS pour l'indice
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = `
        .hint-highlight {
            background-color: #fff59d !important;
            animation: hint-pulse 1.5s ease-in-out infinite;
        }
        @keyframes hint-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
    `;
    document.head.appendChild(style);
});
