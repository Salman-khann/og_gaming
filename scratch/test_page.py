import urllib.request

with urllib.request.urlopen('http://localhost:3000') as resp:
    html = resp.read().decode('utf-8')
    print('Status:', resp.status)
    print('Contains #arena in nav:', 'href="#arena"' in html)
    print('Contains Arena Engine in text:', 'Arena Engine' in html)
    print('Contains Cabin Booking:', 'Cabin Booking' in html)
    print('Contains 5v5 Match Board:', '5v5 Match Board' in html)
    print('Contains Admin Panel:', 'Admin Panel' in html)
