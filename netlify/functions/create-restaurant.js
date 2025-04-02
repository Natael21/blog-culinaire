exports.handler = async function(event, context) {
    // Vérifier que c'est une requête POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { filename, content, title } = JSON.parse(event.body);

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
                message: `Ajout du restaurant : ${title}`,
                content: Buffer.from(content).toString('base64'),
                branch: 'master'
            })
        });

        if (!createFileResponse.ok) {
            throw new Error('Erreur lors de la création du fichier');
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Restaurant créé avec succès' })
        };

    } catch (error) {
        console.error('Erreur:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
}; 