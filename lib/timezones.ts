/**
 * A curated list of common IANA timezones for the Location form's timezone
 * picker. The full `Intl.supportedValuesOf('timeZone')` list has ~600 entries
 * which makes for a poor UX; this short list covers most dairy-producing
 * regions. Users can paste any valid IANA name into the field if their
 * timezone isn't listed.
 */
export const CommonTimezones: { value: string; label: string }[] = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New_York (Eastern)" },
  { value: "America/Chicago", label: "America/Chicago (Central)" },
  { value: "America/Denver", label: "America/Denver (Mountain)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (Pacific)" },
  { value: "America/Phoenix", label: "America/Phoenix (Arizona)" },
  { value: "America/Toronto", label: "America/Toronto" },
  { value: "America/Mexico_City", label: "America/Mexico_City" },
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo" },
  { value: "America/Argentina/Buenos_Aires", label: "America/Argentina/Buenos_Aires" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Dublin", label: "Europe/Dublin" },
  { value: "Europe/Amsterdam", label: "Europe/Amsterdam" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "Europe/Madrid", label: "Europe/Madrid" },
  { value: "Europe/Rome", label: "Europe/Rome" },
  { value: "Europe/Warsaw", label: "Europe/Warsaw" },
  { value: "Europe/Moscow", label: "Europe/Moscow" },
  { value: "Asia/Karachi", label: "Asia/Karachi" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata" },
  { value: "Asia/Dhaka", label: "Asia/Dhaka" },
  { value: "Asia/Bangkok", label: "Asia/Bangkok" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo" },
  { value: "Asia/Dubai", label: "Asia/Dubai" },
  { value: "Asia/Riyadh", label: "Asia/Riyadh" },
  { value: "Africa/Cairo", label: "Africa/Cairo" },
  { value: "Africa/Johannesburg", label: "Africa/Johannesburg" },
  { value: "Africa/Nairobi", label: "Africa/Nairobi" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
  { value: "Australia/Melbourne", label: "Australia/Melbourne" },
  { value: "Australia/Perth", label: "Australia/Perth" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland" },
];
