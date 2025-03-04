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
        5: 'flybingo',
        6: 'brev_fra_påskeharen',
        7: 'dyrene_i_skogen'
    };

    const attachments = products.map(product => {
        const productKey = productMapping[product.id];
        const productInfo = PRODUCTS[productKey];
        return {
            filename: productInfo.filename,
            path: path.join(__dirname, 'products', productInfo.filename)
        };
    });

    const emailTemplate = `
        <h1>Takk for din bestilling hos Kreativ Moro!</h1>
        <p>Her er dine bestilte aktivitetshefter:</p>
        <ul>
            ${products.map(product => {
                const productKey = productMapping[product.id];
                const productInfo = PRODUCTS[productKey];
                return `<li>${productInfo.name}</li>`;
            }).join('')}
        </ul>
        <p>Du finner PDF-filene som vedlegg i denne e-posten.</p>
        <p>Med vennlig hilsen,<br>Kreativ Moro</p>
    `;

    await transporter.sendMail({
        from: {
            name: 'Kreativ Moro',
            address: process.env.EMAIL_USER
        },
        to: customerEmail,
        subject: 'Din bestilling fra Kreativ Moro',
        html: emailTemplate,
        attachments: attachments
    });
}

// Sikker PDF nedlasting fra products-mappen
app.get('/downloads/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        
        // Bruk products-mappen for PDF-filer
        const filePath = path.join(__dirname, 'products', filename);
        
        // Send PDF-filen
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('Feil ved sending av fil:', err);
                res.status(404).send('Filen ble ikke funnet');
            }
        });
    } catch (error) {
        console.error('Feil ved nedlasting:', error);
        res.status(500).send('Serverfeil ved nedlasting');
    }
});

// Stripe checkout session
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { cart } = req.body;
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: cart.map(item => ({
                price: item.priceId,
                quantity: item.quantity,
            })),
            mode: 'payment',
            success_url: `${req.body.success_url}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: req.body.cancel_url,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Stripe feil:', error);
        res.status(500).json({ error: error.message });
    }
});

// Hent ordre-informasjon
app.get('/order-complete', async (req, res) => {
    try {
        const { session_id } = req.query;
        const session = await stripe.checkout.sessions.retrieve(session_id);
        
        res.json({
            customer_email: session.customer_details.email,
            items: session.line_items.data,
            order_number: session.id,
            total_amount: session.amount_total / 100
        });
    } catch (error) {
        console.error('Feil ved henting av ordre:', error);
        res.status(500).json({ error: error.message });
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
    },
    'brev_fra_påskeharen': {
        price: 2000,
        name: 'Brev fra Påskeharen',
        description: 'Digital nedlasting - To PDF varianter (rosa og blå)',
        filename: 'brev_paskeharen.pdf'
    },
    'dyrene_i_skogen': {
        price: 4500,
        name: 'Dyrene i Skogen Fargeleggingshefte',
        description: 'Digital nedlasting - PDF format',
        filename: 'dyrene_i_skogen.pdf'
    }
};

// Oppdater webhook handler
app.post('/webhook', express.raw({type: 'application/json'}), async (request, response) => {
    const sig = request.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        response.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Håndter ulike event typer
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            
            try {
                // Hent kundens e-post fra sesjonen
                const customerEmail = session.customer_details.email;
                
                // Hent ordre-detaljer fra metadata
                const orderItems = JSON.parse(session.metadata.order_items);
                
                // Send e-post med PDF-vedlegg
                await sendOrderEmail(customerEmail, orderItems, session.id);
                
                console.log('Ordre e-post sendt til:', customerEmail);
            } catch (error) {
                console.error('Feil ved sending av ordre e-post:', error);
                // Vi sender fortsatt 200 OK til Stripe for å unngå gjentatte webhook-forsøk
            }
            break;
            
        default:
            console.log(`Uhandled event type: ${event.type}`);
    }

    response.json({received: true});
});

// Start serveren
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server kjører på port ${PORT}`);
});