const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

exports.handler = async function(event, context) {
  try {
    const postsDirectory = path.join(process.cwd(), '_posts');
    const files = fs.readdirSync(postsDirectory);
    
    const posts = files
      .filter(file => file.endsWith('.markdown'))
      .map(file => {
        const filePath = path.join(postsDirectory, file);
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const { data } = matter(fileContents);
        
        return {
          slug: file.replace(/\.markdown$/, ''),
          content: fileContents,
          style: data.style
        };
      });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(posts)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erreur lors de la récupération des posts' })
    };
  }
}; 