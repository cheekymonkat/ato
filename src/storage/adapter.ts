import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StorageAdapter } from './snapshots';

export const localStorageAdapter: StorageAdapter = {
  getItem: key => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};
