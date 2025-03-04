const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');

const app = express();

// CORS konfigurasjon
const corsOptions = {
    origin: [
        'https://kreativmoro.no',
        'https://www.kreativmoro.no',
        'http://kreativmoro.no',
        'http://www.kreativmoro.no',
        'https://annahansen1997.github.io',
        'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Origin',
        'Accept',
        'X-Requested-With',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
    ],
    credentials: true,
    exposedHeaders: ['Access-Control-Allow-Origin'],
    preflightContinue: false,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Håndter preflight requests
app.options('*', cors(corsOptions));

// Legg til CORS headers manuelt som backup
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.sendStatus(204);
    } else {
        next();
    }
});

app.use(express.json());

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server kjører på port ${PORT}`);
}); 