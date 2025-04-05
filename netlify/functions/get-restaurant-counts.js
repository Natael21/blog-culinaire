const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

exports.handler = async function(event, context) {
    try {
        const postsDirectory = path.join(process.cwd(), '_posts');
        const files = fs.readdirSync(postsDirectory);
        
        let readyCount = 0;
        let draftCount = 0;
        
        files.forEach(file => {
            if (file.endsWith('.markdown')) {
                const filePath = path.join(postsDirectory, file);
                const fileContents = fs.readFileSync(filePath, 'utf8');
                const { data } = matter(fileContents);
                
                if (data.state === 'ready') {
                    readyCount++;
                } else if (data.state === 'draft') {
                    draftCount++;
                }
            }
        });
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ready: readyCount,
                draft: draftCount
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Erreur lors du comptage des restaurants' })
        };
    }
}; 