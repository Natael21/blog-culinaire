const { Octokit } = require("@octokit/rest");
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

    // Initialize Octokit with the Git Gateway token
    console.log('Initializing Octokit with token:', process.env.GITHUB_TOKEN ? 'Token present' : 'Token missing');
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';

    console.log('Git configuration:', {
      owner,
      repo,
      branch,
      hasToken: !!process.env.GITHUB_TOKEN
    });

    // Process each change
    for (const change of changes) {
      console.log('Processing change:', change);
      
      if (change.type === 'delete') {
        try {
          console.log(`Attempting to get SHA for file: _posts/${change.filename}`);
          // Get the file's SHA
          const { data: fileData } = await octokit.repos.getContent({
            owner,
            repo,
            path: `_posts/${change.filename}`,
            ref: branch
          });
          console.log('File data retrieved:', {
            sha: fileData.sha,
            path: fileData.path,
            type: fileData.type
          });

          console.log(`Attempting to delete file: _posts/${change.filename}`);
          // Delete the file
          await octokit.repos.deleteFile({
            owner,
            repo,
            path: `_posts/${change.filename}`,
            message: `Delete restaurant: ${change.filename}`,
            sha: fileData.sha,
            branch
          });

          console.log(`Successfully deleted ${change.filename}`);
        } catch (error) {
          console.log('Error details:', {
            status: error.status,
            message: error.message,
            response: error.response?.data
          });
          
          if (error.status === 404) {
            console.log(`File ${change.filename} already deleted or doesn't exist`);
          } else {
            console.error('Unexpected error during deletion:', error);
            throw error;
          }
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
        response: error.response?.data
      })
    };
  }
}; 