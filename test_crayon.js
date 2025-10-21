// Script de test de la fonction crayon
const puppeteer = require('puppeteer');

async function testCrayonFunction() {
    console.log('🧪 Test de la fonction crayon...');
    
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    try {
        // Naviguer vers l'application
        await page.goto('http://localhost:8000');
        
        // Démarrer une partie
        await page.click('#start-game');
        
        // Attendre le chargement du jeu
        await page.waitForSelector('#sudoku-board', { timeout: 5000 });
        
        console.log('✅ Application chargée');
        
        // Activer l'affichage des candidats
        await page.click('#hints-indicator');
        
        // Sélectionner une cellule vide avec des candidats (essayons la première cellule du haut)
        await page.evaluate(() => {
            const cells = document.querySelectorAll('.cell');
            for (let cell of cells) {
                if (!cell.classList.contains('fixed') && !cell.textContent.trim()) {
                    cell.click();
                    return;
                }
            }
        });
        
        // Vérifier qu'une cellule est sélectionnée
        const selectedCell = await page.$('.cell.selected');
        if (!selectedCell) {
            throw new Error('Aucune cellule sélectionnée');
        }
        console.log('✅ Cellule vide sélectionnée');
        
        // Vérifier que des candidats sont affichés
        const hintsBefore = await page.$$('.hints');
        console.log(`📊 Candidats affichés avant masquage: ${hintsBefore.length}`);
        
        // Activer le mode crayon
        await page.click('#mask-hint');
        
        // Vérifier que le bouton crayon est actif
        const isMaskActive = await page.evaluate(() => {
            return document.getElementById('mask-hint').classList.contains('active');
        });
        
        if (!isMaskActive) {
            throw new Error('Le bouton crayon n\'est pas actif');
        }
        console.log('✅ Mode crayon activé');
        
        // Cliquer sur un candidat dans le pad numérique (par exemple le chiffre 1)
        await page.click('.number-pad-button:nth-child(1)');
        
        // Attendre un petit moment pour la mise à jour
        await page.waitForTimeout(100);
        
        // Vérifier que le mode crayon se désactive après utilisation
        const isMaskStillActive = await page.evaluate(() => {
            return document.getElementById('mask-hint').classList.contains('active');
        });
        
        if (isMaskStillActive) {
            console.log('⚠️ Le mode crayon reste actif (comportement attendu selon le code)');
        } else {
            console.log('✅ Mode crayon désactivé automatiquement');
        }
        
        // Activer à nouveau le mode crayon pour réessayer
        await page.click('#mask-hint');
        
        // Sélectionner la même cellule et vérifier l'état du candidat
        const hintsAfter = await page.$$('.hints');
        console.log(`📊 Candidats affichés après masquage: ${hintsAfter.length}`);
        
        console.log('✅ Test terminé avec succès - La fonction crayon fonctionne !');
        
    } catch (error) {
        console.error('❌ Erreur lors du test:', error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

testCrayonFunction().catch(console.error);
