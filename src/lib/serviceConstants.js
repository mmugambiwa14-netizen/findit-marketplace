import { Building2, Wrench, Scale, HardHat, Mountain } from "lucide-react";

// Three professional groups, each with sub-categories
export const SERVICE_CATEGORIES = [
  {
    value: "property_developer",
    label: "Property Developer",
    icon: Building2,
    color: "bg-blue-600",
    subcategories: [
      { value: "new_developments", label: "New Development Listings & Marketing" },
      { value: "property_management", label: "Property Management Services" },
      { value: "consultation_advisory", label: "Consultation & Advisory" },
      { value: "custom_build_renovation", label: "Custom Build & Renovation" },
    ],
  },
  {
    value: "mechanic",
    label: "Mechanic",
    icon: Wrench,
    color: "bg-orange-600",
    subcategories: [
      { value: "pre_purchase_inspection", label: "Pre-Purchase Inspections" },
      { value: "maintenance_repair", label: "Maintenance & Repair" },
      { value: "customization_mods", label: "Customization & Modifications" },
      { value: "roadside_assistance", label: "Roadside Assistance" },
    ],
  },
  {
    value: "legal",
    label: "Legal",
    icon: Scale,
    color: "bg-emerald-600",
    subcategories: [
      { value: "property_conveyancing", label: "Property Transfer & Conveyancing" },
      { value: "sale_contract_review", label: "Sale Contract Review" },
      { value: "dispute_resolution", label: "Dispute Resolution" },
      { value: "general_consultation", label: "General Legal Consultation" },
    ],
  },
  {
    value: "construction",
    label: "Construction",
    icon: HardHat,
    color: "bg-amber-600",
    subcategories: [
      { value: "general_contracting", label: "General Contracting & Building" },
      { value: "architectural_design", label: "Architectural Design & Drawings" },
      { value: "structural_engineering", label: "Structural Engineering" },
      { value: "quantity_surveying", label: "Quantity Surveying & Costing" },
      { value: "civil_works", label: "Civil & Earthworks" },
      { value: "roofing", label: "Roofing & Waterproofing" },
      { value: "plumbing", label: "Plumbing & Drainage" },
      { value: "electrical_installation", label: "Electrical Installation" },
      { value: "painting_finishing", label: "Painting & Finishing" },
      { value: "tiling_flooring", label: "Tiling & Flooring" },
      { value: "carpentry_joinery", label: "Carpentry & Joinery" },
      { value: "welding_steelwork", label: "Welding & Steelwork" },
      { value: "borehole_drilling", label: "Borehole Drilling & Pumps" },
      { value: "solar_installation", label: "Solar & Backup Power Installation" },
      { value: "fencing_walling", label: "Fencing, Walling & Gates" },
      { value: "paving_landscaping", label: "Paving & Landscaping" },
      { value: "hvac", label: "HVAC & Air Conditioning" },
      { value: "demolition", label: "Demolition & Site Clearance" },
      { value: "project_management", label: "Construction Project Management" },
      { value: "plant_hire", label: "Plant & Equipment Hire" },
    ],
  },
  {
    value: "geological",
    label: "Geological & Surveying",
    icon: Mountain,
    color: "bg-stone-600",
    subcategories: [
      { value: "land_surveying", label: "Land Surveying & Mapping" },
      { value: "topographical_survey", label: "Topographical Surveys" },
      { value: "geotechnical_investigation", label: "Geotechnical Investigation" },
      { value: "soil_testing", label: "Soil Testing & Analysis" },
      { value: "site_assessment", label: "Site Assessment & Suitability" },
      { value: "mineral_exploration", label: "Mineral Exploration & Prospecting" },
      { value: "mining_consultancy", label: "Mining Consultancy" },
      { value: "hydrogeology", label: "Hydrogeology & Groundwater" },
      { value: "borehole_siting", label: "Borehole Siting & Water Surveys" },
      { value: "geophysical_survey", label: "Geophysical Surveys" },
      { value: "environmental_impact", label: "Environmental Impact Assessment" },
      { value: "rock_aggregate_testing", label: "Rock & Aggregate Testing" },
      { value: "cadastral_survey", label: "Cadastral & Boundary Surveys" },
      { value: "gis_mapping", label: "GIS & Remote Sensing" },
      { value: "geological_consultancy", label: "General Geological Consultancy" },
    ],
  },
];

// Legal services remain in the dormant future architecture, but the approved
// V1 product scope excludes them from every active marketplace surface.
export const V1_SERVICE_CATEGORIES = SERVICE_CATEGORIES.filter((category) => category.value !== "legal");

export const PRICING_TYPES = [
  { value: "fixed", label: "Fixed price" },
  { value: "starting_from", label: "Starting from" },
  { value: "hourly", label: "Per hour" },
  { value: "quote", label: "Contact for quote" },
];

export function getServiceCategory(value) {
  return SERVICE_CATEGORIES.find((c) => c.value === value) || null;
}

export function getServiceCategoryLabel(value) {
  return getServiceCategory(value)?.label || value;
}

export function getSubcategoryLabel(categoryValue, subValue) {
  const cat = getServiceCategory(categoryValue);
  if (!cat) return subValue;
  return cat.subcategories.find((s) => s.value === subValue)?.label || subValue;
}
