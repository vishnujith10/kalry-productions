import { useState, useEffect } from 'react';
import { Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';

const AVERAGE_STEP_LENGTH = 0.75; // meters
const CALORIES_PER_STEP = 0.04;

export default function useTodaySteps() {
  const [stepsToday, setStepsToday] = useState(0);
  const [isPedometerAvailable, setIsPedometerAvailable] = useState('checking');
  const [baseSteps, setBaseSteps] = useState(0);
  const [liveSteps, setLiveSteps] = useState(0);
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    return today.toDateString();
  });

  useEffect(() => {
    let subscription;
    Pedometer.isAvailableAsync().then(
      result => setIsPedometerAvailable(String(result)),
      error => setIsPedometerAvailable('Could not get isAvailable: ' + error)
    );

    if (Platform.OS === 'android') {
      setStepsToday(0);
      subscription = Pedometer.watchStepCount(result => {
        setStepsToday(result.steps);
      });
    } else {
      const end = new Date();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      Pedometer.getStepCountAsync(start, end).then(
        result => {
          setBaseSteps(result.steps);
          setStepsToday(result.steps);
        },
        error => {
          setBaseSteps(0);
          setStepsToday(0);
        }
      );
      subscription = Pedometer.watchStepCount(result => {
        setLiveSteps(result.steps);
        setStepsToday(baseSteps + result.steps);
      });
    }
    return () => subscription && subscription.remove();
  }, [baseSteps]);

  // Reset steps at midnight
  useEffect(() => {
    const interval = setInterval(() => {
      const todayStr = new Date().toDateString();
      if (todayStr !== currentDate) {
        setCurrentDate(todayStr);
        setStepsToday(0);
        setBaseSteps(0);
        setLiveSteps(0);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [currentDate]);

  const distanceKm = (stepsToday * AVERAGE_STEP_LENGTH) / 1000;
  const calories = stepsToday * CALORIES_PER_STEP;

  return { stepsToday, isPedometerAvailable, distanceKm, calories };
} 