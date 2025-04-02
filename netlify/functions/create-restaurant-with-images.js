exports.handler = async (event, context) => {
    // Vérifier la méthode HTTP
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: "Method not allowed" }),
        };
    }

    try {
        // Récupérer les données du corps de la requête
        const { filename, content, images, title } = JSON.parse(event.body);

        // Utiliser le token GitHub depuis les variables d'environnement
        const githubToken = process.env.GITHUB_TOKEN;

        if (!githubToken) {
            throw new Error("La variable d'environnement GITHUB_TOKEN n'est pas configurée");
        }

        if (!filename || !content || !images || !title) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing required parameters" }),
            };
        }

        const owner = "nataelbaffou";
        const repo = "blog-culinaire";
        const branch = "main";
        const baseUrl = `https://api.github.com`;

        // Headers pour l'API GitHub
        const headers = {
            Authorization: `token ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
        };

        // 1. Récupérer la référence du dernier commit
        const refResponse = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
            { headers }
        );
        
        if (!refResponse.ok) {
            const errorData = await refResponse.json();
            throw new Error(`GitHub API Error: ${errorData.message}`);
        }
        
        const refData = await refResponse.json();
        const latestCommit = refData.object.sha;

        // 2. Récupérer le dernier tree
        const treeResponse = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/git/trees/${latestCommit}`,
            { headers }
        );
        
        if (!treeResponse.ok) {
            const errorData = await treeResponse.json();
            throw new Error(`GitHub API Error: ${errorData.message}`);
        }
        
        const treeData = await treeResponse.json();
        const baseTreeSha = treeData.sha;

        // 3. Créer les blobs et préparer le nouveau tree
        const tree = [];
        let updatedContent = content;

        // Traiter les images
        for (const image of images) {
            const imageBuffer = Buffer.from(image.data.split(",")[1], "base64");
            const imagePath = `static/images/restaurants/${filename.replace(
                ".md",
                ""
            )}/${image.name}`;

            // Créer un blob pour l'image
            const blobResponse = await fetch(
                `${baseUrl}/repos/${owner}/${repo}/git/blobs`,
                {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        content: imageBuffer.toString("base64"),
                        encoding: "base64",
                    }),
                }
            );
            
            if (!blobResponse.ok) {
                const errorData = await blobResponse.json();
                throw new Error(`GitHub API Error: ${errorData.message}`);
            }
            
            const blobData = await blobResponse.json();

            tree.push({
                path: imagePath,
                mode: "100644",
                type: "blob",
                sha: blobData.sha,
            });

            // Mettre à jour les chemins d'images dans le contenu markdown
            updatedContent = updatedContent.replace(image.name, `/${imagePath}`);
        }

        // Créer un blob pour le fichier markdown
        const markdownBlobResponse = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/git/blobs`,
            {
                method: "POST",
                headers,
                body: JSON.stringify({
                    content: updatedContent,
                    encoding: "utf-8",
                }),
            }
        );
        
        if (!markdownBlobResponse.ok) {
            const errorData = await markdownBlobResponse.json();
            throw new Error(`GitHub API Error: ${errorData.message}`);
        }
        
        const markdownBlobData = await markdownBlobResponse.json();

        tree.push({
            path: `content/restaurants/${filename}`,
            mode: "100644",
            type: "blob",
            sha: markdownBlobData.sha,
        });

        // 4. Créer un nouveau tree
        const newTreeResponse = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/git/trees`,
            {
                method: "POST",
                headers,
                body: JSON.stringify({
                    base_tree: baseTreeSha,
                    tree: tree,
                }),
            }
        );
        
        if (!newTreeResponse.ok) {
            const errorData = await newTreeResponse.json();
            throw new Error(`GitHub API Error: ${errorData.message}`);
        }
        
        const newTreeData = await newTreeResponse.json();

        // 5. Créer un nouveau commit
        const commitResponse = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/git/commits`,
            {
                method: "POST",
                headers,
                body: JSON.stringify({
                    message: `Ajout du restaurant: ${title}`,
                    tree: newTreeData.sha,
                    parents: [latestCommit],
                }),
            }
        );
        
        if (!commitResponse.ok) {
            const errorData = await commitResponse.json();
            throw new Error(`GitHub API Error: ${errorData.message}`);
        }
        
        const commitData = await commitResponse.json();

        // 6. Mettre à jour la référence
        const updateRefResponse = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
            {
                method: "PATCH",
                headers,
                body: JSON.stringify({
                    sha: commitData.sha,
                }),
            }
        );

        if (!updateRefResponse.ok) {
            const errorData = await updateRefResponse.json();
            throw new Error(`GitHub API Error: ${errorData.message}`);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Restaurant créé avec succès",
                sha: commitData.sha,
            }),
        };
    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "Une erreur est survenue lors de la création du restaurant",
                details: error.message,
            }),
        };
    }
}; 