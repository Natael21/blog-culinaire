const { Base64 } = require('js-base64');

exports.handler = async function(event, context) {
  console.log('Function started with event:', {
    method: event.httpMethod,
    headers: event.headers,
    body: event.body
  });

  // Ensure method is POST
  if (event.httpMethod !== "POST") {
    console.log('Invalid method:', event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    // Parse the incoming data
    const data = JSON.parse(event.body);
    const { changes } = data;
    console.log('Parsed request data:', data);
    console.log('Changes to process:', changes);

    if (!changes || !Array.isArray(changes)) {
      console.log('Invalid changes format:', changes);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid request format" })
      };
    }

    // Get GitHub token from environment variable
    const githubToken = process.env.GITHUB_TOKEN;
    console.log('GitHub token available:', !!githubToken);
    
    if (!githubToken) {
      console.log('No GitHub token found in environment variables');
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'GitHub token not configured' })
      };
    }

    const config = {
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      branch: process.env.GITHUB_BRANCH || 'master'
    };

    console.log('Git configuration:', config);

    // Get the current commit SHA
    const refResponse = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/refs/heads/${config.branch}`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!refResponse.ok) {
      throw new Error(`Failed to get ref: ${refResponse.status} ${refResponse.statusText}`);
    }

    const refData = await refResponse.json();
    const currentCommitSha = refData.object.sha;

    // Get the current tree
    const treeResponse = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/trees/${currentCommitSha}?recursive=1`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!treeResponse.ok) {
      throw new Error(`Failed to get tree: ${treeResponse.status} ${treeResponse.statusText}`);
    }

    const treeData = await treeResponse.json();

    // Prepare the new tree
    let newTree = treeData.tree.filter(item => {
      // Keep files that are not being deleted
      const isMarkdownFile = item.path.startsWith('_posts/');
      
      console.log('\n=== Vérification détaillée du fichier ===');
      console.log('Chemin du fichier actuel:', item.path);
      console.log('Type du fichier:', item.type);
      console.log('Est un fichier markdown:', isMarkdownFile);
      console.log('Mode du fichier:', item.mode);
      
      // Ne supprimer que les fichiers markdown
      const shouldDelete = changes.some(change => {
        console.log('\nAnalyse du changement:', {
          type: change.type,
          filename: change.filename,
          isDelete: change.type === 'delete'
        });

        if (change.type === 'delete' && isMarkdownFile) {
          // Normaliser le nom du fichier à supprimer
          const filename = change.filename.startsWith('_posts/') 
            ? change.filename 
            : `_posts/${change.filename}`;
            
          console.log('Analyse détaillée de la suppression:', {
            filenameOriginal: change.filename,
            filenameNormalisé: filename,
            cheminFichierActuel: item.path,
            correspondance: filename === item.path
          });

          const willDelete = filename === item.path;
          if (willDelete) {
            console.log('🚨 FICHIER MARQUÉ POUR SUPPRESSION 🚨');
          }
          return willDelete;
        }
        return false;
      });

      console.log('\nRésultat final pour', item.path, ':', {
        estMarkdown: isMarkdownFile,
        seraSupprimer: shouldDelete,
        seraConserver: !shouldDelete
      });
      console.log('----------------------------------------');

      return !shouldDelete;
    });

    console.log('\n=== Résumé détaillé des changements ===');
    console.log('Nombre total de changements:', changes.length);
    console.log('Détail des changements:', changes.map(c => ({
      type: c.type,
      filename: c.filename,
      filenameComplet: c.filename.startsWith('_posts/') ? c.filename : `_posts/${c.filename}`
    })));
    console.log('Nombre de fichiers dans le nouvel arbre:', newTree.length);
    console.log('Liste des fichiers conservés:', newTree.map(item => item.path));
    console.log('=========================================\n');

    // Add new files to the tree
    const createBlobs = [];
    for (const change of changes) {
      if (change.type === 'create') {
        console.log('\n=== Processing create change ===');
        console.log('Creating blob for new file:', change.filename);
        console.log('Number of images to process:', change.images?.length || 0);
        
        // Create a blob for the markdown file
        const createMarkdownBlobResponse = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/blobs`, {
          method: 'POST',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: change.content,
            encoding: 'utf-8'
          })
        });

        if (!createMarkdownBlobResponse.ok) {
          console.error('Failed to create markdown blob:', {
            status: createMarkdownBlobResponse.status,
            statusText: createMarkdownBlobResponse.statusText,
            response: await createMarkdownBlobResponse.text()
          });
          throw new Error(`Failed to create markdown blob: ${createMarkdownBlobResponse.status} ${createMarkdownBlobResponse.statusText}`);
        }

        const markdownBlobData = await createMarkdownBlobResponse.json();
        console.log('Markdown blob created successfully:', markdownBlobData.sha);
        
        // Add the markdown file to the tree
        newTree.push({
          path: `_posts/${change.filename}`,
          mode: '100644',
          type: 'blob',
          sha: markdownBlobData.sha
        });

        // Process all images (main and gallery)
        if (change.images && change.images.length > 0) {
          console.log('\n=== Processing images ===');
          for (const image of change.images) {
            console.log('\nProcessing image:', {
              name: image.name,
              isMain: image.isMain,
              contentLength: (image.content || image.data || '').length
            });
            
            // Vérifier et nettoyer le contenu de l'image
            let imageContent = image.content || image.data;
            
            // Si le contenu contient encore l'en-tête data:image, le retirer
            if (imageContent && imageContent.includes('data:image')) {
              console.log('Cleaning data:image header from content');
              imageContent = imageContent.split(',')[1];
            }

            // S'assurer que le contenu est bien en base64
            if (!imageContent || !imageContent.match(/^[A-Za-z0-9+/=]+$/)) {
              console.error('Invalid base64 content detected for image:', image.name);
              throw new Error(`Invalid base64 content for image: ${image.name}`);
            }

            try {
              console.log('Creating blob for image:', image.name);
              const createImageBlobResponse = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/blobs`, {
                method: 'POST',
                headers: {
                  'Authorization': `token ${githubToken}`,
                  'Accept': 'application/vnd.github.v3+json',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  content: imageContent,
                  encoding: 'base64'
                })
              });

              if (!createImageBlobResponse.ok) {
                const errorData = await createImageBlobResponse.json();
                console.error('Failed to create image blob:', {
                  status: createImageBlobResponse.status,
                  statusText: createImageBlobResponse.statusText,
                  error: errorData
                });
                throw new Error(`Failed to create image blob: ${createImageBlobResponse.status} ${createImageBlobResponse.statusText} - ${JSON.stringify(errorData)}`);
              }

              const imageBlobData = await createImageBlobResponse.json();
              console.log('Image blob created successfully:', {
                name: image.name,
                sha: imageBlobData.sha
              });
              
              // Add the image file to the tree
              const imagePath = `images/${image.name}`;
              console.log('Adding image to tree:', imagePath);
              newTree.push({
                path: imagePath,
                mode: '100644',
                type: 'blob',
                sha: imageBlobData.sha
              });
            } catch (error) {
              console.error('Error processing image:', {
                imageName: image.name,
                error: error.message,
                stack: error.stack,
                response: error.response?.data
              });
              throw error;
            }
          }
        }
      }
    }

    // Create a new tree
    console.log('\n=== Creating new tree ===');
    console.log('Number of items in new tree:', newTree.length);
    console.log('Tree items:', newTree.map(item => item.path));

    const createTreeResponse = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/trees`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        base_tree: currentCommitSha,
        tree: newTree
      })
    });

    if (!createTreeResponse.ok) {
      throw new Error(`Failed to create tree: ${createTreeResponse.status} ${createTreeResponse.statusText}`);
    }

    const newTreeData = await createTreeResponse.json();

    // Create a commit message that includes both additions and deletions
    const deletions = changes.filter(c => c.type === 'delete');
    const additions = changes.filter(c => c.type === 'create');
    let commitMessage = '';

    if (deletions.length > 0 && additions.length > 0) {
      commitMessage = `Modifications des restaurants:\n\n`;
      if (additions.length > 0) {
        commitMessage += `Ajouts:\n${additions.map(c => `+ ${c.filename}`).join('\n')}\n\n`;
      }
      if (deletions.length > 0) {
        commitMessage += `Suppressions:\n${deletions.map(c => `- ${c.filename}`).join('\n')}`;
      }
    } else if (deletions.length > 0) {
      commitMessage = deletions.length === 1
        ? `Delete restaurant: ${deletions[0].filename}`
        : `Delete ${deletions.length} restaurants:\n${deletions.map(c => `- ${c.filename}`).join('\n')}`;
    } else if (additions.length > 0) {
      commitMessage = additions.length === 1
        ? `Add restaurant: ${additions[0].filename}`
        : `Add ${additions.length} restaurants:\n${additions.map(c => `+ ${c.filename}`).join('\n')}`;
    }

    const createCommitResponse = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/commits`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: commitMessage,
        tree: newTreeData.sha,
        parents: [currentCommitSha]
      })
    });

    if (!createCommitResponse.ok) {
      throw new Error(`Failed to create commit: ${createCommitResponse.status} ${createCommitResponse.statusText}`);
    }

    const commitData = await createCommitResponse.json();

    // Update the reference
    const updateRefResponse = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/refs/heads/${config.branch}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sha: commitData.sha,
        force: true
      })
    });

    if (!updateRefResponse.ok) {
      throw new Error(`Failed to update ref: ${updateRefResponse.status} ${updateRefResponse.statusText}`);
    }

    console.log('All changes processed successfully in a single commit');
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: "Changes published successfully",
        commit: commitData.sha
      })
    };
  } catch (error) {
    console.error('Error publishing changes:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Error publishing changes",
        details: error.message,
        stack: error.stack,
        response: error.response?.data
      })
    };
  }
}; 