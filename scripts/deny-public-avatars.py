"""Stop nginx from serving /uploads/avatars without a login."""
from pathlib import Path

path = Path("/etc/nginx/sites-available/gotcha")
if not path.exists():
    print("nginx conf missing; skip")
    raise SystemExit(0)
text = path.read_text()
needle = "location ^~ /uploads/avatars/"
if needle in text:
    print("nginx avatars already denied")
    raise SystemExit(0)
anchor = "    location /uploads/ {"
if anchor not in text:
    print("uploads location missing; skip")
    raise SystemExit(0)
block = """    location ^~ /uploads/avatars/ {
        default_type application/json;
        return 401 '{"statusCode":401,"message":"Unauthorized"}';
    }

"""
path.write_text(text.replace(anchor, block + anchor, 1))
print("nginx avatars denied")
