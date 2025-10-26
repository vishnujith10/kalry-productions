/**
 * DAILY CHECK-IN ERROR FIX TEST
 * Test the fix for the "Cannot read property 'includes' of undefined" error
 */
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ContextualPersonalizationEngine } from '../algorithms/ContextualPersonalizationEngine';

export const CheckInErrorFixTest = () => {
  const [testResults, setTestResults] = useState([]);

  const testSituationHandling = () => {
    const results = [];
    const engine = new ContextualPersonalizationEngine({
      weight: 70,
      height: 170,
      age: 25,
      gender: 'female',
      activityLevel: 'moderate',
      goal: 'weightLoss'
    });

    // Test 1: Normal array situation
    try {
      const context1 = engine.processCheckInResponses({
        sleep: 7,
        energy: 'Medium',
        stress: 'Low',
        mood: 8,
        situation: ['Normal day', 'Feeling sick']
      });
      results.push('✅ Test 1 (Array situation): PASSED');
    } catch (error) {
      results.push(`❌ Test 1 (Array situation): FAILED - ${error.message}`);
    }

    // Test 2: String situation
    try {
      const context2 = engine.processCheckInResponses({
        sleep: 7,
        energy: 'Medium',
        stress: 'Low',
        mood: 8,
        situation: 'Feeling sick'
      });
      results.push('✅ Test 2 (String situation): PASSED');
    } catch (error) {
      results.push(`❌ Test 2 (String situation): FAILED - ${error.message}`);
    }

    // Test 3: Undefined situation
    try {
      const context3 = engine.processCheckInResponses({
        sleep: 7,
        energy: 'Medium',
        stress: 'Low',
        mood: 8,
        situation: undefined
      });
      results.push('✅ Test 3 (Undefined situation): PASSED');
    } catch (error) {
      results.push(`❌ Test 3 (Undefined situation): FAILED - ${error.message}`);
    }

    // Test 4: Null situation
    try {
      const context4 = engine.processCheckInResponses({
        sleep: 7,
        energy: 'Medium',
        stress: 'Low',
        mood: 8,
        situation: null
      });
      results.push('✅ Test 4 (Null situation): PASSED');
    } catch (error) {
      results.push(`❌ Test 4 (Null situation): FAILED - ${error.message}`);
    }

    setTestResults(results);
    
    const allPassed = results.every(result => result.includes('✅'));
    Alert.alert(
      allPassed ? 'All Tests Passed!' : 'Some Tests Failed',
      results.join('\n'),
      [{ text: 'OK', style: 'default' }]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Daily Check-in Error Fix Test</Text>
      <Text style={styles.subtitle}>
        Test the fix for "Cannot read property 'includes' of undefined" error
      </Text>
      
      <TouchableOpacity style={styles.button} onPress={testSituationHandling}>
        <Text style={styles.buttonText}>Run Error Fix Tests</Text>
      </TouchableOpacity>
      
      {testResults.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Test Results:</Text>
          {testResults.map((result, index) => (
            <Text key={index} style={styles.resultText}>{result}</Text>
          ))}
        </View>
      )}
      
      <Text style={styles.note}>
        This test verifies that the situation field is handled correctly regardless of its format.
      </Text>
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
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    backgroundColor: '#F8F9FF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7B61FF',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  note: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
