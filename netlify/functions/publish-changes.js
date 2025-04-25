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
    console.log('Fetching current commit SHA...');
    const refResponse = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/refs/heads/${config.branch}`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!refResponse.ok) {
      const errorText = await refResponse.text();
      console.error('Failed to get ref:', {
        status: refResponse.status,
        statusText: refResponse.statusText,
        error: errorText
      });
      throw new Error(`Failed to get ref: ${refResponse.status} ${refResponse.statusText}\n${errorText}`);
    }

    const refData = await refResponse.json();
    const currentCommitSha = refData.object.sha;
    console.log('Current commit SHA:', currentCommitSha);

    // Get the current tree
    console.log('Fetching current tree...');
    const treeResponse = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/trees/${currentCommitSha}?recursive=1`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!treeResponse.ok) {
      const errorText = await treeResponse.text();
      console.error('Failed to get tree:', {
        status: treeResponse.status,
        statusText: treeResponse.statusText,
        error: errorText
      });
      throw new Error(`Failed to get tree: ${treeResponse.status} ${treeResponse.statusText}\n${errorText}`);
    }

    const treeData = await treeResponse.json();
    console.log('Current tree retrieved successfully');

    // Prepare the new tree
    let newTree = treeData.tree.filter(item => {
      // Keep files that are not being deleted
      const filePath = item.path;
      return !changes.some(change => {
        if (change.type === 'delete' || change.type === 'delete-image') {
          // Si c'est une image, utiliser le chemin tel quel
          if (change.type === 'delete-image' || change.isImage) {
            return filePath === `images/${change.filename}`;
          }
          // Si c'est un fichier dans _upcoming, utiliser le chemin tel quel
          if (change.filename.startsWith('_upcoming/')) {
            return filePath === change.filename;
          }
          // Sinon, ajouter le préfixe _posts/
          return filePath === `_posts/${change.filename}`;
        }
        return false;
      });
    });

    // Add explicit deletion entries for files to be deleted
    for (const change of changes) {
      if (change.type === 'delete' || change.type === 'delete-image') {
        let path;
        if (change.type === 'delete-image' || change.isImage) {
          path = `images/${change.filename}`;
        } else if (change.filename.startsWith('_upcoming/')) {
          path = change.filename;
        } else {
          path = `_posts/${change.filename}`;
        }
        newTree.push({
          path: path,
          mode: '100644',
          type: 'blob',
          sha: null  // This explicitly tells Git to delete the file
        });
      }
    }

    console.log('\n=== Résumé des changements ===');
    console.log('Nombre total de changements:', changes.length);
    console.log('Détail des changements:', changes.map(c => ({
      type: c.type,
      filename: c.filename,
      path: `_posts/${c.filename}`
    })));
    console.log('Nombre de fichiers dans le nouvel arbre:', newTree.length);
    console.log('Liste des fichiers conservés:', newTree.map(item => item.path));
    console.log('Liste des fichiers supprimés:', treeData.tree
      .filter(item => !newTree.some(newItem => newItem.path === item.path))
      .map(item => item.path));
    console.log('================================\n');

    // Add new files to the tree
    const createBlobs = [];
    for (const change of changes) {
      if (change.type === 'create') {
        console.log('Creating blob for new file:', change.filename);
        // Create a blob for the new file
        const createBlobResponse = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/blobs`, {
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

        if (!createBlobResponse.ok) {
          const errorText = await createBlobResponse.text();
          console.error('Failed to create blob:', {
            status: createBlobResponse.status,
            statusText: createBlobResponse.statusText,
            error: errorText
          });
          throw new Error(`Failed to create blob: ${createBlobResponse.status} ${createBlobResponse.statusText}\n${errorText}`);
        }

        const blobData = await createBlobResponse.json();
        console.log('Blob created successfully:', blobData.sha);
        
        // Déterminer le chemin correct pour le fichier
        let path;
        if (change.filename.startsWith('_upcoming/')) {
          path = change.filename;
        } else {
          path = `_posts/${change.filename}`;
        }
        
        // Add the new file to the tree
        newTree.push({
          path: path,
          mode: '100644',
          type: 'blob',
          sha: blobData.sha
        });

        // Traiter les images si elles existent
        if (change.images && Array.isArray(change.images)) {
          console.log('Processing images for file:', change.filename);
          for (const image of change.images) {
            console.log('Creating blob for image:', image.name);
            
            // Créer un blob pour l'image
            const imageBlobResponse = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/blobs`, {
              method: 'POST',
              headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                content: image.data,
                encoding: 'base64'
              })
            });

            if (!imageBlobResponse.ok) {
              const errorText = await imageBlobResponse.text();
              console.error('Failed to create image blob:', {
                imageName: image.name,
                status: imageBlobResponse.status,
                statusText: imageBlobResponse.statusText,
                error: errorText
              });
              throw new Error(`Failed to create image blob: ${imageBlobResponse.status} ${imageBlobResponse.statusText}\n${errorText}`);
            }

            const imageBlobData = await imageBlobResponse.json();
            console.log('Image blob created successfully:', imageBlobData.sha);

            // Ajouter l'image à l'arbre
            newTree.push({
              path: `images/${image.name}`,
              mode: '100644',
              type: 'blob',
              sha: imageBlobData.sha
            });
          }
        }
      }
    }

    // Create a new tree
    console.log('\n=== Creating new tree ===');
    console.log('Number of items in new tree:', newTree.length);
    console.log('Tree items:', newTree.map(item => item.path));
    
    // Diviser l'arbre en morceaux plus petits
    const CHUNK_SIZE = 50;
    const treeChunks = [];
    for (let i = 0; i < newTree.length; i += CHUNK_SIZE) {
      treeChunks.push(newTree.slice(i, i + CHUNK_SIZE));
    }

    console.log('Tree divided into chunks:', treeChunks.length);
    
    let baseTreeSha = currentCommitSha;
    let finalTreeSha = null;

    // Créer les arbres de manière séquentielle
    for (let i = 0; i < treeChunks.length; i++) {
      console.log(`Creating tree chunk ${i + 1}/${treeChunks.length}`);
      const chunk = treeChunks[i];
      
      const createTreeResponse = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/trees`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: chunk
        })
      });

      if (!createTreeResponse.ok) {
        const errorText = await createTreeResponse.text();
        console.error('Failed to create tree chunk:', {
          chunkIndex: i,
          status: createTreeResponse.status,
          statusText: createTreeResponse.statusText,
          error: errorText,
          headers: Object.fromEntries(createTreeResponse.headers.entries())
        });
        throw new Error(`Failed to create tree chunk ${i + 1}: ${createTreeResponse.status} ${createTreeResponse.statusText}\n${errorText}`);
      }

      const newTreeData = await createTreeResponse.json();
      console.log(`Tree chunk ${i + 1} created successfully:`, newTreeData.sha);
      
      baseTreeSha = newTreeData.sha;
      finalTreeSha = newTreeData.sha;
    }

    if (!finalTreeSha) {
      throw new Error('Failed to create final tree');
    }

    console.log('Final tree SHA:', finalTreeSha);

    // Create a commit message that includes both additions and deletions
    const deletions = changes.filter(c => c.type === 'delete');
    const imageDeletions = changes.filter(c => c.type === 'delete-image');
    const additions = changes.filter(c => c.type === 'create');
    let commitMessage = '';

    if (imageDeletions.length > 0) {
      commitMessage = imageDeletions.length === 1
        ? `Suppression de l'image: ${imageDeletions[0].filename}`
        : `Suppression de ${imageDeletions.length} images:\n${imageDeletions.map(c => `- ${c.filename}`).join('\n')}`;
    } else if (deletions.length > 0 && additions.length > 0) {
      commitMessage = `Modifications des restaurants:\n\n`;
      if (additions.length > 0) {
        commitMessage += `Ajouts:\n${additions.map(c => `+ ${c.filename}`).join('\n')}\n\n`;
      }
      if (deletions.length > 0) {
        commitMessage += `Suppressions:\n${deletions.map(c => `- ${c.filename}`).join('\n')}`;
      }
    } else if (deletions.length > 0) {
      commitMessage = deletions.length === 1
        ? `Suppression du restaurant: ${deletions[0].filename}`
        : `Suppression de ${deletions.length} restaurants:\n${deletions.map(c => `- ${c.filename}`).join('\n')}`;
    } else if (additions.length > 0) {
      commitMessage = additions.length === 1
        ? `Ajout du restaurant: ${additions[0].filename}`
        : `Ajout de ${additions.length} restaurants:\n${additions.map(c => `+ ${c.filename}`).join('\n')}`;
    }

    console.log('Creating commit with message:', commitMessage);
    const createCommitResponse = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/commits`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: commitMessage,
        tree: finalTreeSha,
        parents: [currentCommitSha]
      })
    });

    if (!createCommitResponse.ok) {
      const errorText = await createCommitResponse.text();
      console.error('Failed to create commit:', {
        status: createCommitResponse.status,
        statusText: createCommitResponse.statusText,
        error: errorText
      });
      throw new Error(`Failed to create commit: ${createCommitResponse.status} ${createCommitResponse.statusText}\n${errorText}`);
    }

    const commitData = await createCommitResponse.json();
    console.log('Commit created successfully:', commitData.sha);

    // Update the reference with force
    console.log('Updating Git reference with force...');
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

    console.log('GitHub reference update response:', {
      status: updateRefResponse.status,
      statusText: updateRefResponse.statusText,
      headers: Object.fromEntries(updateRefResponse.headers.entries())
    });

    if (!updateRefResponse.ok) {
      const errorText = await updateRefResponse.text();
      console.error('GitHub reference update failed:', {
        status: updateRefResponse.status,
        statusText: updateRefResponse.statusText,
        error: errorText
      });
      throw new Error(`Failed to update ref: ${updateRefResponse.status} ${updateRefResponse.statusText}\n${errorText}`);
    }

    const updatedRefData = await updateRefResponse.json();
    console.log('GitHub reference update successful:', updatedRefData);

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