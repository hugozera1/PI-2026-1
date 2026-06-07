import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Set this to true to use the production Azure backend, or false to use the local development backend
const USE_PRODUCTION_BACKEND = true;
const AZURE_BACKEND_URL = 'https://pi-5-gvfngxh8heavbvat.southafricanorth-01.azurewebsites.net';

let ip = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

try {
  // Pega o IP exato da sua máquina logado pelo Expo (útil se você usar celular físico ou Expo Go no WIFI)
  if (Constants?.expoConfig?.hostUri) {
    ip = Constants.expoConfig.hostUri.split(':')[0];
  } else if (Constants?.manifest?.debuggerHost) {
    ip = Constants.manifest.debuggerHost.split(':')[0];
  } else if (Constants?.experienceUrl) {
    ip = Constants.experienceUrl.split('//')[1].split(':')[0];
  }
} catch (e) {
  console.log('Failed to parse dynamic IP, using fallback', e);
}

const API_URL = USE_PRODUCTION_BACKEND ? AZURE_BACKEND_URL : `http://${ip}:3000`;

export const trackEvent = async (type, payload) => {
  try {
    const userId = await AsyncStorage.getItem('@ab_user_id');
    const version = await AsyncStorage.getItem('@ab_version');

    const eventData = {
      userId,
      version,
      type,
      timestamp: new Date().toISOString(),
      ...payload
    };

    fetch(`${API_URL}/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData)
    }).catch(e => console.log('Failed to send tracking event:', e.message));
  } catch (error) {
    console.log('Error in trackEvent:', error);
  }
};
