exports.handler = async function(event, context) {
    // Vérifier que c'est une requête POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Parser le corps de la requête
        const { images } = JSON.parse(event.body);

        if (!images || !Array.isArray(images)) {
            throw new Error('Aucune image fournie');
        }

        const uploadedUrls = {
            mainImage: '',
            gallery: []
        };

        // Vérifier les doublons potentiels
        const existingFiles = new Set();

        // Uploader chaque image
        for (const imageData of images) {
            const { image, filename, isMain } = imageData;

            // Vérifier si le fichier existe déjà
            if (existingFiles.has(filename)) {
                console.warn(`Fichier en double détecté: ${filename}`);
                continue; // Skip les doublons
            }
            existingFiles.add(filename);

            // Vérifier le format de l'image
            const imageType = image.split(',')[0].split(':')[1].split(';')[0];
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageType)) {
                throw new Error(`Format d'image non supporté: ${imageType}`);
            }

            // Vérifier la taille de l'image
            const imageSize = Math.ceil((image.length * 3) / 4); // Approximative size in bytes
            if (imageSize > 5 * 1024 * 1024) { // 5MB max
                throw new Error(`Image trop volumineuse: ${Math.round(imageSize / 1024 / 1024)}MB`);
            }

            // Le nom de fichier est déjà unique grâce au hash côté client
            const finalFilename = `images/${filename}`;

            // Créer le fichier sur GitHub
            const createFileResponse = await fetch(`https://api.github.com/repos/Natael21/blog-culinaire/contents/${finalFilename}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Upload de l'image : ${filename}`,
                    content: image.split(',')[1], // Récupérer la partie base64 après le data:image/*;base64,
                    branch: 'master'
                })
            });

            if (!createFileResponse.ok) {
                const errorData = await createFileResponse.json();
                console.error('GitHub API Error:', errorData);
                throw new Error(`Erreur lors de la création du fichier: ${errorData.message}`);
            }

            // Construire l'URL de l'image
            const imageUrl = `https://raw.githubusercontent.com/Natael21/blog-culinaire/master/${finalFilename}`;

            // Stocker l'URL selon le type d'image
            if (isMain) {
                uploadedUrls.mainImage = imageUrl;
            } else {
                uploadedUrls.gallery.push(imageUrl);
            }
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ urls: uploadedUrls })
        };

    } catch (error) {
        console.error('Erreur:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: error.message })
        };
    }
}; 