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

    // Get Git Gateway token from Authorization header
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      console.log('No authorization header found');
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'No authorization header' })
      };
    }

    console.log('Git configuration:', {
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      branch: process.env.GITHUB_BRANCH || 'main'
    });

    // Process each change
    for (const change of changes) {
      console.log('Processing change:', change);
      
      if (change.type === 'delete') {
        try {
          console.log(`Attempting to delete file: _posts/${change.filename}`);
          
          // Make DELETE request to Git Gateway
          const response = await fetch(`${process.env.GIT_GATEWAY}/git/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/_posts/${change.filename}`, {
            method: 'DELETE',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message: `Delete restaurant: ${change.filename}`,
              branch: process.env.GITHUB_BRANCH || 'main'
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.log('Error response from Git Gateway:', errorData);
            if (response.status === 404) {
              console.log(`File ${change.filename} already deleted or doesn't exist`);
              continue;
            }
            throw new Error(`Git Gateway error: ${response.status} ${response.statusText}`);
          }

          console.log(`Successfully deleted ${change.filename}`);
        } catch (error) {
          console.log('Error details:', {
            message: error.message,
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
        response: error.response?.data
      })
    };
  }
}; 