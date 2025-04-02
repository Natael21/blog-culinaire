// Fonction pour gérer l'affichage du contenu
function showAdminContent() {
  const loadingOverlay = document.getElementById('loading-overlay');
  const adminContainer = document.querySelector('.admin-container');
  
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
  if (adminContainer) {
    adminContainer.classList.add('authenticated');
  }
  
  // Charger les restaurants si nous sommes sur la section restaurants
  const activeSection = document.querySelector('.admin-content-section.active');
  if (activeSection && activeSection.id === 'restaurants') {
    loadRestaurants();
  }
}

// Vérification de l'authentification
if (window.netlifyIdentity) {
  window.netlifyIdentity.on("init", user => {
    if (!user) {
      window.netlifyIdentity.open('login');
    } else {
      showAdminContent();
    }
  });

  window.netlifyIdentity.on("login", () => {
    showAdminContent();
  });

  window.netlifyIdentity.on("logout", () => {
    window.location.href = "/";
  });

  // Vérification immédiate de l'authentification
  const currentUser = window.netlifyIdentity.currentUser();
  if (currentUser) {
    showAdminContent();
  }
} else {
  // Si Netlify Identity n'est pas chargé, afficher un message d'erreur
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.innerHTML = `
      <div style="text-align: center; color: #e74c3c;">
        <p>Erreur de chargement de l'authentification</p>
        <p>Veuillez rafraîchir la page</p>
      </div>
    `;
  }
}

// Ajouter un timeout pour masquer le loader si l'authentification prend trop de temps
setTimeout(() => {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay && loadingOverlay.style.display !== 'none') {
    loadingOverlay.innerHTML = `
      <div style="text-align: center; color: #e74c3c;">
        <p>Le chargement prend plus de temps que prévu</p>
        <p>Veuillez rafraîchir la page</p>
      </div>
    `;
  }
}, 10000); 