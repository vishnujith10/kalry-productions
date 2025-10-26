/**
 * SIMPLE ALGORITHM TEST
 * Test if the algorithm imports work correctly
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// Test imports
try {
  const { KalryAlgorithmManager } = require('../algorithms/KalryAlgorithmManager');
  const { DailyCheckInModal } = require('../components/DailyCheckInModal');
  
  console.log('✅ Algorithm imports successful');
  console.log('KalryAlgorithmManager:', typeof KalryAlgorithmManager);
  console.log('DailyCheckInModal:', typeof DailyCheckInModal);
} catch (error) {
  console.error('❌ Algorithm import error:', error);
}

export const AlgorithmTest = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Algorithm Import Test</Text>
      <Text style={styles.subtext}>Check console for import status</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: '#666',
  },
});
