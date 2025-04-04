const fs = require('fs');
const path = require('path');

exports.handler = async function(event, context) {
  // Vérifier la méthode HTTP
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { queue } = JSON.parse(event.body);
    
    // Chemin vers le fichier de file d'attente
    const queuePath = path.join(__dirname, '../../_data/geocoding_queue.json');
    
    // Sauvegarder la file d'attente mise à jour
    fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la file d\'attente:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 