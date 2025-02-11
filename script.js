let currentSlide = 0;
let slides = [];
let dots = [];
let currentModal = null;
let cart = JSON.parse(localStorage.getItem('cart')) || [];

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

    // Initialiser kontakt-knapp
    const contactLinks = document.querySelectorAll('.nav-link');
    contactLinks.forEach(link => {
        if (link.textContent.trim() === 'Kontakt') {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                openContactModal();
            });
        }
    });

    // Initialiser Om Oss-funksjonalitet
    const aboutLink = document.querySelector('.about-link');
    if (aboutLink) {
        aboutLink.addEventListener('click', function (e) {
            e.preventDefault();
            openModal('about-modal');
        });
    }
});

function addToCart(product) {
    const existingItem = cart.find(i => i.id === product.id);
    if (existingItem) {
        // Hvis produktet allerede finnes i handlekurven, vis en melding
        showMessage('Dette produktet er allerede i handlekurven');
        return;
    }
    
    // Legg til produktet med quantity = 1
    const item = {
        id: product.id,
        name: product.name,
        price: product.price,
        priceId: product.priceId,
        image: product.image,
        quantity: 1
    };
    
    cart.push(item);
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
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalElement = document.getElementById('cart-total');
    if (!cartItemsContainer) return;
    
    cartItemsContainer.innerHTML = '';
    let total = 0;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}" class="cart-item-image">
            <div class="cart-item-details">
                <h3>${item.name}</h3>
                <p>Pris: ${item.price.toFixed(2)} NOK</p>
                <p>Digital nedlasting (PDF)</p>
                <div class="quantity-controls">
                    <button class="quantity-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                    <span class="quantity-display">${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                </div>
            </div>
            <div class="cart-item-price">${itemTotal.toFixed(2)} NOK</div>
            <button class="delete-btn" onclick="removeFromCart('${item.id}')">×</button>
        `;
        cartItemsContainer.appendChild(itemElement);
    });
    
    if (cartTotalElement) {
        cartTotalElement.textContent = `${total.toFixed(2)} NOK`;
    }

    // Vis eller skjul knapper basert på om handlekurven er tom
    const checkoutButton = document.querySelector('.checkout-button');
    const emptyCartButton = document.querySelector('.empty-cart-button');
    
    if (checkoutButton && emptyCartButton) {
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-cart-message">Handlekurven er tom</p>';
            checkoutButton.style.display = 'none';
            emptyCartButton.style.display = 'none';
        } else {
            checkoutButton.style.display = 'block';
            emptyCartButton.style.display = 'block';
        }
    }
}

function removeFromCart(productId) {
    // Finn indeksen til produktet i handlekurven
    const index = cart.findIndex(item => item.id.toString() === productId.toString());
    
    if (index !== -1) {
        // Fjern produktet fra cart-arrayet
        cart.splice(index, 1);
        
        // Oppdater localStorage
        localStorage.setItem('cart', JSON.stringify(cart));
        
        // Oppdater visningen
        updateCartCount();
        updateCartDisplay();
        
        // Vis melding
        showMessage('Produkt fjernet fra handlekurven');
    }
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.id.toString() === productId.toString());
    if (!item) return;

    const newQuantity = item.quantity + change;
    
    // Ikke la antallet gå under 1
    if (newQuantity < 1) {
        return;
    }
    
    // Oppdater antallet
    item.quantity = newQuantity;
    
    // Oppdater localStorage
    localStorage.setItem('cart', JSON.stringify(cart));
    
    // Oppdater visningen
    updateCartCount();
    updateCartDisplay();
    
    // Vis bekreftelsesmelding
    if (change > 0) {
        showMessage(`Antall ${item.name} økt til ${newQuantity}`);
    } else {
        showMessage(`Antall ${item.name} redusert til ${newQuantity}`);
    }
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

// Modal funksjoner
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.style.display = 'block';
    document.body.classList.add('modal-open');
    currentModal = modal;

    // Initialiser karusell hvis den finnes i modalen
    initializeCarousel(modal);

    if (modalId === 'cart-modal') {
        updateCartDisplay();
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
    const carousel = modal.querySelector('.image-carousel');
    if (!carousel) return;

    const slides = carousel.querySelectorAll('.carousel-image');
    if (slides.length === 0) return;

    // Vis første bilde umiddelbart
    slides[0].style.display = 'block';
    slides[0].classList.add('active');

    const dotsContainer = carousel.querySelector('.carousel-dots');
    if (!dotsContainer) return;

    // Tøm eksisterende dots
    dotsContainer.innerHTML = '';

    // Opprett dots for hvert bilde
    slides.forEach((_, index) => {
        const dot = document.createElement('span');
        dot.className = 'dot';
        if (index === 0) dot.classList.add('active');
        dot.onclick = () => showSlide(modal, index);
        dotsContainer.appendChild(dot);
    });

    // Legg til event listeners for prev/next knapper
    const prevButton = carousel.querySelector('.carousel-button.prev');
    const nextButton = carousel.querySelector('.carousel-button.next');

    if (prevButton) {
        prevButton.onclick = (e) => {
            e.stopPropagation();
            moveSlide(modal, -1);
        };
    }

    if (nextButton) {
        nextButton.onclick = (e) => {
            e.stopPropagation();
            moveSlide(modal, 1);
        };
    }
}

function showSlide(modal, index) {
    const carousel = modal.querySelector('.image-carousel');
    if (!carousel) return;

    const slides = carousel.querySelectorAll('.carousel-image');
    const dots = carousel.querySelectorAll('.dot');
    
    if (slides.length === 0) return;

    // Håndter wrap-around
    let slideIndex = index;
    if (index >= slides.length) slideIndex = 0;
    if (index < 0) slideIndex = slides.length - 1;

    // Skjul alle bilder først
    slides.forEach(slide => {
        slide.style.display = 'none';
        slide.classList.remove('active');
    });
    dots.forEach(dot => dot.classList.remove('active'));

    // Vis det aktive bildet
    slides[slideIndex].style.display = 'block';
    slides[slideIndex].classList.add('active');
    dots[slideIndex].classList.add('active');
}

function moveSlide(modal, direction) {
    const carousel = modal.querySelector('.image-carousel');
    if (!carousel) return;

    const slides = carousel.querySelectorAll('.carousel-image');
    const currentSlide = carousel.querySelector('.carousel-image.active');
    
    if (!currentSlide) return;

    let currentIndex = Array.from(slides).indexOf(currentSlide);
    let newIndex = currentIndex + direction;

    if (newIndex >= slides.length) newIndex = 0;
    if (newIndex < 0) newIndex = slides.length - 1;

    showSlide(modal, newIndex);
}

// Close modal when clicking outside
window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        closeModal(event.target.id);
    }
}

// Handle keyboard navigation
document.addEventListener('keydown', function (event) {
    if (!currentModal) return;

    if (event.key === 'ArrowLeft') {
        moveSlide(currentModal, -1);
    } else if (event.key === 'ArrowRight') {
        moveSlide(currentModal, 1);
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
    }, 3001);
}

// Kontakt-funksjonalitet
function openContactModal() {
    const modal = document.getElementById('contact-modal');
    if (modal) {
        modal.style.display = "block";
        document.body.classList.add('modal-open');
    }
}

// EmailJS konfigurasjon
(function() {
    emailjs.init({
        publicKey: "Ug6P_Hy_7jBVwVMZv",
        blockHeadless: false,
        limitRate: {
            throttle: 10000
        }
    });

    // Test EmailJS tilkobling
    emailjs.send("default_service", "template_bs5yh6j", {
        from_name: "Test",
        subject: "API Test",
        from_email: "test@test.com",
        message: "Dette er en test-melding",
        reply_to: "test@test.com"
    }).then(
        function(response) {
            console.log("EmailJS tilkobling vellykket!", response);
        },
        function(error) {
            console.error("EmailJS tilkoblingsfeil:", error);
        }
    );
})();

// Kontaktskjema funksjonalitet
async function handleContactSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = {
        from_name: form.from_name.value,
        from_email: form.from_email.value,
        subject: form.subject.value,
        message: form.message.value,
        reply_to: form.from_email.value
    };

    try {
        await emailjs.send(
            emailjsConfig.serviceId,
            emailjsConfig.templateId,
            formData,
            {
                publicKey: emailjsConfig.publicKey,
                blockHeadless: false
            }
        );
        alert('Meldingen din er sendt! Vi vil svare så snart som mulig.');
        closeModal('contact-modal');
        form.reset();
    } catch (error) {
        console.error('Error:', error);
        alert('Beklager, det oppstod en feil ved sending av meldingen. Vennligst prøv igjen senere.');
    }
}

// Funksjon for å sende ordrebekreftelse
function sendOrderConfirmation(orderDetails) {
    return emailjs.send(
        'default_service', // Service ID fra playground
        'template_slf2zpr', // Template ID for ordrebekreftelse
        {
            product_name: orderDetails.productName,
            order_number: orderDetails.orderNumber,
            purchase_date: new Date().toLocaleDateString('no-NO'),
            total_price: `${orderDetails.price.toFixed(2)} NOK`,
            to_email: orderDetails.email,
            reply_to: 'kreativmoro@outlook.com'
        }
    ).then(
        function(response) {
            console.log('Ordrebekreftelse sendt:', response);
            return response;
        },
        function(error) {
            console.error('Feil ved sending av ordrebekreftelse:', error);
            throw error;
        }
    );
}

// Oppdatert handlePurchase funksjon
async function handlePurchase(productId, productName, price) {
    const customerEmail = prompt('Vennligst skriv inn din e-postadresse for å motta produktet:');

    if (!customerEmail || !customerEmail.includes('@')) {
        alert('Vennligst oppgi en gyldig e-postadresse.');
        return;
    }

    showLoadingMessage('Behandler din bestilling...');

    try {
        const orderNumber = 'ORDER-' + Date.now();
        await sendOrderConfirmation({
            email: customerEmail,
            productName: productName,
            orderNumber: orderNumber,
            price: price
        });

        hideLoadingMessage();
        showSuccessMessage('Takk for ditt kjøp! Produktet er sendt til din e-post.');
        removeFromCart(productId);
        closeModal('cart-modal');
    } catch (error) {
        hideLoadingMessage();
        showMessage('Beklager, noe gikk galt. Vennligst kontakt kundeservice.', 'error');
        console.error('E-post feil:', error);
    }
}

function showLoadingMessage(message) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-message';
    loadingDiv.innerHTML = `
        <div class="spinner"></div>
        <p>${message}</p>
    `;
    document.body.appendChild(loadingDiv);
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
document.addEventListener('DOMContentLoaded', function () {
    const aboutLink = document.querySelector('.about-link');

    if (aboutLink) {
        aboutLink.addEventListener('click', function (e) {
            e.preventDefault();
            openModal('about-modal');
        });
    }
});

const STRIPE_PUBLISHABLE_KEY = 'pk_live_51Qmu3ULPxmfy63yEbYUAv6FZFaaGsoSTp8XF7nUEol9ksHgNid71K4FogSAhBwBDdNYa8syBZ4DAP4c9BS0qHaBQ00aT9p4bcV';
const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

async function goToCheckout() {
    const cartItems = JSON.parse(localStorage.getItem('cart')) || [];
    if (cartItems.length === 0) {
        alert('Handlekurven er tom');
        return;
    }

    try {
        const response = await fetch('https://kreativmoro.onrender.com/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cart: cartItems
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Server response:', errorData);
            throw new Error('Network response was not ok');
        }

        const session = await response.json();
        
        if (session.url) {
            window.location.href = session.url;
        } else {
            throw new Error('Ingen betalings-URL mottatt');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Det oppstod en feil ved betaling. Vennligst prøv igjen senere.');
    }
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
            star.addEventListener('mouseover', function () {
                const rating = parseInt(this.dataset.rating);
                const description = this.dataset.description;
                highlightStars(stars, rating);
                if (ratingText) {
                    ratingText.textContent = description;
                    ratingText.style.opacity = '1';
                }
            });

            // Når musen forlater stjerneområdet
            ratingContainer.addEventListener('mouseleave', function () {
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
            star.addEventListener('click', function () {
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

// Oppdater buy-button click handlers
document.querySelectorAll('.buy-button').forEach(button => {
    const modalContent = button.closest('.modal-content');
    const productId = parseInt(button.closest('.modal').id.replace('modal', ''));
    const productName = modalContent.querySelector('h2').textContent;
    const price = parseFloat(button.textContent.match(/\d+\.?\d*/)[0]);

    button.onclick = () => handlePurchase(productId, productName, price);
});

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

async function initiateCheckout() {
    try {
        const response = await fetch('/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cart })
        });
        
        const session = await response.json();
        
        if (session.url) {
            window.location = session.url;
        } else {
            alert('Det oppstod en feil ved opprettelse av betalingsøkt. Vennligst prøv igjen.');
        }
    } catch (error) {
        console.error('Betalingsfeil:', error);
        alert('Det oppstod en feil ved betaling. Vennligst prøv igjen.');
    }
}

// Initialiser handlekurven når siden lastes
document.addEventListener('DOMContentLoaded', updateCartDisplay);

function showMessage(message) {
    const messageContainer = document.createElement('div');
    messageContainer.className = 'cart-message';
    messageContainer.innerHTML = message;
    document.body.appendChild(messageContainer);

    setTimeout(() => {
        messageContainer.remove();
    }, 3000);
}