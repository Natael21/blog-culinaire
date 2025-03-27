---
layout: default
title: À propos
---

<div class="page-header">
  <h2>À propos de nous</h2>
  <p>Découvrez notre histoire et notre mission</p>
</div>

<div class="about-content">
  <p>Curieux de la cuisine sherbrookoise ? Vous trouverez ici nos commentaires et appréciations sur les divers restaurants de Sherbrooke que nous avons essayés. Au lieu de prendre beaucoup de temps et d'argent à choisir quel sera votre endroit préféré, la consultation de notre site vous aidera à économiser du temps. Bonne lecture et bon appétit !</p>

  <div class="team-section">
    <div class="team-member">
      <div class="member-photo">
        <img src="/images/Saveur_delice_Natael.jpg" alt="Nataël" loading="lazy">
      </div>
      <h3>Nataël</h3>
      <p>Passionné de gastronomie et toujours à la recherche de nouvelles saveurs à Sherbrooke.</p>
    </div>

    <div class="team-member">
      <div class="member-photo">
        <img src="/images/Saveur_delice_Nicolas.jpg" alt="Nicolas" loading="lazy">
      </div>
      <h3>Nicolas</h3>
      <p>Amateur de bonne cuisine et explorateur culinaire sherbrookois.</p>
    </div>
  </div>
</div>

<style>
.team-section {
  margin-top: 3rem;
  display: flex;
  gap: 2rem;
  justify-content: center;
  flex-wrap: wrap;
}

.team-member {
  flex: 1;
  min-width: 250px;
  max-width: 350px;
  text-align: center;
}

.member-photo {
  width: 200px;
  height: 200px;
  margin: 0 auto 1rem;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.member-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transition: transform 0.3s ease;
}

.member-photo:hover img {
  transform: scale(1.05);
}

.team-member h3 {
  color: var(--primary-color);
  font-family: 'Playfair Display', serif;
  font-size: 1.5rem;
  margin: 0.5rem 0;
}

.team-member p {
  color: #666;
  font-size: 1rem;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .team-section {
    flex-direction: column;
    align-items: center;
  }

  .team-member {
    max-width: 100%;
  }
}
</style>
