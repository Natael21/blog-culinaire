exports.handler = async function(event, context) {
    try {
        // Configuration de l'API GitHub
        const token = process.env.GITHUB_TOKEN;
        const owner = 'Natael21';
        const repo = 'blog-culinaire';
        const path = '_upcoming';

        // Récupérer la liste des fichiers dans le dossier _upcoming
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Erreur GitHub: ${response.status} ${response.statusText}`);
        }

        const files = await response.json();

        // Filtrer pour ne garder que les fichiers .md
        const mdFiles = files.filter(file => file.name.endsWith('.md'));

        // Lire chaque fichier et extraire les métadonnées
        const restaurants = await Promise.all(mdFiles.map(async file => {
            try {
                // Récupérer le contenu du fichier
                const contentResponse = await fetch(
                    `https://api.github.com/repos/${owner}/${repo}/contents/${path}/${file.name}`,
                    {
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3.raw'
                        }
                    }
                );

                if (!contentResponse.ok) {
                    throw new Error(`Erreur lors de la lecture de ${file.name}: ${contentResponse.status} ${contentResponse.statusText}`);
                }

                const content = await contentResponse.text();

                // Extraire les métadonnées du frontmatter
                const frontmatterMatch = content.match(/---\n([\s\S]*?)\n---/);
                if (!frontmatterMatch) {
                    console.error(`Frontmatter non trouvé dans ${file.name}`);
                    return null;
                }

                const frontmatter = frontmatterMatch[1];
                const metadata = {};

                frontmatter.split('\n').forEach(line => {
                    const [key, ...valueParts] = line.split(':');
                    if (key && valueParts.length > 0) {
                        metadata[key.trim()] = valueParts.join(':').trim().replace(/^['"]|['"]$/g, '');
                    }
                });

                return {
                    id: file.name.replace('.md', ''),
                    title: metadata.title || '',
                    diet: metadata.diet || '',
                    description: metadata.description || '',
                    order: parseInt(metadata.order) || 0,
                    restaurant_type: metadata.restaurant_type || '',
                    location: metadata.location || ''
                };

            } catch (error) {
                console.error(`Erreur lors de la lecture de ${file.name}:`, error);
                return null;
            }
        }));

        // Filtrer les restaurants nuls
        const validRestaurants = restaurants.filter(restaurant => restaurant !== null);

        return {
            statusCode: 200,
            body: JSON.stringify(validRestaurants)
        };

    } catch (error) {
        console.error('Erreur lors du chargement des restaurants:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Erreur lors du chargement des restaurants' })
        };
    }
}; 