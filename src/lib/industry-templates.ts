/* ============================================================================
   Industry templates — one-tap setup for a trade. Each preset composes the
   customization framework: accent theme, quick actions, extra lead stages,
   and trade-specific custom fields. Applying is additive: it never deletes
   the business's existing configuration.
   ============================================================================ */

export type IndustryTemplate = {
  id: string;
  name: string;
  icon: string;
  /** OKLCH accent */
  accentH: number;
  accentC: number;
  quickActions: string[];
  /** appended to lead pipeline after 'contacted' */
  extraLeadStages: { key: string; label: string; color: string }[];
  /** custom fields created (entity + type per field) */
  fields: {
    entity: "client" | "job" | "quote" | "lead";
    key: string;
    label: string;
    fieldType: string;
    options?: { choices?: string[] };
  }[];
};

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    id: "window_cleaning",
    name: "Window Cleaning",
    icon: "window",
    accentH: 237,
    accentC: 0.1,
    quickActions: ["create_quote", "book_job", "collect_payment", "start_route"],
    extraLeadStages: [{ key: "walkthrough", label: "Walkthrough", color: "#0EA5E9" }],
    fields: [
      { entity: "job", key: "window_count", label: "Window Count", fieldType: "number" },
      { entity: "job", key: "stories", label: "Stories", fieldType: "number" },
      { entity: "client", key: "screens", label: "Screens Included", fieldType: "checkbox" },
      { entity: "client", key: "gate_code", label: "Gate Code", fieldType: "text" },
    ],
  },
  {
    id: "pressure_washing",
    name: "Pressure Washing",
    icon: "water_drop",
    accentH: 229,
    accentC: 0.082,
    quickActions: ["create_quote", "book_job", "upload_photos", "collect_payment"],
    extraLeadStages: [],
    fields: [
      { entity: "job", key: "surface_type", label: "Surface Type", fieldType: "select", options: { choices: ["Concrete", "Wood", "Vinyl", "Brick", "Roof"] } },
      { entity: "job", key: "sq_footage", label: "Square Footage", fieldType: "number" },
      { entity: "client", key: "water_source", label: "Water Source On Site", fieldType: "checkbox" },
    ],
  },
  {
    id: "roof_cleaning",
    name: "Roof Cleaning",
    icon: "roofing",
    accentH: 20,
    accentC: 0.11,
    quickActions: ["create_quote", "upload_photos", "book_job", "collect_payment"],
    extraLeadStages: [{ key: "inspection", label: "Inspection", color: "#EA580C" }],
    fields: [
      { entity: "job", key: "roof_pitch", label: "Roof Pitch", fieldType: "select", options: { choices: ["Flat", "Low", "Medium", "Steep"] } },
      { entity: "job", key: "roof_material", label: "Roof Material", fieldType: "select", options: { choices: ["Asphalt", "Tile", "Metal", "Cedar"] } },
    ],
  },
  {
    id: "lawn_care",
    name: "Lawn Care",
    icon: "grass",
    accentH: 155,
    accentC: 0.09,
    quickActions: ["book_job", "start_route", "collect_payment", "add_client"],
    extraLeadStages: [],
    fields: [
      { entity: "client", key: "lawn_size", label: "Lawn Size (sq ft)", fieldType: "number" },
      { entity: "client", key: "pets", label: "Pets in Yard", fieldType: "text" },
      { entity: "client", key: "gate_code", label: "Gate Code", fieldType: "text" },
    ],
  },
  {
    id: "house_cleaning",
    name: "House Cleaning",
    icon: "cleaning_services",
    accentH: 293,
    accentC: 0.1,
    quickActions: ["book_job", "add_client", "collect_payment", "send_message"],
    extraLeadStages: [{ key: "walkthrough", label: "Walkthrough", color: "#8B5CF6" }],
    fields: [
      { entity: "client", key: "bedrooms", label: "Bedrooms", fieldType: "number" },
      { entity: "client", key: "bathrooms", label: "Bathrooms", fieldType: "number" },
      { entity: "client", key: "alarm_instructions", label: "Alarm Instructions", fieldType: "text" },
      { entity: "client", key: "preferred_products", label: "Preferred Products", fieldType: "text" },
    ],
  },
  {
    id: "hvac",
    name: "HVAC",
    icon: "mode_fan",
    accentH: 245,
    accentC: 0.11,
    quickActions: ["book_job", "create_invoice", "collect_payment", "view_schedule"],
    extraLeadStages: [{ key: "diagnostic", label: "Diagnostic", color: "#0EA5E9" }],
    fields: [
      { entity: "client", key: "system_type", label: "System Type", fieldType: "select", options: { choices: ["Central AC", "Heat Pump", "Furnace", "Mini-split", "Boiler"] } },
      { entity: "client", key: "system_age", label: "System Age (years)", fieldType: "number" },
      { entity: "client", key: "filter_size", label: "Filter Size", fieldType: "text" },
    ],
  },
  {
    id: "electrical",
    name: "Electrical",
    icon: "bolt",
    accentH: 70,
    accentC: 0.12,
    quickActions: ["book_job", "create_quote", "create_invoice", "collect_payment"],
    extraLeadStages: [{ key: "estimate_visit", label: "Estimate Visit", color: "#F59E0B" }],
    fields: [
      { entity: "job", key: "panel_type", label: "Panel Type", fieldType: "text" },
      { entity: "job", key: "permit_required", label: "Permit Required", fieldType: "checkbox" },
    ],
  },
  {
    id: "painting",
    name: "Painting",
    icon: "format_paint",
    accentH: 330,
    accentC: 0.1,
    quickActions: ["create_quote", "book_job", "upload_photos", "collect_payment"],
    extraLeadStages: [{ key: "color_consult", label: "Color Consult", color: "#DB2777" }],
    fields: [
      { entity: "quote", key: "interior_exterior", label: "Interior / Exterior", fieldType: "select", options: { choices: ["Interior", "Exterior", "Both"] } },
      { entity: "quote", key: "paint_brand", label: "Paint Brand", fieldType: "text" },
      { entity: "job", key: "colors", label: "Colors / Codes", fieldType: "text" },
    ],
  },
  {
    id: "commercial_cleaning",
    name: "Commercial Cleaning",
    icon: "apartment",
    accentH: 170,
    accentC: 0.1,
    quickActions: ["book_job", "create_invoice", "team_chat", "view_schedule"],
    extraLeadStages: [
      { key: "walkthrough", label: "Walkthrough", color: "#14B8A6" },
      { key: "proposal", label: "Proposal", color: "#8B5CF6" },
    ],
    fields: [
      { entity: "client", key: "building_access", label: "Building Access", fieldType: "text" },
      { entity: "client", key: "sq_footage", label: "Square Footage", fieldType: "number" },
      { entity: "client", key: "service_frequency", label: "Service Frequency", fieldType: "select", options: { choices: ["Nightly", "Weekly", "Bi-weekly", "Monthly"] } },
    ],
  },
  {
    id: "detailing",
    name: "Auto Detailing",
    icon: "directions_car",
    accentH: 45,
    accentC: 0.11,
    quickActions: ["book_job", "collect_payment", "upload_photos", "send_message"],
    extraLeadStages: [],
    fields: [
      { entity: "job", key: "vehicle", label: "Vehicle (Year/Make/Model)", fieldType: "text" },
      { entity: "job", key: "package", label: "Package", fieldType: "select", options: { choices: ["Express", "Full Detail", "Ceramic", "Interior Only"] } },
    ],
  },
];
