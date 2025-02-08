require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();

// Sikkerhetstiltak
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutter
    max: 100 // maks 100 requests per vindu
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// CORS konfigurasjon
const corsOptions = {
    origin: ['https://kreativmoro.no', 'https://www.kreativmoro.no'],
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'stripe-signature'],
    credentials: true
};

app.options('*', cors(corsOptions)); // Pre-flight OPTIONS
app.use(cors(corsOptions));

app.use(express.json());

// Logg alle forespørsler
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Opprett checkout-økt endepunkt
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { cart } = req.body;
        
        if (!cart || !Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ error: 'Invalid cart data' });
        }

        const lineItems = cart.map(item => ({
            price: item.priceId,
            quantity: item.quantity
        }));

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/success.html`,
            cancel_url: `${req.protocol}://${req.get('host')}/cancel.html`,
            metadata: {
                order_items: JSON.stringify(cart.map(item => ({
                    name: item.name,
                    quantity: item.quantity
                })))
            }
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Stripe error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.use(express.static(path.join(__dirname, 'public')));

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

// Stripe webhook handler
app.post('/webhook', express.raw({type: 'application/json'}), async (request, response) => {
    const sig = request.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
        response.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            
            // Her kan du legge til kode for å:
            // 1. Sende e-post med nedlastingslenke
            // 2. Oppdatere ordrestatus i database
            // 3. Generere nedlastingslenker
            
            console.log('Betaling fullført:', session);
            break;
            
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log('PaymentIntent var vellykket:', paymentIntent);
            break;
            
        case 'payment_intent.payment_failed':
            const failedPayment = event.data.object;
            console.log('Betaling feilet:', failedPayment);
            break;
            
        default:
            console.log(`Uhåndtert event type ${event.type}`);
    }

    response.send();
});

// Helsesjekk endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'En feil oppstod på serveren',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server kjører på port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal mottatt: lukker server');
    server.close(() => {
        console.log('Server lukket');
        process.exit(0);
    });
});