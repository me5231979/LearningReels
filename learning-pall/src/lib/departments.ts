// Canonical list of Vanderbilt departments used for signup + content targeting.
// For content targeting (reels, comms), an empty/null array means "ALL STAFF".
// ALL_STAFF_VALUE is a sentinel used in admin multi-select UI; the server stores
// an empty array when ALL STAFF is selected.

export const ALL_STAFF_VALUE = "__ALL_STAFF__";
export const ALL_STAFF_LABEL = "ALL STAFF";

export const DEPARTMENTS: readonly string[] = [
  "Arts Libraries and Global Engagement",
  "Athletics and Student Recreation",
  "Blair School of Music",
  "Business Services",
  "Child and Family Centers",
  "College of Arts and Science",
  "College of Connected Computing",
  "Communications",
  "Development and Alumni Relations",
  "Divinity School",
  "Enrollment Affairs",
  "Facilities",
  "Faculty Affairs and Professional Education",
  "Finance",
  "General Counsel",
  "Government and Community Relations",
  "Graduate Education",
  "Information Technology",
  "Law School",
  "Office of Investments",
  "Office of Research",
  "Office of the Chancellor",
  "Office of the Provost",
  "Owen Graduate School of Management",
  "Parking Services",
  "Peabody College",
  "People Culture and Belonging",
  "Public Safety",
  "School of Engineering",
  "School of Medicine: Basic Sciences",
  "School of Medicine: Office of Health Sciences Education",
  "School of Nursing",
  "Student Affairs: Dean of Students",
  "Student Affairs: Housing",
  "Undergraduate Education",
  "Vice Chancellor for Administration",
] as const;

export function isValidDepartment(value: string | null | undefined): boolean {
  if (!value) return false;
  return DEPARTMENTS.includes(value);
}

/**
 * Parses a JSON-encoded string of target departments into an array.
 * An empty array (or null/invalid) means "ALL STAFF" — visible to everyone.
 */
export function parseTargetDepartments(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d): d is string => typeof d === "string" && isValidDepartment(d));
  } catch {
    return [];
  }
}

export function serializeTargetDepartments(departments: string[] | null | undefined): string | null {
  if (!departments || departments.length === 0) return null;
  const valid = departments.filter(isValidDepartment);
  if (valid.length === 0) return null;
  return JSON.stringify(valid);
}

/**
 * Returns true if a user in `userDepartment` can see content targeted at `targets`.
 * `targets` is the parsed array (empty = ALL STAFF, visible to everyone including users
 * with no department set).
 */
export function isVisibleToUser(
  targets: string[],
  userDepartment: string | null | undefined,
): boolean {
  if (targets.length === 0) return true; // ALL STAFF
  if (!userDepartment) return false; // Targeted content requires a department
  return targets.includes(userDepartment);
}
