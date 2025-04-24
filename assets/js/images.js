// Gestion des images
document.addEventListener('DOMContentLoaded', () => {
    const imageGrid = document.getElementById('imageGrid');
    const publishBtn = document.getElementById('publishBtn');
    const confirmationModal = document.getElementById('confirmationModal');
    let imagesToDelete = new Set();

    // Charger les images
    async function loadImages() {
        try {
            const response = await fetch('/api/images');
            if (!response.ok) throw new Error('Erreur lors du chargement des images');
            const images = await response.json();
            displayImages(images);
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors du chargement des images');
        }
    }

    // Afficher les images
    function displayImages(images) {
        imageGrid.innerHTML = '';
        images.forEach(image => {
            const card = document.createElement('div');
            card.className = `image-card ${imagesToDelete.has(image.path) ? 'marked-for-deletion' : ''}`;
            card.innerHTML = `
                <img src="${image.path}" alt="Image">
                <div class="image-info">
                    <div class="image-path">${image.path}</div>
                    <div class="image-actions">
                        <button class="delete-btn" onclick="markForDeletion('${image.path}')">
                            <i class="fas fa-trash"></i> Supprimer
                        </button>
                    </div>
                </div>
            `;
            imageGrid.appendChild(card);
        });
    }

    // Marquer une image pour suppression
    window.markForDeletion = (imagePath) => {
        currentImageToDelete = imagePath;
        confirmationModal.style.display = 'flex';
    };

    // Fermer le modal
    window.closeModal = () => {
        confirmationModal.style.display = 'none';
        currentImageToDelete = null;
    };

    // Confirmer la suppression
    window.confirmDeletion = () => {
        if (currentImageToDelete) {
            imagesToDelete.add(currentImageToDelete);
            loadImages(); // Recharger les images pour mettre à jour l'affichage
            closeModal();
        }
    };

    // Publier les changements
    publishBtn.addEventListener('click', async () => {
        if (imagesToDelete.size === 0) {
            alert('Aucun changement à publier');
            return;
        }

        try {
            const response = await fetch('/api/images/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    images: Array.from(imagesToDelete)
                })
            });

            if (!response.ok) throw new Error('Erreur lors de la suppression des images');

            imagesToDelete.clear();
            await loadImages();
            alert('Changements publiés avec succès');
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la publication des changements');
        }
    });

    // Charger les images au démarrage
    loadImages();
}); 