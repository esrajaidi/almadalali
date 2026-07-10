# Contact form setup

1. Upload the full folder to PHP hosting.
2. Copy `config.example.php` to `config.php`.
3. Open `config.php` and replace `PUT_EMAIL_PASSWORD_HERE` with the real password for `info@almadalali.ly`.
4. Keep these settings:
   - SMTP host: `ls40.server.ly`
   - SMTP port: `465`
   - Encryption: SSL/TLS
   - SMTP authentication: enabled
   - Username: `info@almadalali.ly`
5. Make sure PHP has OpenSSL enabled and outbound port 465 is allowed by the hosting provider.

Do not place the SMTP password in HTML or JavaScript. The password must stay only in the server-side `config.php` file.
