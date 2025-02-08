require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();

// Sikkerhetstiltak med tilpasset CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                "'unsafe-hashes'",
                "https://js.stripe.com",
                "https://cdn.jsdelivr.net",
                "https://www.google-analytics.com"
            ],
            scriptSrcAttr: ["'unsafe-inline'"],
            scriptSrcElem: [
                "'self'",
                "'unsafe-inline'",
                "https://js.stripe.com",
                "https://cdn.jsdelivr.net"
            ],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.stripe.com", "https://kreativmoro.onrender.com"],
            frameSrc: ["'self'", "https://js.stripe.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            childSrc: ["'self'", "https://js.stripe.com"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutter
    max: 100 // maks 100 requests per vindu
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle all other routes to support SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// CORS konfigurasjon
const corsOptions = {
    origin: [
        'https://kreativmoro.no',
        'https://www.kreativmoro.no',
        'https://annahansen1997.github.io',
        'http://kreativmoro.no',
        'http://www.kreativmoro.no'
    ],
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'stripe-signature',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Methods',
        'Access-Control-Allow-Headers'
    ],
    exposedHeaders: ['Access-Control-Allow-Origin'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Håndter preflight requests
app.options('*', cors(corsOptions));

app.use(express.json());

// Logg alle forespørsler
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Konfigurer e-post transport
const transporter = nodemailer.createTransport({
    host: "smtp-mail.outlook.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER, // din hotmail/outlook e-post
        pass: process.env.EMAIL_PASSWORD // ditt vanlige passord
    },
    tls: {
        ciphers: 'SSLv3'
    }
});

// Funksjon for å generere sikker nedlastingslenke
function generateDownloadToken(orderId, productId) {
    const secret = process.env.DOWNLOAD_SECRET_KEY;
    return crypto
        .createHmac('sha256', secret)
        .update(`${orderId}-${productId}`)
        .digest('hex');
}

// Funksjon for å sende ordre-e-post
async function sendOrderEmail(customerEmail, products, orderId) {
    // Map produkt ID til produktnøkler
    const productMapping = {
        0: 'vinterkos',
        1: 'påskekos',
        2: 'dinosaur',
        3: 'enhjørning',
        4: 'bilbingo',
        5: 'flybingo'
    };

    const downloadLinks = products.map(product => {
        const productKey = productMapping[product.id];
        const productInfo = PRODUCTS[productKey];
        const token = generateDownloadToken(orderId, product.id);
        return {
            name: productInfo.name,
            url: `${process.env.DOMAIN}/download/${orderId}/${product.id}/${token}`
        };
    });

    const emailTemplate = `
        <h1>Takk for din bestilling hos Kreativ Moro!</h1>
        <p>Her er dine nedlastingslenker:</p>
        <ul>
            ${downloadLinks.map(link => `
                <li><a href="${link.url}">${link.name}</a></li>
            `).join('')}
        </ul>
        <p>Lenkene er gyldige i 48 timer.</p>
        <p>Med vennlig hilsen,<br>Kreativ Moro</p>
    `;

    await transporter.sendMail({
        from: {
            name: 'Kreativ Moro',
            address: process.env.EMAIL_USER
        },
        to: customerEmail,
        subject: 'Din bestilling fra Kreativ Moro',
        html: emailTemplate
    });
}

// Opprett checkout-økt endepunkt
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { cart } = req.body;
        
        if (!cart || !Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ error: 'Invalid cart data' });
        }

        console.log('Received cart:', cart); // Logging for debugging

        // Validere at alle produkter har priceId
        const invalidItems = cart.filter(item => !item.priceId);
        if (invalidItems.length > 0) {
            return res.status(400).json({ 
                error: 'Missing priceId for some products',
                items: invalidItems
            });
        }

        const lineItems = cart.map(item => ({
            price: item.priceId,
            quantity: item.quantity
        }));

        console.log('Created line items:', lineItems); // Logging for debugging

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: 'https://annahansen1997.github.io/success.html',
            cancel_url: 'https://annahansen1997.github.io/cancel.html',
            metadata: {
                order_items: JSON.stringify(cart.map(item => ({
                    name: item.name,
                    quantity: item.quantity
                })))
            }
        });

        console.log('Created Stripe session:', session.id); // Logging for debugging
        res.json({ url: session.url });
    } catch (error) {
        console.error('Stripe error:', error);
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Produktkonfigurasjon
const PRODUCTS = {
    'vinterkos': {
        price: 4500,
        name: 'Vinterkos Aktivitetshefte',
        description: 'Digital nedlasting - PDF format',
        filename: 'vinterkos_aktivitetshefte.pdf'
    },
    'påskekos': {
        price: 4500,
        name: 'Påskekos Aktivitetshefte',
        description: 'Digital nedlasting - PDF format',
        filename: 'paskekos_aktivitetshefte.pdf'
    },
    'dinosaur': {
        price: 4500,
        name: 'Dinosaur Aktivitetshefte',
        description: 'Digital nedlasting - PDF format',
        filename: 'dinosaur_aktivitetshefte.pdf'
    },
    'enhjørning': {
        price: 4500,
        name: 'Enhjørning Aktivitetshefte',
        description: 'Digital nedlasting - PDF format',
        filename: 'enhjorning_aktivitetshefte.pdf'
    },
    'bilbingo': {
        price: 3500,
        name: 'Bilbingo',
        description: 'Digital nedlasting - PDF format',
        filename: 'bilbingo.pdf'
    },
    'flybingo': {
        price: 3500,
        name: 'Flybingo',
        description: 'Digital nedlasting - PDF format',
        filename: 'flybingo.pdf'
    }
};

// Oppdater webhook handler
app.post('/webhook', express.raw({type: 'application/json'}), async (request, response) => {
    const sig = request.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        response.status(400).send(`