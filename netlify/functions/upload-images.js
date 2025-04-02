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

        // Uploader chaque image
        for (const imageData of images) {
            const { image, filename, isMain } = imageData;

            // Générer un nom de fichier unique
            const timestamp = new Date().getTime();
            const finalFilename = `images/${timestamp}-${filename}`;

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