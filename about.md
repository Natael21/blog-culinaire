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
</div>

<div class="team-section">
  <div class="team-member">
    <img src="/images/Baladi Nataël.jpg" alt="Nataël" class="team-photo" loading="lazy">
    <h3>Nataël</h3>
    <p>Passionné de cuisine et toujours à la recherche de nouvelles saveurs</p>
  </div>
  <div class="team-member">
    <img src="/images/Persepolis Nicolas.jpg" alt="Nicolas" class="team-photo" loading="lazy">
    <h3>Nicolas</h3>
    <p>Amateur de bonne cuisine et critique culinaire enthousiaste</p>
  </div>
</div>

<style>
.team-section {
  display: flex;
  justify-content: center;
  gap: 3rem;
  margin-top: 3rem;
  flex-wrap: wrap;
}

.team-member {
  text-align: center;
  flex: 0 1 300px;
}

.team-photo {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 1rem;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.team-photo:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 12px rgba(0,0,0,0.2);
}

.team-member h3 {
  color: var(--primary-color);
  font-family: 'Playfair Display', serif;
  margin: 0.5rem 0;
}

.team-member p {
  color: #666;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .team-section {
    gap: 2rem;
  }
  
  .team-photo {
    width: 150px;
    height: 150px;
  }
}
</style>
