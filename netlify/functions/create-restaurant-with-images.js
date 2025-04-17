exports.handler = async (event, context) => {
    // Vérifier la méthode HTTP
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: "Method not allowed" }),
        };
    }

    try {
        console.log("Début du traitement de la requête");
        
        // Récupérer les données du corps de la requête
        const body = JSON.parse(event.body);
        console.log("Corps de la requête reçu:", {
            hasFilename: !!body.filename,
            hasContent: !!body.content,
            numberOfImages: body.images?.length,
            hasTitle: !!body.title
        });
        
        const { filename, content, images, title } = body;

        // Forcer l'état à "draft" dans le contenu markdown
        let updatedContent = content;
        if (content.includes("state:")) {
            // Remplacer l'état existant par "draft"
            updatedContent = content.replace(/state:.*$/m, "state: draft");
        } else {
            // Ajouter l'état "draft" après le titre si non présent
            updatedContent = content.replace(/title:.*$/m, `$&\nstate: draft`);
        }

        // Utiliser le token GitHub depuis les variables d'environnement
        const githubToken = process.env.GITHUB_TOKEN;
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;
        const branch = process.env.GITHUB_BRANCH || "main";

        console.log("Variables d'environnement:", {
            hasToken: !!githubToken,
            owner,
            repo,
            branch
        });

        // Vérifier que toutes les variables d'environnement nécessaires sont définies
        if (!githubToken || !owner || !repo) {
            console.error("Variables d'environnement manquantes:", {
                hasToken: !!githubToken,
                hasOwner: !!owner,
                hasRepo: !!repo
            });
            throw new Error("Variables d'environnement manquantes. Veuillez configurer GITHUB_TOKEN, GITHUB_OWNER et GITHUB_REPO");
        }

        if (!filename || !content || !title) {
            console.error("Paramètres manquants:", {
                hasFilename: !!filename,
                hasContent: !!content,
                hasTitle: !!title
            });
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing required parameters" }),
            };
        }

        const baseUrl = `https://api.github.com`;
        const headers = {
            Authorization: `token ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
        };

        // 1. Récupérer la référence du dernier commit
        console.log("Récupération de la référence du dernier commit...");
        const refResponse = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
            { headers }
        );
        
        if (!refResponse.ok) {
            const errorData = await refResponse.json();
            console.error("Erreur lors de la récupération de la référence :", errorData);
            throw new Error(`GitHub API Error: ${errorData.message}`);
        }
        
        const refData = await refResponse.json();
        const latestCommit = refData.object.sha;
        console.log("Dernier commit SHA :", latestCommit);

        // 2. Créer les blobs pour les images
        console.log("Création des blobs pour les images...");
        const imageBlobs = [];
        const imagePlaceholders = {};

        if (images && images.length > 0) {
            for (let i = 0; i < images.length; i++) {
                const imageData = images[i];
                if (!imageData || !imageData.data) {
                    console.error(`Image ${i} invalide:`, imageData);
                    continue;
                }

                // Extraire le type MIME et les données base64
                const [mimeType, base64Data] = imageData.data.split(',');
                if (!base64Data) {
                    console.error(`Format d'image ${i} invalide:`, mimeType);
                    continue;
                }

                const blobResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/git/blobs`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        content: base64Data,
                        encoding: "base64"
                    })
                });

                if (!blobResponse.ok) {
                    const errorData = await blobResponse.json();
                    console.error(`Erreur lors de la création du blob pour l'image ${i}:`, errorData);
                    throw new Error(`GitHub API Error: ${errorData.message}`);
                }

                const blobData = await blobResponse.json();
                const imagePath = `images/${imageData.name}`;
                imageBlobs.push({
                    path: imagePath,
                    sha: blobData.sha,
                    mode: "100644",
                    type: "blob"
                });

                // Stocker le placeholder pour le remplacement
                imagePlaceholders[imageData.name] = `/${imagePath}`;
            }
        }

        // 3. Mettre à jour les chemins d'images dans le contenu markdown
        console.log("Mise à jour des chemins d'images dans le markdown...");
        for (const [placeholder, path] of Object.entries(imagePlaceholders)) {
            updatedContent = updatedContent.replace(new RegExp(placeholder, 'g'), path);
        }

        // 4. Créer le blob pour le contenu markdown
        console.log("Création du blob pour le contenu markdown...");
        const markdownBlobResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/git/blobs`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                content: updatedContent,
                encoding: "utf-8"
            })
        });

        if (!markdownBlobResponse.ok) {
            const errorData = await markdownBlobResponse.json();
            console.error("Erreur lors de la création du blob markdown:", errorData);
            throw new Error(`GitHub API Error: ${errorData.message}`);
        }

        const markdownBlob = await markdownBlobResponse.json();

        // 5. Créer le nouveau tree
        const tree = [
            ...imageBlobs,
            {
                path: filename,
                mode: "100644",
                type: "blob",
                sha: markdownBlob.sha
            }
        ];

        console.log("Création du nouveau tree...");
        const treeResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/git/trees`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                base_tree: latestCommit,
                tree: tree
            })
        });

        if (!treeResponse.ok) {
            const errorData = await treeResponse.json();
            console.error("Erreur lors de la création du tree:", errorData);
            throw new Error(`GitHub API Error: ${errorData.message}`);
        }

        const treeData = await treeResponse.json();

        // 6. Créer le commit
        console.log("Création du commit...");
        const commitResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/git/commits`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                message: `Ajout du restaurant ${title}`,
                tree: treeData.sha,
                parents: [latestCommit]
            })
        });

        if (!commitResponse.ok) {
            const errorData = await commitResponse.json();
            console.error("Erreur lors de la création du commit:", errorData);
            throw new Error(`GitHub API Error: ${errorData.message}`);
        }

        const commitData = await commitResponse.json();

        // 7. Mettre à jour la référence
        console.log("Mise à jour de la référence...");
        const updateRefResponse = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
            {
                method: "PATCH",
                headers,
                body: JSON.stringify({
                    sha: commitData.sha,
                    force: false
                })
            }
        );

        if (!updateRefResponse.ok) {
            const errorData = await updateRefResponse.json();
            console.error("Erreur lors de la mise à jour de la référence:", errorData);
            throw new Error(`GitHub API Error: ${errorData.message}`);
        }

        console.log("Restaurant créé avec succès!");
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Restaurant créé avec succès" })
        };

    } catch (error) {
        console.error("Erreur:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
}; 