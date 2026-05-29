import { Platform, Vibration } from 'react-native';

const pulse = (duration = 10) => {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  Vibration.vibrate(duration);
};

export const hapticTap = () => pulse(8);
export const hapticSuccess = () => pulse(14);
