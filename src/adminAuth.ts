const ADMIN_PASSWORD_KEY = 'mrazaky-admin-password';

export const setAdminPassword = (password: string) => {
  localStorage.setItem(ADMIN_PASSWORD_KEY, password);
};

export const getAdminPassword = (): string | null => {
  return localStorage.getItem(ADMIN_PASSWORD_KEY);
};

export const verifyAdminPassword = (password: string): boolean => {
  const stored = getAdminPassword();
  if (!stored) {
    // Při prvním spuštění nastaví uživatel heslo
    return true;
  }
  return stored === password;
};

export const hasAdminPassword = (): boolean => {
  return getAdminPassword() !== null;
};
