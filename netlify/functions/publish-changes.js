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
      const filePath = item.path;
      return !changes.some(change => 
        change.type === 'delete' && 
        filePath === `_posts/${change.filename}`
      );
    });

    // Add explicit deletion entries for files to be deleted
    for (const change of changes) {
      if (change.type === 'delete') {
        newTree.push({
          path: `_posts/${change.filename}`,
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
          throw new Error(`Failed to create blob: ${createBlobResponse.status} ${createBlobResponse.statusText}`);
        }

        const blobData = await createBlobResponse.json();
        
        // Add the new file to the tree
        newTree.push({
          path: `_posts/${change.filename}`,
          mode: '100644',
          type: 'blob',
          sha: blobData.sha
        });
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
      const errorBody = await updateRefResponse.text();
      console.error('GitHub reference update failed:', {
        status: updateRefResponse.status,
        statusText: updateRefResponse.statusText,
        body: errorBody
      });
      throw new Error(`Failed to update ref: ${updateRefResponse.status} ${updateRefResponse.statusText}\n${errorBody}`);
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