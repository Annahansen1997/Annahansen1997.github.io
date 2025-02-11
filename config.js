// Stripe konfigurasjon - Felles betalingslenke for alle produkter
const config = {
    PAYMENT_LINK: 'https://buy.stripe.com/bIYcOHbzuccO0LKcMN',
    STRIPE_PUBLISHABLE_KEY: 'pk_live_51Qmu3ULPxmfy63yEbYUAv6FZFaaGsoSTp8XF7nUEol9ksHgNid71K4FogSAhBwBDdNYa8syBZ4DAP4c9BS0qHaBQ00aT9p4bcV'
};

const PRODUCT_PRICES = {
    "Flybingo": "price_1Qo9PnLPxmfy63yEf9cE5DIr",
    "Bilbingo": "price_1Qo9P1LPxmfy63yES6FrJHo3",
    "Enhjørningens magiske eventyrhefte": "price_1Qo9ODLPxmfy63yEtbAchGtn",
    "På eventyr med dinosaurene": "price_1Qo9NKLPxmfy63yEAoCoz18f",
    "Påskekos Aktivitetshefte": "price_1Qo9MJLPxmfy63yETbGYTyLJ",
    "Vinterkos Aktivitetshefte": "price_1Qo9IPLPxmfy63yEXy1w1l8T",
    "Brev fra Påskeharen": "price_1QqhMBLPxmfy63yEHKyJ21FW",
    "Dyrene i Skogen Fargeleggingshefte": "price_1QqhLDLPxmfy63yErSiWyw6O"
};

// EmailJS Configuration
const emailjsConfig = {
    publicKey: process.env.EMAILJS_PUBLIC_KEY || 'Ug6P_Hy_7jBVwVMZv',
    serviceId: process.env.EMAILJS_SERVICE_ID || 'default_service',
    templateId: process.env.EMAILJS_TEMPLATE_ID || 'template_bs5yh6j',
    testTemplateId: process.env.EMAILJS_TEST_TEMPLATE_ID || 'template_slf2zpr'
};

// Initialize EmailJS
emailjs.init(emailjsConfig.publicKey);
