/**
 * Free website audit: renders the report from scan.php and fills the
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
            errorInvalid: 'Ievadi vietnes adresi, piemēram, adrese.lv.',
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
            scoreEmail: 'E-pasts',
            scoreVisibility: 'MI un satura redzamība',
            scoreOf: 'no 100',
            scoreNone: 'nav datu',
            issuesTitle: 'Ko var uzlabot',
            issuesIntro: 'Sakārtots pa grupām, kuras var novērst vienā pasūtījumā.',
            infoTitle: 'Papildu informācija',
            infoNote: 'Šie novērojumi neietilpst nevienā maksas grupā.',
            passedTitle: 'Jau kārtībā',
            techLabel: 'Konstatēts:',
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
            loading: 'Auditing the site. This takes a few seconds.',
            errorInvalid: 'Type the site address, for example yoursite.com.',
            errorGeneric: 'The audit could not be completed. Please try again.',
            errorNetwork: 'We could not reach the audit server. Please try again.',
            errors: {
                invalid: 'That address is not valid.',
                scheme: 'Only http and https addresses are supported.',
                host: 'The address has no valid domain name.',
                port: 'Only standard ports are supported.',
                private: 'This address cannot be audited.',
                dns: 'The domain does not respond. Verify the address.',
                tls: 'The certificate is not valid, so the page cannot be reached securely.',
                unreachable: 'The page did not respond in time.',
                http: 'The page returns an error status.',
                blocked: 'The site blocks automated audits. Open it in a browser and review it manually.'
            },
            scoreSecurity: 'Security',
            scoreEmail: 'Email',
            scoreVisibility: 'AI and content visibility',
            scoreOf: 'out of 100',
            scoreNone: 'no data',
            issuesTitle: 'What can be improved',
            issuesIntro: 'Grouped by the fixes that come in one order.',
            infoTitle: 'Additional information',
            infoNote: 'These observations are not part of any paid group.',
            passedTitle: 'Already fine',
            techLabel: 'Found:',
            sev: { high: 'High', medium: 'Medium', low: 'Low', info: 'Info' },
            sevOrder: { high: 0, medium: 1, low: 2, info: 3 },
            found: function (n) {
                if (n === 0) return 'No issues in this group.';
                return 'Found on your site: ' + n + (n === 1 ? ' issue' : ' issues');
            },
            foundBeforeScan: 'Run the audit to see your issues here.',
            noneSelected: 'Select the groups you want fixed.',
            total: 'Total: ',
            bundleHint: 'All three groups together: ',
            save: 'save ',
            currency: ' EUR',
            bundleCta: 'Select all',
            platform: 'Platform',
            checked: 'Audited',
            contactIntro: 'Audited site: ',
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
            https: ['Šifrēts savienojums', 'Daļa apmeklētāju var nonākt nešifrētā savienojumā, kur viņu datus var nolasīt vai mainīt.'],
            hsts: ['HSTS galvene', 'Pārlūks bez HSTS var pieļaut pāreju uz nešifrētu versiju, piemēram, publiskā Wi-Fi tīklā.'],
            csp: ['Content Security Policy', 'Bez pilnas politikas lapa var izpildīt skriptu, kas tajā nonāk no citas vietas vai ievadlauka.'],
            frame: ['Aizsardzība pret clickjacking', 'Lapu var ievietot svešā rāmī un ar neredzamām pogām likt apmeklētājam spiest to, ko viņš neredz.'],
            nosniff: ['MIME tipa pārbaude', 'Pārlūks var pats minēt faila veidu un izpildīt augšupielādētu failu kā kodu.'],
            referrer: ['Referrer-Policy', 'Adrese ar meklēšanas vai pasūtījuma datiem var nonākt citās lapās.'],
            permissions: ['Permissions-Policy', 'Svešs skripts var lūgt kameru vai atrašanās vietu apmeklētāja vārdā.'],
            server: ['Programmatūras versiju slēpšana', 'Redzama servera vai CMS versija palīdz uzbrucējam izvēlēties zināmu ievainojamību.'],
            sri: ['Ārējo failu integritāte', 'Ja ārējais piegādātājs tiek uzlauzts, pārlūks izpildīs mainīto kodu tavā lapā.'],
            cookies: ['Sīkdatņu drošība', 'Bez Secure, HttpOnly un SameSite sīkdatnes var nolasīt skripts vai pārtvert savienojumā.'],
            securitytxt: ['security.txt', 'Drošības pētniekam nav norādīts, kurp ziņot, tāpēc ziņojums par ievainojamību var pazust.'],
            exposed: ['Publiski pieejami konfigurācijas faili', 'Faili ar parolēm un atslēgām ir publiski lejupielādējami.'],
            libs: ['JavaScript bibliotēku versijas', 'Vecajās versijās ir zināmas ievainojamības, ko automātiski meklē skeneri.'],
            spf: ['SPF ieraksts', 'SPF, kas trūkst vai ir nepilnīgs, ļauj citiem serveriem sūtīt e-pastus tava domēna vārdā.'],
            dmarc: ['DMARC politika', 'DMARC, kas trūkst vai tikai novēro, neaptur viltotas vēstules tava domēna vārdā.'],
            dkim: ['DKIM paraksts', 'DKIM nav apstiprināts, tāpēc saņēmējs nevar pārbaudīt, vai vēstule nav pārveidota ceļā.'],
            mx: ['Pasta serveri', 'Domēns nesaņem e-pastus, ja MX ierakstu nav.'],
            caa: ['CAA ieraksts', 'Jebkura sertifikātu iestāde var izsniegt sertifikātu tavam domēnam bez tavas atļaujas.'],
            mtasts: ['MTA-STS', 'Pasta ceļš nav aizsargāts pret pazemināšanu uz nešifrētu savienojumu.'],
            emails: ['Atklātas e-pasta adreses', 'Adreses lapā ir viegls mērķis surogātpasta robotiem.'],
            robots: ['robots.txt MI robotiem', 'MI robotiem var būt liegts ielādēt lapu, tāpēc tā neparādās MI atbildēs.', { warn: 'Nav robots.txt, tāpēc robotu atļaujas nav pārskatāmas.' }],
            llms: ['llms.txt', 'Nav llms.txt, kas MI rīkiem dod īsu lapas kopsavilkumu. Tas nav Google ranga faktors.'],
            sitemap: ['Vietnes karte', 'Meklētāji un MI rīki neatrod visas lapas vienā failā.'],
            title: ['Lapas nosaukums', 'Nosaukums ir par īsu, par garu vai tā nav, tāpēc meklēšanā tas izskatās nepabeigts.'],
            meta: ['Lapas apraksts', 'Apraksta nav vai tas ir nepiemērotā garumā, tāpēc meklētājs to nogriež vai nerāda.'],
            og: ['Kopīgošanas priekšskatījums', 'Kopīgotā saite var parādīties bez attēla vai ar nepareizu kopsavilkumu.'],
            lang: ['Lapas valoda', 'Pārlūks un MI rīki nevar noteikt lapas valodu.'],
            h1: ['Galvenais virsraksts', 'Nav viena skaidra galvenā virsraksta vai to ir vairāki, tāpēc grūti saprast lapas tematu.'],
            schema: ['Strukturētie dati', 'Uzņēmuma dati nav mašīnlasāmi, tāpēc MI un meklētāji tos var nepamanīt.'],
            nojs: ['Saturs bez JavaScript', 'Bez JavaScript paliek maz teksta, tāpēc MI rīki un meklētāji saturu neredz.'],
        },
        en: {
            https: ['Encrypted connection', 'Part of the audience can land on an unencrypted connection where their data can be read or changed.'],
            hsts: ['HSTS header', 'Without HSTS the browser can be moved to an unencrypted version, for example on public Wi-Fi.'],
            csp: ['Content Security Policy', 'Without a full policy the page can run a script that arrives from elsewhere or through an input field.'],
            frame: ['Clickjacking protection', 'The page can be placed in a foreign frame and invisible buttons can trick the visitor into clicking what they cannot see.'],
            nosniff: ['MIME type protection', 'The browser can guess a file type and run an uploaded file as code.'],
            referrer: ['Referrer-Policy', 'An address with search or order data can leak to other sites.'],
            permissions: ['Permissions-Policy', 'A foreign script can request the camera or location in the visitor name.'],
            server: ['Hiding software versions', 'A visible server or CMS version helps an attacker pick a known vulnerability.'],
            sri: ['External asset integrity', 'If an external provider is compromised, the browser runs the altered code on your page.'],
            cookies: ['Cookie safety', 'Without Secure, HttpOnly and SameSite, a script or a network attacker can read the cookies.'],
            securitytxt: ['security.txt', 'A researcher has no address to report to, so a vulnerability report can get lost.'],
            exposed: ['Public configuration files', 'Files with passwords and keys can be downloaded by anyone.'],
            libs: ['JavaScript library versions', 'Older versions contain known vulnerabilities that scanners look for automatically.'],
            spf: ['SPF record', 'An SPF record that is missing or incomplete lets other servers send email in your domain name.'],
            dmarc: ['DMARC policy', 'DMARC that is missing or only monitoring does not stop forged messages in your domain.'],
            dkim: ['DKIM signature', 'DKIM is not confirmed, so the recipient cannot verify that the message was not altered on the way.'],
            mx: ['Mail servers', 'The domain receives no email when no MX records exist.'],
            caa: ['CAA record', 'Any certificate authority can issue a certificate for your domain without your approval.'],
            mtasts: ['MTA-STS', 'The mail path is not protected against downgrading to an unencrypted connection.'],
            emails: ['Exposed email addresses', 'Addresses on the page are an easy target for spam bots.'],
            robots: ['robots.txt for AI crawlers', 'AI crawlers may be blocked from loading the page, so it does not appear in AI answers.', { warn: 'There is no robots.txt, so crawler permissions cannot be reviewed.' }],
            llms: ['llms.txt', 'No llms.txt to give AI tools a short page summary. It is not a Google ranking factor.'],
            sitemap: ['Sitemap', 'Search engines and AI tools cannot find every page in one file.'],
            title: ['Page title', 'The title is too short, too long or missing, so it looks unfinished in search results.'],
            meta: ['Page description', 'The description is missing or the wrong length, so search results show nothing or cut it off.'],
            og: ['Share preview', 'Shared links can appear without an image or with the wrong summary.'],
            lang: ['Page language', 'Browsers and AI tools cannot tell which language the page uses.'],
            h1: ['Main heading', 'There is no single clear main heading, or there are several, so the topic is unclear.'],
            schema: ['Structured data', 'Company data is not machine-readable, so AI tools and search engines may miss it.'],
            nojs: ['Content without JavaScript', 'Without JavaScript little text remains, so AI tools and search engines cannot see the content.'],
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
        emails: ['info', 'info'],
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
        var whyText = (copy[2] && copy[2][state.status]) || copy[1];
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
        why.textContent = whyText;
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

        var security = scoreFor(data, ['security']);
        var email = scoreFor(data, ['trust']);
        var visibility = scoreFor(data, ['visibility']);
        if (scoresBox) {
            scoresBox.textContent = '';
            scoresBox.appendChild(makeScore(UI.scoreSecurity, security));
            scoresBox.appendChild(makeScore(UI.scoreEmail, email));
            scoresBox.appendChild(makeScore(UI.scoreVisibility, visibility));
        }

        if (metaBox) {
            var bits = [data.host];
            if (data.platform && data.platform !== 'unknown') {
                var platformNames = { wordpress: 'WordPress', shopify: 'Shopify', wix: 'Wix', webflow: 'Webflow', joomla: 'Joomla', drupal: 'Drupal', bitrix: 'Bitrix' };
                var platform = platformNames[data.platform] || (data.platform.charAt(0).toUpperCase() + data.platform.slice(1));
                bits.push(UI.platform + ': ' + platform);
            }
            if (data.checked_at) bits.push(UI.checked + ': ' + data.checked_at);
            metaBox.textContent = bits.join(' · ');
        }

        var foundByPackage = { security: [], trust: [], visibility: [], info: [] };
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

            var infoItems = foundByPackage.info || [];
            if (infoItems.length) {
                var infoGroup = document.createElement('section');
                infoGroup.className = 'check-group check-group-info';
                var infoHead = document.createElement('div');
                infoHead.className = 'check-group-head';
                var infoTitle = document.createElement('h4');
                infoTitle.textContent = UI.infoTitle;
                var infoNote = document.createElement('span');
                infoNote.textContent = UI.infoNote;
                infoHead.appendChild(infoTitle);
                infoHead.appendChild(infoNote);
                infoGroup.appendChild(infoHead);
                var infoList = document.createElement('ul');
                infoList.className = 'check-issue-list';
                infoItems.forEach(function (item) {
                    infoList.appendChild(issueRow(item.id, item.state));
                });
                infoGroup.appendChild(infoList);
                issuesBox.appendChild(infoGroup);
            }

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

        fetch('/scan.php?url=' + encodeURIComponent(value) + '&lang=' + encodeURIComponent(lang), { headers: { Accept: 'application/json' } })
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
