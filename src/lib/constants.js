export const ZIMBABWE_LOCATIONS = {
  "Harare": {
    suburbs: ["Avondale", "Borrowdale", "Mount Pleasant", "Highlands", "Greendale", "Mabelreign", "Waterfalls", "Glen Norah", "Budiriro", "Hatfield", "Eastlea", "Belvedere", "Arcadia", "Marlborough", "Emerald Hill", "Chisipite", "Greystone Park", "Vainona", "Bluff Hill", "Tynwald", "Glen View", "Mbare", "Epworth", "Ruwa"]
  },
  "Bulawayo": {
    suburbs: ["Hillside", "Suburbs", "Kumalo", "Burnside", "Matsheumhlope", "Morningside", "Waterford", "Riverside", "Luveve", "Nkulumane", "Entumbane", "Pumula", "Emganwini"]
  },
  "Mutare": {
    suburbs: ["Murambi", "Dangamvura", "Sakubva", "Chikanga", "Fairbridge Park", "Palmerston", "Utopia"]
  },
  "Gweru": {
    suburbs: ["Ascot", "Mkoba", "Senga", "Ivene", "Southdowns", "Ridgemont"]
  },
  "Masvingo": {
    suburbs: ["Rhodene", "Target Kopje", "Mucheke", "Rujeko", "Eastvale"]
  },
  "Victoria Falls": {
    suburbs: ["Town Centre", "Chinotimba", "Mkhosana"]
  },
  "Chinhoyi": {
    suburbs: ["Gadzema", "Chikonohono", "Hunyani Hills", "Cold Stream"]
  },
  "Marondera": {
    suburbs: ["Dombotombo", "Cherutombo", "Rudhaka"]
  },
  "Kadoma": {
    suburbs: ["Rimuka", "Waverly", "Eiffel Flats"]
  },
  "Kariba": {
    suburbs: ["Heights", "Mahombekombe", "Nyamhunga"]
  }
};

export const PROVINCES = [
  "Harare", "Bulawayo", "Manicaland", "Mashonaland Central",
  "Mashonaland East", "Mashonaland West", "Masvingo",
  "Matabeleland North", "Matabeleland South", "Midlands"
];

export const PROPERTY_CATEGORIES = [
  // Residential
  { value: "house_sale", label: "House for Sale", group: "Residential" },
  { value: "house_rent", label: "House for Rent", group: "Residential" },
  { value: "apartment_sale", label: "Apartment for Sale", group: "Residential" },
  { value: "apartment_rent", label: "Apartment for Rent", group: "Residential" },
  { value: "townhouse", label: "Townhouse", group: "Residential" },
  { value: "duplex", label: "Duplex", group: "Residential" },
  { value: "cottage", label: "Cottage", group: "Residential" },
  { value: "cluster", label: "Cluster Home", group: "Residential" },
  { value: "bachelor", label: "Bachelor Flat", group: "Residential" },
  { value: "penthouse", label: "Penthouse", group: "Residential" },
  { value: "studio_apartment", label: "Studio Apartment", group: "Residential" },
  { value: "granny_flat", label: "Granny Flat", group: "Residential" },
  { value: "retirement_home", label: "Retirement Home", group: "Residential" },
  { value: "assisted_living", label: "Assisted Living Facility", group: "Residential" },
  { value: "game_lodge_residence", label: "Game Lodge Residence", group: "Residential" },
  { value: "embassy_residence", label: "Embassy / Diplomatic Housing", group: "Residential" },
  // Holiday & Short Stay
  { value: "bnb", label: "B&B", group: "Holiday & Short Stay" },
  { value: "timeshare", label: "Timeshare", group: "Holiday & Short Stay" },
  { value: "resort", label: "Resort", group: "Holiday & Short Stay" },
  { value: "lodge", label: "Lodge", group: "Holiday & Short Stay" },
  { value: "serviced_apartment", label: "Serviced Apartment", group: "Holiday & Short Stay" },
  { value: "chalet", label: "Chalet", group: "Holiday & Short Stay" },
  { value: "safari_camp", label: "Safari Camp", group: "Holiday & Short Stay" },
  { value: "guest_farm", label: "Guest Farm", group: "Holiday & Short Stay" },
  { value: "glamping_site", label: "Glamping Site", group: "Holiday & Short Stay" },
  { value: "treehouse", label: "Treehouse", group: "Holiday & Short Stay" },
  { value: "houseboat", label: "Houseboat", group: "Holiday & Short Stay" },
  { value: "bush_camp", label: "Bush Camp", group: "Holiday & Short Stay" },
  { value: "safari_tent", label: "Safari Tent", group: "Holiday & Short Stay" },
  { value: "backpackers_hostel", label: "Backpackers Hostel", group: "Holiday & Short Stay" },
  { value: "guesthouse", label: "Guesthouse", group: "Holiday & Short Stay" },
  // Student
  { value: "student_room", label: "Student Room", group: "Student" },
  { value: "hostel", label: "Hostel", group: "Student" },
  { value: "student_apartment", label: "Student Apartment", group: "Student" },
  { value: "student_studio", label: "Student Studio", group: "Student" },
  { value: "postgrad_accommodation", label: "Postgraduate Accommodation", group: "Student" },
  { value: "shared_house", label: "Shared Student House", group: "Student" },
  { value: "commuter_room", label: "Commuter Room", group: "Student" },
  // Commercial
  { value: "office", label: "Office Space", group: "Commercial" },
  { value: "retail", label: "Retail Space", group: "Commercial" },
  { value: "warehouse", label: "Warehouse", group: "Commercial" },
  { value: "storage", label: "Storage Unit", group: "Commercial" },
  { value: "parking", label: "Parking Space", group: "Commercial" },
  { value: "factory", label: "Factory", group: "Commercial" },
  { value: "workshop", label: "Workshop", group: "Commercial" },
  { value: "showroom", label: "Showroom", group: "Commercial" },
  { value: "restaurant_space", label: "Restaurant Space", group: "Commercial" },
  { value: "coworking_space", label: "Co-working Space", group: "Commercial" },
  { value: "data_centre", label: "Data Centre", group: "Commercial" },
  { value: "petrol_station", label: "Petrol Station", group: "Commercial" },
  { value: "car_wash_facility", label: "Car Wash Facility", group: "Commercial" },
  { value: "medical_rooms", label: "Medical Consulting Rooms", group: "Commercial" },
  { value: "dental_practice", label: "Dental Practice", group: "Commercial" },
  { value: "veterinary_clinic", label: "Veterinary Clinic", group: "Commercial" },
  { value: "salon_spa", label: "Salon and Spa Space", group: "Commercial" },
  { value: "gym_studio", label: "Gym and Fitness Studio", group: "Commercial" },
  { value: "takeaway_space", label: "Takeaway Space", group: "Commercial" },
  { value: "hotel", label: "Hotel", group: "Commercial" },
  { value: "motel", label: "Motel", group: "Commercial" },
  { value: "guest_house_business", label: "Guest House Business", group: "Commercial" },
  { value: "school_building", label: "School Building", group: "Commercial" },
  { value: "childcare_facility", label: "Childcare Facility", group: "Commercial" },
  { value: "place_of_worship", label: "Place of Worship", group: "Commercial" },
  { value: "embassy_consulate_space", label: "Embassy / Consulate Space", group: "Commercial" },
  // Land & Farms
  { value: "land_sale", label: "Land for Sale", group: "Land & Farms" },
  { value: "farm", label: "Farm", group: "Land & Farms" },
  { value: "agricultural", label: "Agricultural Land", group: "Land & Farms" },
  { value: "game_farm", label: "Game Farm", group: "Land & Farms" },
  { value: "smallholding", label: "Smallholding", group: "Land & Farms" },
  { value: "commercial_plot", label: "Commercial Plot", group: "Land & Farms" },
  { value: "residential_stand", label: "Residential Stand", group: "Land & Farms" },
  { value: "mining_claims", label: "Mining Claims", group: "Land & Farms" },
  { value: "surveyed_stands", label: "Surveyed Stands", group: "Land & Farms" },
  { value: "irrigation_land", label: "Irrigation Scheme Land", group: "Land & Farms" },
  { value: "communal_land", label: "Communal Land", group: "Land & Farms" },
  { value: "resettlement_farm", label: "Resettlement Farm", group: "Land & Farms" },
  { value: "a2_farm", label: "A2 Farm", group: "Land & Farms" },
  { value: "a1_farm", label: "A1 Farm", group: "Land & Farms" },
  { value: "old_commercial_farm", label: "Old Commercial Farm", group: "Land & Farms" },
  // Events
  { value: "venue", label: "Event Venue", group: "Events" },
  { value: "conference", label: "Conference Centre", group: "Events" },
  { value: "wedding_venue", label: "Wedding Venue", group: "Events" },
  { value: "party_venue", label: "Party Venue", group: "Events" },
  { value: "outdoor_venue", label: "Outdoor Venue", group: "Events" },
  { value: "sports_facility", label: "Sports Facility", group: "Events" },
  { value: "stadium", label: "Stadium", group: "Events" },
  { value: "exhibition_space", label: "Exhibition Space", group: "Events" },
  { value: "filming_location", label: "Filming Location", group: "Events" },
  { value: "drive_in_space", label: "Drive-in Space", group: "Events" },
  // Other
  { value: "property_other", label: "Other Property", group: "Other" },
];

export const CAR_CATEGORIES = [
  { value: "cars_sale", label: "Cars for Sale", group: "Cars" },
  { value: "cars_rent", label: "Cars for Rent", group: "Cars" },
  { value: "minibus_kombi", label: "Minibuses & Kombis", group: "Passenger" },
  { value: "motorbike", label: "Motorbikes", group: "2-Wheels" },
  { value: "scooter", label: "Scooters & Mopeds", group: "2-Wheels" },
  { value: "bicycle", label: "Bicycles", group: "2-Wheels" },
  { value: "caravan_trailer", label: "Caravans & Trailers", group: "Utility" },
  { value: "utility", label: "Utility / Bakkies", group: "Utility" },
  { value: "van", label: "Vans & Panel Vans", group: "Utility" },
  { value: "luxury_classic", label: "Luxury & Classic", group: "Premium" },
  { value: "spare_parts", label: "Spare Parts & Accessories", group: "Parts" },
  { value: "tyres_rims", label: "Tyres & Rims", group: "Parts" },
  { value: "truck_lorry", label: "Trucks & Lorries", group: "Commercial" },
  { value: "bus_coach", label: "Buses & Coaches", group: "Passenger" },
  { value: "car_other", label: "Other Vehicle", group: "Other" },
];

export const MACHINERY_CATEGORIES = [
  { value: "heavy_vehicles", label: "Heavy Vehicles" },
  { value: "construction", label: "Construction Equipment" },
  { value: "agricultural", label: "Agricultural Machinery" },
  { value: "mining", label: "Mining Equipment" },
  { value: "material_handling", label: "Material Handling" },
  { value: "generators", label: "Generators" },
  { value: "compaction", label: "Compaction Equipment" },
  { value: "lifting", label: "Lifting Equipment" },
  { value: "surface_prep", label: "Surface Preparation" },
  { value: "welding", label: "Welding & Fabrication" },
  { value: "boats", label: "Boats & Marine" },
  { value: "machinery_other", label: "Other Machinery" },
];

export const LEGAL_PRACTICE_AREAS = [
  { value: "property_conveyancing", label: "Property Conveyancing" },
  { value: "title_search", label: "Title Search & Verification" },
  { value: "sale_agreement_drafting", label: "Sale Agreement Drafting" },
  { value: "property_dispute", label: "Property Dispute Resolution" },
  { value: "estate_planning", label: "Estate Planning & Wills" },
  { value: "company_registration", label: "Company Registration" },
  { value: "contract_review", label: "Contract Review" },
  { value: "tax_clearance", label: "Tax Clearance / ZIMRA" },
  { value: "notary_services", label: "Notary Services" },
];

export const PRACTITIONER_TYPES = [
  { value: "lawyer", label: "Lawyer" },
  { value: "conveyancer", label: "Licensed Conveyancer" },
  { value: "estate_agent_qualified", label: "Qualified Estate Agent" },
  { value: "tax_practitioner", label: "Tax Practitioner" },
  { value: "notary_public", label: "Notary Public" },
];

export const CAR_MAKES = [
  "Abarth", "AC", "Acura", "Agrale", "Alfa Romeo", "Alpina", "Alpine", "Alvis", "AMC",
  "Ariel", "Arrinera", "Ascari", "Aston Martin", "Auburn", "Audi", "Austin", "Austin Healey",
  "Autobianchi", "Avatr", "BAC", "Bajaj", "Bentley", "BMW", "Borgward", "Brilliance",
  "Bristol", "Bugatti", "Buick", "BYD", "Cadillac", "Caterham", "Changan", "Chery",
  "Chevrolet", "Chrysler", "Citroen", "Coda", "Cosworth", "Dacia", "Daewoo", "DAF",
  "Daihatsu", "Daimler", "Datsun", "De Tomaso", "DeLorean", "Dodge", "Dongfeng",
  "Donkervoort", "DS Automobiles", "Eagle", "FAW", "Ferrari", "Fiat", "Fisker", "Ford",
  "Foton", "GAC", "Geely", "Genesis", "GMC", "Gonow", "Gordon Murray", "Great Wall",
  "Haima", "Haval", "Hennessey", "Hillman", "Hino", "Honda", "Hongqi", "Hummer",
  "Hyundai", "Infiniti", "Isuzu", "Iveco", "JAC", "Jaguar", "Jeep", "Jensen", "Kia",
  "Koenigsegg", "Lada", "Lamborghini", "Lancia", "Land Rover", "LDV", "Lexus", "Lincoln",
  "Lotus", "LuAZ", "Lynk and Co", "Mahindra", "Man", "Maserati", "Maybach", "Mazda",
  "McLaren", "Mercedes-Benz", "Mercury", "MG", "Mini", "Mitsubishi", "Morgan", "Morris",
  "Moskvich", "Nio", "Nissan", "Noble", "Oldsmobile", "Opel", "Pagani", "Peugeot",
  "Plymouth", "Pontiac", "Porsche", "Proton", "RAM", "Renault", "Rimac", "Rivian",
  "Rolls-Royce", "Rover", "Saab", "Samsung", "Saturn", "Seat", "Skoda", "Smart",
  "SsangYong", "Studebaker", "Subaru", "Suzuki", "Tata", "Tesla", "Toyota", "Triumph",
  "TVR", "UAZ", "Vauxhall", "Volkswagen", "Volvo", "Wey", "Wuling", "Xpeng",
  "Zastava", "ZAZ", "Zeekr", "Zotye", "Other"
];

export const MACHINERY_MAKES = [
  "Caterpillar", "Komatsu", "John Deere", "Volvo CE", "Hitachi",
  "JCB", "Case CE", "Liebherr", "Doosan", "Hyundai CE",
  "XCMG", "SANY", "Massey Ferguson", "New Holland", "Case IH",
  "Cummins", "Perkins", "Detroit Diesel", "Scania", "Mercedes-Benz Trucks",
  "MAN", "Volvo Trucks", "DAF", "Iveco", "Hino", "Deutz", "Weichai",
  "Yanmar", "Kubota", "Claas", "Fendt", "Deutz-Fahr", "Terex",
  "Atlas Copco", "Ingersoll Rand", "Sullair", "Dynapac", "Wirtgen",
  "Bomag", "Hamm", "Potain", "Manitowoc", "Grove", "Tadano",
  "Liebherr Cranes", "Manitou", "Linde", "Toyota Industries", "Crown",
  "Still", "Jungheinrich", "Other"
];

export const FUEL_TYPES = [
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
  { value: "electric", label: "Electric" },
  { value: "hybrid", label: "Hybrid" },
  { value: "lpg", label: "LPG" },
  { value: "cng", label: "CNG" },
];

export const CONDITIONS = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
  { value: "for_parts", label: "For Parts" },
];

export const TRANSMISSIONS = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
  { value: "cvt", label: "CVT" },
  { value: "semi_auto", label: "Semi-Automatic" },
];

export const COLORS = [
  "White", "Black", "Silver", "Grey", "Red", "Blue", "Green",
  "Brown", "Gold", "Orange", "Maroon", "Beige", "Yellow",
  "Purple", "Pink", "Champagne", "Bronze", "Navy", "Teal", "Burgundy"
];

export const COUNTRY_CODES = [
  { code: "+93", country: "Afghanistan" },
  { code: "+355", country: "Albania" },
  { code: "+213", country: "Algeria" },
  { code: "+376", country: "Andorra" },
  { code: "+244", country: "Angola" },
  { code: "+1268", country: "Antigua and Barbuda" },
  { code: "+54", country: "Argentina" },
  { code: "+374", country: "Armenia" },
  { code: "+61", country: "Australia" },
  { code: "+43", country: "Austria" },
  { code: "+994", country: "Azerbaijan" },
  { code: "+1242", country: "Bahamas" },
  { code: "+973", country: "Bahrain" },
  { code: "+880", country: "Bangladesh" },
  { code: "+1246", country: "Barbados" },
  { code: "+375", country: "Belarus" },
  { code: "+32", country: "Belgium" },
  { code: "+501", country: "Belize" },
  { code: "+229", country: "Benin" },
  { code: "+975", country: "Bhutan" },
  { code: "+591", country: "Bolivia" },
  { code: "+387", country: "Bosnia and Herzegovina" },
  { code: "+55", country: "Brazil" },
  { code: "+673", country: "Brunei" },
  { code: "+359", country: "Bulgaria" },
  { code: "+226", country: "Burkina Faso" },
  { code: "+257", country: "Burundi" },
  { code: "+855", country: "Cambodia" },
  { code: "+237", country: "Cameroon" },
  { code: "+1", country: "Canada" },
  { code: "+238", country: "Cape Verde" },
  { code: "+236", country: "Central African Republic" },
  { code: "+235", country: "Chad" },
  { code: "+56", country: "Chile" },
  { code: "+86", country: "China" },
  { code: "+57", country: "Colombia" },
  { code: "+269", country: "Comoros" },
  { code: "+242", country: "Congo" },
  { code: "+243", country: "Congo DRC" },
  { code: "+506", country: "Costa Rica" },
  { code: "+385", country: "Croatia" },
  { code: "+53", country: "Cuba" },
  { code: "+357", country: "Cyprus" },
  { code: "+420", country: "Czech Republic" },
  { code: "+45", country: "Denmark" },
  { code: "+253", country: "Djibouti" },
  { code: "+1767", country: "Dominica" },
  { code: "+1809", country: "Dominican Republic" },
  { code: "+593", country: "Ecuador" },
  { code: "+20", country: "Egypt" },
  { code: "+503", country: "El Salvador" },
  { code: "+240", country: "Equatorial Guinea" },
  { code: "+291", country: "Eritrea" },
  { code: "+372", country: "Estonia" },
  { code: "+268", country: "Eswatini" },
  { code: "+251", country: "Ethiopia" },
  { code: "+679", country: "Fiji" },
  { code: "+358", country: "Finland" },
  { code: "+33", country: "France" },
  { code: "+241", country: "Gabon" },
  { code: "+220", country: "Gambia" },
  { code: "+995", country: "Georgia" },
  { code: "+49", country: "Germany" },
  { code: "+233", country: "Ghana" },
  { code: "+30", country: "Greece" },
  { code: "+1473", country: "Grenada" },
  { code: "+502", country: "Guatemala" },
  { code: "+224", country: "Guinea" },
  { code: "+245", country: "Guinea-Bissau" },
  { code: "+592", country: "Guyana" },
  { code: "+509", country: "Haiti" },
  { code: "+504", country: "Honduras" },
  { code: "+36", country: "Hungary" },
  { code: "+354", country: "Iceland" },
  { code: "+91", country: "India" },
  { code: "+62", country: "Indonesia" },
  { code: "+98", country: "Iran" },
  { code: "+964", country: "Iraq" },
  { code: "+353", country: "Ireland" },
  { code: "+972", country: "Israel" },
  { code: "+39", country: "Italy" },
  { code: "+225", country: "Ivory Coast" },
  { code: "+1876", country: "Jamaica" },
  { code: "+81", country: "Japan" },
  { code: "+962", country: "Jordan" },
  { code: "+7", country: "Kazakhstan" },
  { code: "+254", country: "Kenya" },
  { code: "+686", country: "Kiribati" },
  { code: "+383", country: "Kosovo" },
  { code: "+965", country: "Kuwait" },
  { code: "+996", country: "Kyrgyzstan" },
  { code: "+856", country: "Laos" },
  { code: "+371", country: "Latvia" },
  { code: "+961", country: "Lebanon" },
  { code: "+266", country: "Lesotho" },
  { code: "+231", country: "Liberia" },
  { code: "+218", country: "Libya" },
  { code: "+423", country: "Liechtenstein" },
  { code: "+370", country: "Lithuania" },
  { code: "+352", country: "Luxembourg" },
  { code: "+261", country: "Madagascar" },
  { code: "+265", country: "Malawi" },
  { code: "+60", country: "Malaysia" },
  { code: "+960", country: "Maldives" },
  { code: "+223", country: "Mali" },
  { code: "+356", country: "Malta" },
  { code: "+692", country: "Marshall Islands" },
  { code: "+222", country: "Mauritania" },
  { code: "+230", country: "Mauritius" },
  { code: "+52", country: "Mexico" },
  { code: "+691", country: "Micronesia" },
  { code: "+373", country: "Moldova" },
  { code: "+377", country: "Monaco" },
  { code: "+976", country: "Mongolia" },
  { code: "+382", country: "Montenegro" },
  { code: "+212", country: "Morocco" },
  { code: "+258", country: "Mozambique" },
  { code: "+95", country: "Myanmar" },
  { code: "+264", country: "Namibia" },
  { code: "+674", country: "Nauru" },
  { code: "+977", country: "Nepal" },
  { code: "+31", country: "Netherlands" },
  { code: "+64", country: "New Zealand" },
  { code: "+505", country: "Nicaragua" },
  { code: "+227", country: "Niger" },
  { code: "+234", country: "Nigeria" },
  { code: "+850", country: "North Korea" },
  { code: "+389", country: "North Macedonia" },
  { code: "+47", country: "Norway" },
  { code: "+968", country: "Oman" },
  { code: "+92", country: "Pakistan" },
  { code: "+680", country: "Palau" },
  { code: "+970", country: "Palestine" },
  { code: "+507", country: "Panama" },
  { code: "+675", country: "Papua New Guinea" },
  { code: "+595", country: "Paraguay" },
  { code: "+51", country: "Peru" },
  { code: "+63", country: "Philippines" },
  { code: "+48", country: "Poland" },
  { code: "+351", country: "Portugal" },
  { code: "+974", country: "Qatar" },
  { code: "+40", country: "Romania" },
  { code: "+7", country: "Russia" },
  { code: "+250", country: "Rwanda" },
  { code: "+1869", country: "Saint Kitts and Nevis" },
  { code: "+1758", country: "Saint Lucia" },
  { code: "+1784", country: "Saint Vincent" },
  { code: "+685", country: "Samoa" },
  { code: "+378", country: "San Marino" },
  { code: "+239", country: "Sao Tome and Principe" },
  { code: "+966", country: "Saudi Arabia" },
  { code: "+221", country: "Senegal" },
  { code: "+381", country: "Serbia" },
  { code: "+248", country: "Seychelles" },
  { code: "+232", country: "Sierra Leone" },
  { code: "+65", country: "Singapore" },
  { code: "+421", country: "Slovakia" },
  { code: "+386", country: "Slovenia" },
  { code: "+677", country: "Solomon Islands" },
  { code: "+252", country: "Somalia" },
  { code: "+27", country: "South Africa" },
  { code: "+82", country: "South Korea" },
  { code: "+211", country: "South Sudan" },
  { code: "+34", country: "Spain" },
  { code: "+94", country: "Sri Lanka" },
  { code: "+249", country: "Sudan" },
  { code: "+597", country: "Suriname" },
  { code: "+46", country: "Sweden" },
  { code: "+41", country: "Switzerland" },
  { code: "+963", country: "Syria" },
  { code: "+886", country: "Taiwan" },
  { code: "+992", country: "Tajikistan" },
  { code: "+255", country: "Tanzania" },
  { code: "+66", country: "Thailand" },
  { code: "+670", country: "Timor-Leste" },
  { code: "+228", country: "Togo" },
  { code: "+676", country: "Tonga" },
  { code: "+1868", country: "Trinidad and Tobago" },
  { code: "+216", country: "Tunisia" },
  { code: "+90", country: "Turkey" },
  { code: "+993", country: "Turkmenistan" },
  { code: "+688", country: "Tuvalu" },
  { code: "+256", country: "Uganda" },
  { code: "+380", country: "Ukraine" },
  { code: "+971", country: "United Arab Emirates" },
  { code: "+44", country: "United Kingdom" },
  { code: "+1", country: "United States" },
  { code: "+598", country: "Uruguay" },
  { code: "+998", country: "Uzbekistan" },
  { code: "+678", country: "Vanuatu" },
  { code: "+39", country: "Vatican" },
  { code: "+58", country: "Venezuela" },
  { code: "+84", country: "Vietnam" },
  { code: "+967", country: "Yemen" },
  { code: "+260", country: "Zambia" },
  { code: "+263", country: "Zimbabwe" },
];

export const DEFAULT_COUNTRY_CODE = { code: "+263", country: "Zimbabwe" };

export const LISTING_NUMBER_PREFIXES = {
  house_sale: "HS", house_rent: "HR", apartment_sale: "AS", apartment_rent: "AR",
  bnb: "BN", townhouse: "TS", serviced_apartment: "SA", commercial_plot: "CS",
  land_sale: "LD", venue: "EV",
  cars_sale: "CSL", cars_rent: "CRL", minibus_kombi: "MBS", motorbike: "MOT",
  caravan_trailer: "CRV", utility: "UTL", van: "VAN", luxury_classic: "LUX",
  heavy_vehicles: "HVY", construction: "CON", agricultural: "AGR", mining: "MIN",
  material_handling: "MAT", generators: "GEN", compaction: "COM",
  lifting: "LFT", surface_prep: "SUR", welding: "WEL",
};

export const generateListingNumber = (category) => {
  const prefix = LISTING_NUMBER_PREFIXES[category] || "LST";
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
};

const LISTING_CODE_PREFIXES = { property: "PR", car: "CAR", machinery: "MAC" };

// Deterministic, stable reference code derived from the listing id (e.g. PR-A1B2)
export const getListingCode = (type, id) => {
  const prefix = LISTING_CODE_PREFIXES[type] || "LST";
  if (!id) return `${prefix}-XXXX`;
  let hash = 0;
  const str = String(id);
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[hash % chars.length];
    hash = Math.floor(hash / chars.length);
  }
  return `${prefix}-${code}`;
};

// Normalize a code/query for forgiving matching: uppercase, strip everything
// except letters & digits (so "pr a1b2", "PR-A1B2", "pra1b2" all match).
export const normalizeCode = (str) => String(str || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// Forgiving match between a user query and a listing's reference code / listing number.
// Tolerates case, spaces, missing hyphens, and a missing prefix.
export const matchesListingCode = (query, type, listing) => {
  const q = normalizeCode(query);
  if (!q) return false;
  const code = normalizeCode(getListingCode(type, listing.id));
  const num = normalizeCode(listing.listing_number);
  // also allow matching without the alpha prefix (e.g. "a1b2" matches "PR-A1B2")
  const codeNoPrefix = code.replace(/^[A-Z]+/, "");
  const numNoPrefix = num.replace(/^[A-Z]+/, "");
  return (
    code.includes(q) ||
    (num && num.includes(q)) ||
    (codeNoPrefix && codeNoPrefix.includes(q)) ||
    (numNoPrefix && numNoPrefix.includes(q))
  );
};

export const formatPrice = (price) => {
  if (!price) return "Price on request";
  return `$${Number(price).toLocaleString()}`;
};

export const getCategoryLabel = (value) => {
  const all = [...PROPERTY_CATEGORIES, ...CAR_CATEGORIES, ...MACHINERY_CATEGORIES];
  const cat = all.find(c => c.value === value);
  return cat ? cat.label : value?.replace(/_/g, " ") || "Unknown";
};

export const getMachineryLabel = (value) => {
  const cat = MACHINERY_CATEGORIES.find(c => c.value === value);
  return cat ? cat.label : value?.replace(/_/g, " ") || "Unknown";
};

export const getTimeAgo = (dateStr) => {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
};
