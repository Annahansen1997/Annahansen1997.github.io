let currentSlide = 0;
let slides = [];
let dots = [];
let currentModal = null;
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Lagre scroll-posisjon når en modal åpnes
let lastScrollPosition = 0;

document.addEventListener('DOMContentLoaded', function () {
    // Last handlekurv fra localStorage
    cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    // Oppdater handlekurv-visning
    const cartCountElement = document.querySelector('.cart-count');
    if (cartCountElement) {
        updateCartCount();
    }
    
    const cartItemsContainer = document.getElementById('cart-items');
    if (cartItemsContainer) {
        updateCartDisplay();
    }

    // Legg til event listeners
    const checkoutButton = document.querySelector('.checkout-button');
    if (checkoutButton) {
        checkoutButton.addEventListener('click', goToCheckout);
    }

    // Initialiser bildekarusell hvis den finnes
    const modal = document.querySelector('.modal.active');
    if (modal) {
        initializeCarousel(modal);
    }

    // Initialiser søkefunksjonalitet
    const searchInput = document.querySelector('.search-container input');
    const productCards = document.querySelectorAll('.product-card');

    if (searchInput && productCards.length > 0) {
        searchInput.addEventListener('input', function (e) {
            const searchTerm = e.target.value.toLowerCase();

            productCards.forEach(card => {
                const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
                const description = card.querySelector('p')?.textContent.toLowerCase() || '';

                if (title.includes(searchTerm) || description.includes(searchTerm)) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

    // Initialiser Om Oss-funksjonalitet
    const aboutLink = document.querySelector('.about-link');
    if (aboutLink) {
        aboutLink.addEventListener('click', function (e) {
            e.preventDefault();
            openModal('about-modal');
        });
    }
}); 

function updateCartCount() {
    const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelector('.cart-count').textContent = cartCount;
}

function updateCartDisplay() {
    const cartItemsContainer = document.getElementById('cart-items');
    const totalElement = document.getElementById('cart-total');
    
    cartItemsContainer.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}" class="cart-item-image">
            <div class="cart-item-details">
                <span class="cart-item-name">${item.name}</span>
                <span class="cart-item-price">${item.quantity} x ${item.price.toFixed(2)} kr</span>
                <button onclick="removeFromCart(${index})" class="remove-button">Fjern</button>
            </div>
        `;
        
        cartItemsContainer.appendChild(itemElement);
    });

    if (totalElement) {
        totalElement.textContent = `${total.toFixed(2)} kr`;
    }

    // Oppdater checkout knapp
    const checkoutButton = document.querySelector('.checkout-button');
    if (checkoutButton) {
        checkoutButton.disabled = cart.length === 0;
    }
}

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            priceId: product.priceId,
            image: product.image,
            quantity: 1
        });
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    updateCartDisplay();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    updateCartDisplay();
}

function goToCheckout() {
    if (cart.length === 0) {
        alert('Handlekurven er tom');
        return;
    }
    window.location.href = PAYMENT_LINK;
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Lagre nåværende scroll-posisjon
    lastScrollPosition = window.scrollY;

    if (currentModal) {
        currentModal.classList.remove('active');
    }
    
    modal.classList.add('active');
    currentModal = modal;
    
    if (modalId === 'product-modal') {
        initializeCarousel(modal);
    }

    // Forhindre scrolling av bakgrunnen
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lastScrollPosition}px`;
    document.body.style.width = '100%';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.remove('active');
    if (currentModal === modal) {
        currentModal = null;
    }

    // Gjenopprett scrolling og posisjon
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, lastScrollPosition);
}

function initializeCarousel(modal) {
    slides = modal.querySelectorAll('.slide');
    dots = modal.querySelectorAll('.dot');
    
    if (slides.length === 0) return;
    
    showSlide(0);
    
    // Add click events to dots
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => showSlide(index));
    });
}

function showSlide(index) {
    if (slides.length === 0) return;
    
    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');
    
    currentSlide = index;
    
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
}

function nextSlide() {
    if (slides.length === 0) return;
    const newIndex = (currentSlide + 1) % slides.length;
    showSlide(newIndex);
}

function previousSlide() {
    if (slides.length === 0) return;
    const newIndex = (currentSlide - 1 + slides.length) % slides.length;
    showSlide(newIndex);
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.preventDefault();
        closeModal(event.target.id);
    }
}); 