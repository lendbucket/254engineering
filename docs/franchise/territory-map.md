# Franchise territory map (FR5)

**Status: a working map for Robert and his franchise attorney. Internal only.** Nothing here is
an offer, and nothing here may be shown to a prospect. FR13 stands: no franchise promises to
anyone before the FDD issues. The minimum population below is Robert's working figure, ruled
2026-11-11; the attorney states the final rule in Item 12.

Robert's instructions for this map, 2026-11-10 (overnight orders, item 2b):

- counties grouped into the existing regions;
- a protected territory is a county or a group of counties;
- a minimum population per territory;
- San Antonio and Corpus Christi are company owned;
- the first territories are Houston, then Frisco, then Fort Worth.

## Where the numbers come from

- **Regions and their counties:** `src/content/regions.ts`, the eight coverage regions the site
  already publishes under /coverage. Every one of the 254 counties sits in exactly one region.
  This was checked by the script that built the tables: 254 counties read, none missing, none in
  two regions.
- **Populations:** U.S. Census Bureau, Population Estimates Program, **Vintage 2025** county
  totals, file `co-est2025-alldata.csv`, column `POPESTIMATE2025`. That is the estimate for
  **July 1, 2025**. Downloaded 2026-11-11 from
  `https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv`.
  All 254 Texas counties matched by name. Texas total across the eight regions: 31,709,821.
- These are Census **estimates**, not the 2030 count. The next vintage (2026) moves every figure
  slightly, so a threshold set close to a county's figure should be read with that in mind.

## The rule this map applies

1. **A protected territory is one county, or a group of counties inside one region.** A group
   never crosses a region line, so a territory never splits the regional pages, the regional
   standards or the regional data the platform already keys on.
2. **Minimum population: 150,000, Robert's working figure, ruled 2026-11-11.** The attorney
   states the final rule in Item 12. At 150,000:
   - 35 counties meet it on their own;
   - the remaining counties of each region form a pool. How many territories each pool can hold
     depends on how the counties are grouped on the map, which this document does not decide.
3. **A county is never split.** Harris, Dallas, Tarrant, Bexar, Travis, Collin and Denton each
   hold more than a million people. **Robert's ruling, 2026-11-11: Harris County is one
   territory for the first franchisee.** Splitting it, by ZIP code, is revisited before a second
   Houston sale.

## Company owned

| Unit | Territory | Population, July 1 2025 | Region |
| --- | --- | --- | --- |
| San Antonio | Bexar County | 2,160,088 | San Antonio |
| Corpus Christi | Nueces County | 352,992 | Coastal Bend |

**Robert's ruling, 2026-11-11: the rest of those two regions, Comal and Guadalupe among them, is
held back with the company units until the first three territories open.** It is not named
company owned, and it is not open.

## First territories, in Robert's order

| Order | Market | Territory as mapped | Population, July 1 2025 | Region |
| --- | --- | --- | --- | --- |
| 1 | Houston | Harris County | 5,045,026 | Greater Houston |
| 2 | Frisco | Collin County | 1,297,179 | Dallas Fort Worth |
| 3 | Fort Worth | Tarrant County | 2,248,466 | Dallas Fort Worth |

**Frisco sits in two counties,** Collin and Denton. **Robert's ruling, 2026-11-11: the Frisco
territory is Collin County alone.** The Denton County part of the city falls outside it, and
Denton County, at 1,069,346, is its own later territory.

## Counties that meet 150,000 on their own (35)

| Region | County | Population, July 1 2025 |
| --- | --- | --- |
| Coastal Bend | Nueces (company owned) | 352,992 |
| Greater Houston | Harris (first territory) | 5,045,026 |
| Greater Houston | Fort Bend | 975,191 |
| Greater Houston | Montgomery | 781,194 |
| Greater Houston | Brazoria | 419,080 |
| Greater Houston | Galveston | 372,207 |
| Greater Houston | Jefferson | 254,321 |
| Dallas Fort Worth | Dallas | 2,661,397 |
| Dallas Fort Worth | Tarrant (third territory) | 2,248,466 |
| Dallas Fort Worth | Collin (second territory) | 1,297,179 |
| Dallas Fort Worth | Denton | 1,069,346 |
| Dallas Fort Worth | Smith | 252,549 |
| Dallas Fort Worth | Ellis | 240,867 |
| Dallas Fort Worth | Johnson | 218,048 |
| Dallas Fort Worth | Kaufman | 209,235 |
| Dallas Fort Worth | Parker | 184,767 |
| Dallas Fort Worth | Grayson | 153,613 |
| San Antonio | Bexar (company owned) | 2,160,088 |
| San Antonio | Comal | 209,166 |
| San Antonio | Guadalupe | 201,111 |
| Austin and Central Texas | Travis | 1,389,670 |
| Austin and Central Texas | Williamson | 752,827 |
| Austin and Central Texas | Bell | 402,248 |
| Austin and Central Texas | Hays | 304,390 |
| Austin and Central Texas | McLennan | 272,020 |
| Austin and Central Texas | Brazos | 249,088 |
| Rio Grande Valley | Hidalgo | 921,549 |
| Rio Grande Valley | Cameron | 433,946 |
| Rio Grande Valley | Webb | 281,224 |
| West Texas | El Paso | 877,858 |
| West Texas | Midland | 187,855 |
| West Texas | Ector | 173,801 |
| West Texas | Taylor | 150,077 |
| Panhandle | Lubbock | 328,906 |
| Panhandle | Randall | 152,351 |

Taylor (150,077) and Randall (152,351) clear the line by less than two percent. A later vintage
could put either below it.

## The pools: counties under 150,000, by region

Each pool is the region's remaining counties. The last column is a ceiling, the pool's population
divided by 150,000 and rounded down. The real number of territories is lower wherever the counties
cannot be grouped into contiguous groups that each reach the line.

| Region | Counties in the pool | Pool population | At most |
| --- | --- | --- | --- |
| Coastal Bend | 17 | 430,694 | 2 |
| Greater Houston | 10 | 611,234 | 4 |
| Dallas Fort Worth | 55 | 2,204,844 | 14 |
| San Antonio | 10 | 359,724 | 2 |
| Austin and Central Texas | 24 | 728,747 | 4 |
| Rio Grande Valley | 13 | 267,040 | 1 |
| West Texas | 51 | 519,751 | 3 |
| Panhandle | 39 | 404,134 | 2 |

**The groups themselves are not drawn here.** Grouping needs county adjacency, and this document
does not compute it. That is a gap for Robert, listed below. The county geometry the site's
coverage map already draws from (`src/content/county-geometry.ts`) is where the adjacency would
come from if he asks for the groups to be drawn.

### Each pool's counties, with populations

- **Coastal Bend (17):** Victoria 92,656; San Patricio 72,053; Jim Wells 38,804; Bee 32,515;
  Kleberg 30,315; Aransas 26,146; Lavaca 20,651; DeWitt 20,309; Gonzales 20,159; Calhoun 19,599;
  Jackson 15,393; Live Oak 11,929; Duval 9,402; Goliad 7,208; Refugio 6,657; Brooks 6,579;
  Kenedy 319.
- **Greater Houston (10):** Liberty 121,364; Orange 86,266; Walker 83,842; Waller 69,858; Hardin
  58,723; Chambers 57,594; Wharton 42,060; Matagorda 36,463; Austin 33,625; Colorado 21,439.
- **Dallas Fort Worth (55):** Rockwall 140,738; Wichita 129,555; Gregg 126,095; Hunt 123,336;
  Bowie 92,696; Henderson 88,595; Angelina 88,154; Wise 83,778; Harrison 71,956; Hood 70,501; Van
  Zandt 66,130; Nacogdoches 66,035; Anderson 59,805; Navarro 57,181; Rusk 54,854; Polk 53,434;
  Cherokee 53,337; Lamar 51,503; Wood 49,688; Cooke 44,461; Upshur 44,410; Erath 43,911; Fannin
  39,265; Hopkins 39,063; Jasper 33,075; Titus 31,563; Palo Pinto 30,791; San Jacinto 29,488; Cass
  28,651; Shelby 24,286; Panola 23,018; Houston 22,316; Montague 21,966; Tyler 20,443; Young
  18,154; Trinity 14,384; Rains 13,542; Camp 13,380; Wilbarger 12,481; Morris 12,133; Newton
  11,954; Red River 11,816; Franklin 10,994; Clay 10,764; Somervell 10,261; Sabine 10,012; Marion
  9,896; Jack 9,563; Archer 9,129; San Augustine 7,722; Delta 5,549; Baylor 3,472; Hardeman 3,292;
  Cottle 1,224; Foard 1,044.
- **San Antonio (10):** Medina 56,881; Wilson 56,139; Kerr 54,037; Atascosa 53,590; Kendall
  53,289; Gillespie 28,527; Bandera 22,876; Frio 18,823; Karnes 15,018; McMullen 544.
- **Austin and Central Texas (24):** Bastrop 118,908; Coryell 85,592; Burnet 57,015; Caldwell
  55,150; Hill 39,503; Washington 38,288; Grimes 34,252; Milam 26,258; Fayette 25,459; Lampasas
  23,657; Llano 23,353; Limestone 22,849; Freestone 20,811; Burleson 20,549; Bosque 18,918; Lee
  18,729; Falls 17,869; Robertson 17,839; Leon 16,894; Madison 14,226; Blanco 13,581; Hamilton
  8,680; San Saba 5,787; Mills 4,580.
- **Rio Grande Valley (13):** Starr 66,319; Maverick 58,823; Val Verde 47,835; Uvalde 24,963;
  Willacy 19,971; Zapata 13,753; Zavala 9,037; Dimmit 8,024; La Salle 6,517; Jim Hogg 4,555; Kinney
  3,128; Real 2,745; Edwards 1,370.
- **West Texas (51):** Tom Green 120,602; Brown 38,711; Howard 30,504; Gaines 23,956; Jones 20,861; Andrews 18,914;
  Eastland 18,143; Scurry 16,162; Pecos 14,560; Callahan 14,491; Comanche 14,432; Nolan 14,117;
  Reeves 12,138; Dawson 11,776; Ward 11,125; Runnels 9,693; Brewster 9,458; Stephens 9,380;
  Mitchell 8,947; Coleman 7,915; Winkler 7,540; McCulloch 7,472; Haskell 5,499; Presidio 5,433;
  Martin 5,284; Crane 4,554; Kimble 4,438; Mason 3,990; Fisher 3,692; Concho 3,607; Hudspeth 3,433;
  Coke 3,412; Sutton 3,203; Shackelford 3,197; Knox 3,192; Reagan 3,166; Upton 3,131; Crockett
  2,769; Culberson 2,267; Schleicher 2,245; Menard 1,956; Jeff Davis 1,711; Throckmorton 1,554;
  Irion 1,463; Sterling 1,349; Stonewall 1,186; Glasscock 1,128; Terrell 702; Kent 674; Borden
  567; Loving 52.
- **Panhandle (39):** Potter 114,453; Hale 31,819; Moore 21,891; Hockley 21,600; Gray 20,919; Hutchinson 19,633;
  Deaf Smith 18,626; Lamb 12,579; Terry 11,720; Parmer 9,678; Ochiltree 9,284; Dallam 7,508;
  Yoakum 7,438; Castro 7,295; Bailey 6,963; Swisher 6,703; Childress 6,643; Lynn 6,017; Carson
  5,805; Hansford 4,944; Hartley 4,904; Floyd 4,881; Crosby 4,852; Wheeler 4,773; Garza 4,510;
  Donley 3,213; Hemphill 3,083; Lipscomb 2,955; Sherman 2,781; Hall 2,737; Cochran 2,546;
  Collingsworth 2,487; Armstrong 1,843; Oldham 1,783; Dickens 1,692; Briscoe 1,474; Motley 1,043;
  Roberts 867; King 192.

## Region totals, July 1 2025

| Region | Counties | Population |
| --- | --- | --- |
| Dallas Fort Worth | 65 | 10,740,311 |
| Greater Houston | 16 | 8,458,253 |
| Austin and Central Texas | 30 | 4,098,990 |
| San Antonio | 13 | 2,930,089 |
| West Texas | 55 | 1,909,342 |
| Rio Grande Valley | 16 | 1,903,759 |
| Panhandle | 41 | 885,391 |
| Coastal Bend | 18 | 783,686 |

## Robert's rulings of 2026-11-11

His answers 4 to 7 on issue #1, each as recommended:

1. **Minimum population: 150,000**, as the working figure. The attorney sets the final rule in
   Item 12.
2. **Harris County is one territory** for the first franchisee. Splitting it by ZIP code is
   revisited before a second Houston sale.
3. **The rest of the San Antonio and Coastal Bend regions is held back** with the company units
   until the first three territories open.
4. **Frisco is Collin County alone.**

## Gaps for Robert

Each is something this repository does not hold, so the map does not invent it.

1. **The county groups for each pool,** which need adjacency drawn on the map.
2. **Owner-occupied households or another measure** in place of, or beside, population, if the
   attorney prefers one.

## How the tables were produced

A script joined `src/content/regions.ts` to the Census file above by county name, with no
manual figures. Its own checks: 254 Census counties for Texas, 254 counties across the regions,
none missing, none in two regions, none outside every region. The script lives in the session's
scratchpad and is not part of the repository. Re-running it on a later vintage changes only the
population column.
