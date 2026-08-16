/**
 * The eight coverage regions, and the assignment of all 254 Texas counties.
 *
 * WHY EVERY COUNTY IS IN EXACTLY ONE REGION
 * -----------------------------------------
 * The firm is named for the 254 counties and claims to serve all of them, so the
 * coverage map has to be able to prove it. Every county in Texas appears in
 * exactly one `counties` array below, which makes the claim checkable rather
 * than decorative: scripts/coverage-audit.mjs counts the union, asserts it is
 * 254, and fails on a duplicate or an omission. A map that quietly lost four
 * counties would still look complete on the page.
 *
 * The groupings follow the state's regional council boundaries rather than being
 * drawn by feel, because those are the lines that already organize permitting,
 * emergency management, and procurement in Texas. That is why the Dallas Fort
 * Worth region reaches to the Louisiana line: it carries the North, Northeast,
 * and East Texas councils along with the Metroplex, and the county list says so
 * plainly instead of implying that Longview is a suburb of Dallas.
 *
 * WHAT THE PROSE IS FOR
 * ---------------------
 * Wind, soil, and permitting are the three things that actually change the
 * engineering as you move across this state, and they change a great deal. A
 * slab detail that is correct in Lubbock is wrong in Beaumont. So each region
 * states its own conditions in its own words. There are no county pages and
 * there is no template with the county name substituted in, because that is
 * doorway content and it is worth less than nothing to a reader or a crawler.
 */

export type Region = {
  slug: string;
  /** Short name for the hub, breadcrumbs, and nav. */
  name: string;
  /** The fuller name used as the region page's own description of itself. */
  longName: string;
  h1: string;
  /** Under 58 characters, keyword leading. */
  title: string;
  /** 140 to 155 characters. */
  description: string;
  /** One paragraph for the hub card. */
  summary: string;
  /** The population centers a reader uses to orient themselves. */
  anchors: string[];
  wind: string[];
  soils: string[];
  permitting: string[];
  /** Service slugs that carry the most weight here, most first. */
  emphasis: { slug: string; why: string }[];
  counties: string[];
};

export const regions: Region[] = [
  {
    slug: "coastal-bend",
    name: "Coastal Bend",
    longName: "the Coastal Bend and the Golden Crescent",
    h1: "Engineering Services Across the Texas Coastal Bend",
    title: "Coastal Bend Engineering Services Coverage",
    description:
      "Engineering coverage across the Texas Coastal Bend and Golden Crescent, where windstorm certification, coastal clays, and storm damage set the work.",
    summary:
      "Eighteen counties from the Guadalupe delta to the King Ranch. Seven of them sit inside the windstorm catastrophe area, which makes WPI-8 certification the defining requirement of building here.",
    anchors: ["Corpus Christi", "Victoria", "Rockport", "Port Lavaca", "Kingsville", "Beeville"],
    wind: [
      "Seven Coastal Bend counties, Aransas, Calhoun, Kenedy, Kleberg, Nueces, Refugio, and San Patricio, are inside the catastrophe area designated by the Texas Department of Insurance. Inside that line, construction and reroofing require windstorm inspection and a WPI-8 certificate of compliance before windstorm coverage can be written through the Texas Windstorm Insurance Association. It is the single most consequential regulatory fact about building in this region.",
      "Design wind speeds here are among the highest in the state, and exposure category matters as much as the mapped speed. A structure on open bay frontage at Rockport or Port Aransas is in a materially different wind environment than one three miles inland behind live oak cover, and the roof attachment schedule reflects that difference.",
      "Hurricane Harvey made landfall near Rockport in 2017 and remains the reference event for this region. It reset expectations about opening protection, roof deck attachment, and the difference between a structure built to the windstorm code and one that merely looks the same.",
    ],
    soils: [
      "Away from the barrier islands, the coastal prairie carries clays with meaningful shrink swell potential, and the Victoria and Orelia soils common through Nueces and San Patricio counties move enough seasonally to matter to a slab.",
      "Nearer the bays the picture inverts. Sandy and silty deposits with a shallow water table bring bearing capacity and buoyancy questions rather than expansion questions, and pier foundations in that setting are designed for a very different failure mode.",
      "Salt exposure is a durability problem across the whole region. Concrete cover, reinforcement corrosion, and connector coatings are specified more conservatively within a few miles of open water than they would be inland.",
    ],
    permitting: [
      "Corpus Christi, Victoria, Portland, Rockport, and the incorporated cities operate their own building departments and inspect against the code editions they have adopted. Inside the catastrophe area, the windstorm inspection runs parallel to the city permit rather than replacing it, and both have to be satisfied.",
      "Large parts of these counties are unincorporated and have limited or no building permitting. That does not remove the windstorm requirement, and it does not remove a lender's or an insurer's documentation requirement, which is often what actually drives the engineering on rural coastal property.",
      "Flood elevation regulation is a constant. Much of the developed coast lies in mapped flood zones, and portions of the barrier islands fall under the Coastal Barrier Resources Act, which affects federally backed lending and therefore the certifications a file needs.",
    ],
    emphasis: [
      { slug: "windstorm-wpi-8", why: "Required across the seven seacoast counties in this region." },
      { slug: "roof-inspections", why: "Storm exposure makes roof condition the recurring question for lenders and carriers." },
      { slug: "forensic-engineering", why: "Wind and water damage cause questions follow every named storm." },
      { slug: "repair-specifications", why: "Post storm repair has to be scoped before it can be bid or permitted." },
    ],
    counties: [
      "Aransas", "Bee", "Brooks", "Calhoun", "DeWitt", "Duval", "Goliad", "Gonzales", "Jackson",
      "Jim Wells", "Kenedy", "Kleberg", "Lavaca", "Live Oak", "Nueces", "Refugio", "San Patricio",
      "Victoria",
    ],
  },

  {
    slug: "greater-houston",
    name: "Greater Houston",
    longName: "Greater Houston and Southeast Texas",
    h1: "Engineering Services Across Greater Houston",
    title: "Greater Houston Engineering Services Coverage",
    description:
      "Engineering coverage across Greater Houston and Southeast Texas, where high plasticity clay, subsidence, and coastal windstorm rules govern the work.",
    summary:
      "Sixteen counties from the Brazos bottoms to the Sabine. The highest plasticity clays in Texas, measurable ground subsidence, and a windstorm line that runs through Harris County itself.",
    anchors: ["Houston", "Galveston", "Beaumont", "The Woodlands", "Sugar Land", "Katy"],
    wind: [
      "Five counties in this region, Brazoria, Chambers, Galveston, Jefferson, and Matagorda, sit inside the designated catastrophe area, and so does the part of Harris County east of State Highway 146. That line runs through a working metropolitan county, which is why the windstorm question here is asked address by address rather than county by county.",
      "West of the line, design wind speeds fall steadily inland but remain high enough that roof attachment and opening protection are still the governing details on residential construction. Hurricane Ike in 2008 and Hurricane Harvey in 2017 both demonstrated how far inland roof and envelope damage extends.",
      "Straight line wind from thunderstorm outflow is an underrated peril across the northern counties of this region, and it damages structures that were never designed for anything a hurricane would bring.",
    ],
    soils: [
      "The Beaumont and Lake Charles clay formations under Harris, Fort Bend, Brazoria, Galveston, and the Golden Triangle include some of the most expansive soils in the United States. Plasticity indices in the forties and above are routine, and seasonal movement of an inch or more across a slab is normal behavior rather than a defect.",
      "That single fact shapes almost everything. Post tensioned slabs proportioned to the plasticity index are the standard residential foundation, moisture stability around the perimeter is a maintenance obligation rather than landscaping advice, and mature trees within their drip line of a slab are a recognized cause of differential movement.",
      "Ground subsidence adds a second, slower motion. Groundwater withdrawal has lowered ground surface across parts of Harris, Fort Bend, and Montgomery counties by measurable amounts, and it is regulated by the Harris Galveston Subsidence District and the Fort Bend Subsidence District. Subsidence is regional rather than differential, so it rarely damages a slab directly, but it changes drainage and flood elevations and therefore changes what a site requires.",
    ],
    permitting: [
      "The City of Houston has no zoning but does have a full building code and an active permitting and inspection department, which surprises people who conflate the two. Sealed structural documents are required for the alterations and the new construction the code lists, exactly as in any other large Texas city.",
      "The region contains dozens of incorporated cities, each with its own adopted code editions and local amendments, alongside large unincorporated areas permitted through the counties. A project on the wrong side of a municipal boundary can face a materially different submittal requirement.",
      "Floodplain regulation has tightened substantially since Harvey. Harris County and the City of Houston both raised finished floor elevation requirements and adopted updated rainfall statistics, and those rules now drive foundation and site work on redevelopment throughout the region.",
    ],
    emphasis: [
      { slug: "foundation-inspections", why: "The most expansive soils in the state make foundation performance the standing question." },
      { slug: "windstorm-wpi-8", why: "Required in five counties here and in Harris County east of State Highway 146." },
      { slug: "structural-letters", why: "Dense municipal permitting means alterations routinely need a sealed letter." },
      { slug: "forensic-engineering", why: "Storm, water, and movement damage questions are constant across the region." },
    ],
    counties: [
      "Austin", "Brazoria", "Chambers", "Colorado", "Fort Bend", "Galveston", "Hardin", "Harris",
      "Jefferson", "Liberty", "Matagorda", "Montgomery", "Orange", "Walker", "Waller", "Wharton",
    ],
  },

  {
    slug: "dallas-fort-worth",
    name: "Dallas Fort Worth",
    longName: "Dallas Fort Worth, North Texas, and East Texas",
    h1: "Engineering Services Across Dallas Fort Worth and North Texas",
    title: "Dallas Fort Worth Engineering Services Coverage",
    description:
      "Engineering coverage across Dallas Fort Worth, North Texas, and East Texas, where Blackland Prairie clay and severe hail define most of the work.",
    summary:
      "Sixty five counties, from the Metroplex east to the Louisiana line and north to the Red River. Blackland Prairie clay under the western half, piney woods sands under the eastern, and the most damaging hail in the country over all of it.",
    anchors: ["Dallas", "Fort Worth", "Tyler", "Denton", "Wichita Falls", "Texarkana", "Longview"],
    wind: [
      "There is no coastal windstorm certification requirement anywhere in this region. Wind still governs plenty of design, but it arrives as thunderstorm outflow and tornado rather than as hurricane, and the design wind speeds are correspondingly lower than on the coast.",
      "Hail is the dominant peril and it is not a close contest. The corridor running through the Metroplex and north to the Red River produces some of the highest hail loss totals in the United States, and it is why roof condition is the most commonly asked engineering question in this region.",
      "Tornado exposure is real across the whole area and concentrated in the spring. It affects how a repair specification is written after an event more than it affects routine residential design.",
    ],
    soils: [
      "The Blackland Prairie runs south southwest through Dallas, Collin, Ellis, Hunt, and Navarro counties, and the Houston Black clay under it is a textbook expansive soil with plasticity indices commonly in the thirties and forties. The Eagle Ford and Taylor formations beneath it behave similarly where they are shallow.",
      "West of Fort Bend of the Metroplex the picture changes. Tarrant, Parker, and Palo Pinto counties sit on the Fort Worth Prairie and the Cross Timbers, with shallower soils over limestone and sandstone and, in places, rock close enough to the surface to change a foundation entirely.",
      "The eastern counties are a different problem. The piney woods of the East Texas and Deep East Texas counties carry sandy soils with low plasticity, high groundwater in places, and slopes that introduce erosion and slope stability questions that the Blackland Prairie never raises.",
    ],
    permitting: [
      "The Metroplex is a dense patchwork of municipal building departments, most of them with their own adopted code editions and local amendments. Sealed structural letters and drawings are routinely required for alterations, and the requirement varies noticeably between adjacent cities.",
      "Unincorporated county land across North and East Texas is a very different environment, with limited or no building permitting in many counties. Where the county requires nothing, the requirement usually comes from a lender, an insurer, or a title company instead.",
      "The eastern counties, particularly along the Ark Tex and Deep East Texas corridors, are rural enough that documentation for a loan file is more often the trigger for engineering than a plan review is.",
    ],
    emphasis: [
      { slug: "foundation-inspections", why: "Blackland Prairie clay makes foundation movement the region's recurring question." },
      { slug: "roof-inspections", why: "The most severe hail exposure in the country drives constant roof condition review." },
      { slug: "structural-letters", why: "Dense municipal permitting means most alterations need something sealed." },
      { slug: "residential-light-commercial-design", why: "Sustained construction volume across the Metroplex and its outer counties." },
    ],
    counties: [
      "Anderson", "Angelina", "Archer", "Baylor", "Bowie", "Camp", "Cass", "Cherokee", "Clay",
      "Collin", "Cooke", "Cottle", "Dallas", "Delta", "Denton", "Ellis", "Erath", "Fannin", "Foard",
      "Franklin", "Grayson", "Gregg", "Hardeman", "Harrison", "Henderson", "Hood", "Hopkins",
      "Houston", "Hunt", "Jack", "Jasper", "Johnson", "Kaufman", "Lamar", "Marion", "Montague",
      "Morris", "Nacogdoches", "Navarro", "Newton", "Palo Pinto", "Panola", "Parker", "Polk",
      "Rains", "Red River", "Rockwall", "Rusk", "Sabine", "San Augustine", "San Jacinto", "Shelby",
      "Smith", "Somervell", "Tarrant", "Titus", "Trinity", "Tyler", "Upshur", "Van Zandt", "Wichita",
      "Wilbarger", "Wise", "Wood", "Young",
    ],
  },

  {
    slug: "san-antonio",
    name: "San Antonio",
    longName: "San Antonio and South Central Texas",
    h1: "Engineering Services Across San Antonio and South Central Texas",
    title: "San Antonio Engineering Services Coverage",
    description:
      "Engineering coverage across San Antonio and South Central Texas, where the Balcones Escarpment splits limestone from clay and changes the foundation.",
    summary:
      "Thirteen counties along the Balcones Escarpment. The single most useful fact about engineering here is that the escarpment runs through Bexar County, and the soil on either side of it is not the same soil.",
    anchors: ["San Antonio", "New Braunfels", "Kerrville", "Boerne", "Seguin", "Fredericksburg"],
    wind: [
      "This region is fully inland. There is no windstorm certification requirement, and design wind speeds are moderate by Texas standards, which puts the governing load on gravity and on soil rather than on wind for most residential structures.",
      "Hail and severe thunderstorm wind still reach the region regularly, and the Hill Country counties see damaging downslope wind events that surprise structures designed only to the mapped speed.",
      "Flash flooding is the more distinctive hazard here. The escarpment turns Hill Country rainfall into fast moving water, and site and foundation decisions on stream adjacent property are made with scour and hydrostatic loading in view.",
    ],
    soils: [
      "The Balcones Escarpment divides the region and it divides the engineering with it. North and west of it, in Kendall, Kerr, Bandera, Gillespie, and northern Bexar county, soils are thin over Edwards limestone, rock is often within a few feet of the surface, and the foundation problem is excavation and bearing on irregular rock rather than expansion.",
      "South and east of the escarpment the region sits on Taylor and Del Rio clays and the marls beneath them, with high plasticity and pronounced seasonal movement. Southern and eastern Bexar, Wilson, Guadalupe, Atascosa, Medina, and Frio counties behave much more like the Blackland Prairie than like the Hill Country twenty miles away.",
      "Karst features complicate the limestone side. Voids, solution cavities, and infilled sinkholes are encountered in the Edwards outcrop, and a foundation investigation that assumes uniform rock bearing on that terrain is assuming too much.",
    ],
    permitting: [
      "The City of San Antonio permits within its limits and exercises authority in its extraterritorial jurisdiction, and Bexar County permits in unincorporated areas. New Braunfels, Schertz, Boerne, Seguin, and Kerrville each operate their own departments with their own adopted editions.",
      "The Edwards Aquifer Recharge Zone adds a regulatory layer that exists almost nowhere else in the state. Development over the recharge and contributing zones requires a water pollution abatement plan approved by the Texas Commission on Environmental Quality, and that review runs on its own schedule alongside the building permit.",
      "The Interstate 35 corridor from San Antonio through New Braunfels is among the fastest growing areas in the country, and the jurisdictions along it have been revising their requirements to keep pace. Confirming the adopted code edition at the start of a project is worth more here than in a settled market.",
    ],
    emphasis: [
      { slug: "foundation-inspections", why: "Two very different soil regimes meet inside one metropolitan county." },
      { slug: "residential-light-commercial-design", why: "Sustained construction growth along the Interstate 35 corridor." },
      { slug: "structural-letters", why: "Active municipal permitting across the region's incorporated cities." },
      { slug: "solar-structural-letters", why: "High residential solar adoption across the metropolitan area." },
    ],
    counties: [
      "Atascosa", "Bandera", "Bexar", "Comal", "Frio", "Gillespie", "Guadalupe", "Karnes", "Kendall",
      "Kerr", "McMullen", "Medina", "Wilson",
    ],
  },

  {
    slug: "austin-central-texas",
    name: "Austin and Central Texas",
    longName: "Austin, Central Texas, and the Brazos Valley",
    h1: "Engineering Services Across Austin and Central Texas",
    title: "Austin and Central Texas Engineering Services",
    description:
      "Engineering coverage across Austin, Central Texas, and the Brazos Valley, where Blackland clay, Hill Country rock, and demanding review meet.",
    summary:
      "Thirty counties from the Hill Country through the Blackland Prairie to the Brazos Valley, containing both the most demanding development review process in Texas and counties that require no building permit at all.",
    anchors: ["Austin", "Round Rock", "Waco", "Killeen", "College Station", "San Marcos"],
    wind: [
      "Central Texas is inland and carries no windstorm certification requirement. Design wind speeds are moderate, and for most residential work the wind case governs uplift details rather than the lateral system.",
      "The region sits in an active severe weather corridor. Hail through the Interstate 35 counties and the Waco area is frequent enough to drive a steady volume of roof condition work, and tornado exposure across the Blackland Prairie is well documented.",
      "West of the escarpment, in Burnet, Llano, and Blanco counties, terrain driven wind and flash flooding matter more than the mapped wind speed suggests.",
    ],
    soils: [
      "East of Interstate 35 the region is Blackland Prairie: Houston Black and Austin chalk derived clays with high plasticity and pronounced seasonal movement. Slab design follows the plasticity index, and moisture stability around the perimeter is treated as part of the design rather than as a homeowner's option.",
      "West of the escarpment, through western Travis, Hays, Burnet, and Llano counties, thin soils over Edwards limestone and Llano uplift granite change the problem completely. Rock bearing, excavation cost, and slope stability replace shrink swell as the controlling considerations.",
      "The Brazos Valley counties bring a third condition. Alluvial soils along the Brazos and its tributaries carry variable bearing and a shallow water table, and they can change materially over the length of a single site.",
    ],
    permitting: [
      "The City of Austin operates one of the most demanding development review processes in Texas, with watershed regulations, tree ordinances, and impervious cover limits layered on top of the building code. Timelines there are set by review, not by design, and planning for that is part of doing the work honestly.",
      "Travis, Williamson, and Hays counties, along with Round Rock, Cedar Park, Georgetown, San Marcos, and Pflugerville, each add their own requirements. Waco, Temple, Killeen, Bryan, and College Station operate conventional building departments with more predictable review.",
      "Outside the corridor, many Central Texas counties have minimal or no building permitting in unincorporated areas. In those places the engineering requirement comes from a lender, an insurer, or a subdivision covenant rather than from a plan reviewer.",
    ],
    emphasis: [
      { slug: "residential-light-commercial-design", why: "Sustained construction volume across the Interstate 35 corridor." },
      { slug: "foundation-inspections", why: "Blackland Prairie clay east of the corridor moves seasonally and visibly." },
      { slug: "solar-structural-letters", why: "One of the highest residential solar adoption rates in the state." },
      { slug: "structural-letters", why: "Demanding municipal review makes sealed documentation routine." },
    ],
    counties: [
      "Bastrop", "Bell", "Blanco", "Bosque", "Brazos", "Burleson", "Burnet", "Caldwell", "Coryell",
      "Falls", "Fayette", "Freestone", "Grimes", "Hamilton", "Hays", "Hill", "Lampasas", "Lee",
      "Leon", "Limestone", "Llano", "Madison", "McLennan", "Milam", "Mills", "Robertson", "San Saba",
      "Travis", "Washington", "Williamson",
    ],
  },

  {
    slug: "rio-grande-valley",
    name: "Rio Grande Valley",
    longName: "the Rio Grande Valley and South Texas",
    h1: "Engineering Services Across the Rio Grande Valley",
    title: "Rio Grande Valley Engineering Services Coverage",
    description:
      "Engineering coverage across the Rio Grande Valley and South Texas, where delta clays, a high water table, and a windstorm line all shape the work.",
    summary:
      "Sixteen counties along the river from Brownsville to Del Rio. Two of them are inside the windstorm catastrophe area and the rest are not, which is the distinction that decides what a project here actually needs.",
    anchors: ["McAllen", "Brownsville", "Harlingen", "Laredo", "Edinburg", "Del Rio"],
    wind: [
      "Cameron and Willacy counties are inside the catastrophe area designated by the Texas Department of Insurance, so construction and reroofing there require windstorm inspection and a WPI-8 certificate. Hidalgo County is not inside that line, and neither are Starr, Webb, or any of the counties upriver.",
      "That boundary is the most frequently misunderstood fact in the region. Design wind speeds remain high across Hidalgo and the interior valley, and the structures are built much the same way, but the certification requirement stops at the county line and a project scoped on the wrong assumption loses time.",
      "Hurricane exposure is genuine across the whole lower valley. Hurricane Dolly in 2008 and Hurricane Hanna in 2020 both produced widespread roof and envelope damage well inland of the coast.",
    ],
    soils: [
      "The lower valley sits on Rio Grande delta deposits: interbedded clays, silts, and sands laid down by a shifting river. Bearing conditions can change over short distances on a single site, which is why a boring log matters more here than a soil map does.",
      "Expansive clays through Cameron, Hidalgo, and Willacy counties carry meaningful plasticity, and a shallow water table across much of the delta adds buoyancy and construction dewatering considerations that most of Texas never faces.",
      "Moving upriver the soils change to caliche and shallow rock through Webb, Zapata, and Val Verde counties, where excavation difficulty replaces shrink swell as the governing site condition. Soil salinity in parts of the delta also affects concrete and reinforcement durability.",
    ],
    permitting: [
      "McAllen, Brownsville, Harlingen, Edinburg, Mission, Pharr, Laredo, and Del Rio operate their own building departments. Requirements for sealed documents are conventional, and the code editions in force vary between neighboring cities.",
      "A substantial share of development in this region happens in unincorporated areas, including colonias, and the Model Subdivision Rules that apply to economically distressed areas along the border add platting and infrastructure requirements that are not encountered elsewhere in the state.",
      "Manufactured housing is a large share of the residential stock across the valley, which makes the foundation certification required by federally backed lending one of the most frequently ordered engineering deliverables in the region.",
    ],
    emphasis: [
      { slug: "manufactured-home-foundation-certifications", why: "Manufactured housing is a large share of the residential stock here." },
      { slug: "windstorm-wpi-8", why: "Required in Cameron and Willacy counties." },
      { slug: "foundation-inspections", why: "Delta soils and a shallow water table make foundation performance variable." },
      { slug: "roof-inspections", why: "Tropical exposure keeps roof condition in front of lenders and carriers." },
    ],
    counties: [
      "Cameron", "Dimmit", "Edwards", "Hidalgo", "Jim Hogg", "Kinney", "La Salle", "Maverick",
      "Real", "Starr", "Uvalde", "Val Verde", "Webb", "Willacy", "Zapata", "Zavala",
    ],
  },

  {
    slug: "west-texas",
    name: "West Texas",
    longName: "West Texas, the Permian Basin, and the Trans-Pecos",
    h1: "Engineering Services Across West Texas",
    title: "West Texas Engineering Services Coverage",
    description:
      "Engineering coverage across West Texas, the Permian Basin, and the Trans-Pecos, where collapsible soils and long distances shape how the work is done.",
    summary:
      "Fifty five counties spanning nearly six hundred miles. Low plasticity soils that make foundations simpler, collapsible and gypsum bearing soils that make them harder, and distances that make how a firm is organized matter as much as what it knows.",
    anchors: ["El Paso", "Midland", "Odessa", "San Angelo", "Abilene", "Big Spring"],
    wind: [
      "West Texas carries no windstorm certification requirement and sees very little hurricane influence. Sustained wind and blowing dust are the ordinary condition rather than an event, and open terrain means exposure category C applies far more often than it does in the eastern half of the state.",
      "The Permian Basin and the Concho Valley see significant hail, and the Abilene and Big Spring corridors are struck often enough that roof condition work is a steady requirement.",
      "For the large metal buildings common across this region, wind is usually the governing lateral load, and the connection details at the base and the eave are where that load is resolved.",
    ],
    soils: [
      "Much of West Texas is a relief after the clays of the east. Sandy soils, caliche, and shallow rock produce low plasticity and stable bearing across large areas, and foundations are correspondingly simpler.",
      "The exceptions are the ones worth engineering for. Gypsiferous soils across parts of the Permian Basin and the Trans-Pecos can dissolve under sustained wetting, and collapsible soils, including the alluvial fan deposits around El Paso and the loess derived soils on parts of the plains, can lose volume abruptly when they are first saturated. Both fail on wetting rather than on load, which is why drainage and utility leak control are structural considerations here and not just maintenance.",
      "Localized expansive clays do occur, particularly in the Concho Valley and through the West Central counties around Abilene, and they are easy to miss on a site chosen by regional assumption rather than by boring.",
    ],
    permitting: [
      "El Paso, Midland, Odessa, San Angelo, Abilene, and the larger incorporated cities operate building departments and require sealed documents in the usual circumstances. Outside them, a great many of these counties have no building code adoption and no permitting in unincorporated areas at all.",
      "Where there is no plan reviewer, the requirement comes from somewhere else: a lender, an insurer, a utility interconnection, or a landowner. That is the ordinary situation across much of this region and it changes who the engineering deliverable is addressed to.",
      "Distance is the operational constraint that defines working here. A single county in the Trans-Pecos can be larger than several eastern states, and a firm that cannot get a qualified technician to a site without a full day of travel cannot serve this region on any reasonable schedule.",
    ],
    emphasis: [
      { slug: "manufactured-home-foundation-certifications", why: "Manufactured housing is common across the rural counties." },
      { slug: "solar-structural-letters", why: "The region carries a large share of the state's solar buildout." },
      { slug: "residential-light-commercial-design", why: "Metal buildings and light commercial construction across the basin." },
      { slug: "foundation-inspections", why: "Collapsible and gypsum bearing soils fail on wetting rather than on load." },
    ],
    counties: [
      "Andrews", "Borden", "Brewster", "Brown", "Callahan", "Coke", "Coleman", "Comanche", "Concho",
      "Crane", "Crockett", "Culberson", "Dawson", "Eastland", "Ector", "El Paso", "Fisher", "Gaines",
      "Glasscock", "Haskell", "Howard", "Hudspeth", "Irion", "Jeff Davis", "Jones", "Kent", "Kimble",
      "Knox", "Loving", "Martin", "Mason", "McCulloch", "Menard", "Midland", "Mitchell", "Nolan",
      "Pecos", "Presidio", "Reagan", "Reeves", "Runnels", "Schleicher", "Scurry", "Shackelford",
      "Sterling", "Stephens", "Stonewall", "Sutton", "Taylor", "Terrell", "Throckmorton", "Tom Green",
      "Upton", "Ward", "Winkler",
    ],
  },

  {
    slug: "panhandle",
    name: "Panhandle",
    longName: "the Texas Panhandle and the South Plains",
    h1: "Engineering Services Across the Texas Panhandle",
    title: "Texas Panhandle Engineering Services Coverage",
    description:
      "Engineering coverage across the Texas Panhandle and South Plains, where wind exposure, frost depth, and playa drainage change the design assumptions.",
    summary:
      "Forty one counties on the Llano Estacado and the caprock. The most consistently wind exposed terrain in Texas, the deepest frost penetration in the state, and forty one counties where a lender is more often the reason for an engineer's seal than a building department is.",
    anchors: ["Amarillo", "Lubbock", "Plainview", "Pampa", "Borger", "Levelland"],
    wind: [
      "The high plains are the most consistently wind exposed terrain in Texas. Open, unobstructed fetch means exposure category C is the honest assumption for most sites and category B is the one that has to be justified, and that single choice moves design pressures more than most people expect.",
      "Wind frequently governs the lateral design of the metal buildings, agricultural structures, and light commercial buildings that make up much of the construction here, and uplift at the roof to wall connection is the detail that decides whether a building survives a severe event intact.",
      "Hail is severe and frequent across the South Plains, and the region also sees the state's most significant winter loading, which is a design case that barely registers in the rest of Texas.",
    ],
    soils: [
      "The Llano Estacado carries the Pullman and Sherm clay loams, which have moderate shrink swell potential: enough to matter to a slab, considerably less than the Blackland Prairie or the upper coast. Caliche layers are common and provide good bearing where they are continuous and a nuisance where they are not.",
      "Playa lakes are the distinctive feature of the region. These shallow ephemeral basins collect runoff across the plains, and building near one raises drainage, saturation, and soil moisture questions that the surrounding uniform terrain does not.",
      "Frost depth is the assumption most commonly carried in wrongly from elsewhere in Texas. Footing depths in the northern Panhandle are set for meaningfully deeper frost penetration than anywhere else in the state, and a detail copied from a Dallas plan set is not correct in Dalhart.",
    ],
    permitting: [
      "Amarillo, Lubbock, Plainview, and the larger incorporated cities operate full building departments with conventional requirements for sealed documents. Outside them, most of the forty one counties in this region have little or no building permitting in unincorporated areas.",
      "That makes the engineering deliverable here more often a document for a lender, an insurer, or a loan file than a document for a plan reviewer, and it changes how the letter is written and who it is addressed to.",
      "Manufactured housing is a significant share of the rural residential stock, which makes the HUD foundation certification required by federally backed lending one of the most frequently needed deliverables across the region.",
    ],
    emphasis: [
      { slug: "manufactured-home-foundation-certifications", why: "Manufactured housing is a large share of the rural residential stock." },
      { slug: "roof-inspections", why: "Severe and frequent hail keeps roof condition in front of carriers and lenders." },
      { slug: "residential-light-commercial-design", why: "Metal buildings and agricultural structures where wind governs the design." },
      { slug: "foundation-inspections", why: "Moderate shrink swell soils and the deepest frost depths in Texas." },
    ],
    counties: [
      "Armstrong", "Bailey", "Briscoe", "Carson", "Castro", "Childress", "Cochran", "Collingsworth",
      "Crosby", "Dallam", "Deaf Smith", "Dickens", "Donley", "Floyd", "Garza", "Gray", "Hale",
      "Hall", "Hansford", "Hartley", "Hemphill", "Hockley", "Hutchinson", "King", "Lamb",
      "Lipscomb", "Lubbock", "Lynn", "Moore", "Motley", "Ochiltree", "Oldham", "Parmer", "Potter",
      "Randall", "Roberts", "Sherman", "Swisher", "Terry", "Wheeler", "Yoakum",
    ],
  },
];

export const regionBySlug = (slug: string): Region | undefined =>
  regions.find((r) => r.slug === slug);

/** Every county in Texas, sorted, derived from the regions rather than kept twice. */
export const allCounties: string[] = regions
  .flatMap((r) => r.counties)
  .sort((a, b) => a.localeCompare(b));

/** The county each county belongs to, for the hub's alphabetical index. */
export const regionOfCounty: Record<string, Region> = Object.fromEntries(
  regions.flatMap((r) => r.counties.map((c) => [c, r] as const)),
);
