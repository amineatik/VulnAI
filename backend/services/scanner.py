"""
Advanced Vulnerability Scanner
VulnGuard AI
Version améliorée avec réduction des faux positifs
"""

import requests
import re
import socket
import ssl
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)


class VulnerabilityScanner:

    def __init__(self, target_url: str, db=None):

        self.target_url = target_url.rstrip("/")
        self.db = db

        self.session = requests.Session()

        self.session.headers.update({
            "User-Agent": "VulnGuardAI/3.0"
        })

        self.timeout = 15

        self.vulnerabilities = []

        self.visited_urls = set()

        self.found_forms = []

    # =========================================================
    # MAIN
    # =========================================================

    def scan(self):

        logger.info(f" Starting scan: {self.target_url}")

        self.crawl_website(self.target_url)

        self.check_headers()

        self.check_ssl()

        self.check_cors()

        self.check_sensitive_files()

        self.check_information_disclosure()

        self.check_open_ports()

        self.detect_technologies()

        self.scan_forms()

        score = self.calculate_security_score()

        logger.info(f"✅ Scan finished: {len(self.vulnerabilities)} vulnerabilities")

        return {
            "vulnerabilities": self.vulnerabilities,
            "security_score": score,
            "summary": self.get_summary()
        }

    # =========================================================
    # ADD VULN
    # =========================================================

    def add_vulnerability(
        self,
        title,
        description,
        severity,
        cvss_score,
        remediation,
        endpoint=None
    ):

        vuln = {
            "title": title,
            "description": description,
            "severity": severity,
            "cvss_score": str(cvss_score),
            "endpoint": endpoint or self.target_url,
            "remediation": remediation,
            "status": "open"
        }

        self.vulnerabilities.append(vuln)

        logger.warning(f"[{severity.upper()}] {title}")

    # =========================================================
    # CRAWLER
    # =========================================================

    def crawl_website(self, url, depth=2):

        if depth <= 0:
            return

        if url in self.visited_urls:
            return

        self.visited_urls.add(url)

        try:

            response = self.session.get(
                url,
                timeout=self.timeout
            )

            soup = BeautifulSoup(response.text, "html.parser")

            # Forms
            forms = soup.find_all("form")

            for form in forms:
                self.found_forms.append({
                    "url": url,
                    "form": form
                })

            # Links
            links = soup.find_all("a", href=True)

            for link in links:

                href = link["href"]

                full_url = urljoin(url, href)

                if self.target_url in full_url:
                    self.crawl_website(full_url, depth - 1)

        except Exception as e:
            logger.error(f"Crawl error: {e}")

    # =========================================================
    # HEADERS
    # =========================================================

    def check_headers(self):

        try:

            response = self.session.get(
                self.target_url,
                timeout=self.timeout
            )

            headers = response.headers

            required_headers = {
                "Strict-Transport-Security": "Missing HSTS Header",
                "Content-Security-Policy": "Missing CSP Header",
                "X-Frame-Options": "Missing X-Frame-Options",
                "X-Content-Type-Options": "Missing X-Content-Type-Options",
                "Referrer-Policy": "Missing Referrer-Policy",
                "Permissions-Policy": "Missing Permissions-Policy"
            }

            for header, title in required_headers.items():

                if header not in headers:

                    self.add_vulnerability(
                        title=title,
                        description=f"{header} header missing",
                        severity="medium",
                        cvss_score=5.0,
                        remediation=f"Add {header} header"
                    )

        except Exception as e:
            logger.error(e)

    # =========================================================
    # SSL
    # =========================================================

    def check_ssl(self):

        parsed = urlparse(self.target_url)

        if parsed.scheme != "https":

            self.add_vulnerability(
                title="Website not using HTTPS",
                description="HTTP protocol detected",
                severity="critical",
                cvss_score=9.5,
                remediation="Enable HTTPS"
            )

            return

        try:

            hostname = parsed.hostname

            context = ssl.create_default_context()

            with socket.create_connection((hostname, 443)) as sock:

                with context.wrap_socket(
                    sock,
                    server_hostname=hostname
                ) as ssock:

                    cert = ssock.getpeercert()

                    if not cert:

                        self.add_vulnerability(
                            title="Invalid SSL Certificate",
                            description="SSL certificate invalid",
                            severity="high",
                            cvss_score=7.5,
                            remediation="Install valid SSL certificate"
                        )

        except Exception as e:
            logger.error(e)

    # =========================================================
    # CORS
    # =========================================================

    def check_cors(self):

        try:

            response = self.session.get(
                self.target_url,
                headers={"Origin": "https://evil.com"},
                timeout=self.timeout
            )

            cors = response.headers.get(
                "Access-Control-Allow-Origin"
            )

            if cors == "*":

                self.add_vulnerability(
                    title="Misconfigured CORS",
                    description="CORS allows all origins",
                    severity="high",
                    cvss_score=7.4,
                    remediation="Restrict allowed origins"
                )

        except Exception:
            pass

    # =========================================================
    # SENSITIVE FILES
    # =========================================================

    def check_sensitive_files(self):

        sensitive_files = {
            "/.env": [
                "APP_KEY",
                "SECRET_KEY",
                "DB_PASSWORD",
                "DATABASE_URL"
            ],

            "/.git/config": [
                "[core]",
                "repositoryformatversion"
            ],

            "/database.sql": [
                "CREATE TABLE",
                "INSERT INTO"
            ],

            "/config.php": [
                "<?php",
                "DB_HOST"
            ],

            "/phpinfo.php": [
                "php version",
                "phpinfo()"
            ],

            "/backup.zip": [
                "PK"
            ]
        }

        for path, indicators in sensitive_files.items():

            try:

                url = self.target_url + path

                response = self.session.get(
                    url,
                    timeout=self.timeout
                )

                if response.status_code != 200:
                    continue

                content_type = response.headers.get(
                    "Content-Type",
                    ""
                )

                # ZIP
                if path.endswith(".zip"):

                    if (
                        "application/zip" in content_type
                        or response.content[:2] == b"PK"
                    ):

                        self.add_vulnerability(
                            title="Sensitive Backup File Exposed",
                            description=f"Backup file exposed: {path}",
                            severity="critical",
                            cvss_score=9.1,
                            remediation="Remove backup files from public access",
                            endpoint=url
                        )

                    continue

                content = response.text[:5000]

                # False positive reduction
                if (
                    "404" in content.lower()
                    or "not found" in content.lower()
                ):
                    continue

                found = False

                for indicator in indicators:

                    if indicator.lower() in content.lower():
                        found = True
                        break

                if found:

                    self.add_vulnerability(
                        title="Sensitive File Exposed",
                        description=f"Sensitive file exposed: {path}",
                        severity="critical",
                        cvss_score=9.1,
                        remediation="Remove or protect sensitive files",
                        endpoint=url
                    )

            except Exception:
                continue

    # =========================================================
    # INFO DISCLOSURE
    # =========================================================

    def check_information_disclosure(self):

        patterns = [
            r"api[_-]?key",
            r"secret",
            r"token",
            r"password",
            r"AWS_SECRET"
        ]

        try:

            response = self.session.get(
                self.target_url,
                timeout=self.timeout
            )

            content = response.text.lower()

            for pattern in patterns:

                if re.search(pattern, content):

                    self.add_vulnerability(
                        title="Sensitive Information Disclosure",
                        description=f"Sensitive pattern found: {pattern}",
                        severity="high",
                        cvss_score=7.0,
                        remediation="Remove secrets from frontend"
                    )

        except Exception:
            pass

    # =========================================================
    # PORT SCAN
    # =========================================================

    def check_open_ports(self):

        parsed = urlparse(self.target_url)

        host = parsed.hostname

        ports = [21, 22, 25, 80, 443, 3306, 5432]

        def scan_port(port):

            try:

                sock = socket.socket()

                sock.settimeout(1)

                result = sock.connect_ex((host, port))

                sock.close()

                if result == 0 and port not in [80, 443]:

                    self.add_vulnerability(
                        title="Open Port Detected",
                        description=f"Port {port} is open",
                        severity="medium",
                        cvss_score=5.5,
                        remediation="Close unnecessary ports"
                    )

            except Exception:
                pass

        with ThreadPoolExecutor(max_workers=10) as executor:
            executor.map(scan_port, ports)

    # =========================================================
    # TECHNOLOGY DISCLOSURE
    # =========================================================

    def detect_technologies(self):

        try:

            response = self.session.get(
                self.target_url,
                timeout=self.timeout
            )

            headers = response.headers

            server = headers.get("Server")

            powered = headers.get("X-Powered-By")

            if server:

                self.add_vulnerability(
                    title="Server Version Disclosure",
                    description=f"Server disclosed: {server}",
                    severity="low",
                    cvss_score=3.2,
                    remediation="Hide server version"
                )

            if powered:

                self.add_vulnerability(
                    title="Technology Disclosure",
                    description=f"Technology disclosed: {powered}",
                    severity="low",
                    cvss_score=3.0,
                    remediation="Remove X-Powered-By header"
                )

        except Exception:
            pass

    # =========================================================
    # FORMS
    # =========================================================

    def scan_forms(self):

        for item in self.found_forms:

            form = item["form"]

            url = item["url"]

            inputs = form.find_all("input")

            for inp in inputs:

                name = inp.get("name", "")

                if not name:
                    continue

                self.check_csrf(form, url)

                self.test_xss(url, name)

                self.test_sqli(url, name)

    # =========================================================
    # CSRF
    # =========================================================

    def check_csrf(self, form, url):

        html = str(form).lower()

        if "csrf" not in html:

            self.add_vulnerability(
                title="Missing CSRF Protection",
                description="Form without CSRF token",
                severity="high",
                cvss_score=7.5,
                remediation="Implement CSRF protection",
                endpoint=url
            )

    # =========================================================
    # SQLI
    # =========================================================

    def test_sqli(self, url, param):

        payloads = [
            "' OR '1'='1",
            "' UNION SELECT NULL--"
        ]

        sql_errors = [
            "sql syntax",
            "mysql",
            "sqlite",
            "postgresql",
            "ora-",
            "syntax error"
        ]

        for payload in payloads:

            try:

                response = self.session.get(
                    url,
                    params={param: payload},
                    timeout=self.timeout
                )

                content = response.text.lower()

                if any(err in content for err in sql_errors):

                    self.add_vulnerability(
                        title="SQL Injection",
                        description="Possible SQL injection vulnerability",
                        severity="critical",
                        cvss_score=9.8,
                        remediation="Use prepared statements",
                        endpoint=url
                    )

                    return

            except Exception:
                continue

    # =========================================================
    # XSS
    # =========================================================

    def test_xss(self, url, param):

        payload = "<script>alert(1)</script>"

        try:

            response = self.session.get(
                url,
                params={param: payload},
                timeout=self.timeout
            )

            if payload in response.text:

                self.add_vulnerability(
                    title="Reflected XSS",
                    description="Input reflected without sanitization",
                    severity="critical",
                    cvss_score=8.5,
                    remediation="Escape user input",
                    endpoint=url
                )

        except Exception:
            pass

    # =========================================================
    # SCORE
    # =========================================================

    def calculate_security_score(self):

        score = 100

        penalties = {
            "critical": 25,
            "high": 15,
            "medium": 8,
            "low": 3
        }

        for vuln in self.vulnerabilities:

            score -= penalties.get(
                vuln["severity"],
                1
            )

        return max(score, 0)

    # =========================================================
    # SUMMARY
    # =========================================================

    def get_summary(self):

        summary = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0
        }

        for vuln in self.vulnerabilities:

            sev = vuln["severity"]

            if sev in summary:
                summary[sev] += 1

        return summary