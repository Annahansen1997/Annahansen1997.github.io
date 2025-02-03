require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Konfigurer e-post-tjeneste
const transporter = nodemailer.createTransport({
    service: 'hotmail',
    auth: {
        user: 'hombgames@hotmail.com',
        pass: process.env.EMAIL_PASSWORD
    }
});

// Stripe Price IDs for products
const STRIPE_PRICE_IDS = {
    'flybingo': 'price_1QnxbQLPxmfy63yEgOJpONGp',
    'bilbingo': 'price_1QnxbQLPxmfy63yEhKMpQOYp',
    'enhjørning': 'price_1QnxbQLPxmfy63yEiRNpFCBG',
    'dinosaur': 'price_1QnxbQLPxmfy63yEjSOpXHZb',
    'påskekos': 'price_1QnxbQLPxmfy63yEkTQqYIZc',
    'vinterkos': 'price_1QnxbQLPxmfy63yElURrZJad'
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

app.post('/create-checkout-session', async (req, res) => {
    try {
        const { items } = req.body;
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: items.map(item => ({
                price: STRIPE_PRICE_IDS[item.id],
                quantity: 1,
            })),
            mode: 'payment',
            success_url: `${req.headers.origin}/success.html`,
            cancel_url: `${req.headers.origin}/cancel.html`,
            automatic_tax: { enabled: true },
            billing_address_collection: 'required',
            shipping_address_collection: {
                allowed_countries: ['NO'],
            },
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
    console.log(`Server running on port ${port}`);
});