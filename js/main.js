let lastScroll = 0;
const header = document.querySelector('header');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        if (currentScroll > lastScroll) {
            header.classList.add('hidden');
            header.classList.remove('sticky');
        } else {
            header.classList.remove('hidden');
            header.classList.add('sticky');
        }
    } else {
        header.classList.remove('sticky', 'hidden');
    }
    
    lastScroll = currentScroll;
});

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

// Load Google Analytics
(function() {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-4RZF44QNDM';
    document.head.appendChild(script);
})();

gtag('js', new Date());
gtag('config', 'G-4RZF44QNDM', { 'send_page_view': false });

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
        gtag('consent', 'update', {
            'analytics_storage': consent.analytics ? 'granted' : 'denied',
            'ad_storage': consent.marketing ? 'granted' : 'denied',
            'ad_user_data': consent.marketing ? 'granted' : 'denied',
            'ad_personalization': consent.marketing ? 'granted' : 'denied',
            'page_view': consent.analytics ? 'granted' : 'denied'
        });
        
        // Send page view if analytics consent was just granted
        if (consent.analytics) {
            gtag('config', 'G-4RZF44QNDM', { 'send_page_view': true });
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

document.addEventListener('DOMContentLoaded', () => {
    new CookieConsent();
    
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
    
    function openMobileMenu() {
        mainNav.classList.add('active');
        mobileMenuToggle.classList.add('active');
        mobileMenuOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function closeMobileMenu() {
        mainNav.classList.remove('active');
        mobileMenuToggle.classList.remove('active');
        mobileMenuOverlay.classList.remove('active');
        document.body.style.overflow = '';
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
        invalidPhone: isEnglish ? 'Phone number can only contain numbers and + sign.' : 'Tālruņa numurs var saturēt tikai ciparus un + zīmi.'
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
                const response = await fetch('contact.php', { method: 'POST', body: formData });
                const result = await response.json();
                formMessage.textContent = result.message;
                formMessage.className = 'form-message ' + (result.success ? 'success' : 'error');
                if (result.success) {
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
    if (logoLink) logoLink.addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    
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
    const backToTop = document.getElementById('backToTop');
    window.addEventListener('scroll', () => {
        if (backToTop) {
            if (window.pageYOffset > 300) {
                backToTop.classList.add('active');
            } else {
                backToTop.classList.remove('active');
            }
        }
    });
    
    if (backToTop) {
        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});

// ANIMATIONS
const animatedElements = document.querySelectorAll('.section, footer, .cta-section, .services-grid, .benefits-grid, .process-grid, .contacts-grid, .stat-item, .service-card, .benefit-card, .process-card, .contact-card, .hours-card, .tech-grid, .cta-box');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.animationPlayState = 'running';
            entry.target.style.opacity = '1';
        }
    });
}, { threshold: 0.1 });
animatedElements.forEach(el => { el.style.animationPlayState = 'paused'; observer.observe(el); });

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

document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('scroll', updateBackToTopVisibility);
    const backToTopBtn = document.getElementById('backToTop');
    if (backToTopBtn) backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
});