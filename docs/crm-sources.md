# Sales list import sources

Robert's sales CRM ruling of 2026-11-02, item R2: "Read each portal's terms before the first pull and record the URL and terms date in docs/crm-sources.md; skip any source whose terms forbid storage."

This document and `src/config/crm-sources.ts` say the same thing. The config decides what runs; `sourceRefusal` lets a source run only when it is ready, its terms have a recorded read date, those terms allow storage, and something is declared to fetch. A proof asserts that against every declaration. Everything below was read on 2026-11-02 unless it says otherwise.

Approved by Robert on 2026-11-02 as drafted (issue #1, 6587551734), with three later answers the same day:
- TDLR's residential solar retailer and salesperson files join beside the electrical contractor file, vertical solar, under the same TDLR terms (answer to 6588393366).
- Austin stays on hold until he records the City's terms date, because its terms PDF could not be read here.
- Houston, Dallas, Fort Worth and Corpus Christi wait for the open records letters he is sending.

How every source runs (his answers 3 and 4): the daily schedule only previews; a person with `crm.import` presses Write; a company with no phone and no email is held on the import screen until a phone is found.

## Summary

| Source | Terms read | Storage allowed | State |
| --- | --- | --- | --- |
| San Antonio building permits | 2026-11-02 | Yes, CC BY with attribution | Ready. The contractor's name only, no phone, so most companies are held. |
| Austin issued construction permits | Not read | Not established | On hold until Robert records the City's terms date |
| Dallas building permits | Not read | Not established | On hold for the open records request |
| Fort Worth development permits | City disclaimer of 2016 read; dataset not read | Not established for this use | On hold for the open records request |
| Houston | n/a | n/a | Skipped: no permit-level dataset |
| Corpus Christi | Not read | Not established | On hold for the open records request |
| TDLR electrical contractors | 2026-11-02 | Yes, with attribution and a non-misleading presentation | Ready |
| TDLR residential solar retailers | 2026-11-02 | Yes, the same TDLR terms | Ready |
| TDLR residential solar salespeople | 2026-11-02 | Yes, the same TDLR terms | Ready. Name and county only, so every record is held. |
| TDHCA manufactured housing licensees | Not read | Not established | On hold |
| TREC brokers and sales agents | 2026-11-02 | Yes, published as a high value data set with no restriction found | Ready. No phone, email or address by law, so every record is held. |
| Google Places, on demand | 2026-11-02 | Latitude and longitude only, for 30 days | The lookup is closed: no Google key. Nothing from Google is stored. |

## Each source

### San Antonio, building permits
- Dataset: https://data.sanantonio.gov/dataset/building-permits (City of San Antonio, Development Services). The job reads `permits_issued.csv`, about 29 MB.
- License on the dataset page: Creative Commons Attribution (http://www.opendefinition.org/licenses/cc-by), read 2026-11-02. Storage and reuse allowed with attribution to the City of San Antonio; every source row carries it.
- Filter: PERMIT TYPE in Re-Roof Permit, Solar - Photovoltaic Permit, Foundation Repair Permit and Comm Foundation Permit.
- Grouped by PRIMARY CONTACT, the contractor's name ("keyed by contractor name"), with the permit count and the latest DATE ISSUED. The ADDRESS is the job site and is not stored as the company's address.
- Source record id: `contractor:` and the normalized name.

### Austin, issued construction permits
- Dataset: https://data.austintexas.gov/d/3syk-w9eu. The dataset's own license reads "Public Domain U.S. Government".
- The City's Terms of Use (https://data.austintexas.gov/stories/s/ranj-cccq and the PDF https://data.austintexas.gov/download/2z87-8uh7/application/pdf) could not be read here: the page renders by script and the PDF carries no usable text. **On hold until Robert records the terms date.** The parser is built and proved on a recorded sample, so the source runs the day the date is recorded.
- Filter: work class Roof; Auxiliary Power whose description names solar or PV; Repair whose description names foundation. Grouped by contractor company, with its phone and address.

### Dallas, building permits
- Dataset: https://www.dallasopendata.com/d/e7gq-4sah. No license on the dataset; the Terms of Use page answered 404. On hold for the open records request.

### Fort Worth, development permits
- Dataset: https://data.fortworthtexas.gov/d/quz7-xnsy, now redirected to an ArcGIS hub whose fields could not be read. The City's Data Disclaimer and Terms of Use of February 15, 2016 (https://mapit.fortworthtexas.gov/disclaimer.pdf) permit use. A third party says the dataset names only the owner, never the contractor. On hold for the open records request.

### Houston
- No permit-level dataset; the Permitting Center posts activity reports by ZIP code. Skipped until the open records request gives a contractor-bearing export.

### Corpus Christi
- Monthly permit history reports in Excel and PDF; fields and terms not read. On hold for the open records request.

### TDLR, electrical contractors
- File: https://www.tdlr.texas.gov/dbproduction2/Lteecele.csv, linked from https://www.tdlr.texas.gov/LicenseSearch/licfile.asp ("The files are updated everyday").
- Terms: https://www.tdlr.texas.gov/disclaimer.htm, undated, read 2026-11-02. The Link Policy, section D: "The information posted on a state agency web site may be copied so long as it is presented in a non-misleading way" and "Use of the information must identify the state agency that is the source of the information". No clause forbids commercial contact.
- Every source row carries the attribution "Source: Texas Department of Licensing and Regulation".
- Filter: every license not past its expiration date. Business name, address, county and phone. Source record id: `license:` and the license number. Vertical other, tagged `electrical_contractor`.

### TDLR, residential solar retailers
- File: https://www.tdlr.texas.gov/dbproduction2/vsResidentialSolarRetailers.csv, confirmed on licfile.asp 2026-11-02. The same TDLR terms and attribution.
- Filter: License Status Current. Licensee, address, county and phone. Source record id: `registration:` and the license number. Vertical solar.

### TDLR, residential solar salespeople
- File: https://www.tdlr.texas.gov/dbproduction2/vsResidentialSolarSalesperson.csv, confirmed on licfile.asp 2026-11-02. The same TDLR terms and attribution.
- Filter: License Status Current. The person's name and county only, so every record is held until a phone is found. Vertical solar, tagged `solar_salesperson`.

### TDHCA, manufactured housing licensees
- Download page: https://mhweb.tdhca.state.tx.us/mhweb/home_prod_summary.jsp. No fields, date or terms shown. On hold until the agency's terms are read.

### TREC, broker and sales agent license holders
- Dataset: https://data.texas.gov/dataset/Broker-and-Sales-Agent-License-Holder-Information/s7ft-44qi, linked from https://www.trec.texas.gov/public/high-value-data-sets ("maintained pursuant to Texas Government Code Section 2054.1265", updated daily). No restriction found.
- Filter: status Active; Broker Company, Broker Individual and Sales Agent. Source record id: `license:` and the license number.
- TREC notes that legislation removed public access to home address, phone and email, so every record is held until a phone is found.

### Google Places, on demand only
- Google Maps Platform Service Specific Terms, section 14, page last modified October 28, 2026, read 2026-11-02 (https://cloud.google.com/maps-platform/terms/maps-service-terms): latitude and longitude may be cached for up to 30 days; Places content may not be used with a non-Google map.
- The firm has no Google Maps Platform key, so the lookup is closed and the import screen says so. When a key is added, the lookup shows its answer to the person and stores nothing; the person records what they confirm by calling.
