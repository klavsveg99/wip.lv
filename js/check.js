/**
 * Free website check: renders the report from scan.php and fills the
 * fix packages with the issues found on the visitor's site.
 */
(function () {
    'use strict';

    var root = document.getElementById('siteCheck');
    if (!root) return;

    var lang = document.documentElement.lang.toLowerCase().indexOf('en') === 0 ? 'en' : 'lv';

    var UI = {
        lv: {
            loading: 'Pārbaudām lapu. Tas aizņem dažas sekundes.',
            errorInvalid: 'Ievadi mājaslapas adresi, piemēram, tavaadrese.lv.',
            errorGeneric: 'Pārbaudi neizdevās pabeigt. Pamēģini vēlreiz.',
            errorNetwork: 'Nevarējām sazināties ar pārbaudes serveri. Pamēģini vēlreiz.',
            errors: {
                invalid: 'Adrese nav derīga.',
                scheme: 'Atbalstītas ir tikai http un https adreses.',
                host: 'Adresē nav derīga domēna vārda.',
                port: 'Atbalstīti ir tikai standarta porti.',
                private: 'Šo adresi pārbaudīt nevar.',
                dns: 'Domēns neatbild. Pārbaudi adresi.',
                tls: 'Sertifikāts nav derīgs, tāpēc lapa nav droši sasniedzama.',
                unreachable: 'Lapa neatbildēja laikā.',
                http: 'Lapa atgriež kļūdas statusu.',
                blocked: 'Vietne bloķē automātiskas pārbaudes. Atver to pārlūkā un pārbaudi manuāli.'
            },
            scoreSecurity: 'Drošība',
            scoreVisibility: 'MI un satura redzamība',
            scoreOf: 'no 100',
            scoreNone: 'nav datu',
            issuesTitle: 'Ko var uzlabot',
            issuesIntro: 'Sakārtots pa grupām, kuras var novērst vienā pasūtījumā.',
            passedTitle: 'Jau kārtībā',
            techLabel: 'Pārbaudē redzams:',
            sev: { high: 'Augsta', medium: 'Vidēja', low: 'Zema', info: 'Info' },
            sevOrder: { high: 0, medium: 1, low: 2, info: 3 },
            found: function (n) {
                if (n === 0) return 'Šajā grupā trūkumu nav.';
                return 'Tavā pārbaudē: ' + n + ' ' + (n === 1 ? 'trūkums' : 'trūkumi');
            },
            foundBeforeScan: 'Pārbaudi lapu, lai šeit redzētu savus trūkumus.',
            noneSelected: 'Atzīmē grupas, kuras vēlies novērst.',
            total: 'Kopā: ',
            bundleHint: 'Visas trīs grupas kopā: ',
            save: 'ietaupi ',
            currency: ' EUR',
            bundleCta: 'Izvēlēties visas',
            platform: 'Platforma',
            checked: 'Pārbaudīts',
            contactIntro: 'Pārbaudītā lapa: ',
            contactGroups: 'Izvēlētās grupas: ',
            contactTotal: 'Kopā: '
        },
        en: {
            loading: 'Checking the page. This takes a few seconds.',
            errorInvalid: 'Enter a website address, for example yoursite.com.',
            errorGeneric: 'The check could not be completed. Please try again.',
            errorNetwork: 'We could not reach the check server. Please try again.',
            errors: {
                invalid: 'That address is not valid.',
                scheme: 'Only http and https addresses are supported.',
                host: 'The address has no valid domain name.',
                port: 'Only standard ports are supported.',
                private: 'This address cannot be checked.',
                dns: 'The domain does not respond. Check the address.',
                tls: 'The certificate is not valid, so the page cannot be reached securely.',
                unreachable: 'The page did not respond in time.',
                http: 'The page returns an error status.',
                blocked: 'The site blocks automated checks. Open it in a browser and check it manually.'
            },
            scoreSecurity: 'Security',
            scoreVisibility: 'AI and content visibility',
            scoreOf: 'out of 100',
            scoreNone: 'no data',
            issuesTitle: 'What can be improved',
            issuesIntro: 'Grouped by the fixes that come in one order.',
            passedTitle: 'Already fine',
            techLabel: 'Seen in the check:',
            sev: { high: 'High', medium: 'Medium', low: 'Low', info: 'Info' },
            sevOrder: { high: 0, medium: 1, low: 2, info: 3 },
            found: function (n) {
                if (n === 0) return 'No issues in this group.';
                return 'Found on your site: ' + n + (n === 1 ? ' issue' : ' issues');
            },
            foundBeforeScan: 'Run the check to see your issues here.',
            noneSelected: 'Select the groups you want fixed.',
            total: 'Total: ',
            bundleHint: 'All three groups together: ',
            save: 'save ',
            currency: ' EUR',
            bundleCta: 'Select all',
            platform: 'Platform',
            checked: 'Checked',
            contactIntro: 'Checked site: ',
            contactGroups: 'Selected groups: ',
            contactTotal: 'Total: '
        }
    }[lang];

    var PACKAGES = [
        { id: 'security', price: 99, name: lang === 'en' ? 'Security' : 'Drošība' },
        { id: 'trust', price: 79, name: lang === 'en' ? 'Email and trust' : 'E-pasts un uzticamība' },
        { id: 'visibility', price: 89, name: lang === 'en' ? 'AI and content visibility' : 'MI un satura redzamība' }
    ];

    var BUNDLE_PRICE = 229;

    var CHECK_COPY = {
        lv: {
            https: ['Šifrēts savienojums', 'Apmeklētāju dati ceļo šifrēti, un http adrese pāradresē uz https.'],
            hsts: ['HSTS galvene', 'Pārlūks atceras lietot tikai šifrētu savienojumu, pat ja kāds mēģina to apiet.'],
            csp: ['Content Security Policy', 'Politika ierobežo, kurus skriptus un stilus lapa drīkst ielādēt.'],
            frame: ['Aizsardzība pret clickjacking', 'Lapu nevar ievietot svešā rāmī, lai maldinātu apmeklētājus.'],
            nosniff: ['MIME tipa pārbaude', 'Pārlūks neizpilda failu kā kodu tikai tāpēc, ka tas izskatās pēc skripta.'],
            referrer: ['Referrer-Policy', 'Citas lapas nesaņem pilnu adresi ar meklēšanas vai pasūtījuma datiem.'],
            permissions: ['Permissions-Policy', 'Svešs skripts nevar pieprasīt kameru vai atrašanās vietu tavas lapas vārdā.'],
            server: ['Programmatūras versiju slēpšana', 'Uzbrucējs neredz precīzu servera vai CMS versiju, ko izmantot uzbrukumā.'],
            sri: ['Ārējo failu integritāte', 'Ja ārējais piegādātājs tiek uzlauzts, pārlūks neizpilda mainīto kodu.'],
            cookies: ['Sīkdatņu drošība', 'Sīkdatnes ir ar Secure, HttpOnly un SameSite karodziņiem.'],
            securitytxt: ['security.txt', 'Drošības pētnieks zina, kurp ziņot par atrastu ievainojamību.'],
            exposed: ['Publiski pieejami konfigurācijas faili', 'Faili ar parolēm un atslēgām nav publiski lejupielādējami.'],
            libs: ['Novecojušas JavaScript bibliotēkas', 'Vecajās versijās ir zināmas ievainojamības, ko automātiski meklē skeneri.'],
            spf: ['SPF ieraksts', 'Pastam ir saraksts, kas drīkst sūtīt e-pastus tava domēna vārdā.'],
            dmarc: ['DMARC politika', 'Viltotas vēstules tava domēna vārdā tiek atzīmētas vai noraidītas.'],
            dkim: ['DKIM paraksts', 'Saņēmējs var pārbaudīt, ka vēstule nav pārveidota ceļā.'],
            mx: ['Pasta serveri', 'Domēns var saņemt e-pastus.'],
            caa: ['CAA ieraksts', 'Tikai norādītās iestādes drīkst izsniegt sertifikātu tavam domēnam.'],
            mtasts: ['MTA-STS', 'Pasta serveri vienojas par šifrētu piegādi.'],
            emails: ['Atklātas e-pasta adreses', 'Adreses lapā nav viegls mērķis surogātpasta robotiem.'],
            robots: ['robots.txt MI robotiem', 'ChatGPT, Perplexity un citi MI rīki drīkst ielādēt tavu lapu.'],
            llms: ['llms.txt', 'MI asistenti saņem īsu un sakārtotu lapas satura kopsavilkumu.'],
            sitemap: ['Vietnes karte', 'Meklētāji un MI rīki atrod visas lapas vienā failā.'],
            title: ['Lapas nosaukums', 'Nosaukums ir skaidrs un meklēšanā nav nogriezts.'],
            meta: ['Lapas apraksts', 'Meklētājs parāda kopsavilkumu, kas aicina atvērt lapu.'],
            og: ['Kopīgošanas priekšskatījums', 'Saites WhatsApp vai LinkedIn rāda virsrakstu, aprakstu un attēlu.'],
            lang: ['Lapas valoda', 'Pārlūks un MI rīki zina, kādā valodā lapa ir.'],
            h1: ['Galvenais virsraksts', 'Viens skaidrs H1 palīdz saprast, par ko ir lapa.'],
            schema: ['Strukturētie dati', 'schema.org dati apraksta uzņēmumu, adresi un pakalpojumus mašīnlasāmā formā.'],
            nojs: ['Saturs bez JavaScript', 'MI rīki un meklētāji nolasa galveno tekstu arī bez skriptu izpildes.']
        },
        en: {
            https: ['Encrypted connection', 'Visitor data travels encrypted, and the http address redirects to https.'],
            hsts: ['HSTS header', 'The browser remembers to use an encrypted connection even if someone tries to bypass it.'],
            csp: ['Content Security Policy', 'The policy limits which scripts and styles the page may load.'],
            frame: ['Clickjacking protection', 'The page cannot be placed in a foreign frame to mislead visitors.'],
            nosniff: ['MIME type check', 'The browser does not run a file as code just because it looks like a script.'],
            referrer: ['Referrer-Policy', 'Other sites do not receive full addresses with search or order data.'],
            permissions: ['Permissions-Policy', 'A foreign script cannot request the camera or location on behalf of your page.'],
            server: ['Hiding software versions', 'An attacker cannot see the exact server or CMS version to target.'],
            sri: ['External asset integrity', 'If an external provider is compromised, the browser refuses the altered code.'],
            cookies: ['Cookie safety', 'Cookies carry the Secure, HttpOnly and SameSite flags.'],
            securitytxt: ['security.txt', 'A security researcher knows where to report a found vulnerability.'],
            exposed: ['Public configuration files', 'Files with passwords and keys cannot be downloaded by anyone.'],
            libs: ['Outdated JavaScript libraries', 'Older versions contain known vulnerabilities that scanners look for automatically.'],
            spf: ['SPF record', 'Mail servers know which senders may use your domain.'],
            dmarc: ['DMARC policy', 'Forged messages in your domain are marked or rejected.'],
            dkim: ['DKIM signature', 'The recipient can verify that the message was not altered in transit.'],
            mx: ['Mail servers', 'The domain can receive email.'],
            caa: ['CAA record', 'Only named authorities may issue a certificate for your domain.'],
            mtasts: ['MTA-STS', 'Mail servers agree on encrypted delivery.'],
            emails: ['Exposed email addresses', 'Addresses on the page are not an easy target for spam bots.'],
            robots: ['robots.txt for AI crawlers', 'ChatGPT, Perplexity and other AI tools may load your page.'],
            llms: ['llms.txt', 'AI assistants get a short, ordered summary of the page content.'],
            sitemap: ['Sitemap', 'Search engines and AI tools find every page in one file.'],
            title: ['Page title', 'The title is clear and not cut off in search results.'],
            meta: ['Page description', 'Search results show a summary that invites the visit.'],
            og: ['Share preview', 'Links in WhatsApp or LinkedIn show a title, description and image.'],
            lang: ['Page language', 'Browsers and AI tools know which language the page uses.'],
            h1: ['Main heading', 'One clear H1 helps both people and machines understand the page.'],
            schema: ['Structured data', 'schema.org data describes the company, address and services in a machine-readable form.'],
            nojs: ['Content without JavaScript', 'AI tools and search engines read the main text without running scripts.']
        }
    };

    var CHECK_META = {
        https: ['security', 'high'],
        hsts: ['security', 'high'],
        csp: ['security', 'medium'],
        frame: ['security', 'medium'],
        nosniff: ['security', 'low'],
        referrer: ['security', 'low'],
        permissions: ['security', 'low'],
        server: ['security', 'low'],
        sri: ['security', 'low'],
        cookies: ['security', 'low'],
        securitytxt: ['security', 'low'],
        exposed: ['security', 'high'],
        libs: ['security', 'medium'],
        spf: ['trust', 'high'],
        dmarc: ['trust', 'high'],
        dkim: ['trust', 'medium'],
        mx: ['trust', 'info'],
        caa: ['trust', 'low'],
        mtasts: ['trust', 'low'],
        emails: ['trust', 'low'],
        robots: ['visibility', 'medium'],
        llms: ['visibility', 'low'],
        sitemap: ['visibility', 'medium'],
        title: ['visibility', 'medium'],
        meta: ['visibility', 'medium'],
        og: ['visibility', 'low'],
        lang: ['visibility', 'medium'],
        h1: ['visibility', 'low'],
        schema: ['visibility', 'medium'],
        nojs: ['visibility', 'high']
    };

    var WEIGHTS = { high: 3, medium: 2, low: 1, info: 0 };

    var form = document.getElementById('checkForm');
    var input = document.getElementById('checkUrl');
    var submitBtn = document.getElementById('checkSubmit');
    var status = document.getElementById('checkStatus');
    var report = document.getElementById('checkReport');
    var scoresBox = document.getElementById('checkScores');
    var issuesBox = document.getElementById('checkIssues');
    var metaBox = document.getElementById('checkMeta');
    var totalBox = document.getElementById('checkTotal');
    var totalText = document.getElementById('checkTotalText');
    var bundleBtn = document.getElementById('checkBundleBtn');
    var bundleText = document.getElementById('checkBundleText');
    var descriptionField = document.getElementById('company_description');

    var lastUrl = '';
    var totalIssues = 0;

    function money(value) {
        return value + UI.currency;
    }

    function packageOf(id) {
        var meta = CHECK_META[id];
        return meta ? meta[0] : null;
    }

    function checkName(id) {
        var copy = CHECK_COPY[lang][id];
        return copy ? copy[0] : id;
    }

    function packageName(id) {
        var found = PACKAGES.filter(function (pkg) { return pkg.id === id; })[0];
        return found ? found.name : id;
    }

    function setStatus(text, tone) {
        if (!status) return;
        status.textContent = text || '';
        status.hidden = !text;
        status.className = 'check-status' + (tone ? ' is-' + tone : '');
    }

    function scoreFor(data, packageIds) {
        var points = 0;
        var max = 0;
        Object.keys(CHECK_META).forEach(function (id) {
            if (packageIds.indexOf(CHECK_META[id][0]) === -1) return;
            var state = data.checks[id];
            var weight = WEIGHTS[CHECK_META[id][1]] || 0;
            if (!state || !weight) return;
            max += weight;
            if (state.status === 'pass') points += weight;
            else if (state.status === 'warn') points += weight * 0.5;
        });
        return max ? Math.round((points / max) * 100) : null;
    }

    function makeScore(label, value) {
        var box = document.createElement('div');
        box.className = 'check-score';
        var title = document.createElement('span');
        title.className = 'check-score-label';
        title.textContent = label;
        var number = document.createElement('span');
        number.className = 'check-score-num';
        number.textContent = value === null ? '-' : String(value);
        var of = document.createElement('span');
        of.className = 'check-score-of';
        of.textContent = UI.scoreOf;
        var bar = document.createElement('div');
        bar.className = 'check-score-bar';
        var fill = document.createElement('i');
        fill.style.width = (value === null ? 0 : value) + '%';
        bar.appendChild(fill);
        box.appendChild(title);
        box.appendChild(number);
        box.appendChild(of);
        box.appendChild(bar);
        return box;
    }

    function sevChip(sev) {
        var chip = document.createElement('span');
        chip.className = 'check-sev';
        chip.setAttribute('data-sev', sev);
        chip.textContent = UI.sev[sev] || sev;
        return chip;
    }

    function issueRow(id, state) {
        var meta = CHECK_META[id];
        var copy = CHECK_COPY[lang][id] || [id, ''];
        var row = document.createElement('li');
        row.className = 'check-issue';

        var head = document.createElement('div');
        head.className = 'check-issue-head';
        head.appendChild(sevChip(meta[1]));
        var title = document.createElement('h4');
        title.textContent = copy[0];
        head.appendChild(title);
        row.appendChild(head);

        var why = document.createElement('p');
        why.textContent = copy[1];
        row.appendChild(why);

        if (state.detail) {
            var tech = document.createElement('p');
            tech.className = 'check-issue-tech';
            tech.textContent = UI.techLabel + ' ' + state.detail;
            row.appendChild(tech);
        }
        return row;
    }

    function renderReport(data) {
        if (!report) return;
        report.hidden = false;

        var security = scoreFor(data, ['security', 'trust']);
        var visibility = scoreFor(data, ['visibility']);
        if (scoresBox) {
            scoresBox.textContent = '';
            scoresBox.appendChild(makeScore(UI.scoreSecurity, security));
            scoresBox.appendChild(makeScore(UI.scoreVisibility, visibility));
        }

        if (metaBox) {
            var bits = [data.host];
            if (data.platform && data.platform !== 'unknown') {
                bits.push(UI.platform + ': ' + data.platform.charAt(0).toUpperCase() + data.platform.slice(1));
            }
            if (data.checked_at) bits.push(UI.checked + ': ' + data.checked_at);
            metaBox.textContent = bits.join(' · ');
        }

        var foundByPackage = { security: [], trust: [], visibility: [] };
        var passed = [];
        Object.keys(CHECK_META).forEach(function (id) {
            var state = data.checks[id];
            if (!state) return;
            if (state.status === 'fail' || state.status === 'warn') {
                foundByPackage[CHECK_META[id][0]].push({ id: id, state: state });
            } else if (state.status === 'pass') {
                passed.push(id);
            }
        });
        Object.keys(foundByPackage).forEach(function (pkg) {
            foundByPackage[pkg].sort(function (a, b) {
                return (UI.sevOrder[CHECK_META[a.id][1]] || 0) - (UI.sevOrder[CHECK_META[b.id][1]] || 0);
            });
        });

        totalIssues = foundByPackage.security.length + foundByPackage.trust.length + foundByPackage.visibility.length;

        if (issuesBox) {
            issuesBox.textContent = '';

            var head = document.createElement('div');
            head.className = 'check-issues-head';
            var h3 = document.createElement('h3');
            h3.textContent = UI.issuesTitle;
            var intro = document.createElement('p');
            intro.textContent = UI.issuesIntro;
            head.appendChild(h3);
            head.appendChild(intro);
            issuesBox.appendChild(head);

            PACKAGES.forEach(function (pkg) {
                var items = foundByPackage[pkg.id];
                if (!items.length) return;

                var group = document.createElement('section');
                group.className = 'check-group';
                var groupHead = document.createElement('div');
                groupHead.className = 'check-group-head';
                var groupTitle = document.createElement('h4');
                groupTitle.textContent = pkg.name;
                var count = document.createElement('span');
                count.textContent = UI.found(items.length);
                groupHead.appendChild(groupTitle);
                groupHead.appendChild(count);
                group.appendChild(groupHead);

                var list = document.createElement('ul');
                list.className = 'check-issue-list';
                items.forEach(function (item) {
                    list.appendChild(issueRow(item.id, item.state));
                });
                group.appendChild(list);
                issuesBox.appendChild(group);
            });

            if (passed.length) {
                var details = document.createElement('details');
                details.className = 'check-passed';
                var summary = document.createElement('summary');
                summary.textContent = UI.passedTitle + ' (' + passed.length + ')';
                details.appendChild(summary);
                var passedList = document.createElement('ul');
                passed.forEach(function (id) {
                    var item = document.createElement('li');
                    item.textContent = checkName(id);
                    passedList.appendChild(item);
                });
                details.appendChild(passedList);
                issuesBox.appendChild(details);
            }
        }

        updatePackages(foundByPackage);
        updateTotal();

        if (window.gtag) {
            window.gtag('event', 'site_check', { event_category: 'check' });
        }
    }

    function updatePackages(foundByPackage) {
        document.querySelectorAll('[data-package]').forEach(function (card) {
            var id = card.getAttribute('data-package');
            var items = foundByPackage[id] || [];
            var label = card.querySelector('[data-pkg-found]');
            var list = card.querySelector('[data-pkg-issues]');
            if (label) {
                label.textContent = UI.found(items.length);
                label.classList.toggle('has-issues', items.length > 0);
            }
            if (list) {
                list.textContent = '';
                if (!items.length) {
                    list.hidden = true;
                } else {
                    list.hidden = false;
                    items.forEach(function (item) {
                        var li = document.createElement('li');
                        li.textContent = checkName(item.id);
                        list.appendChild(li);
                    });
                }
            }
        });
    }

    function selectedPackages() {
        return Array.prototype.slice.call(document.querySelectorAll('[data-pkg-input]:checked'))
            .map(function (inputEl) { return inputEl.value; });
    }

    function updateTotal() {
        if (!totalText) return;
        var selected = selectedPackages();
        var sum = selected.reduce(function (acc, id) {
            var pkg = PACKAGES.filter(function (p) { return p.id === id; })[0];
            return acc + (pkg ? pkg.price : 0);
        }, 0);
        var separate = PACKAGES.reduce(function (acc, pkg) { return acc + pkg.price; }, 0);

        if (!selected.length) {
            totalText.textContent = UI.noneSelected;
            totalText.classList.remove('is-active');
        } else if (selected.length === PACKAGES.length) {
            totalText.textContent = UI.total + money(BUNDLE_PRICE) + ' · ' + UI.save + money(separate - BUNDLE_PRICE);
            totalText.classList.add('is-active');
        } else {
            totalText.textContent = UI.total + money(sum) + ' · ' + UI.bundleHint + money(BUNDLE_PRICE);
            totalText.classList.add('is-active');
        }

        if (bundleText) {
            bundleText.textContent = money(BUNDLE_PRICE) + ' ' +
                (lang === 'en' ? 'instead of ' : 'nevis ') + money(separate);
        }

        if (descriptionField && lastUrl) {
            var marker = UI.contactIntro;
            var current = descriptionField.value.trim();
            if (current === '' || current.indexOf(marker) === 0) {
                var lines = [marker + lastUrl];
                if (selected.length) {
                    lines.push(UI.contactGroups + selected.map(packageName).join(', '));
                    lines.push(UI.contactTotal + money(selected.length === PACKAGES.length ? BUNDLE_PRICE : sum));
                }
                descriptionField.value = lines.join('\n');
            }
        }
    }

    function submitUrl(url) {
        var value = (url || '').trim();
        if (!value) {
            setStatus(UI.errorInvalid, 'error');
            if (report) report.hidden = true;
            return;
        }
        lastUrl = value.replace(/^https?:\/\//i, '').replace(/\/+$/, '');

        setStatus(UI.loading, 'loading');
        if (report) report.hidden = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.setAttribute('aria-busy', 'true');
        }

        fetch('scan.php?url=' + encodeURIComponent(value), { headers: { Accept: 'application/json' } })
            .then(function (response) {
                return response.json().catch(function () { return null; });
            })
            .then(function (data) {
                if (!data) {
                    setStatus(UI.errorGeneric, 'error');
                    return;
                }
                if (!data.ok) {
                    setStatus(UI.errors[data.error] || UI.errorGeneric, 'error');
                    return;
                }
                setStatus('', '');
                renderReport(data);
            })
            .catch(function () {
                setStatus(UI.errorNetwork, 'error');
            })
            .then(function () {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.removeAttribute('aria-busy');
                }
            });
    }

    if (form && input) {
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            submitUrl(input.value);
        });
    }

    document.querySelectorAll('[data-pkg-input]').forEach(function (checkbox) {
        checkbox.addEventListener('change', updateTotal);
    });

    if (bundleBtn) {
        bundleBtn.addEventListener('click', function () {
            document.querySelectorAll('[data-pkg-input]').forEach(function (checkbox) {
                checkbox.checked = true;
            });
            updateTotal();
        });
    }

    var initialUrl = new URLSearchParams(window.location.search).get('url');
    if (initialUrl && input) {
        input.value = initialUrl;
        submitUrl(initialUrl);
    } else {
        updateTotal();
    }
})();
