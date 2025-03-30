require('dotenv').config();

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-01-27.acacia'
});
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const nodemailer = require('nodemailer');

// Konfigurer nodemailer med Gmail SMTP
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Gmail email
        pass: process.env.EMAIL_PASSWORD // Gmail app password
    }
});

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
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With', 'stripe-signature'],
    credentials: true
};

// Helmet med CSP-konfigurasjon
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: [
                "'self'", 
                "https://api.stripe.com",
                "https://kreativmoro.onrender.com",
                "https://www.sandbox.paypal.com",
                "https://www.paypal.com",
                "https://checkout.klarna.com"
            ],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://js.stripe.com",
                "https://www.sandbox.paypal.com",
                "https://www.paypal.com",
                "https://checkout.klarna.com"
            ],
            frameSrc: [
                "'self'",
                "https://js.stripe.com",
                "https://www.sandbox.paypal.com",
                "https://www.paypal.com",
                "https://checkout.klarna.com"
            ],
            imgSrc: ["'self'", "data:", "https:"],
            styleSrc: ["'self'", "'unsafe-inline'"]
        }
    }
}));

// Bruk middleware for alt unntatt webhook-ruten
app.use((req, res, next) => {
    if (req.originalUrl === '/webhook') {
        next();
    } else {
        cors(corsOptions)(req, res, next);
    }
});

// Bruk JSON parsing for alt unntatt webhook-ruten
app.use((req, res, next) => {
    if (req.originalUrl === '/webhook') {
        next();
    } else {
        express.json()(req, res, next);
    }
});

// Håndter preflight requests
app.options('*', cors(corsOptions));

// Legg til CORS headers for alle ruter (unntatt webhook)
app.use((req, res, next) => {
    if (req.originalUrl === '/webhook') {
        next();
        return;
    }
    
    const origin = req.headers.origin;
    if (corsOptions.origin.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, stripe-signature');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

// Serve statiske filer
app.use(express.static(path.join(__dirname)));

// VIKTIG: Webhook route må komme FØR alle andre ruter
app.post('/webhook', express.raw({type: 'application/json'}), async (request, response) => {
    const sig = request.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            request.body, 
            sig, 
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('Received event:', event);

    // Håndter ulike event typer
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            
            try {
                // Hent komplett sesjonsinformasjon med line_items - FIKSET EXPAND
                const completeSession = await stripe.checkout.sessions.retrieve(
                    session.id, 
                    {
                        expand: ['line_items']
                    }
                );
                
                // Legg til sjekk på om line_items eksisterer
                if (completeSession && completeSession.line_items && completeSession.line_items.data) {
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
                } else {
                    console.error('Mangler line_items data i Stripe-responsen');
                }
            } catch (error) {
                console.error('Feil ved sending av ordre e-post:', error);
                // Ikke send feilstatus - vi vil gi 200 OK til Stripe selv om e-posten feiler
            }
            break;
            
        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    // Send alltid 200 OK respons til Stripe
    return response.status(200).json({received: true});
});

// Test-webhook rute for debugging
app.post('/test-webhook', (req, res) => {
    console.log('Test webhook mottatt');
    res.status(200).json({ success: true });
});

// Test-email rute - må være før catch-all ruten
app.get('/test-email', async (req, res) => {
    try {
        // Sjekk Gmail e-post og passord
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
            throw new Error('EMAIL_USER eller EMAIL_PASSWORD er ikke konfigurert');
        }

        console.log('Forsøker å sende e-post til:', process.env.EMAIL_USER);

        const mailOptions = {
            from: `"Kreativ Moro" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            subject: 'Test E-post fra Kreativ Moro',
            text: 'Dette er en test-e-post for å verifisere at Gmail SMTP-konfigurasjonen fungerer.',
            html: '<strong>Dette er en test-e-post for å verifisere at Gmail SMTP-konfigurasjonen fungerer.</strong>'
        };

        const response = await transporter.sendMail(mailOptions);
        console.log('Gmail SMTP respons:', response);
        
        res.send('Test-e-post sendt! Sjekk innboksen din. Gmail SMTP respons mottatt.');
    } catch (error) {
        console.error('Detaljert feil ved sending av test-e-post:', {
            message: error.message,
            response: error.response ? error.response.body : null
        });
        res.status(500).send(`Feil ved sending av test-e-post: ${error.message}`);
    }
});

// Grunnleggende rute for rotadressen
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
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
        name: 'På eventyr med dinosaurene',
        description: 'Digital nedlasting - PDF format',
        filename: 'dinosaur_aktivitetshefte.pdf',
        price_id: 'price_1Qo9NKLPxmfy63yEAoCoz18f'
    },
    'enhjørning': {
        price: 4500,
        name: 'Enhjørningens magiske eventyrhefte',
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
            payment_method_types: ['card', 'paypal', 'klarna'],
            line_items: cart.map(item => ({
                price: item.priceId,
                quantity: item.quantity,
            })),
            mode: 'payment',
            success_url: `${req.body.success_url}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: req.body.cancel_url,
            customer_email: req.body.customer_email, // Legg til e-post
            billing_address_collection: 'required' // Gjør e-post obligatorisk
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Stripe feil:', error);
        res.status(500).json({ error: error.message });
    }
});

// Hent ordre-informasjon - FIKSET EXPAND
app.get('/order-complete', async (req, res) => {
    try {
        const { session_id } = req.query;
        
        // Legg til expand for line_items
        const session = await stripe.checkout.sessions.retrieve(
            session_id, 
            {
                expand: ['line_items']
            }
        );
        
        // Legg til sjekk for å sikre at dataen finnes
        if (!session.line_items || !session.line_items.data) {
            throw new Error('Mangler line_items data i Stripe-responsen');
        }
        
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

// Generer sikker nedlastingslenke
function generateSecureDownloadUrl(sessionId, productId, filename) {
    const timestamp = Date.now();
    const token = crypto
        .createHmac('sha256', process.env.DOWNLOAD_SECRET_KEY)
        .update(`${sessionId}-${productId}-${timestamp}`)
        .digest('hex');
    
    return `/secure-download/${sessionId}/${productId}/${timestamp}/${token}/${filename}`;
}

// Ny rute for å hente nedlastingslenker
app.get('/get-download-links', async (req, res) => {
    try {
        const { session_id } = req.query;
        const session = await stripe.checkout.sessions.retrieve(session_id, {
            expand: ['line_items']
        });

        // Verifiser at betalingen er fullført
        if (session.payment_status !== 'paid') {
            return res.status(400).json({ error: 'Betaling ikke fullført' });
        }

        // Legg til sjekk for å sikre at dataen finnes
        if (!session.line_items || !session.line_items.data) {
            throw new Error('Mangler line_items data i Stripe-responsen');
        }

        const files = session.line_items.data.map(item => {
            const productId = item.price.product;
            const product = Object.entries(PRODUCTS).find(([_, p]) => p.price_id === item.price.id);
            
            if (!product) return null;

            const [key, productInfo] = product;
            return {
                name: productInfo.name,
                filename: productInfo.filename,
                downloadUrl: generateSecureDownloadUrl(session_id, productId, productInfo.filename)
            };
        }).filter(Boolean);

        res.json({ files });
    } catch (error) {
        console.error('Feil ved generering av nedlastingslenker:', error);
        res.status(500).json({ error: 'Kunne ikke generere nedlastingslenker' });
    }
});

// Sikker nedlastingsrute
app.get('/secure-download/:sessionId/:productId/:timestamp/:token/:filename', async (req, res) => {
    try {
        const { sessionId, productId, timestamp, token, filename } = req.params;
        
        // Verifiser token
        const expectedToken = crypto
            .createHmac('sha256', process.env.DOWNLOAD_SECRET_KEY)
            .update(`${sessionId}-${productId}-${timestamp}`)
            .digest('hex');
        
        if (token !== expectedToken) {
            return res.status(403).send('Ugyldig nedlastingslenke');
        }

        // Sjekk om lenken er utløpt (f.eks. 24 timer)
        const now = Date.now();
        if (now - parseInt(timestamp) > 24 * 60 * 60 * 1000) {
            return res.status(403).send('Nedlastingslenken er utløpt');
        }

        // Verifiser at sesjonen eksisterer og er betalt
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') {
            return res.status(403).send('Betaling ikke fullført');
        }

        // Send filen
        const filePath = path.join(__dirname, 'products', filename);
        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('Feil ved nedlasting:', err);
                res.status(500).send('Feil ved nedlasting av fil');
            }
        });
    } catch (error) {
        console.error('Feil ved sikker nedlasting:', error);
        res.status(500).send('Serverfeil ved nedlasting');
    }
});

// Oppdater sendOrderEmail funksjonen
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
            const filePath = path.join(__dirname, 'products', productInfo.filename);
            const fileContent = fs.readFileSync(filePath).toString('base64');

            return {
                content: fileContent,
                filename: productInfo.filename,
                type: 'application/pdf',
                disposition: 'attachment'
            };
        });

        const mailOptions = {
            from: `"Kreativ Moro" <${process.env.EMAIL_USER}>`,
            to: customerEmail,
            subject: 'Din bestilling fra Kreativ Moro',
            text: `Hei!\n\nTakk for din bestilling hos Kreativ Moro. Her er din(e) digitale produkt(er):\n\nOrdre detaljer:\nProdukt(er): ${products.map(p => p.name).join(', ')}\nOrdrenummer: ${orderData.order_number}\nDato: ${formattedDate}\nTotalt betalt: ${(orderData.total_amount / 100).toFixed(2)} NOK\n\nDine PDF-filer er vedlagt denne e-posten.\n\nViktig informasjon:\n- PDF-filene er kun for personlig bruk\n- Ikke del filene med andre\n- Du kan skrive ut så mange kopier du ønsker til eget bruk\n\nHar du spørsmål om din bestilling?\nSvar på denne e-posten eller kontakt oss via nettsiden.\n\nMed vennlig hilsen,\nKreativ Moro\n\n---\nwww.kreativmoro.no`,
            attachments: attachments.map(attachment => ({
                filename: attachment.filename,
                content: attachment.content,
                encoding: 'base64',
                contentType: attachment.type,
                disposition: attachment.disposition
            }))
        };

        await transporter.sendMail(mailOptions);
        console.log('Ordre e-post sendt til:', customerEmail);
    } catch (error) {
        console.error('Feil ved sending av ordre e-post:', error);
        throw error;
    }
}

// Håndter alle andre ruter ved å sende index.html - MÅ VÆRE SIST
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Legg til portkonfigurasjon
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});