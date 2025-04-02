const { Buffer } = require('buffer');

exports.handler = async function(event, context) {
    // Vérifier que c'est une requête POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Parser le corps de la requête
        const body = JSON.parse(event.body);
        const base64Data = body.image.split(',')[1]; // Récupérer la partie base64 après le data:image/*;base64,
        const filename = body.filename;

        if (!base64Data || !filename) {
            throw new Error('Données d\'image manquantes');
        }

        // 1. Récupérer le SHA du dernier commit
        const branchResponse = await fetch(`https://api.github.com/repos/Natael21/blog-culinaire/branches/master`, {
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!branchResponse.ok) {
            throw new Error('Erreur lors de la récupération des informations de la branche');
        }

        const branchData = await branchResponse.json();
        const lastCommitSha = branchData.commit.sha;

        // 2. Créer le fichier
        const timestamp = new Date().getTime();
        const finalFilename = `images/${timestamp}-${filename}`;

        const createFileResponse = await fetch(`https://api.github.com/repos/Natael21/blog-culinaire/contents/${finalFilename}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Upload de l'image : ${filename}`,
                content: base64Data,
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

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ url: imageUrl })
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