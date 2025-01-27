const express = require('express');
const stripe = require('stripe')('din_stripe_secret_key');
const nodemailer = require('nodemailer');
const app = express();

app.use(express.json());
app.use(express.static('.'));

// Konfigurer e-post-tjeneste
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'hombgames@hotmail.com', // Din e-postadresse
        pass: 'ditt_app_passord' // App-spesifikt passord
    }
});

app.post('/create-checkout-session', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: req.body.lineItems,
            mode: 'payment',
            success_url: 'https://dittdomene.no/success.html',
            cancel_url: 'https://dittdomene.no/cancel.html',
            metadata: {
                customerEmail: req.body.customerEmail // Legg til kundens e-post
            }
        });

        res.json({ id: session.sessionId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Webhook for å håndtere vellykkede betalinger
app.post('/webhook', express.raw({type: 'application/json'}), async (request, response) => {
    const sig = request.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(request.body, sig, 'din_webhook_secret');
    } catch (err) {
        response.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Håndter vellykket betaling
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        // Send PDF til kunden
        const mailOptions = {
            from: 'hombgames@hotmail.com',
            to: session.metadata.customerEmail,
            subject: 'Ditt Påskekos Aktivitetshefte',
            text: 'Takk for kjøpet! Her er ditt Påskekos Aktivitetshefte.',
            attachments: [{
                filename: 'Påskekos_Aktivitetshefte.pdf',
                path: './assets/Påskekos_Aktivitetshefte.pdf' // Sti til PDF-filen
            }]
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

app.listen(3000, () => console.log('Server kjører på port 3000')); 