const fs = require('fs');
const path = require('path');

exports.handler = async function(event, context) {
    try {
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                body: JSON.stringify({ error: 'Méthode non autorisée' })
            };
        }

        const { changes } = JSON.parse(event.body);
        
        if (!changes || !Array.isArray(changes)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Données invalides' })
            };
        }

        const restaurantsDir = path.join(process.cwd(), 'content', 'restaurants');
        
        // Traiter chaque changement
        for (const change of changes) {
            if (change.type === 'delete') {
                // Supprimer le fichier
                const filePath = path.join(restaurantsDir, change.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } else if (change.type === 'create') {
                // Créer le fichier
                const filePath = path.join(restaurantsDir, change.filename);
                fs.writeFileSync(filePath, change.content);
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Modifications appliquées avec succès' })
        };
    } catch (error) {
        console.error('Erreur:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Erreur lors de l\'application des modifications' })
        };
    }
}; 