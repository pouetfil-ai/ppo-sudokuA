// Variables globales
let sudokuGrid = Array(9).fill().map(() => Array(9).fill(0));
let initialGrid = Array(9).fill().map(() => Array(9).fill(0));
let solutionGrid = Array(9).fill().map(() => Array(9).fill(0)); // Grille de solution complète
let hintsVisible = false;
let selectedCell = null;
let selectedValue = 0;
let history = [];
let historyIndex = -1;
let maskedCandidates = Array(9).fill().map(() => Array(9).fill().map(() => Array(10).fill(false))); // index 1-9: true si candidat masqué
let maskMode = false; // Mode pour masquer un candidat
let highlightedCandidates = Array(9).fill().map(() => Array(9).fill().map(() => Array(10).fill(false))); // index 1-9: true si candidat marqué en jaune
let highlightMode = false; // Mode pour marquer un candidat

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
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

// Créer le numéro-pad
function createNumberPad() {
    const pad = document.getElementById('number-pad');
    pad.innerHTML = '';

    for (let num = 1; num <= 9; num++) {
        const button = document.createElement('button');
        button.className = 'number-pad-button';
        button.textContent = num;
        button.addEventListener('click', () => onNumberPadClick(num));
        pad.appendChild(button);
    }
}

// Configurer les écouteurs d'événements
function setupEventListeners() {
    document.getElementById('start-game').addEventListener('click', startGame);
    // document.getElementById('new-game').addEventListener('click', newGame); // Supprimé
    document.getElementById('menu-btn').addEventListener('click', showMenu);
    document.getElementById('undo').addEventListener('click', undo);
    document.getElementById('redo').addEventListener('click', redo);
    document.getElementById('clear-grid').addEventListener('click', clearGrid);
    document.getElementById('hints-indicator').addEventListener('click', toggleHints);
    document.getElementById('mask-hint').addEventListener('click', () => {
        maskMode = !maskMode;
        if (maskMode) highlightMode = false; // Désactiver le jaune si le noir est activé
        updateCandidateBtnStates();
        if (selectedCell) selectedCell.focus();
    });
    document.getElementById('highlight-hint').addEventListener('click', () => {
        highlightMode = !highlightMode;
        if (highlightMode) maskMode = false; // Désactiver le noir si le jaune est activé
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

    // Synchroniser la difficulté dans le sélecteur caché du jeu
    document.getElementById('difficulty').value = selectedDifficulty;

    // Créer la grille et démarrer la partie
    createBoard();
    createNumberPad();
    newGame();
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
        highlightedCandidates: JSON.parse(JSON.stringify(highlightedCandidates))
    };
    history = [initialState];
    historyIndex = 0;
    // Réinitialiser les masquages de candidats
    maskedCandidates = Array(9).fill().map(() => Array(9).fill().map(() => Array(10).fill(false)));
    highlightMode = false;
    highlightedCandidates = Array(9).fill().map(() => Array(9).fill().map(() => Array(10).fill(false)));
    maskMode = false;
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

    // Créer les divs avec fond jaune si marqués
    const hintDivs = hints.map((num, index) => {
        const numValue = index + 1;
        const className = highlightedCandidates[row][col][numValue] ? 'hint-highlighted' : '';
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
    } else if (key === 'Backspace' || key === 'Delete') {
        const oldValue = sudokuGrid[row][col];
        sudokuGrid[row][col] = 0;
        updateBoard();
        addToHistory(sudokuGrid);
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

    if (complete && valid) {
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
function addToHistory(grid, masked = null, highlighted = null) {
    // Supprimer tout ce qui vient après l'index actuel
    history = history.slice(0, historyIndex + 1);
    // Ajouter le nouvel état (grille et candidats masqués)
    const state = {
        grid: JSON.parse(JSON.stringify(grid)),
        maskedCandidates: masked ? JSON.parse(JSON.stringify(masked)) : JSON.parse(JSON.stringify(maskedCandidates)),
        highlightedCandidates: highlighted ? JSON.parse(JSON.stringify(highlighted)) : JSON.parse(JSON.stringify(highlightedCandidates))
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
        updateBoard();
        clearMessage();
    }
}

// Retour au menu
function showMenu() {
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('game-container').classList.add('hidden');
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

    if (highlightMode && isValidMove(row, col, num)) {
        // (Dé)marquer un candidat en jaune avec les boutons du pad
        highlightedCandidates[row][col][num] = !highlightedCandidates[row][col][num];
        updateBoard();
        updateCandidateBtnStates();
        addToHistory(sudokuGrid, maskedCandidates, highlightedCandidates);
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
    }
}

// Effacer le message
function clearMessage() {
    document.getElementById('message').textContent = '';
    document.getElementById('message').className = 'message';
}
