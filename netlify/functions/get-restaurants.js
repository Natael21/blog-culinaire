const axios = require('axios');

exports.handler = async function(event, context) {
    console.log('Début de la fonction get-restaurants');
    try {
        // Configuration de l'API GitHub
        const token = process.env.GITHUB_TOKEN;
        const owner = process.env.GITHUB_OWNER || 'Natael21';
        const repo = process.env.GITHUB_REPO || 'blog-culinaire';
        const branch = process.env.GITHUB_BRANCH || 'master';
        const path = '_posts';

        console.log('Configuration GitHub:', { owner, repo, branch, path });

        // Récupérer la liste des fichiers dans le dossier _posts
        const response = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        console.log('Réponse GitHub:', response.data);

        // Filtrer pour ne garder que les fichiers .md
        const mdFiles = response.data.filter(file => file.name.endsWith('.md'));
        console.log('Fichiers .md trouvés:', mdFiles);

        // Lire chaque fichier et extraire les métadonnées
        const restaurants = await Promise.all(mdFiles.map(async file => {
            try {
                console.log(`Traitement du fichier: ${file.name}`);
                
                // Récupérer le contenu du fichier
                const contentResponse = await axios.get(
                    `https://api.github.com/repos/${owner}/${repo}/contents/${path}/${file.name}`,
                    {
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3.raw'
                        }
                    }
                );

                const content = contentResponse.data;
                console.log('Contenu du fichier:', content.substring(0, 200) + '...');

                // Extraire les métadonnées du frontmatter
                const frontmatterMatch = content.match(/---\n([\s\S]*?)\n---/);
                if (!frontmatterMatch) {
                    console.error(`Frontmatter non trouvé dans ${file.name}`);
                    return null;
                }

                const frontmatter = frontmatterMatch[1];
                console.log(`Frontmatter de ${file.name}:`, frontmatter);

                const metadata = {};

                frontmatter.split('\n').forEach(line => {
                    const [key, ...valueParts] = line.split(':');
                    if (key && valueParts.length > 0) {
                        metadata[key.trim()] = valueParts.join(':').trim();
                    }
                });

                console.log(`Métadonnées extraites de ${file.name}:`, metadata);

                // Déterminer l'état (draft ou ready)
                const state = file.name.startsWith('draft-') ? 'draft' : 'ready';
                console.log(`État du fichier ${file.name}:`, state);

                const restaurant = {
                    filename: file.name,
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
                console.error(`Erreur lors de la lecture de ${file.name}:`, error);
                return null;
            }
        }));

        const validRestaurants = restaurants.filter(restaurant => restaurant !== null);
        console.log('Liste finale des restaurants:', validRestaurants);

        return {
            statusCode: 200,
            body: JSON.stringify(validRestaurants)
        };
    } catch (error) {
        console.error('Erreur globale:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Erreur lors de la récupération des restaurants' })
        };
    }
}; 