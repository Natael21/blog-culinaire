const fs = require('fs');
const path = require('path');

exports.handler = async function(event, context) {
    try {
        // Vérifier que la méthode est POST
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                body: JSON.stringify({ error: 'Méthode non autorisée' })
            };
        }

        // Récupérer le nom du fichier depuis le corps de la requête
        const { filename } = JSON.parse(event.body);
        
        if (!filename) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Nom de fichier manquant' })
            };
        }

        // Chemin vers le fichier à supprimer
        const filePath = path.join(process.cwd(), 'content', 'restaurants', filename);
        
        // Vérifier si le fichier existe
        if (!fs.existsSync(filePath)) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Fichier non trouvé' })
            };
        }

        // Supprimer le fichier
        fs.unlinkSync(filePath);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Restaurant supprimé avec succès' })
        };
    } catch (error) {
        console.error('Erreur:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Erreur lors de la suppression du restaurant' })
        };
    }
}; 