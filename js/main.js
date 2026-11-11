let lastScroll = 0;
const header = document.querySelector('header');

// rAF-THROTTLED, PASSIVE SCROLL (fixes choppy scroll jank)
let scrollTicking = false;
function onScrollFrame() {
    scrollTicking = false;
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
        if (currentScroll > lastScroll + 2) {
            header.classList.add('hidden');
            header.classList.remove('sticky');
        } else if (currentScroll < lastScroll - 2) {
            header.classList.remove('hidden');
            header.classList.add('sticky');
        }
    } else {
        header.classList.remove('sticky', 'hidden');
    }
    lastScroll = currentScroll;

    updateBackToTopVisibility();
}

window.addEventListener('scroll', () => {
    if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(onScrollFrame);
    }
}, { passive: true });

// GOOGLE ANALYTICS & CONSENT MODE
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }

// Google Consent Mode v2 - default denied
gtag('consent', 'default', {
    'analytics_storage': 'denied',
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'wait_for_update': 500
});

const GA_MEASUREMENT_ID = 'G-4RZF44QNDM';
const GOOGLE_ADS_ID = 'AW-17661436144';
const ADS_CONVERSIONS = {
    form: 'iQZXCMGznYQdEPDB0OVB',
    call: 'XQWSCMSznYQdEPDB0OVB',
    email: 'xyzRCMeznYQdEPDB0OVB'
};
let gaLoaded = false;

function trackAdsConversion(type) {
    const label = ADS_CONVERSIONS[type];
    if (label) gtag('event', 'conversion', { send_to: GOOGLE_ADS_ID + '/' + label });
}

// reCAPTCHA Enterprise (score based). The site key is public; the secret
// key lives only on the server (private/config.php).
const RECAPTCHA_SITE_KEY = '6LctVdgtAAAAAPZOep17km6IIiTumxmN9n0AOy8r';
const RECAPTCHA_ACTION = 'contact_form';
let recaptchaScriptPromise = null;

function loadRecaptcha() {
    if (window.grecaptcha && window.grecaptcha.enterprise) {
        return Promise.resolve();
    }
    if (!recaptchaScriptPromise) {
        recaptchaScriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://www.google.com/recaptcha/enterprise.js?render=' + RECAPTCHA_SITE_KEY;
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    return recaptchaScriptPromise;
}

function getRecaptchaToken() {
    return loadRecaptcha().then(() => new Promise((resolve, reject) => {
        if (!window.grecaptcha || !window.grecaptcha.enterprise) {
            reject(new Error('reCAPTCHA unavailable'));
            return;
        }
        window.grecaptcha.enterprise.ready(() => {
            window.grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, { action: RECAPTCHA_ACTION })
                .then(resolve)
                .catch(reject);
        });
    }));
}

// Load early so reCAPTCHA can observe the session before the form is used.
loadRecaptcha().catch(() => {});

function loadGoogleAnalytics() {
    if (gaLoaded) return;
    gaLoaded = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    script.onload = function() {
        gtag('js', new Date());
        gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
        gtag('config', GOOGLE_ADS_ID);
    };
    document.head.appendChild(script);
}

const COOKIE_CONSENT_KEY = 'wip_cookie_consent';
const COOKIE_PREFERENCES_KEY = 'wip_cookie_preferences';
const COOKIE_EXPIRY_DAYS = 365;

class CookieConsent {
    constructor() {
        this.consentBanner = document.getElementById('cookieConsent');
        this.consentModal = document.getElementById('cookieModal');
        this.modalOverlay = document.getElementById('cookieModalOverlay');
        this.initialized = false;
        this.init();
    }
    
    init() {
        this.attachEventListeners();
        this.checkConsent();
    }
    
    attachEventListeners() {
        document.getElementById('cookieReject')?.addEventListener('click', () => this.rejectAll());
        document.getElementById('cookieAcceptAll')?.addEventListener('click', () => this.acceptAll());
        document.getElementById('cookieCustomize')?.addEventListener('click', () => this.openModal());
        document.getElementById('cookieModalClose')?.addEventListener('click', () => this.closeModal());
        document.getElementById('cookieModalOverlay')?.addEventListener('click', () => this.closeModal());
        document.getElementById('cookieModalReject')?.addEventListener('click', () => this.rejectAll());
        document.getElementById('cookieModalAccept')?.addEventListener('click', () => this.acceptAll());
        document.getElementById('cookieModalSave')?.addEventListener('click', () => this.savePreferences());
        document.getElementById('cookieSettings')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.openModal();
        });
    }
    
    checkConsent() {
        const consent = this.getConsent();
        if (!consent) {
            this.showBanner();
        } else {
            this.applyConsent(consent);
        }
    }
    
    getConsent() {
        const cookie = document.cookie.split('; ').find(row => row.startsWith(COOKIE_CONSENT_KEY + '='));
        if (!cookie) return null;
        try {
            return JSON.parse(decodeURIComponent(cookie.split('=')[1]));
        } catch (e) {
            return null;
        }
    }
    
    showBanner() {
        if (this.consentBanner) this.consentBanner.classList.add('show');
    }
    
    hideBanner() {
        if (this.consentBanner) this.consentBanner.classList.remove('show');
    }
    
    openModal() {
        if (this.consentModal) {
            this.consentModal.classList.add('show');
            document.body.style.overflow = 'hidden';
            this.loadPreferences();
        }
    }
    
    closeModal() {
        if (this.consentModal) {
            this.consentModal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }
    
    loadPreferences() {
        const preferences = this.getPreferences();
        document.querySelectorAll('.category-checkbox').forEach(checkbox => {
            const category = checkbox.getAttribute('data-category');
            if (category === 'necessary') {
                checkbox.checked = true;
            } else {
                checkbox.checked = preferences[category] || false;
            }
        });
    }
    
    getPreferences() {
        const cookie = document.cookie.split('; ').find(row => row.startsWith(COOKIE_PREFERENCES_KEY + '='));
        if (!cookie) return { analytics: false, marketing: false };
        try {
            return JSON.parse(decodeURIComponent(cookie.split('=')[1]));
        } catch (e) {
            return { analytics: false, marketing: false };
        }
    }
    
    savePreferences() {
        const preferences = {};
        document.querySelectorAll('.category-checkbox:not(:disabled)').forEach(checkbox => {
            const category = checkbox.getAttribute('data-category');
            preferences[category] = checkbox.checked;
        });
        this.setConsent(preferences);
        this.closeModal();
        this.hideBanner();
    }
    
    acceptAll() {
        this.setConsent({ analytics: true, marketing: true });
        this.closeModal();
        this.hideBanner();
    }
    
    rejectAll() {
        this.setConsent({ analytics: false, marketing: false });
        this.closeModal();
        this.hideBanner();
    }
    
    setConsent(preferences) {
        const consent = {
            necessary: true,
            analytics: preferences.analytics || false,
            marketing: preferences.marketing || false,
            timestamp: new Date().getTime()
        };
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + COOKIE_EXPIRY_DAYS);
        document.cookie = COOKIE_CONSENT_KEY + '=' + encodeURIComponent(JSON.stringify(consent)) + '; expires=' + expiryDate.toUTCString() + '; path=/; SameSite=Lax';
        document.cookie = COOKIE_PREFERENCES_KEY + '=' + encodeURIComponent(JSON.stringify(preferences)) + '; expires=' + expiryDate.toUTCString() + '; path=/; SameSite=Lax';
        this.updateGoogleConsent(consent);
        this.loadConditionalScripts(consent);
    }
    
    updateGoogleConsent(consent) {
        if (consent.analytics) {
            loadGoogleAnalytics();
        }
        gtag('consent', 'update', {
            'analytics_storage': consent.analytics ? 'granted' : 'denied',
            'ad_storage': consent.marketing ? 'granted' : 'denied',
            'ad_user_data': consent.marketing ? 'granted' : 'denied',
            'ad_personalization': consent.marketing ? 'granted' : 'denied'
        });
        if (consent.analytics && gaLoaded) {
            gtag('event', 'page_view');
        }
    }
    
    applyConsent(consent) {
        this.updateGoogleConsent(consent);
    }
    
    loadConditionalScripts(consent) {
        // Load conditional scripts based on consent
        // For now, Google Analytics is handled via updateGoogleConsent with Consent Mode v2
    }
}

const PORTFOLIO_PROJECTS = {
    restoransmio: {
        name: 'RestoransMio.lv',
        image: 'images/restoransmio.jpg',
        url: 'https://restoransmio.lv/',
        displayUrl: 'restoransmio.lv',
        lv: {
            type: 'Restorāns',
            description: 'Tumši zaļš damaskas raksts, zelta akcenti un rokraksta logotips rada mājīgu, nedaudz greznu restorāna noskaņu. Bloki rit kā žurnālā, bet ēdienkarte atveras kā pāršķirama grāmata. Rezervācijas poga ir redzama visā lapā, un vietne ir pieejama latviešu, angļu un krievu valodā.',
            note: 'Noskaņa un praktiskums ir līdzsvarā: bagātīgā vizuālā valoda netraucē ātri atrast ēdienkarti vai veikt rezervāciju.',
            points: [
                'Interaktīva ēdienkarte ar pāršķiramām lappusēm',
                'Virtuāla tūre pa restorāna telpām',
                'Rezervācijas poga pastāvīgi redzama',
                'Latviešu, angļu un krievu valodas',
                'Sociālo tīklu un Tripadvisor saites'
            ]
        },
        en: {
            type: 'Restaurant',
            description: 'Deep green damask, gold accents and a script logo give the site a cosy, quietly upscale restaurant feel. Sections read like a magazine spread, while the menu opens as a page-turning book. The reservation button stays visible throughout and the site is available in Latvian, English and Russian.',
            note: 'Atmosphere and practicality are balanced: the rich visual language never gets in the way of finding the menu or booking a table.',
            points: [
                'Interactive menu with page-turning spreads',
                'Virtual tour of the restaurant',
                'Reservation button always within reach',
                'Latvian, English and Russian versions',
                'Social and Tripadvisor links'
            ]
        }
    },
    skujkoks: {
        name: 'Skujkoks.lv',
        image: 'images/skujkoks.jpg',
        url: 'https://skujkoks.lv/',
        displayUrl: 'skujkoks.lv',
        lv: {
            type: 'Mežsaimniecība',
            description: 'Balta telpa, maigi zaļa navigācija un melni akcenti rada mierīgu, uzticamu zīmolu. Hero attēls ar mežu pildītu pūci uzreiz pasaka stāstu par mežu, bet lapa ir sadalīta skaidrās sadaļās ar enkuriem: par uzņēmumu, pakalpojumi, partneri, komanda, atsauksmes un jaunumi. Katram pakalpojumam ir sava detaļu lapa, un kontaktforma ļauj ātri pieteikt konsultāciju.',
            note: 'Vienkāršā struktūra un spēcīgais vizuālais motīvs padara plašo pakalpojumu klāstu viegli pārskatāmu.',
            points: [
                'Vienas lapas navigācija ar sadaļu enkuriem',
                'Atsevišķa lapa katram meža pakalpojumam',
                'Partneru, komandas un atsauksmju sadaļas',
                'Jaunumu bloks un pieteikuma forma',
                'Zaļš zīmols ar meža motīviem'
            ]
        },
        en: {
            type: 'Forestry',
            description: 'White space, a soft sage navigation bar and black accents give the site a calm, trustworthy brand feel. A hero image of an owl filled with forest instantly tells the forestry story, while the page breaks into clear anchored sections: about, services, partners, team, testimonials and news. Every service has its own detail page and the contact form makes it easy to request a consultation.',
            note: 'A simple structure and a strong visual motif make a broad service range easy to scan.',
            points: [
                'Single-page navigation with section anchors',
                'A separate page for every forestry service',
                'Partners, team and testimonial sections',
                'News block and enquiry form',
                'A green brand built on forest imagery'
            ]
        }
    },
    asl: {
        name: 'ASL.lv',
        image: 'images/asl.jpg',
        url: 'https://asl.lv/',
        displayUrl: 'asl.lv',
        lv: {
            type: 'Pasākumu tehnika',
            description: 'Kinematogrāfisks tumšs hero ar skatuves prožektoru stariem un lielu, pārliecinošu virsrakstu uzreiz liek just pasākuma mērogu. Zem tā gaiša sadaļa ar milzīgu tipogrāfiju un blīvu pakalpojumu režģi rada tehnisku, profesionālu kontrastu. Lapa darbojas kā portfolio: reāli projekti ar LED ekrāniem, skatuvēm un apgaismojumu, deviņas pakalpojumu kategorijas, zīmolu partneri un komandas profili.',
            note: 'Vizuālais tēls un pierādījumi ir vienā vietā: lielais hero piesaista uzmanību, bet projektu sadaļa parāda reālu darbu.',
            points: [
                'Kinematogrāfisks hero ar skatuves gaismām',
                'Portfolio ar reāliem pasākumu projektiem',
                'Deviņas skaidras pakalpojumu kategorijas',
                'Zīmolu partneru josla',
                'Piecas valodas un komandas profili'
            ]
        },
        en: {
            type: 'Event technology',
            description: 'A cinematic dark hero with stage spotlight beams and an oversized headline sets the scale of an event immediately. Below it, a light section with huge typography and a dense service grid creates a technical, professional contrast. The site doubles as a portfolio: real projects with LED screens, stages and lighting, nine service categories, brand partners and team profiles.',
            note: 'Image and proof sit together: the big hero grabs attention, while the project section shows real work.',
            points: [
                'Cinematic hero with stage lighting',
                'Portfolio of real event projects',
                'Nine clearly grouped service categories',
                'A row of brand partners',
                'Five languages and team profiles'
            ]
        }
    },
    gude: {
        name: 'Gude.lv',
        image: 'images/gude.jpg',
        url: 'https://gude.lv/',
        displayUrl: 'gude.lv',
        lv: {
            type: 'Ražotājs',
            description: 'Silts krēmkrāsas fons, gandrīz melni paneļi un oranžs akcents kopā ar blīvu, industriālu tipogrāfiju rada izteiktu ražotāja raksturu. Lielie skaitļi (20+ gadi, 1700+ m³ mēnesī, 18% mitrums) uzreiz nodod uzticamību, bet produkcijas, izmēru un iepakojuma sadaļas atbild uz praktiskiem jautājumiem. Vietne ir sešās valodās, un pirkuma pieprasījums atveras ērtā modālajā logā.',
            note: 'Konkrēti skaitļi un skaidra tehniskā informācija pārvērš vienkāršu produktu pārliecinošā B2B piedāvājumā.',
            points: [
                'Industriāla tipogrāfija un silta krāsu palete',
                'Uzticamības skaitļi pirmajā ekrānā',
                'Produktu, izmēru un iepakojuma specifikācijas',
                'Loģistikas un eksporta sadaļa',
                'Sešas valodas un pirkuma modālais logs'
            ]
        },
        en: {
            type: 'Manufacturer',
            description: 'A warm cream background, near-black panels and an orange accent, paired with dense industrial typography, give the site a distinct manufacturer character. The big numbers (20+ years, 1700+ m³ per month, 18% moisture) establish credibility at a glance, while the product, size and packaging sections answer practical questions. The site is available in six languages and the purchase enquiry opens in a convenient modal.',
            note: 'Concrete numbers and clear technical information turn a simple product into a convincing B2B offer.',
            points: [
                'Industrial typography and a warm palette',
                'Credibility numbers on the first screen',
                'Product, size and packaging specifications',
                'Logistics and export section',
                'Six languages and a purchase modal'
            ]
        }
    },
    franciskadraudze: {
        name: 'FranciskaDraudze.lv',
        image: 'images/franciska.jpg',
        url: 'https://franciskadraudze.lv/',
        displayUrl: 'franciskadraudze.lv',
        lv: {
            type: 'Draudze',
            description: 'Pilnekrāna baznīcas gaisa fotogrāfija, dziļi bordo navigācija un serifa virsraksti rada mierīgu, cieņpilnu noskaņu. Saturs ir sakārtots tā, lai draudzes loceklis ātri atrastu jaunumus, notikumu kalendāru, grupas, koru informāciju un baznīcas vēsturi, bet ziedojumu poga un sociālie tīkli ir vienmēr pa rokai. Fotogrāfijas un siltais tonis padara lapu personisku, nevis oficiālu.',
            note: 'Spēcīgā hero fotogrāfija un skaidrā navigācija līdzsvaro bagāto kopienas saturu ar vieglu lietošanu.',
            points: [
                'Pilnekrāna baznīcas fotogrāfija ar maigu pārklājumu',
                'Bordo navigācija un serifa tipogrāfija',
                'Jaunumu bloks un notikumu kalendārs',
                'Draudzes grupu, koru un galerijas sadaļas',
                'Ziedojumu poga, YouTube un Facebook'
            ]
        },
        en: {
            type: 'Parish',
            description: 'A full-screen aerial photograph of the church, deep burgundy navigation and serif headings create a calm, respectful mood. The content is arranged so a parish member can quickly find news, the event calendar, groups, choir information and church history, while the donation button and social links are always at hand. Photography and a warm tone make the page feel personal rather than official.',
            note: 'The strong hero photograph and clear navigation balance rich community content with easy use.',
            points: [
                'Full-screen church photograph with a soft overlay',
                'Burgundy navigation and serif typography',
                'News block and event calendar',
                'Parish groups, choirs and gallery sections',
                'Donation button, YouTube and Facebook'
            ]
        }
    },
    latvijasfondi: {
        name: 'LatvijasFondi.lv',
        image: 'images/latvijasfondi.jpg',
        url: 'https://latvijasfondi.lv/',
        displayUrl: 'latvijasfondi.lv',
        lv: {
            type: 'Nekustamie īpašumi',
            description: 'Tumši zils fons, oranžs akcents un baltas, noapaļotas formas rada mūsdienīgu un uzticamu finanšu iespaidu. Vissvarīgākais ir novērtējuma pieprasījums: daudzpakāpju forma ar soļu indikatoru jau atrodas hero sadaļā, tāpēc apmeklētājs var sākt bez meklēšanas. Zemāk ir pakalpojumi, juridiski droša procesa izklāsts, seši uzticamības iemesli, klientu atsauksmes un BUJ sadaļa.',
            note: 'Forma ir lapas centrā, nevis paslēpta: tas ir reti redzams un ļoti efektīvs veids, kā pārvērst apmeklētāju pieprasījumā.',
            points: [
                'Daudzpakāpju novērtējuma forma pirmajā ekrānā',
                'Tumši zila un oranža kontrasta shēma',
                '"Seši iemesli" uzticamības bloks',
                'Klientu atsauksmes un BUJ sadaļa',
                'Piecas valodas un ātra pieteikšanās'
            ]
        },
        en: {
            type: 'Real estate',
            description: 'A deep navy background, orange accent and white rounded shapes create a modern, trustworthy financial impression. The most important action is the valuation request: a multi-step form with a progress indicator sits right in the hero, so visitors can start without searching. Below are services, a clear legal process, six credibility reasons, client testimonials and an FAQ section.',
            note: 'The form is the centre of the page, not hidden away: a rare and very effective way to turn a visitor into an enquiry.',
            points: [
                'Multi-step valuation form in the hero',
                'Deep navy and orange contrast',
                'A six-reason credibility block',
                'Client testimonials and an FAQ section',
                'Five languages and a fast enquiry flow'
            ]
        }
    }
};

class PortfolioModal {
    constructor() {
        this.modal = document.getElementById('portfolioModal');
        if (!this.modal) return;

        this.panel = this.modal.querySelector('.pf-modal-panel');
        this.closeButton = this.modal.querySelector('.pf-modal-close');
        this.image = document.getElementById('pfModalImage');
        this.kicker = document.getElementById('pfModalKicker');
        this.title = document.getElementById('pfModalTitle');
        this.url = document.getElementById('pfModalUrl');
        this.urlText = document.getElementById('pfModalUrlText');
        this.description = document.getElementById('pfModalDesc');
        this.note = document.getElementById('pfModalNote');
        this.points = document.getElementById('pfModalPoints');
        this.visit = document.getElementById('pfModalVisit');
        this.language = document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'lv';
        this.lastTrigger = null;
        this.closeTimer = null;

        this.init();
    }

    init() {
        this.modal.querySelectorAll('[data-pf-close]').forEach((element) => {
            element.addEventListener('click', () => this.close());
        });

        document.querySelectorAll('.portfolio-card[data-pf-key]').forEach((card) => {
            card.addEventListener('click', (event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                this.open(card.dataset.pfKey, card);
            });
        });

        document.addEventListener('keydown', (event) => {
            if (!this.modal.classList.contains('is-open')) return;

            if (event.key === 'Escape') {
                event.preventDefault();
                this.close();
                return;
            }

            if (event.key === 'Tab') this.trapFocus(event);
        });
    }

    open(key, trigger) {
        const project = PORTFOLIO_PROJECTS[key];
        if (!project) return;

        clearTimeout(this.closeTimer);
        this.lastTrigger = trigger || document.activeElement || null;
        this.render(project);
        this.modal.classList.add('is-open');
        this.modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('pf-modal-open');
        this.closeButton.focus({ preventScroll: true });
    }

    close() {
        if (!this.modal.classList.contains('is-open')) return;

        this.modal.classList.remove('is-open');
        this.modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('pf-modal-open');

        clearTimeout(this.closeTimer);
        this.closeTimer = setTimeout(() => {
            if (this.lastTrigger && document.contains(this.lastTrigger)) {
                this.lastTrigger.focus({ preventScroll: true });
            }
        }, 220);
    }

    render(project) {
        const content = project[this.language] || project.lv;

        this.image.src = project.image;
        this.image.alt = project.name + (this.language === 'en' ? ' website screenshot' : ' mājaslapas ekrānuzņēmums');
        this.kicker.textContent = content.type;
        this.title.textContent = project.name;
        this.url.href = project.url;
        this.urlText.textContent = project.displayUrl;
        this.description.textContent = content.description;
        this.note.textContent = content.note;
        this.visit.href = project.url;
        this.points.replaceChildren(...content.points.map((point) => {
            const item = document.createElement('li');
            item.textContent = point;
            return item;
        }));
        this.panel.scrollTop = 0;
        this.modal.querySelector('.pf-modal-body').scrollTop = 0;
    }

    trapFocus(event) {
        const focusable = Array.from(this.modal.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
            .filter((element) => element.getClientRects().length > 0);
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CookieConsent();
    new PortfolioModal();

    // PRICING TABS
    const pricingTabs = Array.from(document.querySelectorAll('.pricing-tab'));
    const pricingPanels = Array.from(document.querySelectorAll('.pricing-panel'));

    function selectPricingTab(tab) {
        pricingTabs.forEach((pricingTab) => {
            const isSelected = pricingTab === tab;
            pricingTab.setAttribute('aria-selected', String(isSelected));
            pricingTab.tabIndex = isSelected ? 0 : -1;
        });
        pricingPanels.forEach((panel) => {
            panel.hidden = panel.id !== tab.getAttribute('aria-controls');
        });
    }

    pricingTabs.forEach((tab, index) => {
        tab.addEventListener('click', () => selectPricingTab(tab));
        tab.addEventListener('keydown', (event) => {
            let nextIndex;
            if (event.key === 'ArrowRight') nextIndex = (index + 1) % pricingTabs.length;
            else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + pricingTabs.length) % pricingTabs.length;
            else if (event.key === 'Home') nextIndex = 0;
            else if (event.key === 'End') nextIndex = pricingTabs.length - 1;
            else return;

            event.preventDefault();
            pricingTabs[nextIndex].focus();
            selectPricingTab(pricingTabs[nextIndex]);
        });
    });
    
    // GOOGLE ADS CALCULATOR
    const adsCalc = document.getElementById('adsCalc');
    if (adsCalc) {
        const adsEnglish = document.documentElement.lang === 'en';
        const industryProfiles = {
            services: { cpc: 0.75, cr: 0.045, close: 0.32, value: 250 },
            store: { cpc: 0.42, cr: 0.023, close: 1, value: 45 },
            b2b: { cpc: 1.35, cr: 0.028, close: 0.18, value: 1400 }
        };
        const adsBudget = document.getElementById('adsBudget');
        const adsValue = document.getElementById('adsValue');
        const adsIndustry = document.getElementById('adsIndustry');
        const adsBudgetOut = document.getElementById('adsBudgetOut');
        const adsValueOut = document.getElementById('adsValueOut');
        const adsClicks = document.getElementById('adsClicks');
        const adsLeads = document.getElementById('adsLeads');
        const adsClients = document.getElementById('adsClients');
        const adsCpa = document.getElementById('adsCpa');
        const adsRevenue = document.getElementById('adsRevenue');
        const adsRoi = document.getElementById('adsRoi');
        const adsNumber = new Intl.NumberFormat(adsEnglish ? 'en-GB' : 'lv-LV', { maximumFractionDigits: 0, useGrouping: 'always' });
        const adsDecimal = new Intl.NumberFormat(adsEnglish ? 'en-GB' : 'lv-LV', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: 'always' });

        function adsMoney(value) {
            return adsEnglish ? '€' + adsNumber.format(value) : adsNumber.format(value) + ' €';
        }

        function updateAdsCalc() {
            const profile = industryProfiles[adsIndustry.value] || industryProfiles.services;
            const budget = Number(adsBudget.value);
            const clientValue = Number(adsValue.value);
            const clicks = budget / profile.cpc;
            const leads = clicks * profile.cr;
            const clients = leads * profile.close;
            const revenue = clients * clientValue;
            const costPerClient = clients > 0 ? budget / clients : 0;
            const roi = budget > 0 ? revenue / budget : 0;

            adsBudgetOut.textContent = adsMoney(budget);
            adsValueOut.textContent = adsMoney(clientValue);
            adsClicks.textContent = adsNumber.format(Math.round(clicks));
            adsLeads.textContent = adsNumber.format(Math.round(leads));
            adsClients.textContent = adsDecimal.format(clients);
            adsCpa.textContent = adsMoney(Math.round(costPerClient));
            adsRevenue.textContent = adsMoney(Math.round(revenue / 10) * 10);
            adsRoi.textContent = adsEnglish
                ? (roi < 1 ? 'The budget barely returns at this value.' : 'The budget returns about ' + adsDecimal.format(roi) + ' times.')
                : (roi < 1 ? 'Pie šīs vērtības budžets neatmaksājas.' : 'Budžets atpelnās ' + adsDecimal.format(roi) + ' reizes.');
        }

        adsBudget.addEventListener('input', updateAdsCalc);
        adsValue.addEventListener('input', updateAdsCalc);
        adsIndustry.addEventListener('change', () => {
            const profile = industryProfiles[adsIndustry.value] || industryProfiles.services;
            adsValue.value = profile.value;
            updateAdsCalc();
        });
        updateAdsCalc();
    }

    // CONTACT POPUP
    const contactPopup = document.getElementById('contactPopup');
    const contactOverlay = document.getElementById('contactOverlay');
    const popupClose = document.getElementById('popupClose');
    const contactForm = document.getElementById('contactForm');
    const formMessage = document.getElementById('formMessage');
    const ctaButtons = document.querySelectorAll('.contact-cta-btn');
    
    function openPopup() {
        contactPopup.classList.add('active');
        contactOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function closePopup() {
        contactPopup.classList.remove('active');
        contactOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    if (ctaButtons) {
        ctaButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openPopup();
        });
        });
    }
    
    if (popupClose) popupClose.addEventListener('click', closePopup);
    if (contactOverlay) contactOverlay.addEventListener('click', closePopup);
    
    // MOBILE MENU
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mainNav = document.getElementById('mainNav');
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    const backToTop = document.getElementById('backToTop');

    function openMobileMenu() {
        mainNav.classList.add('active');
        mobileMenuToggle.classList.add('active');
        mobileMenuOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (backToTop) backToTop.style.display = 'none';
    }
    
    function closeMobileMenu() {
        mainNav.classList.remove('active');
        mobileMenuToggle.classList.remove('active');
        mobileMenuOverlay.classList.remove('active');
        document.body.style.overflow = '';
        if (backToTop) backToTop.style.display = '';
    }
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            if (mainNav.classList.contains('active')) {
                closeMobileMenu();
            } else {
                openMobileMenu();
            }
        });
    }
    
    if (mobileMenuOverlay) mobileMenuOverlay.addEventListener('click', closeMobileMenu);
    if (mainNav) mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMobileMenu));

    // ACTIVE SECTION IN NAV
    const navSectionLinks = Array.from(document.querySelectorAll('.nav-items-grid a[href^="#"]'))
        .filter((link) => link.getAttribute('href').length > 1)
        .map((link) => ({ link, section: document.querySelector(link.getAttribute('href')) }))
        .filter((item) => item.section);

    if (navSectionLinks.length) {
        const setActiveSection = () => {
            let current = null;
            navSectionLinks.forEach(({ link, section }) => {
                const rect = section.getBoundingClientRect();
                if (rect.top <= 180 && rect.bottom > 180) current = link;
            });
            navSectionLinks.forEach(({ link }) => {
                const isCurrent = link === current;
                link.classList.toggle('active', isCurrent);
                if (isCurrent) {
                    link.setAttribute('aria-current', 'true');
                } else {
                    link.removeAttribute('aria-current');
                }
            });
        };
        window.addEventListener('scroll', setActiveSection, { passive: true });
        window.addEventListener('resize', setActiveSection);
        window.addEventListener('hashchange', setActiveSection);
        window.addEventListener('load', setActiveSection);
        setActiveSection();
    }
    
    // ESCAPE KEY
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (contactPopup && contactPopup.classList.contains('active')) closePopup();
            if (mainNav && mainNav.classList.contains('active')) closeMobileMenu();
        }
    });
    
    // FORM HANDLING
    const isEnglish = document.documentElement.lang === 'en';
    
    const errorMessages = {
        network: isEnglish ? 'Error sending message. Please try again or contact us by email.' : 'Kļūda nosūtot ziņojumu. Lūdzu, mēģiniet vēlreiz vai sazinieties ar mums pa e-pastu.',
        required: isEnglish ? 'Please fill in all required fields.' : 'Lūdzu, aizpildiet visus obligātos laukus.',
        invalidEmail: isEnglish ? 'Please enter a valid email address.' : 'Lūdzu, ievadiet derīgu e-pasta adresi.',
        invalidPhone: isEnglish ? 'Phone number can only contain numbers and + sign.' : 'Tālruņa numurs var saturēt tikai ciparus un + zīmi.',
        captcha: isEnglish ? 'Please confirm you are not a robot and try again.' : 'Lūdzu, apstipriniet, ka neesat robots, un mēģiniet vēlreiz.'
    };
    
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(contactForm);
            
            const phoneInput = document.getElementById('phone');
            if (phoneInput && phoneInput.value) {
                const phoneRegex = /^[0-9+]+$/;
                if (!phoneRegex.test(phoneInput.value)) {
                    formMessage.textContent = errorMessages.invalidPhone;
                    formMessage.className = 'form-message error';
                    return;
                }
            }
            
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = isEnglish ? 'Sending...' : 'Nosūta...';
            submitBtn.disabled = true;
            
            try {
                formData.append('recaptchaToken', await getRecaptchaToken());
            } catch (error) {
                formMessage.textContent = errorMessages.captcha;
                formMessage.className = 'form-message error';
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
                return;
            }
            
            try {
                const response = await fetch('contact.php', { method: 'POST', body: formData });
                const result = await response.json();
                formMessage.textContent = result.message;
                formMessage.className = 'form-message ' + (result.success ? 'success' : 'error');
                if (result.success) {
                    gtag('event', 'form_submission', {
                        event_category: 'contact',
                        event_label: window.location.pathname
                    });
                    gtag('event', 'generate_lead');
                    gtag('event', 'conversion_event_submit_lead_form');
                    trackAdsConversion('form');
                    const formFields = contactForm.querySelector('.form-fields');
                    if (formFields) formFields.style.display = 'none';
                }
            } catch (error) {
                formMessage.textContent = errorMessages.network;
                formMessage.className = 'form-message error';
            } finally {
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }
    
    // LOGO CLICK
    const logoLink = document.querySelector('.logo');
    if (logoLink) logoLink.addEventListener('click', (e) => {
        const href = logoLink.getAttribute('href');
        if (href === null || href === '' || href === '#') {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    
    // FAQ ACCORDION
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (question) {
            question.addEventListener('click', () => {
                const isOpen = item.classList.contains('active');
                faqItems.forEach(i => i.classList.remove('active'));
                if (!isOpen) item.classList.add('active');
            });
        }
    });
    
    // BACK TO TOP
    if (backToTop) {
        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});

// SCROLL REVEAL - adds .reveal to blocks and .is-visible when they enter
// the viewport (CSS handles the actual transition; no paused animations)
document.documentElement.classList.add('js');

const revealSelector = '.section, footer, .cta-section, .features-grid, .services-grid, .benefits-grid, .process-grid, .contacts-grid, .tech-grid, .stat-item, .feature-card, .service-card, .benefit-card, .process-card, .contact-card, .hours-card, .cta-box';
const revealObserver = new IntersectionObserver((entries) => {
    let delay = 0;
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (delay > 0) {
            el.style.transitionDelay = delay + 'ms';
            el.addEventListener('transitionend', () => { el.style.transitionDelay = ''; }, { once: true });
        }
        el.classList.add('is-visible');
        revealObserver.unobserve(el);
        delay = Math.min(delay + 70, 350);
    });
}, { rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll(revealSelector).forEach(el => {
    el.classList.add('reveal');
    revealObserver.observe(el);
});

// TECH TOOLTIPS
const techItems = document.querySelectorAll('.tech-item');
let activeTechTooltip = null;
techItems.forEach(item => {
    item.addEventListener('click', function() {
        if (window.innerWidth <= 1024) {
            if (activeTechTooltip && activeTechTooltip !== this) activeTechTooltip.classList.remove('tooltip-active');
            if (this === activeTechTooltip) { this.classList.remove('tooltip-active'); activeTechTooltip = null; }
            else { this.classList.add('tooltip-active'); activeTechTooltip = this; }
        }
    });
});
document.addEventListener('click', (e) => {
    if (!e.target.closest('.tech-item') && activeTechTooltip) {
        activeTechTooltip.classList.remove('tooltip-active');
        activeTechTooltip = null;
    }
});

// BACK TO TOP
function updateBackToTopVisibility() {
    const backToTopBtn = document.getElementById('backToTop');
    const cookieModal = document.getElementById('cookieModal');
    const cookieBanner = document.getElementById('cookieConsent');
    const contactPopup = document.getElementById('contactPopup');
    const mainNav = document.getElementById('mainNav');
    
    const isCookieModalVisible = cookieModal && cookieModal.classList.contains('show');
    const isCookieBannerVisible = cookieBanner && cookieBanner.classList.contains('show');
    const isContactPopupVisible = contactPopup && contactPopup.classList.contains('active');
    const isMobileMenuVisible = mainNav && mainNav.classList.contains('active');
    
    if (backToTopBtn) {
        if (window.scrollY > 300 && !isCookieModalVisible && !isCookieBannerVisible && !isContactPopupVisible && !isMobileMenuVisible) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    }
}

// CALL AND EMAIL CLICK TRACKING
document.querySelectorAll('a[href^="tel:"]').forEach(link => {
    link.addEventListener('click', () => {
        gtag('event', 'click_to_call');
        trackAdsConversion('call');
    });
});

document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
    link.addEventListener('click', () => {
        gtag('event', 'email_click');
        trackAdsConversion('email');
    });
});
