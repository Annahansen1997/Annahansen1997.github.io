require('dotenv').config();

// Legg til denne koden rett etter require('dotenv').config();
console.log('Email configuration:', {
    user: process.env.EMAIL_USER ? 'Satt' : 'Ikke satt',
    password: process.env.EMAIL_PASSWORD ? 'Satt' : 'Ikke satt'
});

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const sgMail = require('@sendgrid/mail');

const app = express();

// Legg til SendGrid konfigurasjon
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Legg også til en test-rute for å sende en test-e-post
app.get('/test-email', async (req, res) => {
    try {
        await transporter.sendMail({
            from: {
                name: 'Kreativ Moro',
                address: process.env.EMAIL_USER
            },
            to: process.env.EMAIL_USER, // Sender til samme adresse for testing
            subject: 'Test E-post fra Kreativ Moro',
            text: 'Dette er en test-e-post for å verifisere at e-postkonfigurasjonen fungerer.',
            attachments: [{
                filename: 'test.txt',
                content: 'Dette er en test-fil for å teste vedlegg.'
            }]
        });
        
        res.send('Test-e-post sendt! Sjekk innboksen din.');
    } catch (error) {
        console.error('Feil ved sending av test-e-post:', error);
        res.status(500).send(`Feil ved sending av test-e-post: ${error.message}`);
    }
});

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
        'http://kreativmoro.no',
        'http://www.kreativmoro.no',
        'https://annahansen1997.github.io',
        'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With'],
    credentials: true
};

app.use(cors(corsOptions));

// Parse JSON bodies
app.use(express.json());

// Håndter preflight requests
app.options('*', cors(corsOptions));

// Legg til CORS headers for alle ruter
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (corsOptions.origin.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

// Logg alle forespørsler
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Konfigurer e-post transport
const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },
    tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
    },
    debug: true,
    logger: true
});

// Verifiser tilkobling ved oppstart
transporter.verify(function(error, success) {
    if (error) {
        console.error('E-postkonfigurasjon feil:', error);
        if (error.code === 'EAUTH') {
            console.error('Autentiseringsfeil detaljer:', {
                responseCode: error.responseCode,
                response: error.response,
                command: error.command
            });
        }
    } else {
        console.log('E-postserver er klar til å sende meldinger');
    }
});

// Funksjon for å sende ordre-e-post
async function sendOrderEmail(customerEmail, orderData, products) {
    try {
        const now = new Date();
        const formattedDate = now.toLocaleDateString('no-NO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        const attachments = products.map(product => {
            const productInfo = Object.values(PRODUCTS).find(p => p.price_id === product.price.id);
            if (!productInfo) return null;
            
            const filePath = path.join(__dirname, 'products', productInfo.filename);
            const fileContent = fs.readFileSync(filePath);
            
            return {
                content: fileContent.toString('base64'),
                filename: productInfo.filename,
                type: 'application/pdf',
                disposition: 'attachment'
            };
        }).filter(Boolean);

        const emailTemplate = `
Hei!

Takk for din bestilling hos Kreativ Moro. Her er din(e) digitale produkt(er):

Ordre detaljer:
Produkt(er): ${productNames}
Ordrenummer: ${orderData.order_number}
Dato: ${formattedDate}
Totalt betalt: ${(orderData.total_amount / 100).toFixed(2)} NOK

Dine PDF-filer er vedlagt denne e-posten.

Viktig informasjon:
- PDF-filene er kun for personlig bruk
- Ikke del filene med andre
- Du kan skrive ut så mange kopier du ønsker til eget bruk

Har du spørsmål om din bestilling? 
Svar på denne e-posten eller kontakt oss via nettsiden.

Med vennlig hilsen,
Kreativ Moro

---
www.kreativmoro.no`;

        const msg = {
            to: customerEmail,
            from: {
                email: process.env.SENDGRID_FROM_EMAIL,
                name: 'Kreativ Moro'
            },
            subject: 'Din bestilling fra Kreativ Moro',
            text: emailTemplate,
            attachments: attachments
        };

        await sgMail.send(msg);
        console.log('Ordre e-post sendt til:', customerEmail);
    } catch (error) {
        console.error('Feil ved sending av ordre e-post:', error);
        throw error;
    }
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
        filename: 'vinterkos_aktivitetshefte.pdf',
        price_id: 'price_1Qo9IPLPxmfy63yEXy1w1l8T'
    },
    'påskekos': {
        price: 4500,
        name: 'Påskekos Aktivitetshefte',
        description: 'Digital nedlasting - PDF format',
        filename: 'paskekos_aktivitetshefte.pdf',
        price_id: 'price_1Qo9MJLPxmfy63yETbGYTyLJ'
    },
    'dinosaur': {
        price: 4500,
        name: 'Dinosaur Aktivitetshefte',
        description: 'Digital nedlasting - PDF format',
        filename: 'dinosaur_aktivitetshefte.pdf',
        price_id: 'price_1Qo9NKLPxmfy63yEAoCoz18f'
    },
    'enhjørning': {
        price: 4500,
        name: 'Enhjørning Aktivitetshefte',
        description: 'Digital nedlasting - PDF format',
        filename: 'enhjorning_aktivitetshefte.pdf',
        price_id: 'price_1Qo9ODLPxmfy63yEtbAchGtn'
    },
    'bilbingo': {
        price: 3500,
        name: 'Bilbingo',
        description: 'Digital nedlasting - PDF format',
        filename: 'bilbingo.pdf',
        price_id: 'price_1Qo9P1LPxmfy63yES6FrJHo3'
    },
    'flybingo': {
        price: 3500,
        name: 'Flybingo',
        description: 'Digital nedlasting - PDF format',
        filename: 'flybingo.pdf',
        price_id: 'price_1Qo9PnLPxmfy63yEf9cE5DIr'
    },
    'brev_fra_påskeharen': {
        price: 2000,
        name: 'Brev fra Påskeharen',
        description: 'Digital nedlasting - To PDF varianter (rosa og blå)',
        filename: 'brev_paskeharen.pdf',
        price_id: 'price_1QqhMBLPxmfy63yEHKyJ21FW'
    },
    'dyrene_i_skogen': {
        price: 4500,
        name: 'Dyrene i Skogen Fargeleggingshefte',
        description: 'Digital nedlasting - PDF format',
        filename: 'dyrene_i_skogen.pdf',
        price_id: 'price_1QqhLDLPxmfy63yErSiWyw6O'
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

    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            
            try {
                // Hent komplett sesjonsinformasjon med line_items
                const completeSession = await stripe.checkout.sessions.retrieve(session.id, {
                    expand: ['line_items']
                });
                
                // Send e-post med PDF-vedlegg
                await sendOrderEmail(
                    completeSession.customer_details.email,
                    {
                        order_number: completeSession.id,
                        total_amount: completeSession.amount_total
                    },
                    completeSession.line_items.data
                );
                
                console.log('Ordre e-post sendt til:', completeSession.customer_details.email);
            } catch (error) {
                console.error('Feil ved sending av ordre e-post:', error);
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