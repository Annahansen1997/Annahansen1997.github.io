let currentSlide = 0;
let slides = [];
let dots = [];
let currentModal = null;
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Lagre scroll-posisjon når en modal åpnes
let lastScrollPosition = 0;

const STRIPE_PUBLISHABLE_KEY = 'pk_live_51Qmu3ULPxmfy63yEbYUAv6FZFaaGsoSTp8XF7nUEol9ksHgNid71K4FogSAhBwBDdNYa8syBZ4DAP4c9BS0qHaBQ00aT9p4bcV';
const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

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

async function goToCheckout() {
    const cartItems = JSON.parse(localStorage.getItem('cart')) || [];
    if (cartItems.length === 0) {
        alert('Handlekurven er tom');
        return;
    }

    try {
        showLoadingMessage('Behandler betalingen...');
        
        // Konstruer fullstendige URLs for success og cancel
        const baseUrl = window.location.origin;
        const successUrl = `${baseUrl}/success.html`;
        const cancelUrl = `${baseUrl}/cancel.html`;
        
        const response = await fetch('https://kreativmoro.onrender.com/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cart: cartItems,
                success_url: successUrl,
                cancel_url: cancelUrl
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
        hideLoadingMessage();
        showMessage('Det oppstod en feil ved betaling. Vennligst prøv igjen senere eller kontakt kundeservice.', 'error');
    }
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

// Funksjon for å håndtere vellykket betaling og levering av produkt
async function handleSuccessfulPayment() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (!sessionId) return;

    try {
        // Hent ordreinformasjon fra server
        const response = await fetch(`https://kreativmoro.onrender.com/order-complete?session_id=${sessionId}`, {
            method: 'GET'
        });
        
        if (!response.ok) {
            throw new Error('Kunne ikke hente ordreinformasjon');
        }
        
        const orderData = await response.json();
        
        // Send ordrebekreftelse og produkter på e-post
        await sendOrderConfirmation({
            email: orderData.customer_email,
            productName: orderData.items.map(item => item.name).join(', '),
            orderNumber: orderData.order_number,
            price: orderData.total_amount,
            items: orderData.items
        });

        // Tøm handlekurven
        emptyCart();
        
        // Vis suksessmelding og opprett nedlastingslenker
        const successContainer = document.createElement('div');
        successContainer.className = 'success-container';
        successContainer.innerHTML = `
            <h2>Takk for ditt kjøp!</h2>
            <p>En e-post med ordrebekreftelse og produktene er sendt til din e-post.</p>
            <div class="download-section">
                <h3>Last ned dine produkter her:</h3>
                <div class="download-links">
                    ${orderData.items.map(item => `
                        <div class="download-item">
                            <img src="${item.image}" alt="${item.name}" class="download-thumbnail">
                            <div class="download-info">
                                <h4>${item.name}</h4>
                                <a href="https://kreativmoro.onrender.com/downloads/${item.priceId}.pdf" 
                                   target="_blank" 
                                   class="download-button">
                                   Åpne PDF
                                </a>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Finn eller opprett container for success-innhold
        let successPageContainer = document.querySelector('.success-page-container');
        if (!successPageContainer) {
            successPageContainer = document.createElement('div');
            successPageContainer.className = 'success-page-container';
            document.body.appendChild(successPageContainer);
        }
        
        successPageContainer.innerHTML = ''; // Tøm eksisterende innhold
        successPageContainer.appendChild(successContainer);
        
    } catch (error) {
        console.error('Feil ved behandling av ordre:', error);
        showMessage('Det oppstod en feil ved behandling av ordren. Vennligst kontakt kundeservice.', 'error');
    }
}

// Kjør denne funksjonen når siden lastes
document.addEventListener('DOMContentLoaded', function() {
    // Sjekk om vi er på success-siden
    if (window.location.pathname.includes('success.html')) {
        handleSuccessfulPayment();
    }
});

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
            reply_to: 'kreativmoro@outlook.com',
            // Legg ved produktfilene som vedlegg
            attachments: orderDetails.items ? orderDetails.items.map(item => ({
                name: `${item.name}.pdf`,
                url: `https://kreativmoro.onrender.com/downloads/${item.priceId}.pdf`
            })) : []
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

// Legg til nye stiler for success-siden
const styles = `
    .success-container {
        max-width: 800px;
        margin: 40px auto;
        padding: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }

    .success-container h2 {
        color: #2c3e50;
        text-align: center;
        margin-bottom: 20px;
    }

    .download-section {
        margin-top: 30px;
    }

    .download-links {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
        margin-top: 20px;
    }

    .download-item {
        display: flex;
        align-items: center;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        transition: transform 0.2s;
    }

    .download-item:hover {
        transform: translateY(-2px);
    }

    .download-thumbnail {
        width: 80px;
        height: 80px;
        object-fit: cover;
        border-radius: 4px;
        margin-right: 15px;
    }

    .download-info {
        flex: 1;
    }

    .download-info h4 {
        margin: 0 0 10px 0;
        color: #2c3e50;
    }

    .download-button {
        display: inline-block;
        padding: 8px 16px;
        background-color: #4CAF50;
        color: white;
        text-decoration: none;
        border-radius: 4px;
        transition: background-color 0.2s;
    }

    .download-button:hover {
        background-color: #45a049;
    }
`;

// Legg til stilene i dokumentet
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet); 