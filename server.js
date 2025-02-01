require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const app = express();

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

// Produktkatalog
const products = {
    'vinterkos': {
        name: 'Vinterkos',
        price: 4500, // 45 NOK i øre
        description: 'Digitalt aktivitetshefte for vinteren',
        filename: 'Vinterkos_Aktivitetshefte.pdf'
    },
    'paskekos': {
        name: 'Påskekos',
        price: 4500, // 45 NOK i øre
        description: 'Digitalt aktivitetshefte for påsken',
        filename: 'Påskekos_Aktivitetshefte.pdf'
    },
    'dinosaur': {
        name: 'På eventyr med dinosaurene',
        price: 4500, // 45 NOK i øre
        description: 'Digitalt aktivitetshefte med dinosaurer',
        filename: 'Dinosaur_Aktivitetshefte.pdf'
    },
    'enhjorning': {
        name: 'Enhjørningens magiske eventyrhefte',
        price: 4500, // 45 NOK i øre
        description: 'Digitalt aktivitetshefte med enhjørninger',
        filename: 'Enhjørning_Aktivitetshefte.pdf'
    },
    'bilbingo': {
        name: 'Bilbingo',
        price: 3500, // 35 NOK i øre
        description: 'Digitalt bilbingo for bilturen',
        filename: 'Bilbingo.pdf'
    },
    'flybingo': {
        name: 'Flybingo',
        price: 3500, // 35 NOK i øre
        description: 'Digitalt flybingo for flyreisen',
        filename: 'Flybingo.pdf'
    }
};

// Opprett checkout-økt endepunkt
app.post('/create-checkout-session', async (req, res) => {
    try {
        const items = req.body.items || [];
        const lineItems = items.map(item => ({
            price_data: {
                currency: 'nok',
                product_data: {
                    name: products[item.id].name,
                    description: products[item.id].description,
                },
                unit_amount: products[item.id].price,
            },
            quantity: item.quantity || 1,
        }));

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${req.headers.origin}/success.html`,
            cancel_url: `${req.headers.origin}/cancel.html`,
            metadata: {
                customerEmail: req.body.customerEmail
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
        event = stripe.webhooks.constructEvent(request.body, sig, 'din_webhook_secret');
    } catch (err) {
        response.status(400).send(`Webhook-feil: ${err.message}`);
        return;
    }

    // Håndter vellykket betaling
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        // Send PDF til kunden
        const mailOptions = {
            from: 'hombgames@hotmail.com',
            to: session.metadata.customerEmail,
            subject: 'Dine aktivitetshefter fra Kreativ Moro',
            text: 'Tusen takk for kjøpet! Her er dine aktivitetshefter. God fornøyelse!',
            attachments: [] // Attachments will be added based on purchased items
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