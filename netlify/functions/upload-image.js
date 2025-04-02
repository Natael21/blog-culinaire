exports.handler = async function(event, context) {
    // Vérifier que c'est une requête POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Récupérer le fichier depuis le FormData
        const formData = event.body;
        const file = formData.file;
        
        if (!file) {
            throw new Error('Aucun fichier fourni');
        }

        // Générer un nom de fichier unique
        const timestamp = new Date().getTime();
        const filename = `images/${timestamp}-${file.name}`;

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
        const createFileResponse = await fetch(`https://api.github.com/repos/Natael21/blog-culinaire/contents/${filename}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Upload de l'image : ${file.name}`,
                content: file.content,
                branch: 'master'
            })
        });

        if (!createFileResponse.ok) {
            throw new Error('Erreur lors de la création du fichier');
        }

        // Construire l'URL de l'image
        const imageUrl = `https://raw.githubusercontent.com/Natael21/blog-culinaire/master/${filename}`;

        return {
            statusCode: 200,
            body: JSON.stringify({ url: imageUrl })
        };

    } catch (error) {
        console.error('Erreur:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
}; 