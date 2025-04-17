const fs = require('fs');
const path = require('path');

exports.handler = async function(event, context) {
    console.log('Début de la fonction get-restaurants');
    try {
        // Chemin vers le dossier des restaurants (à la racine du projet)
        const currentDir = process.cwd();
        console.log('Répertoire courant:', currentDir);
        
        // Remonter d'un niveau pour atteindre la racine du projet
        const rootDir = path.join(currentDir, '..');
        console.log('Racine du projet:', rootDir);
        
        const restaurantsDir = path.join(rootDir, '_posts');
        console.log('Chemin complet du dossier _posts:', restaurantsDir);
        
        // Vérifier si le dossier existe
        if (!fs.existsSync(restaurantsDir)) {
            console.log('Le dossier _posts n\'existe pas');
            console.log('Contenu du répertoire courant:', fs.readdirSync(currentDir));
            console.log('Contenu de la racine:', fs.readdirSync(rootDir));
            return {
                statusCode: 200,
                body: JSON.stringify([])
            };
        }
        
        // Lire tous les fichiers du dossier
        const files = fs.readdirSync(restaurantsDir);
        console.log('Fichiers trouvés dans _posts:', files);
        
        // Filtrer pour ne garder que les fichiers .md
        const mdFiles = files.filter(file => file.endsWith('.md'));
        console.log('Fichiers .md trouvés:', mdFiles);
        
        // Lire chaque fichier et extraire les métadonnées
        const restaurants = mdFiles.map(filename => {
            try {
                console.log(`Traitement du fichier: ${filename}`);
                const filePath = path.join(restaurantsDir, filename);
                console.log('Chemin complet du fichier:', filePath);
                
                const content = fs.readFileSync(filePath, 'utf8');
                console.log('Contenu du fichier:', content.substring(0, 200) + '...'); // Afficher les 200 premiers caractères
                
                // Extraire les métadonnées du frontmatter
                const frontmatterMatch = content.match(/---\n([\s\S]*?)\n---/);
                if (!frontmatterMatch) {
                    console.error(`Frontmatter non trouvé dans ${filename}`);
                    return null;
                }
                
                const frontmatter = frontmatterMatch[1];
                console.log(`Frontmatter de ${filename}:`, frontmatter);
                
                const metadata = {};
                
                frontmatter.split('\n').forEach(line => {
                    const [key, ...valueParts] = line.split(':');
                    if (key && valueParts.length > 0) {
                        metadata[key.trim()] = valueParts.join(':').trim();
                    }
                });
                
                console.log(`Métadonnées extraites de ${filename}:`, metadata);
                
                // Déterminer l'état (draft ou ready)
                const state = filename.startsWith('draft-') ? 'draft' : 'ready';
                console.log(`État du fichier ${filename}:`, state);
                
                const restaurant = {
                    filename,
                    state,
                    title: metadata.title || '',
                    date: metadata.date || '',
                    image: metadata.image || '',
                    address: metadata.address || '',
                    style: metadata.style || '',
                    price: metadata.price || '',
                    rating: metadata.rating || '',
                    content: content.split('---')[2].trim()
                };
                
                console.log(`Restaurant traité:`, restaurant);
                return restaurant;
                
            } catch (error) {
                console.error(`Erreur lors de la lecture de ${filename}:`, error);
                return null;
            }
        }).filter(restaurant => restaurant !== null);
        
        console.log('Liste finale des restaurants:', restaurants);
        
        return {
            statusCode: 200,
            body: JSON.stringify(restaurants)
        };
    } catch (error) {
        console.error('Erreur globale:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Erreur lors de la récupération des restaurants' })
        };
    }
}; 