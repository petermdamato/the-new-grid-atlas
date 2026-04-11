/** US ZIP: 5 digits or ZIP+4 as #####-#### */
export function isValidUsZip(zip: string): boolean {
  const t = zip.trim();
  if (!t) return false;
  return /^\d{5}$/.test(t) || /^\d{5}-\d{4}$/.test(t);
}

export function canSaveNotificationPrefs(zip: string, notify: boolean): boolean {
  if (!notify) return true;
  return isValidUsZip(zip);
}
