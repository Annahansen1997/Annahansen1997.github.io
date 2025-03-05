const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const sgMail = require('@sendgrid/mail');

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

// Legg til SendGrid konfigurasjon
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

        const productNames = products.map(product => {
            const productInfo = Object.values(PRODUCTS).find(p => p.price_id === product.price.id);
            return productInfo ? productInfo.name : '';
        }).filter(Boolean).join(', ');

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

// Legg til en test-rute for å sende en test-e-post
app.get('/test-email', async (req, res) => {
    try {
        const msg = {
            to: process.env.SENDGRID_FROM_EMAIL,
            from: {
                email: process.env.SENDGRID_FROM_EMAIL,
                name: 'Kreativ Moro'
            },
            subject: 'Test E-post fra Kreativ Moro',
            text: 'Dette er en test-e-post for å verifisere at SendGrid-konfigurasjonen fungerer.'
        };

        await sgMail.send(msg);
        res.send('Test-e-post sendt! Sjekk innboksen din.');
    } catch (error) {
        console.error('Feil ved sending av test-e-post:', error);
        res.status(500).send(`Feil ved sending av test-e-post: ${error.message}`);
    }
});

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server kjører på port ${PORT}`);
}); 