<?php
/**
 * Passive website check used by parbaude.html / parbaude-en.html.
 * Only standard HTTP requests are made: nothing on the target site is changed.
 * Returns raw per-check statuses; all wording and pricing live in js/check.js.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

const PAGE_MAX_BYTES = 900000;
const USER_AGENT = 'Mozilla/5.0 (compatible; WIP.LV-check/1.0; +https://wip.lv/)';

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $code): never
{
    respond(['ok' => false, 'error' => $code], 400);
}

function is_public_ip(string $ip): bool
{
    if (filter_var($ip, FILTER_VALIDATE_IP) === false) {
        return false;
    }
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
        return false;
    }
    // Carrier-grade NAT, not covered by the PHP flags.
    if (preg_match('~^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.~', $ip)) {
        return false;
    }
    return true;
}

function parse_header_lines(array $lines): array
{
    $out = [];
    foreach ($lines as $line) {
        if (str_contains($line, ':')) {
            [$name, $value] = explode(':', $line, 2);
            $out[strtolower(trim($name))][] = trim($value);
        }
    }
    return $out;
}

function header_value(array $headers, string $name): string
{
    return isset($headers[$name][0]) ? (string)$headers[$name][0] : '';
}

/** Fetch the page itself, keeping response headers and TLS details. */
function fetch_page(string $url): array
{
    $rawHeaders = [];
    $headers = [];
    $body = '';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 4,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_ENCODING => '',
        CURLOPT_USERAGENT => USER_AGENT,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_HEADERFUNCTION => function ($ch, string $line) use (&$rawHeaders, &$headers): int {
            $trimmed = trim($line);
            if (preg_match('~^HTTP/~i', $trimmed)) {
                $rawHeaders = [];
                return strlen($line);
            }
            if ($trimmed !== '') {
                $rawHeaders[] = $trimmed;
            }
            return strlen($line);
        },
        CURLOPT_WRITEFUNCTION => function ($ch, string $chunk) use (&$body): int {
            $body .= $chunk;
            if (strlen($body) > PAGE_MAX_BYTES) {
                return 0;
            }
            return strlen($chunk);
        },
    ]);
    $ok = curl_exec($ch);
    $info = curl_getinfo($ch);
    $errno = curl_errno($ch);
    curl_close($ch);

    return [
        'ok' => $ok !== false || $errno === 23,
        'errno' => $errno,
        'code' => (int)($info['http_code'] ?? 0),
        'final_url' => (string)($info['url'] ?? $url),
        'content_type' => (string)($info['content_type'] ?? ''),
        'tls_verified' => (bool)($info['ssl_verify_result'] === 0),
        'headers' => parse_header_lines($rawHeaders),
        'body' => $body,
    ];
}

/** Fetch small auxiliary files in parallel. */
function fetch_many(array $urls, bool $head = false, int $timeout = 5): array
{
    $multi = curl_multi_init();
    $handles = [];
    foreach ($urls as $key => $url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 2,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_ENCODING => '',
            CURLOPT_USERAGENT => USER_AGENT,
            CURLOPT_NOBODY => $head,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        ]);
        curl_multi_add_handle($multi, $ch);
        $handles[$key] = $ch;
    }

    $running = null;
    do {
        curl_multi_exec($multi, $running);
        if ($running) {
            curl_multi_select($multi, 0.2);
        }
    } while ($running);

    $out = [];
    foreach ($handles as $key => $ch) {
        $out[$key] = [
            'code' => (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE),
            'redirects' => (int)curl_getinfo($ch, CURLINFO_REDIRECT_COUNT),
            'final_url' => (string)curl_getinfo($ch, CURLINFO_EFFECTIVE_URL),
            'body' => (string)curl_multi_getcontent($ch),
        ];
        curl_multi_remove_handle($multi, $ch);
        curl_close($ch);
    }
    curl_multi_close($multi);

    return $out;
}

function dns_txt(string $name): array
{
    $records = @dns_get_record($name, DNS_TXT);
    if (!is_array($records)) {
        return [];
    }
    $values = [];
    foreach ($records as $record) {
        if (isset($record['txt'])) {
            $values[] = $record['txt'];
        } elseif (isset($record['entries']) && is_array($record['entries'])) {
            $values[] = implode('', $record['entries']);
        }
    }
    return $values;
}

function dns_dkim_txt(string $name): array
{
    $values = dns_txt($name);
    if ($values) {
        return $values;
    }
    // Hostinger delegates DKIM with CNAME records, and not every resolver
    // follows the CNAME for a TXT query.
    $cnames = @dns_get_record($name, DNS_CNAME);
    if (is_array($cnames)) {
        foreach ($cnames as $record) {
            $target = rtrim((string)($record['target'] ?? ''), '.');
            if ($target !== '') {
                $values = dns_txt($target);
                if ($values) {
                    return $values;
                }
            }
        }
    }
    return [];
}

function dns_has(string $name, int $type): bool
{
    $records = @dns_get_record($name, $type);
    return is_array($records) && count($records) > 0;
}

function check(bool $pass, string $detail = '', string $warnDetail = ''): array
{
    if ($pass) {
        return ['status' => 'pass', 'detail' => $detail];
    }
    return $warnDetail !== ''
        ? ['status' => 'warn', 'detail' => $warnDetail]
        : ['status' => 'fail', 'detail' => $detail];
}

/* ---------------------------------------------------------------- input */

$outLang = (($_GET['lang'] ?? '') === 'en') ? 'en' : 'lv';
$raw = trim((string)($_GET['url'] ?? $_POST['url'] ?? ''));
if ($raw === '' || mb_strlen($raw) > 300) {
    fail('invalid');
}
if (!preg_match('~^[a-z][a-z0-9+.\-]*://~i', $raw)) {
    $raw = 'https://' . $raw;
}

$parts = parse_url($raw);
if ($parts === false) {
    fail('invalid');
}
$scheme = strtolower((string)($parts['scheme'] ?? ''));
$host = strtolower(rtrim((string)($parts['host'] ?? ''), '.'));
$port = $parts['port'] ?? null;

if (!in_array($scheme, ['http', 'https'], true)) {
    fail('scheme');
}
if (isset($parts['user']) || isset($parts['pass'])) {
    fail('invalid');
}
if ($port !== null && !in_array((int)$port, [80, 443], true)) {
    fail('port');
}
if ($host === '' || strlen($host) > 253) {
    fail('host');
}
if (filter_var($host, FILTER_VALIDATE_IP)) {
    fail('private');
}
if (!preg_match('~^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+$~', $host)) {
    fail('host');
}
foreach (['localhost', '.local', '.internal', '.localdomain', '.test', '.invalid', '.onion'] as $blocked) {
    if ($host === 'localhost' || str_ends_with($host, $blocked)) {
        fail('private');
    }
}

$resolved = gethostbynamel($host);
if (!$resolved) {
    fail('dns');
}
foreach ($resolved as $ip) {
    if (!is_public_ip($ip)) {
        fail('private');
    }
}

/* ---------------------------------------------------------------- fetch */

$page = fetch_page($scheme . '://' . $host . '/');
if (!$page['ok']) {
    fail(in_array($page['errno'], [60, 51, 58, 83], true) ? 'tls' : 'unreachable');
}
if ($page['code'] >= 400 && $page['code'] !== 401 && $page['code'] !== 403) {
    fail('http');
}

$html = $page['body'];
$headers = $page['headers'];
$finalUrl = $page['final_url'];
$finalScheme = strtolower((string)(parse_url($finalUrl, PHP_URL_SCHEME) ?: $scheme));
$isHttps = $finalScheme === 'https';

$aux = fetch_many([
    'robots' => $scheme . '://' . $host . '/robots.txt',
    'llms' => $scheme . '://' . $host . '/llms.txt',
    'sitemap' => $scheme . '://' . $host . '/sitemap.xml',
    'securitytxt' => $scheme . '://' . $host . '/.well-known/security.txt',
    'git' => $scheme . '://' . $host . '/.git/HEAD',
    'env' => $scheme . '://' . $host . '/.env',
    'wpconfig' => $scheme . '://' . $host . '/wp-config.php.bak',
], false, 5);
$aux = array_merge($aux, fetch_many(['http' => 'http://' . $host . '/'], true, 4));

/* ---------------------------------------------------------------- page */

$title = '';
if (preg_match('~<title[^>]*>(.*?)</title>~is', $html, $m)) {
    $title = trim(preg_replace('~\s+~', ' ', html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8')));
}
$blockedPage = header_value($headers, 'cf-mitigated') === 'challenge'
    || $page['code'] === 403
    || stripos($title, 'just a moment') !== false;
if ($blockedPage) {
    fail('blocked');
}
$lang = '';
if (preg_match('~<html[^>]*\slang\s*=\s*["\']([^"\']+)["\']~i', $html, $m)) {
    $lang = trim($m[1]);
}
$h1Count = preg_match_all('~<h1\b[^>]*>\s*\S~i', $html);
$metaDescription = '';
if (preg_match('~<meta[^>]+name\s*=\s*["\']description["\'][^>]*content\s*=\s*["\']([^"\']*)["\']~i', $html, $m)) {
    $metaDescription = trim($m[1]);
} elseif (preg_match('~<meta[^>]+content\s*=\s*["\']([^"\']*)["\'][^>]*name\s*=\s*["\']description["\']~i', $html, $m)) {
    $metaDescription = trim($m[1]);
}
$ogTags = [];
foreach (['og:title', 'og:description', 'og:image'] as $tag) {
    if (preg_match('~<meta[^>]+property\s*=\s*["\']' . preg_quote($tag, '~') . '["\']~i', $html)) {
        $ogTags[] = $tag;
    }
}
$hasSchema = (bool)preg_match('~<script[^>]+application/ld\+json~i', $html) || (bool)preg_match('~itemscope~i', $html);
$plainText = trim(preg_replace('~\s+~', ' ', strip_tags(preg_replace('~<(script|style|noscript)\b[^>]*>.*?</\1>~is', ' ', $html))));

$platform = 'unknown';
if (preg_match('~wp-content|wp-includes|/wp-json~i', $html)) {
    $platform = 'wordpress';
} elseif (preg_match('~bitrix~i', $html)) {
    $platform = 'bitrix';
} elseif (preg_match('~cdn\.shopify\.com~i', $html)) {
    $platform = 'shopify';
} elseif (preg_match('~wix\.com|wixstatic~i', $html)) {
    $platform = 'wix';
} elseif (preg_match('~webflow~i', $html)) {
    $platform = 'webflow';
} elseif (preg_match('~joomla~i', $html)) {
    $platform = 'joomla';
} elseif (preg_match('~drupal~i', $html)) {
    $platform = 'drupal';
}

/* ---------------------------------------------------------------- checks */

$c = [];

// HTTPS and transport.
$httpProbe = $aux['http'];
// RESPONSE_CODE is the final response after redirects, so look at the redirect count.
$httpRedirects = ($httpProbe['redirects'] ?? 0) > 0 && str_starts_with($httpProbe['final_url'] ?? '', 'https://');
if (!$isHttps) {
    $c['https'] = ['status' => 'fail', 'detail' => 'http://' . $host . '/'];
} elseif ($httpRedirects) {
    $c['https'] = ['status' => 'pass', 'detail' => 'https://' . $host . '/'];
} else {
    $c['https'] = ['status' => 'warn', 'detail' => 'HTTPS darbojas, http:// versija nepāradresē'];
}

$hsts = header_value($headers, 'strict-transport-security');
$hstsMaxAge = 0;
if ($hsts !== '' && preg_match('~max-age\s*=\s*(\d+)~i', $hsts, $m)) {
    $hstsMaxAge = (int)$m[1];
}
if (!$isHttps) {
    $c['hsts'] = ['status' => 'info', 'detail' => 'Nav HTTPS'];
} elseif ($hstsMaxAge > 0) {
    $c['hsts'] = ['status' => 'pass', 'detail' => 'max-age=' . $hstsMaxAge];
} elseif ($hsts !== '') {
    $c['hsts'] = ['status' => 'warn', 'detail' => 'max-age=0'];
} else {
    $c['hsts'] = ['status' => 'fail', 'detail' => 'HSTS nav iestatīts'];
}

$csp = header_value($headers, 'content-security-policy');
if ($csp === '') {
    $c['csp'] = ['status' => 'fail', 'detail' => 'CSP nav iestatīts'];
} else {
    $missing = [];
    foreach (['object-src', 'base-uri', 'frame-ancestors'] as $directive) {
        if (stripos($csp, $directive) === false) {
            $missing[] = $directive;
        }
    }
    $c['csp'] = $missing
        ? ['status' => 'warn', 'detail' => 'Trūkst: ' . implode(', ', $missing)]
        : ['status' => 'pass', 'detail' => 'Politika ir pilna'];
}

$xfo = strtolower(header_value($headers, 'x-frame-options'));
$cspFrame = $csp !== '' && stripos($csp, 'frame-ancestors') !== false;
if (in_array($xfo, ['deny', 'sameorigin'], true) || $cspFrame) {
    $c['frame'] = ['status' => 'pass', 'detail' => $cspFrame ? 'CSP frame-ancestors' : 'X-Frame-Options: ' . $xfo];
} else {
    $c['frame'] = ['status' => 'fail', 'detail' => $xfo !== '' ? 'X-Frame-Options: ' . $xfo : 'X-Frame-Options nav'];
}

$c['nosniff'] = check(strtolower(header_value($headers, 'x-content-type-options')) === 'nosniff', 'X-Content-Type-Options nav', '');
$referrer = strtolower(header_value($headers, 'referrer-policy'));
if ($referrer === '') {
    $c['referrer'] = ['status' => 'fail', 'detail' => 'Referrer-Policy nav'];
} elseif (str_contains($referrer, 'unsafe-url')) {
    $c['referrer'] = ['status' => 'warn', 'detail' => $referrer];
} else {
    $c['referrer'] = ['status' => 'pass', 'detail' => $referrer];
}
$c['permissions'] = check(header_value($headers, 'permissions-policy') !== '', 'Permissions-Policy nav', '');

$disclosure = [];
foreach (['server', 'x-powered-by', 'x-aspnet-version'] as $name) {
    $value = header_value($headers, $name);
    if ($value !== '' && preg_match('~\d~', $value)) {
        $disclosure[] = $value;
    }
}
if (preg_match('~<meta[^>]+name\s*=\s*["\']generator["\'][^>]*content\s*=\s*["\']([^"\']+)~i', $html, $m)) {
    $disclosure[] = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
}
$c['server'] = $disclosure
    ? ['status' => 'warn', 'detail' => mb_substr(implode(', ', array_unique($disclosure)), 0, 120)]
    : ['status' => 'pass', 'detail' => 'Versijas netiek atklātas'];

$externalWithoutSri = 0;
if (preg_match_all('~<(script|link)\b[^>]*>~i', $html, $tags)) {
    foreach ($tags[0] as $tag) {
        $isScript = stripos($tag, '<script') === 0;
        $hasIntegrity = stripos($tag, 'integrity=') !== false;
        if (!preg_match('~(?:src|href)\s*=\s*["\'](https?://[^"\']+)["\']~i', $tag, $src)) {
            continue;
        }
        $assetHost = strtolower((string)(parse_url($src[1], PHP_URL_HOST) ?: ''));
        if ($assetHost === $host || str_ends_with($assetHost, '.' . $host)) {
            continue;
        }
        if (str_contains($assetHost, 'fonts.googleapis.com') || str_contains($assetHost, 'fonts.gstatic.com')) {
            continue;
        }
        if (!$isScript && stripos($tag, 'stylesheet') === false) {
            continue;
        }
        if (!$hasIntegrity) {
            $externalWithoutSri++;
        }
    }
}
$c['sri'] = $externalWithoutSri > 0
    ? ['status' => 'warn', 'detail' => $externalWithoutSri . ' faili bez integrity']
    : ['status' => 'pass', 'detail' => 'Visi ārējie faili ar parakstu'];

$cookieHeaders = $headers['set-cookie'] ?? [];
if (!$cookieHeaders) {
    $c['cookies'] = ['status' => 'info', 'detail' => 'Sīkdatnes netiek iestatītas'];
} else {
    $weak = 0;
    foreach ($cookieHeaders as $cookie) {
        $lower = strtolower($cookie);
        if (!str_contains($lower, 'secure') || !str_contains($lower, 'httponly') || !str_contains($lower, 'samesite')) {
            $weak++;
        }
    }
    $c['cookies'] = $weak === 0
        ? ['status' => 'pass', 'detail' => count($cookieHeaders) . ' sīkdatnes ar Secure, HttpOnly, SameSite']
        : ['status' => 'warn', 'detail' => $weak . ' no ' . count($cookieHeaders) . ' bez Secure/HttpOnly/SameSite'];
}

$securityTxt = $aux['securitytxt'];
$c['securitytxt'] = check(
    $securityTxt['code'] === 200 && stripos($securityTxt['body'], 'contact:') !== false,
    'Contact nav atrasts',
    ''
);

$exposed = [];
if ($aux['git']['code'] === 200 && str_contains($aux['git']['body'], 'ref:')) {
    $exposed[] = '/.git/HEAD';
}
if ($aux['env']['code'] === 200 && preg_match('~[A-Z_]{3,}\s*=~', $aux['env']['body'])) {
    $exposed[] = '/.env';
}
if ($aux['wpconfig']['code'] === 200 && stripos($aux['wpconfig']['body'], 'DB_PASSWORD') !== false) {
    $exposed[] = '/wp-config.php.bak';
}
$c['exposed'] = $exposed
    ? ['status' => 'fail', 'detail' => implode(', ', $exposed)]
    : ['status' => 'pass', 'detail' => 'Nav atrasti'];

$oldLibs = [];
if (preg_match_all('~jquery[.\-/]?(\d+\.\d+(?:\.\d+)?)~i', $html, $m)) {
    foreach (array_unique($m[1]) as $version) {
        if (version_compare($version, '3.5.0', '<')) {
            $oldLibs[] = 'jQuery ' . $version;
        }
    }
}
if (preg_match('~bootstrap[.\-/]?(\d+\.\d+(?:\.\d+)?)~i', $html, $m) && version_compare($m[1], '4.3.0', '<')) {
    $oldLibs[] = 'Bootstrap ' . $m[1];
}
$c['libs'] = $oldLibs
    ? ['status' => 'warn', 'detail' => implode(', ', array_unique($oldLibs))]
    : ['status' => 'pass', 'detail' => 'Versijas ir aktuālas'];

// Email and domain trust.
$spf = '';
foreach (dns_txt($host) as $txt) {
    if (stripos($txt, 'v=spf1') === 0) {
        $spf = $txt;
        break;
    }
}
if ($spf === '') {
    $c['spf'] = ['status' => 'fail', 'detail' => 'Nav SPF ieraksta'];
} elseif (stripos($spf, '-all') !== false || stripos($spf, '~all') !== false) {
    $c['spf'] = ['status' => 'pass', 'detail' => stripos($spf, '-all') !== false ? 'SPF ar -all' : 'SPF ar ~all'];
} elseif (stripos($spf, '+all') !== false || stripos($spf, '?all') !== false) {
    $c['spf'] = ['status' => 'warn', 'detail' => stripos($spf, '+all') !== false ? 'SPF beidzas ar +all' : 'SPF beidzas ar ?all'];
} else {
    $c['spf'] = ['status' => 'warn', 'detail' => 'SPF bez all mehānisma'];
}

$dmarc = '';
foreach (dns_txt('_dmarc.' . $host) as $txt) {
    if (stripos($txt, 'v=DMARC1') === 0) {
        $dmarc = $txt;
        break;
    }
}
if ($dmarc === '') {
    $c['dmarc'] = ['status' => 'fail', 'detail' => 'Nav DMARC ieraksta'];
} elseif (preg_match('~\bp\s*=\s*(none|quarantine|reject)~i', $dmarc, $m)) {
    $policy = strtolower($m[1]);
    $c['dmarc'] = $policy === 'none'
        ? ['status' => 'warn', 'detail' => 'p=none (tikai novēro)']
        : ['status' => 'pass', 'detail' => 'p=' . $policy];
} else {
    $c['dmarc'] = ['status' => 'warn', 'detail' => 'Politika nav norādīta'];
}

$dkimSelectors = [
    'default', 'mail', 'google', 'selector1', 'selector2', 'k1', 's1',
    'hostingermail-a', 'hostingermail-b', 'hostingermail-c', 'reach-a', 'reach-b',
];
$dkimFound = '';
foreach ($dkimSelectors as $selector) {
    foreach (dns_dkim_txt($selector . '._domainkey.' . $host) as $txt) {
        if (stripos($txt, 'v=DKIM1') !== false && preg_match('~p=[A-Za-z0-9+/]{10,}~', $txt)) {
            $dkimFound = $selector;
            break 2;
        }
    }
}
$c['dkim'] = $dkimFound !== ''
    ? ['status' => 'pass', 'detail' => 'Atrasts selektors: ' . $dkimFound]
    : ['status' => 'info', 'detail' => 'Standarta selektoros nav atrasts'];

$hasMx = dns_has($host, DNS_MX);
$c['mx'] = $hasMx
    ? ['status' => 'pass', 'detail' => 'MX ieraksti ir']
    : ['status' => 'info', 'detail' => 'Domēns e-pastu nesaņem'];

$hasCaa = function_exists('dns_get_record') && dns_has($host, DNS_CAA);
$c['caa'] = $hasCaa
    ? ['status' => 'pass', 'detail' => 'CAA ieraksts ir']
    : ['status' => 'warn', 'detail' => 'Nav CAA ieraksta'];

$mtaSts = '';
foreach (dns_txt('_mta-sts.' . $host) as $txt) {
    if (stripos($txt, 'v=STSv1') === 0) {
        $mtaSts = $txt;
        break;
    }
}
$c['mtasts'] = $mtaSts !== ''
    ? ['status' => 'pass', 'detail' => $mtaSts]
    : ['status' => 'warn', 'detail' => 'Nav MTA-STS ieraksta'];

$emailCount = preg_match_all('~[a-z0-9._%+\-]+@' . preg_quote($host, '~') . '~i', $plainText);
$c['emails'] = $emailCount > 0
    ? ['status' => 'warn', 'detail' => $emailCount . ' adreses atklātā tekstā']
    : ['status' => 'pass', 'detail' => 'Nav atklātu adreses'];

// AI and content visibility.
$robots = $aux['robots'];
$robotsOk = $robots['code'] === 200 && $robots['body'] !== '';
$aiAgents = ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot'];
$blockedAgents = [];
foreach ($aiAgents as $agent) {
    if (preg_match('~User-agent:\s*' . preg_quote($agent, '~') . '\s*(?:\r?\n)Disallow:\s*/\s*(?:\r?\n|$)~i', $robots['body'])) {
        $blockedAgents[] = $agent;
    }
}
if (!$robotsOk) {
    $c['robots'] = ['status' => 'warn', 'detail' => 'robots.txt nav atrasts'];
} elseif ($blockedAgents) {
    $c['robots'] = ['status' => 'fail', 'detail' => 'Aizliegts: ' . implode(', ', $blockedAgents)];
} elseif (preg_match('~User-agent:\s*\*\s*(?:\r?\n)Disallow:\s*/\s*(?:\r?\n|$)~i', $robots['body'])) {
    $c['robots'] = ['status' => 'fail', 'detail' => 'Visa lapa aizliegta robotiem'];
} else {
    $c['robots'] = ['status' => 'pass', 'detail' => 'MI roboti nav aizliegti'];
}

$llms = $aux['llms'];
$c['llms'] = check($llms['code'] === 200 && strlen(trim($llms['body'])) > 20, 'llms.txt nav atrasts', '');

$sitemapHeaderLine = stripos($robots['body'], 'sitemap:') !== false;
$sitemap = $aux['sitemap'];
$c['sitemap'] = check(
    ($sitemap['code'] === 200 && strlen(trim($sitemap['body'])) > 20) || $sitemapHeaderLine,
    'Sitemap nav atrasts',
    ''
);

$titleLength = mb_strlen($title);
$c['title'] = $title === ''
    ? ['status' => 'fail', 'detail' => 'Nav <title>']
    : ($titleLength >= 10 && $titleLength <= 70
        ? ['status' => 'pass', 'detail' => $titleLength . ' rakstzīmes']
        : ['status' => 'warn', 'detail' => $titleLength . ' rakstzīmes']);

$descriptionLength = mb_strlen($metaDescription);
$c['meta'] = $metaDescription === ''
    ? ['status' => 'fail', 'detail' => 'Nav meta description']
    : ($descriptionLength >= 50 && $descriptionLength <= 170
        ? ['status' => 'pass', 'detail' => $descriptionLength . ' rakstzīmes']
        : ['status' => 'warn', 'detail' => $descriptionLength . ' rakstzīmes']);

$c['og'] = count($ogTags) === 3
    ? ['status' => 'pass', 'detail' => 'og:title, og:description, og:image']
    : ['status' => 'warn', 'detail' => $ogTags ? 'Ir: ' . implode(', ', $ogTags) : 'Nav Open Graph tagu'];

$c['lang'] = $lang !== ''
    ? ['status' => 'pass', 'detail' => 'lang="' . $lang . '"']
    : ['status' => 'fail', 'detail' => 'Nav lang atribūta'];

$c['h1'] = $h1Count === 1
    ? ['status' => 'pass', 'detail' => '1 virsraksts']
    : ($h1Count === 0
        ? ['status' => 'fail', 'detail' => 'Nav <h1>']
        : ['status' => 'warn', 'detail' => $h1Count . ' virsraksti']);

$c['schema'] = $hasSchema
    ? ['status' => 'pass', 'detail' => 'Strukturētie dati ir']
    : ['status' => 'fail', 'detail' => 'Nav schema.org datu'];

$textLength = mb_strlen($plainText);
$c['nojs'] = $textLength >= 400
    ? ['status' => 'pass', 'detail' => $textLength . ' rakstzīmes bez JavaScript']
    : ($textLength >= 100
        ? ['status' => 'warn', 'detail' => $textLength . ' rakstzīmes bez JavaScript']
        : ['status' => 'fail', 'detail' => $textLength . ' rakstzīmes bez JavaScript']);

/* ---------------------------------------------------------------- output */

function localize_detail(string $detail, string $lang): string
{
    if ($lang !== 'en') {
        return $detail;
    }
    static $map = [
        'HSTS nav iestatīts' => 'HSTS is not set',
        'CSP nav iestatīts' => 'CSP is not set',
        'Politika ir pilna' => 'Policy is complete',
        'X-Frame-Options nav' => 'No X-Frame-Options',
        'X-Content-Type-Options nav' => 'No X-Content-Type-Options',
        'Referrer-Policy nav' => 'No Referrer-Policy',
        'Permissions-Policy nav' => 'No Permissions-Policy',
        'Versijas netiek atklātas' => 'No versions exposed',
        'Visi ārējie faili ar parakstu' => 'All external assets signed',
        'Sīkdatnes netiek iestatītas' => 'No cookies set',
        'Contact nav atrasts' => 'No Contact entry',
        'Nav atrasti' => 'None found',
        'Versijas ir aktuālas' => 'Versions are current',
        'Nav SPF ieraksta' => 'No SPF record',
        'SPF ar -all' => 'SPF with -all',
        'SPF ar ~all' => 'SPF with ~all',
        'SPF beidzas ar +all' => 'SPF ends with +all',
        'SPF beidzas ar ?all' => 'SPF ends with ?all',
        'SPF bez all mehānisma' => 'SPF without an all mechanism',
        'Nav DMARC ieraksta' => 'No DMARC record',
        'p=none (tikai novēro)' => 'p=none (monitor only)',
        'Politika nav norādīta' => 'Policy not set',
        'Standarta selektoros nav atrasts' => 'Not found under standard selectors',
        'MX ieraksti ir' => 'MX records present',
        'Domēns e-pastu nesaņem' => 'Domain does not receive email',
        'CAA ieraksts ir' => 'CAA record present',
        'Nav CAA ieraksta' => 'No CAA record',
        'Nav MTA-STS ieraksta' => 'No MTA-STS record',
        'Nav atklātu adreses' => 'No exposed addresses',
        'robots.txt nav atrasts' => 'robots.txt not found',
        'Visa lapa aizliegta robotiem' => 'Whole site disallowed for crawlers',
        'MI roboti nav aizliegti' => 'AI crawlers are not blocked',
        'llms.txt nav atrasts' => 'llms.txt not found',
        'Sitemap nav atrasts' => 'Sitemap not found',
        'Nav meta description' => 'No meta description',
        'Nav Open Graph tagu' => 'No Open Graph tags',
        'Nav lang atribūta' => 'No lang attribute',
        'Nav <h1>' => 'No <h1>',
        'Nav <title>' => 'No <title>',
        'Strukturētie dati ir' => 'Structured data present',
        'Nav schema.org datu' => 'No schema.org data',
        'HTTPS darbojas, http:// versija nepāradresē' => 'HTTPS works, http:// version does not redirect',
        '1 virsraksts' => '1 heading',
    ];
    if (isset($map[$detail])) {
        return $map[$detail];
    }
    $patterns = [
        '~^Trūkst: (.+)$~' => 'Missing: $1',
        '~^(\d+) faili bez integrity$~' => '$1 assets without integrity',
        '~^(\d+) sīkdatnes ar Secure, HttpOnly, SameSite$~' => '$1 cookies with Secure, HttpOnly, SameSite',
        '~^(\d+) no (\d+) bez Secure/HttpOnly/SameSite$~' => '$1 of $2 without Secure/HttpOnly/SameSite',
        '~^(\d+) adreses atklātā tekstā$~' => '$1 addresses in plain text',
        '~^Atrasts selektors: (.+)$~' => 'Found selector: $1',
        '~^Aizliegts: (.+)$~' => 'Blocked: $1',
        '~^Ir: (.+)$~' => 'Present: $1',
        '~^(\d+) rakstzīmes bez JavaScript$~' => '$1 characters without JavaScript',
        '~^(\d+) rakstzīmes$~' => '$1 characters',
        '~^(\d+) virsraksti$~' => '$1 headings',
    ];
    foreach ($patterns as $pattern => $replacement) {
        if (preg_match($pattern, $detail)) {
            return preg_replace($pattern, $replacement, $detail);
        }
    }
    return $detail;
}

foreach ($c as $checkId => $checkResult) {
    $c[$checkId]['detail'] = localize_detail($checkResult['detail'], $outLang);
}

respond([
    'ok' => true,
    'host' => $host,
    'final_url' => $finalUrl,
    'platform' => $platform,
    'title' => mb_substr($title, 0, 120),
    'checked_at' => gmdate('Y-m-d'),
    'checks' => $c,
]);
