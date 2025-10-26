/**
 * WORKING ALGORITHM INTEGRATION
 * This is a working example you can actually use in your app
 */
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Import the algorithms
import { AdaptiveGoalEngine } from '../algorithms/AdaptiveGoalEngine';
import { CompassionateFeedbackEngine } from '../algorithms/CompassionateFeedbackEngine';
import { ContextualPersonalizationEngine } from '../algorithms/ContextualPersonalizationEngine';
import { DataSyncEngine } from '../algorithms/DataSyncEngine';

export const WorkingAlgorithmIntegration = ({ userProfile }) => {
  const [goalEngine, setGoalEngine] = useState(null);
  const [feedbackEngine, setFeedbackEngine] = useState(null);
  const [syncEngine, setSyncEngine] = useState(null);
  const [personalizationEngine, setPersonalizationEngine] = useState(null);
  const [dailyGoal, setDailyGoal] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Initialize engines
  useEffect(() => {
    if (userProfile) {
      try {
        const goal = new AdaptiveGoalEngine(userProfile);
        const feedback = new CompassionateFeedbackEngine();
        const sync = new DataSyncEngine();
        const personalization = new ContextualPersonalizationEngine(userProfile);
        
        setGoalEngine(goal);
        setFeedbackEngine(feedback);
        setSyncEngine(sync);
        setPersonalizationEngine(personalization);
        
        console.log('✅ All algorithm engines initialized successfully');
      } catch (error) {
        console.error('❌ Error initializing algorithms:', error);
      }
    }
  }, [userProfile]);

  // Test adaptive goal generation
  const testAdaptiveGoal = () => {
    if (!goalEngine) return;
    
    try {
      const checkIn = {
        sleepHours: 7,
        stressLevel: 'medium',
        energyLevel: 'medium',
        situation: null
      };
      
      const goal = goalEngine.generateDailyGoal(checkIn);
      setDailyGoal(goal);
      
      Alert.alert(
        'Adaptive Goal Generated!',
        `Today's goal: ${goal.min}-${goal.max} calories\n\n${goal.displayMessage}`,
        [{ text: 'Great!', style: 'default' }]
      );
    } catch (error) {
      console.error('Error generating adaptive goal:', error);
      Alert.alert('Error', 'Failed to generate adaptive goal');
    }
  };

  // Test compassionate feedback
  const testCompassionateFeedback = () => {
    if (!feedbackEngine) return;
    
    try {
      const foodData = {
        name: 'Banana',
        calories: 105,
        protein: 1,
        carbs: 27,
        fat: 0.3,
        fiber: 3,
        micronutrients: { potassium: true, vitaminC: true },
        category: 'fruit'
      };
      
      const feedbackResult = feedbackEngine.generateFoodFeedback(foodData);
      setFeedback(feedbackResult);
      
      Alert.alert(
        'Compassionate Feedback Generated!',
        feedbackResult.message,
        [{ text: 'Amazing!', style: 'default' }]
      );
    } catch (error) {
      console.error('Error generating feedback:', error);
      Alert.alert('Error', 'Failed to generate feedback');
    }
  };

  // Test data sync
  const testDataSync = async () => {
    if (!syncEngine) return;
    
    try {
      const testData = { test: 'data', timestamp: Date.now() };
      syncEngine.autoSave(testData, 'test_key');
      
      const syncStatus = syncEngine.getSyncStatus();
      
      Alert.alert(
        'Data Sync Test',
        `Status: ${syncStatus.message}`,
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error) {
      console.error('Error testing data sync:', error);
      Alert.alert('Error', 'Failed to test data sync');
    }
  };

  // Test personalization
  const testPersonalization = () => {
    if (!personalizationEngine) return;
    
    try {
      const responses = {
        sleep: 7,
        energy: 'Medium',
        stress: 'Low',
        mood: 8,
        situation: ['Normal day']
      };
      
      const context = personalizationEngine.processCheckInResponses(responses);
      
      Alert.alert(
        'Personalization Test',
        `Active Profiles: ${context.activeProfiles.join(', ')}\nInsights: ${context.insights.length}`,
        [{ text: 'Cool!', style: 'default' }]
      );
    } catch (error) {
      console.error('Error testing personalization:', error);
      Alert.alert('Error', 'Failed to test personalization');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Algorithm Integration Test</Text>
        
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            Goal Engine: {goalEngine ? '✅ Ready' : '❌ Not Ready'}
          </Text>
          <Text style={styles.statusText}>
            Feedback Engine: {feedbackEngine ? '✅ Ready' : '❌ Not Ready'}
          </Text>
          <Text style={styles.statusText}>
            Sync Engine: {syncEngine ? '✅ Ready' : '❌ Not Ready'}
          </Text>
          <Text style={styles.statusText}>
            Personalization Engine: {personalizationEngine ? '✅ Ready' : '❌ Not Ready'}
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.testButton} onPress={testAdaptiveGoal}>
            <Text style={styles.buttonText}>Test Adaptive Goals</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={testCompassionateFeedback}>
            <Text style={styles.buttonText}>Test Compassionate Feedback</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={testDataSync}>
            <Text style={styles.buttonText}>Test Data Sync</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={testPersonalization}>
            <Text style={styles.buttonText}>Test Personalization</Text>
          </TouchableOpacity>
        </View>

        {dailyGoal && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>Latest Adaptive Goal:</Text>
            <Text style={styles.resultText}>
              {dailyGoal.min}-{dailyGoal.max} calories
            </Text>
            <Text style={styles.resultSubtext}>{dailyGoal.displayMessage}</Text>
          </View>
        )}

        {feedback && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>Latest Feedback:</Text>
            <Text style={styles.resultText}>{feedback.message}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  statusContainer: {
    backgroundColor: '#F8F9FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 20,
  },
  testButton: {
    backgroundColor: '#7B61FF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0EA5E9',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0EA5E9',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    color: '#0369A1',
    marginBottom: 4,
  },
  resultSubtext: {
    fontSize: 12,
    color: '#0369A1',
  },
});
