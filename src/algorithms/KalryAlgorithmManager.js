/**
 * KALRY ALGORITHM INTEGRATION
 * This file shows how to integrate all four algorithms into Kalry
 */
import { AdaptiveGoalEngine } from './AdaptiveGoalEngine';
import { CompassionateFeedbackEngine } from './CompassionateFeedbackEngine';
import { ContextualPersonalizationEngine } from './ContextualPersonalizationEngine';
import { DataSyncEngine } from './DataSyncEngine';

export class KalryAlgorithmManager {
  constructor(userProfile) {
    this.userProfile = userProfile;
    
    // Initialize all engines
    this.goalEngine = new AdaptiveGoalEngine(userProfile);
    this.feedbackEngine = new CompassionateFeedbackEngine();
    this.syncEngine = new DataSyncEngine();
    this.personalizationEngine = new ContextualPersonalizationEngine(userProfile);
    
    // State management
    this.dailyContext = null;
    this.dailyGoal = null;
    this.dailyPlan = null;
  }

  // DAILY FLOW: Complete morning routine
  async startDailyRoutine() {
    try {
      // Step 1: Check for crash recovery
      const recoveredData = await this.syncEngine.recoverUnsavedData();
      if (recoveredData.length > 0) {
        console.log(`Recovered ${recoveredData.length} unsaved entries`);
        // Show recovery UI to user
        return { type: 'recovery', data: recoveredData };
      }

      // Step 2: Conduct daily check-in
      const checkInQuestions = await this.personalizationEngine.conductDailyCheckIn();
      return { type: 'checkin', questions: checkInQuestions.questions };
      
    } catch (error) {
      console.error('Error starting daily routine:', error);
      return { type: 'error', message: 'Failed to start daily routine' };
    }
  }

  // Process check-in responses and generate daily plan
  async processDailyCheckIn(responses) {
    try {
      console.log('KalryAlgorithmManager: Processing responses:', responses);
      
      // Process check-in responses
      this.dailyContext = this.personalizationEngine.processCheckInResponses(responses);
      console.log('KalryAlgorithmManager: Daily context created:', this.dailyContext);
      
      // Convert responses to format expected by AdaptiveGoalEngine
      const goalEngineInput = this.convertResponsesForGoalEngine(responses);
      console.log('KalryAlgorithmManager: Goal engine input:', goalEngineInput);
      
      // Generate adaptive daily goal using converted responses
      this.dailyGoal = this.goalEngine.generateDailyGoal(goalEngineInput);
      console.log('KalryAlgorithmManager: Daily goal generated:', this.dailyGoal);
      
      // Create personalized daily plan
      this.dailyPlan = this.personalizationEngine.generateDailyPlan(this.dailyGoal, this.dailyContext);
      console.log('KalryAlgorithmManager: Daily plan created:', this.dailyPlan);
      
      // Auto-save the daily plan
      this.syncEngine.autoSave(this.dailyPlan, `daily_plan_${this.dailyContext.date}`);
      
      return {
        success: true,
        dailyGoal: this.dailyGoal,
        dailyPlan: this.dailyPlan,
        context: this.dailyContext
      };
      
    } catch (error) {
      console.error('Error processing check-in:', error);
      return { success: false, error: error.message };
    }
  }

  // Convert DailyCheckInModal responses to AdaptiveGoalEngine format
  convertResponsesForGoalEngine(responses) {
    return {
      sleepHours: responses.sleep || 7,
      stressLevel: this.mapStressLevel(responses.stress),
      energyLevel: this.mapEnergyLevel(responses.energy),
      situation: responses.situation || null
    };
  }

  // Map stress level from DailyCheckInModal to AdaptiveGoalEngine format
  mapStressLevel(stress) {
    const mapping = {
      'Very Low': 'low',
      'Low': 'low', 
      'Medium': 'medium',
      'High': 'high',
      'Very High': 'high'
    };
    return mapping[stress] || 'medium';
  }

  // Map energy level from DailyCheckInModal to AdaptiveGoalEngine format
  mapEnergyLevel(energy) {
    const mapping = {
      'Very Low': 'low',
      'Low': 'low',
      'Medium': 'medium', 
      'High': 'high',
      'Very High': 'high'
    };
    return mapping[energy] || 'medium';
  }

  // FOOD LOGGING: Enhanced with compassionate feedback
  async logFood(foodData) {
    try {
      // Auto-save the food entry
      this.syncEngine.autoSave(foodData, `food_entry_${Date.now()}`);
      
      // Generate compassionate feedback
      const feedback = this.feedbackEngine.generateFoodFeedback(foodData);
      
      // Validate feedback (no banned words)
      const isValid = this.feedbackEngine.validateFeedback(feedback.message);
      if (!isValid) {
        console.warn('Generated feedback contains banned words');
      }
      
      return {
        success: true,
        feedback: feedback,
        foodData: foodData
      };
      
    } catch (error) {
      console.error('Error logging food:', error);
      return { success: false, error: error.message };
    }
  }

  // END OF DAY: Generate compassionate summary
  async generateEndOfDaySummary(actualCalories, loggedMeals) {
    try {
      let feedback = null;
      
      // Generate appropriate feedback based on goal achievement
      if (actualCalories > this.dailyGoal.max) {
        feedback = this.feedbackEngine.generateOverGoalFeedback(
          actualCalories, 
          this.dailyGoal, 
          this.dailyContext
        );
      } else if (actualCalories < this.dailyGoal.min) {
        feedback = this.feedbackEngine.generateUnderGoalFeedback(
          actualCalories, 
          this.dailyGoal
        );
      } else {
        feedback = {
          message: `${actualCalories} calories today. Perfect! You're right in your flexible range! 🎯`,
          tone: 'celebration'
        };
      }
      
      // Calculate streak with forgiveness
      const streakData = this.feedbackEngine.calculateStreakWithForgiveness(
        this.userProfile.history
      );
      
      return {
        success: true,
        feedback: feedback,
        streak: streakData,
        dailyGoal: this.dailyGoal,
        actualCalories: actualCalories,
        goalAchieved: actualCalories >= this.dailyGoal.min && actualCalories <= this.dailyGoal.max
      };
      
    } catch (error) {
      console.error('Error generating end of day summary:', error);
      return { success: false, error: error.message };
    }
  }

  // WEEKLY REVIEW: Generate comprehensive weekly summary
  async generateWeeklyReview() {
    try {
      const weeklySummary = this.personalizationEngine.generateWeeklySummary();
      
      return {
        success: true,
        summary: weeklySummary,
        patterns: weeklySummary.patterns,
        recommendations: weeklySummary.recommendations,
        celebration: weeklySummary.celebration
      };
      
    } catch (error) {
      console.error('Error generating weekly review:', error);
      return { success: false, error: error.message };
    }
  }

  // EXERCISE LOGGING: Enhanced with accurate calorie calculation
  async logExercise(exerciseData, userWeight, duration) {
    try {
      // Calculate accurate exercise calories using METs
      const exerciseCalories = this.syncEngine.calculateExerciseCalories(
        exerciseData, 
        userWeight, 
        duration
      );
      
      // Handle exercise calories in daily goal
      const adjustedGoal = this.syncEngine.handleExerciseCalories(
        this.dailyGoal,
        exerciseCalories,
        this.userProfile.exerciseCaloriePreference || 'maintain_deficit'
      );
      
      // Auto-save exercise data
      this.syncEngine.autoSave({
        ...exerciseData,
        calories: exerciseCalories,
        duration: duration,
        timestamp: Date.now()
      }, `exercise_${Date.now()}`);
      
      return {
        success: true,
        exerciseCalories: exerciseCalories,
        adjustedGoal: adjustedGoal,
        feedback: `Great workout! You burned approximately ${exerciseCalories.calories} calories. ${exerciseCalories.note || ''}`
      };
      
    } catch (error) {
      console.error('Error logging exercise:', error);
      return { success: false, error: error.message };
    }
  }

  // NOTIFICATIONS: Generate compassionate, non-nagging notifications
  generateNotification(type, context = {}) {
    return this.feedbackEngine.generateNotification(type, context);
  }

  // WELCOME BACK: Handle user return after absence
  generateWelcomeBackMessage(daysSinceLastLog) {
    return this.feedbackEngine.generateWelcomeBackMessage(daysSinceLastLog);
  }

  // SYNC STATUS: Check data synchronization status
  getSyncStatus() {
    return this.syncEngine.getSyncStatus();
  }

  // UPDATE USER PROFILE: Refresh all engines with new user data
  updateUserProfile(newProfile) {
    this.userProfile = { ...this.userProfile, ...newProfile };
    
    // Reinitialize engines with updated profile
    this.goalEngine = new AdaptiveGoalEngine(this.userProfile);
    this.personalizationEngine = new ContextualPersonalizationEngine(this.userProfile);
    
    console.log('User profile updated, engines refreshed');
  }

  // GET CURRENT STATE: For debugging and state management
  getCurrentState() {
    return {
      userProfile: this.userProfile,
      dailyContext: this.dailyContext,
      dailyGoal: this.dailyGoal,
      dailyPlan: this.dailyPlan,
      syncStatus: this.getSyncStatus()
    };
  }
}

// USAGE EXAMPLES FOR KALRY INTEGRATION:

// 1. Initialize in your main app component
export const initializeKalryAlgorithms = (userProfile) => {
  return new KalryAlgorithmManager(userProfile);
};

// 2. Daily routine in MainDashboardScreen
export const startDailyRoutine = async (algorithmManager) => {
  const result = await algorithmManager.startDailyRoutine();
  
  if (result.type === 'checkin') {
    // Show daily check-in modal
    return { showCheckIn: true, questions: result.questions };
  } else if (result.type === 'recovery') {
    // Show recovery modal
    return { showRecovery: true, recoveredData: result.data };
  }
  
  return { showCheckIn: false };
};

// 3. Food logging in HomeScreen
export const logFoodWithFeedback = async (algorithmManager, foodData) => {
  const result = await algorithmManager.logFood(foodData);
  
  if (result.success) {
    // Show compassionate feedback
    return {
      success: true,
      message: result.feedback.message,
      tone: result.feedback.tone,
      showCalories: result.feedback.showCalories
    };
  }
  
  return { success: false, error: result.error };
};

// 4. End of day summary
export const generateEndOfDaySummary = async (algorithmManager, actualCalories) => {
  const result = await algorithmManager.generateEndOfDaySummary(actualCalories, []);
  
  if (result.success) {
    return {
      message: result.feedback.message,
      streak: result.streak.message,
      goalAchieved: result.goalAchieved,
      actualCalories: result.actualCalories,
      dailyGoal: result.dailyGoal
    };
  }
  
  return { success: false, error: result.error };
};

// 5. Weekly review in ProgressScreen
export const generateWeeklyReview = async (algorithmManager) => {
  const result = await algorithmManager.generateWeeklyReview();
  
  if (result.success) {
    return {
      celebration: result.summary.celebration,
      patterns: result.summary.patterns,
      recommendations: result.summary.recommendations,
      averageSleep: result.summary.averageSleep,
      averageCalories: result.summary.averageCalories
    };
  }
  
  return { success: false, error: result.error };
};
