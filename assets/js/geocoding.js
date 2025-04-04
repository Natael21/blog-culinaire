class GeocodingManager {
  constructor() {
    this.queue = [];
    this.cache = {};
    this.isProcessing = false;
    this.batchSize = 3;
    this.retryDelay = 1000;
    this.maxRetries = 3;
  }

  async init() {
    try {
      // Charger la file d'attente depuis le serveur
      const response = await fetch('/_data/geocoding_queue.json');
      this.queue = await response.json();
      
      // Charger le cache
      const cacheResponse = await fetch('/_data/geocoding_cache.json');
      this.cache = await cacheResponse.json();
      
      if (this.queue.length > 0) {
        this.processQueue();
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du géocodage:', error);
    }
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    const batch = this.queue.slice(0, this.batchSize);
    
    try {
      await Promise.all(batch.map(entry => this.geocodeAddress(entry)));
    } catch (error) {
      console.error('Erreur lors du traitement du batch:', error);
    }
    
    this.isProcessing = false;
    
    // Continuer avec le prochain batch après un délai
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), this.retryDelay);
    }
  }

  async geocodeAddress(entry, attempt = 1) {
    try {
      const address = entry.address.toLowerCase().includes('sherbrooke') 
        ? entry.address 
        : `${entry.address}, Sherbrooke, QC`;
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
        {
          headers: {
            'User-Agent': 'BlogCulinaire/1.0'
          }
        }
      );
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      if (!data || data.length === 0) throw new Error('No results found');
      
      // Mettre à jour le cache
      this.cache[entry.cache_key] = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        address: entry.address,
        updated_at: Math.floor(Date.now() / 1000)
      };
      
      // Envoyer la mise à jour au serveur
      await this.updateServerCache(entry.cache_key, this.cache[entry.cache_key]);
      
      // Retirer de la file d'attente
      this.queue = this.queue.filter(item => item.cache_key !== entry.cache_key);
      await this.updateServerQueue();
      
      console.log(`Géocodage réussi pour ${entry.title}`);
      
    } catch (error) {
      console.error(`Erreur de géocodage pour ${entry.title}:`, error);
      
      if (attempt < this.maxRetries) {
        entry.attempts = attempt;
        setTimeout(() => this.geocodeAddress(entry, attempt + 1), this.retryDelay * attempt);
      } else {
        // Marquer comme échoué après max retries
        entry.failed = true;
        await this.updateServerQueue();
      }
    }
  }

  async updateServerCache(key, value) {
    try {
      await fetch('/api/update-geocoding-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key, value })
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du cache:', error);
    }
  }

  async updateServerQueue() {
    try {
      await fetch('/api/update-geocoding-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ queue: this.queue })
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la file d\'attente:', error);
    }
  }
}

// Initialiser le gestionnaire de géocodage
document.addEventListener('DOMContentLoaded', () => {
  const geocodingManager = new GeocodingManager();
  geocodingManager.init();
}); 