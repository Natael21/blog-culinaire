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
    const { key, value } = JSON.parse(event.body);
    
    // Chemin vers le fichier de cache
    const cachePath = path.join(__dirname, '../../_data/geocoding_cache.json');
    
    // Lire le cache existant
    let cache = {};
    if (fs.existsSync(cachePath)) {
      const cacheContent = fs.readFileSync(cachePath, 'utf8');
      cache = JSON.parse(cacheContent);
    }
    
    // Mettre à jour le cache
    cache[key] = value;
    
    // Sauvegarder le cache mis à jour
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Erreur lors de la mise à jour du cache:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 