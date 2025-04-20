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

    console.log('Git configuration:', {
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      branch: process.env.GITHUB_BRANCH || 'master'
    });

    // Process each change
    for (const change of changes) {
      console.log('Processing change:', change);
      
      if (change.type === 'delete') {
        try {
          const filePath = `_posts/${change.filename}`;
          console.log(`Attempting to delete file: ${filePath}`);
          
          // First, get the file's SHA
          const getFileResponse = await fetch(`https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${filePath}`, {
            headers: {
              'Authorization': `token ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });

          console.log('Get file response status:', getFileResponse.status);

          if (!getFileResponse.ok) {
            const errorData = await getFileResponse.json();
            console.log('Error getting file:', errorData);
            if (getFileResponse.status === 404) {
              console.log(`File ${change.filename} already deleted or doesn't exist`);
              continue;
            }
            throw new Error(`GitHub API error: ${getFileResponse.status} ${getFileResponse.statusText}`);
          }

          const fileData = await getFileResponse.json();
          console.log('File data received:', { sha: fileData.sha, path: fileData.path });

          // Now delete the file with its SHA
          const deleteResponse = await fetch(`https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${filePath}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `token ${githubToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
              message: `Delete restaurant: ${change.filename}`,
              sha: fileData.sha,
              branch: process.env.GITHUB_BRANCH || 'master'
            })
          });

          console.log('Delete response status:', deleteResponse.status);
          
          if (!deleteResponse.ok) {
            const errorData = await deleteResponse.json();
            console.log('Error response from GitHub API:', errorData);
            throw new Error(`GitHub API error: ${deleteResponse.status} ${deleteResponse.statusText}`);
          }

          const responseData = await deleteResponse.json();
          console.log('Success response from GitHub API:', responseData);
          console.log(`Successfully deleted ${change.filename}`);
        } catch (error) {
          console.log('Error details:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data
          });
          throw error;
        }
      }
    }

    console.log('All changes processed successfully');
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Changes published successfully" })
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