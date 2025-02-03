let currentSlide = 0;
let slides = [];
let dots = [];
let currentModal = null;
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Oppdater handlekurven når siden lastes
document.addEventListener('DOMContentLoaded', function() {
    updateCartCount();
    updateCartDisplay();
    // Legg til event listeners for handlekurv-knapper
    const checkoutButton = document.querySelector('.checkout-button');
    if (checkoutButton) {
        checkoutButton.addEventListener('click', goToCheckout);
    }
});

function addToCart(product) {
    // Sjekk om produktet allerede er i handlekurven
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        // Vis melding om at produktet allerede er i handlekurven
        showAddedToCartMessage(`${product.name} er allerede i handlekurven`);
        return;
    }
    
    // Legg til produktet (alltid med quantity = 1 siden det er PDF)
    cart.push({ ...product, quantity: 1 });
    
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    updateCartDisplay();
    showAddedToCartMessage(product.name);
}

function updateCartCount() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelector('.cart-count').textContent = totalItems;
}

function updateCartDisplay() {
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    
    if (!cartItems || !cartTotal) return;
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-cart-message">Handlekurven er tom</div>';
        cartTotal.textContent = '0,00 NOK';
        return;
    }
    
    let html = '';
    let total = 0;
    
    cart.forEach(item => {
        total += item.price;
        
        html += `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}">
                <div class="cart-item-details">
                    <h3>${item.name}</h3>
                    <p>${item.price.toFixed(2)} NOK</p>
                </div>
                <button class="delete-btn" onclick="removeFromCart(${item.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;
    });
    
    cartItems.innerHTML = html;
    cartTotal.textContent = total.toFixed(2) + ' NOK';
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (!item) return;
    
    item.quantity += change;
    
    if (item.quantity <= 0) {
        removeFromCart(productId);
    } else {
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        updateCartDisplay();
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    updateCartDisplay();
}

function emptyCart() {
    cart = [];
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    updateCartDisplay();
}

function showAddedToCartMessage(productName) {
    const messageContainer = document.createElement('div');
    messageContainer.className = 'cart-message';
    messageContainer.innerHTML = `
        ${productName} lagt til i handlekurven!
        <button onclick="openModal('cart-modal')" class="view-cart-btn">Vis handlekurv</button>
    `;

    document.body.appendChild(messageContainer);

    setTimeout(() => {
        messageContainer.remove();
    }, 3000);
}

// Søkefunksjonalitet
const searchInput = document.querySelector('.search-container input');
const productCards = document.querySelectorAll('.product-card');

searchInput.addEventListener('input', function (e) {
    const searchTerm = e.target.value.toLowerCase();

    productCards.forEach(card => {
        const title = card.querySelector('h3').textContent.toLowerCase();
        const description = card.querySelector('p').textContent.toLowerCase();

        if (title.includes(searchTerm) || description.includes(searchTerm)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
});

// Modal funksjoner
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
        
        if (modalId === 'cart-modal') {
            updateCartDisplay();
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
}

function initializeCarousel(modal) {
    // Reset current slide
    currentSlide = 0;
    
    // Get carousel elements for the current modal
    slides = modal.querySelectorAll('.carousel-image');
    if (slides.length === 0) return;
    
    // Clear existing dots
    const dotsContainer = modal.querySelector('.carousel-dots');
    if (!dotsContainer) return;
    dotsContainer.innerHTML = '';
    
    // Create dots for each slide
    slides.forEach((_, index) => {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.onclick = () => goToSlide(index);
        dotsContainer.appendChild(dot);
    });
    
    // Update dots array
    dots = modal.querySelectorAll('.dot');
    
    // Show first slide
    showSlide(0);
}

function showSlide(n) {
    if (!currentModal || slides.length === 0) return;
    
    // Remove active class from all slides and dots
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    
    // Update current slide index
    currentSlide = (n + slides.length) % slides.length;
    
    // Add active class to current slide and dot
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
}

function moveSlide(direction) {
    if (!currentModal) return;
    showSlide(currentSlide + direction);
}

function goToSlide(n) {
    if (!currentModal) return;
    showSlide(n);
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        closeModal(event.target.id);
    }
}

// Handle keyboard navigation
document.addEventListener('keydown', function(event) {
    if (!currentModal) return;
    
    if (event.key === 'ArrowLeft') {
        moveSlide(-1);
    } else if (event.key === 'ArrowRight') {
        moveSlide(1);
    } else if (event.key === 'Escape') {
        closeModal(currentModal.id);
    }
});

// Shopping cart functionality
function showCartMessage() {
    const message = document.createElement('div');
    message.className = 'cart-message';
    message.innerHTML = `
        <span>Produkt lagt i handlekurv!</span>
        <button class="view-cart-btn" onclick="openModal('cart-modal')">Se handlekurv</button>
    `;
    
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.remove();
    }, 3000);
}

// Kontakt-funksjonalitet
document.querySelectorAll('.nav-link').forEach(link => {
    if (link.textContent.trim() === 'Kontakt') {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            openContactModal();
        });
    }
});

function openContactModal() {
    const modal = document.getElementById('contact-modal');
    modal.style.display = "block";
    document.body.classList.add('modal-open');
   
    // Legg til overflow kontroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.overscrollBehavior = 'none';
}

// Legg til denne konstanten øverst i filen (utenfor alle funksjoner)
const CONTACT_CONFIG = {
    recipientEmail: 'hombgames@hotmail.com' // Dette er kun for backend-bruk
};

// Oppdater handleContactSubmit funksjonen
function handleContactSubmit(event) {
    event.preventDefault();

    // Reset error messages
    document.querySelectorAll('.error-message').forEach(el => el.style.display = 'none');

    // Get form fields
    const email = document.getElementById('email');
    const subject = document.getElementById('subject');
    const message = document.getElementById('message');

    // Validate fields
    let isValid = true;

    if (!email.value || !email.value.includes('@')) {
        document.getElementById('email-error').textContent = 'Vennligst oppgi en gyldig e-postadresse';
        document.getElementById('email-error').style.display = 'block';
        isValid = false;
    }

    if (!subject.value.trim()) {
        document.getElementById('subject-error').textContent = 'Emne er påkrevd';
        document.getElementById('subject-error').style.display = 'block';
        isValid = false;
    }

    if (!message.value.trim()) {
        document.getElementById('message-error').textContent = 'Melding er påkrevd';
        document.getElementById('message-error').style.display = 'block';
        isValid = false;
    }

    if (!isValid) {
        return;
    }

    const formData = {
        email: email.value,
        subject: subject.value,
        message: message.value,
        to_email: CONTACT_CONFIG.recipientEmail
    };

    // Send e-post via EmailJS
    emailjs.send(
        'DIN_SERVICE_ID',
        'DIN_TEMPLATE_ID',
        formData
    ).then(
        function (response) {
            showSuccessMessage('Takk for din henvendelse! Vi vil svare deg så snart som mulig.');
            document.getElementById('contactForm').reset();
            closeModal('contact-modal');
        },
        function (error) {
            showSuccessMessage('Beklager, noe gikk galt. Vennligst prøv igjen senere.', 'error');
        }
    );
}

function showSuccessMessage(message) {
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    successMessage.textContent = message;
    document.body.appendChild(successMessage);

    setTimeout(() => {
        successMessage.remove();
    }, 3000);
}

// Om Oss-funksjonalitet
document.querySelector('.about-link').addEventListener('click', function (e) {
    e.preventDefault();
    openModal('about-modal');
});

// Stripe konfigurasjon
const stripe = Stripe(config.STRIPE_PUBLISHABLE_KEY);

function initiateCheckout() {
    // Hent handlekurvdata
    const cartItems = JSON.parse(localStorage.getItem('cart')) || [];
    if (cartItems.length === 0) {
        alert('Handlekurven er tom');
        return;
    }

    // Redirect til Stripe betalingslenke
    window.location.href = 'https://buy.stripe.com/bIYcOHbzuccO0LKcMN';
}

// Bildekarusell funksjonalitet
let currentImageIndex = 0;

function changeImage(direction) {
    const modal = document.querySelector('.modal.active');
    if (!modal) return;

    const images = modal.querySelectorAll('.carousel-image');
    const dots = modal.querySelectorAll('.dot');

    // Fjern active class fra nåværende bilde og dot
    images[currentImageIndex].classList.remove('active');
    dots[currentImageIndex].classList.remove('active');

    // Oppdater index med looping
    currentImageIndex = (currentImageIndex + direction + images.length) % images.length;

    // Legg til active class på nytt bilde og dot
    images[currentImageIndex].classList.add('active');
    dots[currentImageIndex].classList.add('active');
}

function showImage(index) {
    const modal = document.querySelector('.modal.active');
    if (!modal) return;

    const images = modal.querySelectorAll('.carousel-image');
    const dots = modal.querySelectorAll('.dot');

    // Fjern active class fra nåværende bilde og dot
    images[currentImageIndex].classList.remove('active');
    dots[currentImageIndex].classList.remove('active');

    // Sett ny index
    currentImageIndex = index;

    // Legg til active class på nytt bilde og dot
    images[currentImageIndex].classList.add('active');
    dots[currentImageIndex].classList.add('active');
}

// Rabattkode funksjonalitet
function applyDiscount() {
    const discountCode = document.getElementById('discount-code').value.trim().toUpperCase();

    // Her kan du legge til dine rabattkoder
    const validDiscounts = {
        'VELKOMST10': 10, // 10% rabatt
        'PÅSKE20': 20,    // 20% rabatt
    };

    if (validDiscounts.hasOwnProperty(discountCode)) {
        const discountPercent = validDiscounts[discountCode];
        const currentTotal = calculateTotal();
        const discountAmount = (currentTotal * discountPercent) / 100;
        const newTotal = currentTotal - discountAmount;

        document.getElementById('cart-total').textContent = newTotal.toFixed(2) + ' NOK';
        showSuccessMessage(`Rabattkode anvendt! Du fikk ${discountPercent}% rabatt.`);
        document.getElementById('discount-code').value = '';
    } else {
        showSuccessMessage('Ugyldig rabattkode', 'error');
    }
}

// Oppdater calculateTotal funksjonen
function calculateTotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

// Anmeldelsesfunksjonalitet
let currentRating = 0;
let reviews = JSON.parse(localStorage.getItem('productReviews')) || {};

function initializeStarRating() {
    document.querySelectorAll('.star-rating').forEach(ratingContainer => {
        const stars = ratingContainer.querySelectorAll('.star');
        const ratingText = ratingContainer.querySelector('.star-rating-text');
        
        stars.forEach(star => {
            // Når musen er over en stjerne
            star.addEventListener('mouseover', function() {
                const rating = parseInt(this.dataset.rating);
                const description = this.dataset.description;
                highlightStars(stars, rating);
                if (ratingText) {
                    ratingText.textContent = description;
                    ratingText.style.opacity = '1';
                }
            });

            // Når musen forlater stjerneområdet
            ratingContainer.addEventListener('mouseleave', function() {
                highlightStars(stars, currentRating);
                if (ratingText) {
                    if (currentRating > 0) {
                        const selectedStar = ratingContainer.querySelector(`[data-rating="${currentRating}"]`);
                        ratingText.textContent = selectedStar.dataset.description;
                    } else {
                        ratingText.textContent = 'Velg din vurdering';
                    }
                }
            });

            // Når en stjerne klikkes
            star.addEventListener('click', function() {
                const rating = parseInt(this.dataset.rating);
                const description = this.dataset.description;
                currentRating = rating;
                highlightStars(stars, rating);
                if (ratingText) {
                    ratingText.textContent = description;
                }
                
                // Legg til en visuell bekreftelse
                star.style.transform = 'scale(1.2)';
                setTimeout(() => {
                    star.style.transform = 'scale(1)';
                }, 200);
            });
        });
    });
}

function highlightStars(stars, rating) {
    stars.forEach(star => {
        const starRating = parseInt(star.dataset.rating);
        if (starRating <= rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

function submitReview(productId) {
    if (currentRating === 0) {
        showSuccessMessage('Vennligst velg antall stjerner', 'error');
        return;
    }

    const reviewText = document.getElementById('review-text').value.trim();
    if (!reviewText) {
        showSuccessMessage('Vennligst skriv en omtale', 'error');
        return;
    }

    const review = {
        rating: currentRating,
        text: reviewText,
        date: new Date().toISOString(),
    };

    if (!reviews[productId]) {
        reviews[productId] = [];
    }
    reviews[productId].push(review);
    localStorage.setItem('productReviews', JSON.stringify(reviews));

    // Reset form
    currentRating = 0;
    highlightStars(stars, 0);
    document.getElementById('review-text').value = '';

    // Oppdater visning
    displayReviews(productId);
    showSuccessMessage('Takk for din omtale!');
}

function displayReviews(productId) {
    const container = document.getElementById('reviews-container');
    const productReviews = reviews[productId] || [];

    if (productReviews.length === 0) {
        container.innerHTML = '<p>Ingen omtaler ennå. Bli den første til å anmelde dette produktet!</p>';
        return;
    }

    const reviewsHTML = productReviews.map(review => {
        const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
        const date = new Date(review.date).toLocaleDateString('no-NO');

        return `
            <div class="review-item">
                <div class="review-header">
                    <div class="review-stars">${stars}</div>
                    <div class="review-date">${date}</div>
                </div>
                <div class="review-text">${review.text}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = reviewsHTML;

    // Oppdater gjennomsnittlig rating
    const avgRating = productReviews.reduce((sum, review) => sum + review.rating, 0) / productReviews.length;
    const reviewCount = productReviews.length;

    document.querySelector('.reviews-section h3').innerHTML =
        `Kundeomtaler <span class="review-stars">${'★'.repeat(Math.round(avgRating))}</span>
        <span class="review-count">(${reviewCount} ${reviewCount === 1 ? 'omtale' : 'omtaler'})</span>`;
}

// Produkt-spesifikke PDF-filer
const productPDFs = {
    1: 'paskekos_aktivitetshefte.pdf',
    2: 'dinosaur_aktivitetshefte.pdf',
    3: 'enhjorning_aktivitetshefte.pdf',
    4: 'bilbingo.pdf',
    5: 'flybingo.pdf'
};

// Funksjon for å håndtere kjøp
function handlePurchase(productId, productName, price) {
    // Spør om kundens e-postadresse
    const customerEmail = prompt('Vennligst skriv inn din e-postadresse for å motta produktet:');

    if (!customerEmail || !customerEmail.includes('@')) {
        alert('Vennligst oppgi en gyldig e-postadresse.');
        return;
    }

    // Vis laste-indikator
    showLoadingMessage('Behandler din bestilling...');

    // Send e-post med produktet
    emailjs.send(
        'DIN_SERVICE_ID', // Erstatt med din EmailJS service ID
        'DIN_TEMPLATE_ID', // Erstatt med din EmailJS template ID
        {
            to_email: customerEmail,
            product_name: productName,
            product_file: productPDFs[productId],
            purchase_date: new Date().toLocaleDateString('no-NO'),
            total_price: price.toFixed(2) + ' NOK'
        }
    ).then(
        function (response) {
            hideLoadingMessage();
            showSuccessMessage('Takk for ditt kjøp! Produktet er sendt til din e-post.');
            // Fjern produktet fra handlekurven hvis det var kjøpt derfra
            removeFromCart(productId);
            closeModal('cart-modal');
        },
        function (error) {
            hideLoadingMessage();
            showSuccessMessage('Beklager, noe gikk galt. Vennligst kontakt kundeservice.', 'error');
            console.error('E-post feil:', error);
        }
    );
}

// Oppdater buy-button click handlers
document.querySelectorAll('.buy-button').forEach(button => {
    const modalContent = button.closest('.modal-content');
    const productId = parseInt(button.closest('.modal').id.replace('modal', ''));
    const productName = modalContent.querySelector('h2').textContent;
    const price = parseFloat(button.textContent.match(/\d+\.?\d*/)[0]);

    button.onclick = () => handlePurchase(productId, productName, price);
});

// Loading message
function showLoadingMessage(message) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-message';
    loadingDiv.innerHTML = `
        <div class="spinner"></div>
        <p>${message}</p>
    `;
    document.body.appendChild(loadingDiv);
}

function hideLoadingMessage() {
    const loadingDiv = document.querySelector('.loading-message');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

function buyNow(product) {
    // Legg til produktet i handlekurven
    addToCart(product);
    
    // Lukk den nåværende produkt-modalen
    const currentModal = document.querySelector('.modal[style*="display: block"]');
    if (currentModal) {
        closeModal(currentModal.id);
    }
    
    // Åpne handlekurv-modalen
    openModal('cart-modal');
}

function goToCheckout() {
    console.log('Starter checkout prosess'); // Debug logging
    
    // Lukk handlekurv-modalen
    closeModal('cart-modal');
    
    // Opprett checkout-modal
    const checkoutModal = document.createElement('div');
    checkoutModal.id = 'checkout-modal';
    checkoutModal.className = 'modal';
    
    const cartItems = JSON.parse(localStorage.getItem('cart')) || [];
    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const modalContent = `
        <div class="modal-content checkout-modal-content">
            <span class="close" onclick="closeModal('checkout-modal')">&times;</span>
            <h2>Kasse</h2>
            <div class="checkout-summary">
                <h3>Din bestilling</h3>
                <div id="checkout-items">
                    ${generateCheckoutItemsHTML()}
                </div>
                <div class="checkout-total">
                    <strong>Totalt å betale: ${total.toFixed(2)} NOK</strong>
                </div>
                <div class="checkout-actions">
                    <button class="payment-button" onclick="initiateCheckout()">Betal med kort</button>
                    <button class="back-to-cart-button" onclick="backToCart()">Tilbake til handlekurv</button>
                </div>
            </div>
        </div>
    `;
    
    checkoutModal.innerHTML = modalContent;
    document.body.appendChild(checkoutModal);
    
    // Vis checkout-modalen
    setTimeout(() => {
        openModal('checkout-modal');
    }, 100);
}

function generateCheckoutItemsHTML() {
    const cartItems = JSON.parse(localStorage.getItem('cart')) || [];
    let html = '';
    
    cartItems.forEach(item => {
        html += `
            <div class="checkout-item">
                <img src="${item.image}" alt="${item.name}" class="checkout-item-image">
                <div class="checkout-item-details">
                    <h4>${item.name}</h4>
                    <p>Pris: ${item.price.toFixed(2)} NOK</p>
                    <p>Antall: ${item.quantity}</p>
                </div>
            </div>
        `;
    });
    
    return html;
}

function backToCart() {
    // Fjern checkout-modalen
    closeModal('checkout-modal');
    const checkoutModal = document.getElementById('checkout-modal');
    if (checkoutModal) {
        checkoutModal.remove();
    }
    
    // Åpne handlekurv-modalen igjen
    openModal('cart-modal');
}