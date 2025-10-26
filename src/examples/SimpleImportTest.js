/**
 * SIMPLE IMPORT TEST
 * Test if all algorithm imports work correctly
 */
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Test individual algorithm imports
const testImports = () => {
  try {
    // Test AdaptiveGoalEngine
    const { AdaptiveGoalEngine } = require('../algorithms/AdaptiveGoalEngine');
    console.log('✅ AdaptiveGoalEngine imported successfully');
    
    // Test CompassionateFeedbackEngine
    const { CompassionateFeedbackEngine } = require('../algorithms/CompassionateFeedbackEngine');
    console.log('✅ CompassionateFeedbackEngine imported successfully');
    
    // Test DataSyncEngine
    const { DataSyncEngine } = require('../algorithms/DataSyncEngine');
    console.log('✅ DataSyncEngine imported successfully');
    
    // Test ContextualPersonalizationEngine
    const { ContextualPersonalizationEngine } = require('../algorithms/ContextualPersonalizationEngine');
    console.log('✅ ContextualPersonalizationEngine imported successfully');
    
    // Test DailyCheckInModal
    const { DailyCheckInModal } = require('../components/DailyCheckInModal');
    console.log('✅ DailyCheckInModal imported successfully');
    
    Alert.alert('Success!', 'All algorithm imports are working correctly!');
    
  } catch (error) {
    console.error('❌ Import error:', error);
    Alert.alert('Error', `Import failed: ${error.message}`);
  }
};

export const SimpleImportTest = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Algorithm Import Test</Text>
      <Text style={styles.subtitle}>Test if all algorithms can be imported</Text>
      
      <TouchableOpacity style={styles.button} onPress={testImports}>
        <Text style={styles.buttonText}>Test Imports</Text>
      </TouchableOpacity>
      
      <Text style={styles.note}>Check console for detailed results</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#7B61FF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
