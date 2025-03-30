document.addEventListener('DOMContentLoaded', function() {
    const styleFilter = document.getElementById('style-filter');
    const priceFilter = document.getElementById('price-filter');
    const dietFilter = document.getElementById('diet-filter');
    const restaurantCards = document.querySelectorAll('.restaurant-card');

    function filterRestaurants() {
        const selectedStyle = styleFilter.value;
        const selectedPrice = priceFilter.value;
        const selectedDiet = dietFilter.value;

        restaurantCards.forEach(card => {
            const style = card.getAttribute('data-style');
            const price = card.getAttribute('data-price');
            const diet = card.getAttribute('data-diet');
            
            const styleMatch = selectedStyle === 'all' || style === selectedStyle;
            const priceMatch = selectedPrice === 'all' || price === selectedPrice;
            const dietMatch = selectedDiet === 'all' || diet === selectedDiet;

            if (styleMatch && priceMatch && dietMatch) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    styleFilter.addEventListener('change', filterRestaurants);
    priceFilter.addEventListener('change', filterRestaurants);
    dietFilter.addEventListener('change', filterRestaurants);
}); 