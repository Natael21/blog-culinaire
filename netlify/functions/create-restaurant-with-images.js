exports.handler = async (event, context) => {
    // Vérifier la méthode HTTP
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: "Method not allowed" }),
        };
    }

    try {
        console.log("=== DÉBUT DU TRAITEMENT DE LA REQUÊTE ===");
        
        // Récupérer les données du corps de la requête
        const body = JSON.parse(event.body);
        console.log("Détails de la requête:", {
            filename: body.filename,
            contentLength: body.content?.length,
            numberOfImages: body.images?.length,
            title: body.title
        });

        console.log("Détails des images reçues:", body.images?.map(img => ({
            name: img.name,
            dataLength: img.data?.length,
            isBase64: img.data?.startsWith && !img.data?.startsWith('data:') // Vérifie si c'est du base64 pur
        })));
        
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
        console.log("\n=== CRÉATION DES BLOBS POUR LES IMAGES ===");
        const imageBlobs = [];
        const imagePlaceholders = {};

        // Fonction pour vérifier si une image existe déjà
        async function checkImageExists(imagePath, baseUrl, owner, repo, branch, headers) {
            try {
                const response = await fetch(
                    `${baseUrl}/repos/${owner}/${repo}/contents/${imagePath}?ref=${branch}`,
                    { headers }
                );
                if (response.ok) {
                    const data = await response.json();
                    return { exists: true, sha: data.sha };
                }
                return { exists: false };
            } catch (error) {
                console.log(`Erreur lors de la vérification de l'image ${imagePath}:`, error);
                return { exists: false };
            }
        }

        if (images && images.length > 0) {
            for (let i = 0; i < images.length; i++) {
                const imageData = images[i];
                console.log(`\nTraitement de l'image ${i + 1}/${images.length}:`, {
                    nom: imageData.name,
                    tailleDonnées: imageData.data?.length
                });

                if (!imageData || !imageData.data) {
                    console.error(`Image ${i} invalide:`, imageData);
                    continue;
                }

                const imagePath = `images/${imageData.name}`;
                
                // Vérifier si l'image existe déjà
                const imageCheck = await checkImageExists(imagePath, baseUrl, owner, repo, branch, headers);
                
                let blobSha;
                if (imageCheck.exists) {
                    console.log(`L'image ${imageData.name} existe déjà, réutilisation du SHA:`, imageCheck.sha);
                    blobSha = imageCheck.sha;
                } else {
                    // Les données sont déjà en base64 propre
                    const base64Data = imageData.data;
                    console.log(`Préparation du blob pour ${imageData.name}:`, {
                        tailleDonnéesBase64: base64Data?.length,
                        premièresCaractères: base64Data?.substring(0, 50) + '...'
                    });

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
                        console.error(`Erreur lors de la création du blob pour l'image ${imageData.name}:`, {
                            status: blobResponse.status,
                            statusText: blobResponse.statusText,
                            error: errorData
                        });
                        throw new Error(`GitHub API Error: ${errorData.message}`);
                    }

                    const blobData = await blobResponse.json();
                    blobSha = blobData.sha;
                    console.log(`Nouveau blob créé pour ${imageData.name}:`, {
                        sha: blobSha,
                        path: imagePath
                    });
                }

                imageBlobs.push({
                    path: imagePath,
                    sha: blobSha,
                    mode: "100644",
                    type: "blob"
                });

                imagePlaceholders[imageData.name] = `/${imagePath}`;
            }
        }

        // 3. Mettre à jour les chemins d'images dans le contenu markdown
        console.log("\n=== MISE À JOUR DES CHEMINS D'IMAGES ===");
        console.log("Placeholders d'images:", imagePlaceholders);
        for (const [placeholder, path] of Object.entries(imagePlaceholders)) {
            const regex = new RegExp(placeholder, 'g');
            const occurrences = (updatedContent.match(regex) || []).length;
            console.log(`Remplacement de ${placeholder} par ${path} (${occurrences} occurrences)`);
            updatedContent = updatedContent.replace(regex, path);
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
        console.log("\n=== CRÉATION DU NOUVEAU TREE ===");
        const tree = [
            ...imageBlobs,
            {
                path: filename,
                mode: "100644",
                type: "blob",
                sha: markdownBlob.sha
            }
        ];
        console.log("Structure du tree:", {
            nombreImages: imageBlobs.length,
            cheminsImages: imageBlobs.map(blob => blob.path),
            fichierMarkdown: filename
        });

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

        console.log("\n=== RESTAURANT CRÉÉ AVEC SUCCÈS ===");
        console.log("Résumé:", {
            nombreImagesTraitées: imageBlobs.length,
            fichierMarkdown: filename,
            commitSHA: commitData.sha
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: "Restaurant créé avec succès",
                details: {
                    imagesCount: imageBlobs.length,
                    markdownFile: filename,
                    commitSHA: commitData.sha
                }
            })
        };

    } catch (error) {
        console.error("\n=== ERREUR LORS DU TRAITEMENT ===", {
            message: error.message,
            stack: error.stack
        });
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: error.message,
                details: error.stack
            })
        };
    }
}; 