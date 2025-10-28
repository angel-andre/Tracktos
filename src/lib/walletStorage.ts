const STORAGE_KEY = 'tracktos_saved_wallets';

export interface SavedWallet {
  address: string;
  label?: string;
  lastUsed: string;
}

export const getSavedWallets = (): SavedWallet[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Error reading saved wallets:', error);
    return [];
  }
};

export const saveWallet = (address: string, label?: string): void => {
  try {
    const wallets = getSavedWallets();
    const existingIndex = wallets.findIndex(w => w.address === address);
    
    if (existingIndex >= 0) {
      // Update existing wallet
      wallets[existingIndex] = {
        ...wallets[existingIndex],
        lastUsed: new Date().toISOString(),
        ...(label && { label })
      };
    } else {
      // Add new wallet
      wallets.unshift({
        address,
        label,
        lastUsed: new Date().toISOString()
      });
    }
    
    // Keep only last 10 wallets
    const limited = wallets.slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
  } catch (error) {
    console.error('Error saving wallet:', error);
  }
};

export const removeWallet = (address: string): void => {
  try {
    const wallets = getSavedWallets();
    const filtered = wallets.filter(w => w.address !== address);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing wallet:', error);
  }
};

