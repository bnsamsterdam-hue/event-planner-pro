# -*- coding: utf-8 -*-
"""
Zet het emissiezone-bestand van het NDW om naar een klein, leesbaar bestand
dat de app kan gebruiken.

Het NDW levert DATEX II: een uitgebreid Europees formaat vol naamruimten en
verwijzingen. Daar hoeven wij maar een fractie van: waar ligt de zone, om wat
voor zone gaat het, vanaf wanneer geldt hij, en voor welke voertuigen.

Uit het originele bestand van bijna 900 kB blijft zo een fractie over.
"""
import re, json, sys, datetime

def tekst(blok, tag):
    m = re.search(r'<%s[^>]*>(.*?)</%s>' % (tag, tag), blok, re.S)
    return re.sub(r'<[^>]+>', '', m.group(1)).strip() if m else ''

def zones_uit(xml):
    uit = []
    # elke zone staat in een urbanVehicleAccessRegulation
    for blok in re.findall(r'<cz:urbanVehicleAccessRegulation\b.*?</cz:urbanVehicleAccessRegulation>', xml, re.S):
        naam  = tekst(blok, 'cz:name')
        if not naam or naam.lower()=='onbekend':
            naam = tekst(blok, 'com:value') or ''
        soort = tekst(blok, 'cz:controlledZoneType')      # lowEmissionZone / zeroEmissionZone
        status= tekst(blok, 'cz:status')
        url   = tekst(blok, 'cz:urlForFurtherInformation')
        stad  = tekst(blok, 'tro:issuingAuthority')
        start = tekst(blok, 'com:overallStartTime')[:10]
        eind  = tekst(blok, 'com:overallEndTime')[:10]

        # strengste euronorm die in deze zone genoemd wordt
        euros = [int(x) for x in re.findall(r'<com:emissionClassificationEuro>[^<]*?(\d)[^<]*?</com:emissionClassificationEuro>', blok)]
        euro  = max(euros) if euros else None

        cats  = sorted(set(re.findall(r'<comx:euVehicleCategory>([^<]+)</comx:euVehicleCategory>', blok)))
        brand = sorted(set(re.findall(r'<com:fuelType>([^<]+)</com:fuelType>', blok)))

        vlakken = []
        for pl in re.findall(r'<loc:posList>([^<]+)</loc:posList>', blok):
            g = [float(x) for x in pl.split()]
            # het NDW zet breedte eerst, dan lengte
            punten = [[round(g[i], 6), round(g[i+1], 6)] for i in range(0, len(g) - 1, 2)]
            if len(punten) > 2:
                vlakken.append(punten)
        if not vlakken:
            continue

        uit.append({
            'naam': naam or stad,
            'stad': stad,
            # Let op: het NDW zet bij bijna alles "lowEmissionZone" in het
            # type-veld, ook bij zero-emissiezones. De naam is betrouwbaarder:
            # die begint bij een zero-emissiezone met ZE of bevat "zero".
            'soort': ('zero' if re.search(r'\bze\b|zero', (naam+' '+soort).lower()) else 'milieu'),
            'status': status,
            'vanaf': start,
            'tot': eind if eind and not eind.startswith('2999') else '',
            'euro': euro,
            'categorieen': cats,
            'brandstoffen': brand,
            'url': url,
            'vlakken': vlakken
        })
    return uit

if __name__ == '__main__':
    xml = open(sys.argv[1], encoding='utf-8').read()
    z = zones_uit(xml)
    doc = {
        'bron': 'NDW open data - emissiezones',
        'opgehaald': datetime.datetime.utcnow().strftime('%Y-%m-%d'),
        'aantal': len(z),
        'zones': z
    }
    open(sys.argv[2], 'w', encoding='utf-8').write(json.dumps(doc, ensure_ascii=False, separators=(',', ':')))
    print('zones:', len(z))
    for x in z[:8]:
        print('  %-28s %-6s vanaf %-10s euro %-4s %d vlak(ken)' % (x['naam'][:28], x['soort'], x['vanaf'], x['euro'], len(x['vlakken'])))
