// Fonction pour charger les restaurants depuis le dossier _posts
async function loadRestaurants() {
  try {
    const response = await fetch('https://api.github.com/repos/Natael21/blog-culinaire/contents/_posts');
    const posts = await response.json();
    
    const restaurantList = document.getElementById('restaurant-list');
    restaurantList.innerHTML = '';
    
    // Utiliser un Set pour suivre les titres des restaurants déjà affichés
    const displayedTitles = new Set();
    
    for (const post of posts) {
      if (post.name.endsWith('.markdown')) {
        try {
          const contentResponse = await fetch(post.download_url);
          const content = await contentResponse.text();
          
          // Extraire les métadonnées du frontmatter
          const frontmatter = content.split('---')[1];
          const metadata = {};
          frontmatter.split('\n').forEach(line => {
            const match = line.match(/^(\w+):\s*"?([^"\n]+)"?$/);
            if (match) {
              metadata[match[1]] = match[2];
            }
          });

          // Vérifier si ce titre a déjà été affiché
          if (!displayedTitles.has(metadata.title)) {
            displayedTitles.add(metadata.title);

            const item = document.createElement('div');
            item.className = 'restaurant-item';
            item.innerHTML = `
              <div class="restaurant-info">
                <img src="${metadata.image || '/images/restaurant-test.jpg'}" alt="${metadata.title}" class="restaurant-image">
                <div class="restaurant-details">
                  <h3>${metadata.title}</h3>
                  <div class="restaurant-meta">
                    <span><i class="fas fa-calendar"></i> ${metadata.date}</span>
                    <span><i class="fas fa-utensils"></i> ${metadata.style}</span>
                    <span><i class="fas fa-star"></i> ${metadata.note}/5</span>
                  </div>
                </div>
              </div>
              <div class="restaurant-actions">
                <a href="/admin/edit-restaurant.html?file=${encodeURIComponent(post.path)}&content=${encodeURIComponent(content)}" class="action-btn edit-btn">
                  <i class="fas fa-edit"></i> Modifier
                </a>
                <button class="action-btn delete-btn" onclick="deleteRestaurant('${post.path}')">
                  <i class="fas fa-trash"></i> Supprimer
                </button>
              </div>
            `;
            restaurantList.appendChild(item);
          }
        } catch (error) {
          console.error('Erreur lors du chargement du contenu du restaurant:', error);
        }
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement des restaurants:', error);
    const restaurantList = document.getElementById('restaurant-list');
    restaurantList.innerHTML = '<p class="error-message">Une erreur est survenue lors du chargement des restaurants. Veuillez réessayer plus tard.</p>';
  }
}

// Fonction pour filtrer et trier les restaurants
function filterAndSortRestaurants() {
  const searchTerm = document.getElementById('restaurant-search').value.toLowerCase();
  const sortBy = document.getElementById('sort-by').value;
  const restaurantItems = Array.from(document.querySelectorAll('.restaurant-item'));

  // Filtrer
  restaurantItems.forEach(item => {
    const title = item.querySelector('h3').textContent.toLowerCase();
    const cuisine = item.querySelector('.restaurant-meta span').textContent.toLowerCase();
    item.style.display = (title.includes(searchTerm) || cuisine.includes(searchTerm)) ? 'flex' : 'none';
  });

  // Trier
  const sortedItems = restaurantItems.sort((a, b) => {
    const titleA = a.querySelector('h3').textContent;
    const titleB = b.querySelector('h3').textContent;
    const dateA = new Date(a.querySelector('.restaurant-meta span').textContent.replace('Date: ', ''));
    const dateB = new Date(b.querySelector('.restaurant-meta span').textContent.replace('Date: ', ''));

    switch(sortBy) {
      case 'date-desc':
        return dateB - dateA;
      case 'date-asc':
        return dateA - dateB;
      case 'name-asc':
        return titleA.localeCompare(titleB, 'fr');
      case 'name-desc':
        return titleB.localeCompare(titleA, 'fr');
      default:
        return 0;
    }
  });

  const restaurantList = document.getElementById('restaurant-list');
  restaurantList.innerHTML = '';
  sortedItems.forEach(item => restaurantList.appendChild(item));
}

// Ajouter les écouteurs d'événements pour les filtres
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('restaurant-search');
  const sortSelect = document.getElementById('sort-by');
  
  if (searchInput) {
    searchInput.addEventListener('input', filterAndSortRestaurants);
  }
  
  if (sortSelect) {
    sortSelect.addEventListener('change', filterAndSortRestaurants);
  }
  
  // Charger les restaurants uniquement si nous sommes sur la section restaurants
  const activeSection = document.querySelector('.admin-content-section.active');
  if (activeSection && activeSection.id === 'restaurants') {
    loadRestaurants().then(() => {
      filterAndSortRestaurants();
    });
  }
});

// Gestion des boutons de navigation
document.querySelectorAll('.admin-nav button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.admin-nav button').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    document.querySelectorAll('.admin-content-section').forEach(section => section.classList.remove('active'));
    const targetSection = document.getElementById(button.dataset.section);
    targetSection.classList.add('active');
    
    // Charger les données appropriées lors du changement d'onglet
    if (button.dataset.section === 'restaurants') {
      // Vider la liste avant de recharger
      const restaurantList = document.getElementById('restaurant-list');
      restaurantList.innerHTML = '';
      loadRestaurants().then(() => {
        filterAndSortRestaurants();
      });
    }
  });
}); 