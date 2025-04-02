const { Octokit } = require('@octokit/rest');

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

        // Créer une instance d'Octokit avec le token GitHub
        const octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN
        });

        // Générer un nom de fichier unique
        const timestamp = new Date().getTime();
        const filename = `images/${timestamp}-${file.name}`;

        // Uploader le fichier sur GitHub
        await octokit.repos.createOrUpdateFileContents({
            owner: 'Natael21',
            repo: 'blog-culinaire',
            path: filename,
            message: `Upload de l'image : ${file.name}`,
            content: file.content,
            branch: 'master'
        });

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