/**
 * Utility functions for formatting text across the website
 */

/**
 * Format a name with proper capitalization (first letter uppercase, rest lowercase for each word)
 * @param name - The name to format
 * @returns Properly capitalized name
 * @example formatName("JOHN DOE") => "John Doe"
 * @example formatName("jane smith") => "Jane Smith"
 * @example formatName("jOHN dOE") => "John Doe"
 */
export function formatName(name: string | undefined | null): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format name and get first name only
 * @param name - The full name
 * @returns First name with proper capitalization
 */
export function formatFirstName(name: string | undefined | null): string {
  if (!name) return '';
  
  const firstName = name.split(' ')[0];
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}
