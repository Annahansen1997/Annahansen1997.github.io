require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const cors = require('cors');  // Legg til denne linjen
const app = express();

// CORS konfigurasjon
const corsOptions = {
    origin: ['https://kreativmoro.no', 'http://localhost:3000'], // Tillat både produksjon og lokal utvikling
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'stripe-signature'],
    credentials: true
};

// Legg til CORS middleware
app.use(cors({
    origin: ['https://kreativmoro.no', 'http://localhost:3000'],
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'stripe-signature'],
    credentials: true
}));

app.options('*', cors()); // Håndter pre-flight OPTIONS-forespørsler globalt

app.use(express.json());
app.use(express.static('.'));

// Konfigurer e-post-tjeneste
const transporter = nodemailer.createTransport({
    service: 'hotmail',
    auth: {
        user: 'hombgames@hotmail.com',
        pass: process.env.EMAIL_PASSWORD
    }
});

// Stripe Price IDs for hvert produkt
const STRIPE_PRICE_IDS = {
    '0': 'price_1Qo9IPLPxmfy63yEXy1w1l8T',  // Vinterkos
    '1': 'price_1Qo9MJLPxmfy63yETbGYTyLJ',  // Påskekos
    '2': 'price_1Qo9NKLPxmfy63yEAoCoz18f',  // Dinosaur
    '3': 'price_1Qo9ODLPxmfy63yEtbAchGtn',  // Enhjørning
    '4': 'price_1Qo9P1LPxmfy63yES6FrJHo3',  // Bilbingo
    '5': 'price_1Qo9PnLPxmfy63yEf9cE5DIr'   // Flybingo
};

// Produktkatalog
const products = {
    '0': {
        name: 'Vinterkos',
        price: 4500, // 45 NOK i øre
        description: 'Digitalt aktivitetshefte for vinteren',
        filename: 'Vinterkos_Aktivitetshefte.pdf'
    },
    '1': {
        name: 'Påskekos',
        price: 4500, // 45 NOK i øre
        description: 'Digitalt aktivitetshefte for påsken',
        filename: 'Påskekos_Aktivitetshefte.pdf'
    },
    '2': {
        name: 'På eventyr med dinosaurene',
        price: 4500, // 45 NOK i øre
        description: 'Digitalt aktivitetshefte med dinosaurer',
        filename: 'Dinosaur_Aktivitetshefte.pdf'
    },
    '3': {
        name: 'Enhjørningens magiske eventyrhefte',
        price: 4500, // 45 NOK i øre
        description: 'Digitalt aktivitetshefte med enhjørninger',
        filename: 'Enhjørning_Aktivitetshefte.pdf'
    },
    '4': {
        name: 'Bilbingo',
        price: 3500, // 35 NOK i øre
        description: 'Digitalt bilbingo for bilturen',
        filename: 'Bilbingo.pdf'
    },
    '5': {
        name: 'Flybingo',
        price: 3500, // 35 NOK i øre
        description: 'Digitalt flybingo for flyreisen',
        filename: 'Flybingo.pdf'
    }
};

// Opprett checkout-økt endepunkt
// Oppdater endepunktet med eksplisitt CORS
app.post('/create-checkout-session', cors(corsOptions), async (req, res) => {
    try {
        const items = req.body.items || [];
        const lineItems = items.map(item => ({
            price: STRIPE_PRICE_IDS[item.id],
            quantity: 1
        }));

        const purchasedProducts = items.map(item => ({
            name: products[item.id].name,
            filename: products[item.id].filename
        }));

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${req.headers.origin}/success.html`,
            cancel_url: `${req.headers.origin}/cancel.html`,
            metadata: {
                customerEmail: req.body.customerEmail,
                purchasedProducts: JSON.stringify(purchasedProducts)
            },
            billing_address_collection: 'required',
            shipping_address_collection: {
                allowed_countries: ['NO']
            }
        });

        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ error: `Betalingsfeil: ${error.message}` });
    }
});

// Webhook for å håndtere vellykkede betalinger
app.post('/webhook', express.raw({type: 'application/json'}), async (request, response) => {
    const sig = request.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        response.status(400).send(`Webhook-feil: ${err.message}`);
        return;
    }

    // Håndter vellykket betaling
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const purchasedProducts = JSON.parse(session.metadata.purchasedProducts);
        
        // Send PDF til kunden
        const mailOptions = {
            from: 'hombgames@hotmail.com',
            to: session.metadata.customerEmail,
            subject: 'Dine aktivitetshefter fra Kreativ Moro',
            text: 'Tusen takk for kjøpet! Her er dine aktivitetshefter. God fornøyelse!',
            attachments: purchasedProducts.map(product => ({
                filename: product.filename,
                path: `./${product.filename}` // Sørg for at filene ligger i riktig mappe
            }))
        };

        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.log('E-postfeil:', error);
            } else {
                console.log('E-post sendt:', info.response);
            }
        });
    }

    response.json({received: true});
});

// Start serveren
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Serveren kjører på port ${port}`);
});