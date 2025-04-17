const fs = require('fs');
const path = require('path');

exports.handler = async function(event, context) {
    try {
        // Chemin vers le dossier des restaurants
        const restaurantsDir = path.join(process.cwd(), 'content', 'restaurants');
        
        // Lire tous les fichiers du dossier
        const files = fs.readdirSync(restaurantsDir);
        
        // Filtrer pour ne garder que les fichiers .md
        const mdFiles = files.filter(file => file.endsWith('.md'));
        
        // Lire chaque fichier et extraire les métadonnées
        const restaurants = mdFiles.map(filename => {
            const filePath = path.join(restaurantsDir, filename);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Extraire les métadonnées du frontmatter
            const frontmatter = content.match(/---\n([\s\S]*?)\n---/)[1];
            const metadata = {};
            
            frontmatter.split('\n').forEach(line => {
                const [key, ...valueParts] = line.split(':');
                if (key && valueParts.length > 0) {
                    metadata[key.trim()] = valueParts.join(':').trim();
                }
            });
            
            // Déterminer l'état (draft ou ready)
            const state = filename.startsWith('draft-') ? 'draft' : 'ready';
            
            return {
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
        });
        
        return {
            statusCode: 200,
            body: JSON.stringify(restaurants)
        };
    } catch (error) {
        console.error('Erreur:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Erreur lors de la récupération des restaurants' })
        };
    }
}; 