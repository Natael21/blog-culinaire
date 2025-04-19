const { Octokit } = require("@octokit/rest");
const { Base64 } = require('js-base64');

exports.handler = async function(event, context) {
  // Ensure method is POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    // Parse the incoming data
    const data = JSON.parse(event.body);
    const { changes } = data;

    if (!changes || !Array.isArray(changes)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid request format" })
      };
    }

    // Initialize Octokit with the Git Gateway token
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';

    console.log('Processing changes:', changes);

    // Process each change
    for (const change of changes) {
      if (change.type === 'delete') {
        try {
          // Get the file's SHA
          const { data: fileData } = await octokit.repos.getContent({
            owner,
            repo,
            path: `_posts/${change.filename}`,
            ref: branch
          });

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
          if (error.status === 404) {
            console.log(`File ${change.filename} already deleted or doesn't exist`);
          } else {
            throw error;
          }
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Changes published successfully" })
    };
  } catch (error) {
    console.error('Error publishing changes:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Error publishing changes",
        details: error.message
      })
    };
  }
}; 