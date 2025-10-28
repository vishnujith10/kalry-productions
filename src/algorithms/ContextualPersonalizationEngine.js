/**
 * CONTEXT-AWARE PERSONALIZATION SYSTEM
 * Addresses: One-size-fits-all, lack of life context
 */
export class ContextualPersonalizationEngine {
  constructor(userProfile) {
    this.user = userProfile;
    this.lifeSituationProfiles = this.initializeProfiles();
    this.contextHistory = [];
  }

  initializeProfiles() {
    return {
      sick: {
        name: 'Recovery Mode',
        priority: 'healing',
        adjustments: {
          calorieIncrease: 150,
          proteinIncrease: 10,
          workoutIntensity: 0, // Pause workouts
          streakPause: true,
          hydrationFocus: true
        },
        recommendations: [
          'Prioritize rest and sleep',
          'Focus on hydrating fluids (water, herbal tea, broth)',
          'Protein-rich, easy-to-digest foods',
          'Don\'t worry about calorie goals—focus on recovery'
        ],
        duration: 'until feeling better'
      },
      
      travel: {
        name: 'Travel Mode',
        priority: 'flexibility',
        adjustments: {
          calorieIncrease: 75,
          workoutType: 'bodyweight',
          mealTrackingMode: 'simplified',
          streakFlexibility: true
        },
        recommendations: [
          'Hotel room bodyweight workouts (15-20 min)',
          'Aim for protein at each meal',
          'Stay hydrated (especially on flights)',
          'Walk as much as possible (explore on foot!)'
        ],
        quickLogOptions: [
          'Restaurant meal (balanced plate)',
          'Fast food/convenience',
          'Hotel breakfast',
          'Snacks/airport food'
        ],
        duration: 'duration of trip'
      },
      
      highStress: {
        name: 'Stress Management Mode',
        priority: 'mental health',
        adjustments: {
          calorieIncrease: 100,
          workoutIntensity: 0.7, // 70% of normal
          workoutType: 'stress-relief', // Yoga, walking, swimming
          sleepPriority: true,
          mindfulnessReminders: true
        },
        recommendations: [
          'Gentle movement: yoga, walking, stretching',
          'Stress-reducing activities: meditation, nature, music',
          'Prioritize 7-9 hours sleep',
          'Avoid extreme calorie deficits (increases stress)'
        ],
        stressManagementTools: [
          '5-minute breathing exercise',
          '10-minute guided meditation',
          'Journaling prompt',
          'Gratitude practice'
        ],
        duration: 'until stress level decreases'
      },
      
      period: {
        name: 'Menstrual Cycle Support',
        priority: 'hormone balance',
        adjustments: {
          calorieIncrease: 150,
          ironIncrease: true,
          workoutIntensity: 0.8,
          cravingsTolerance: 'high'
        },
        recommendations: [
          'Iron-rich foods: red meat, spinach, lentils, fortified cereals',
          'Magnesium for cramps: dark chocolate, nuts, seeds',
          'Stay hydrated (reduces bloating)',
          'Lower intensity workouts are fine—listen to your body'
        ],
        foodSuggestions: [
          { food: 'Dark chocolate', reason: 'Magnesium for cramps + satisfies cravings' },
          { food: 'Salmon', reason: 'Omega-3s reduce inflammation' },
          { food: 'Bananas', reason: 'Potassium reduces bloating' },
          { food: 'Ginger tea', reason: 'Eases nausea and cramps' }
        ],
        duration: '3-7 days'
      },
      
      bigEvent: {
        name: 'Special Event Mode',
        priority: 'enjoyment',
        adjustments: {
          calorieTracking: 'optional',
          streakFlexibility: true,
          mindset: 'enjoy the moment'
        },
        recommendations: [
          'Events are for enjoying! No guilt needed.',
          'Aim for balance, not perfection',
          'Stay hydrated (especially if drinking alcohol)',
          'Get back to routine tomorrow—one meal/day doesn\'t define progress'
        ],
        duration: '1 day'
      },
      
      highActivity: {
        name: 'High Activity Mode',
        priority: 'fueling performance',
        adjustments: {
          calorieIncrease: 300,
          carbIncrease: 50,
          proteinIncrease: 20,
          hydrationIncrease: true,
          electrolytes: true
        },
        recommendations: [
          'Fuel before activity: carbs + moderate protein',
          'Recovery after: protein + carbs within 2 hours',
          'Hydrate: add electrolytes for activities >1 hour',
          'Don\'t skimp on food—your body needs energy!'
        ],
        duration: 'day of activity'
      }
    };
  }

  // Daily check-in to assess context
  async conductDailyCheckIn() {
    const questions = [
      {
        id: 'sleep',
        question: 'How many hours did you sleep last night?',
        type: 'number',
        range: [0, 12],
        default: 7
      },
      {
        id: 'sleepQuality',
        question: 'How was your sleep quality?',
        type: 'scale',
        range: [1, 10],
        labels: { 1: 'Terrible', 5: 'Okay', 10: 'Excellent' }
      },
      {
        id: 'energy',
        question: 'What\'s your energy level today?',
        type: 'select',
        options: ['Very Low', 'Low', 'Medium', 'High', 'Very High']
      },
      {
        id: 'stress',
        question: 'How stressed do you feel?',
        type: 'select',
        options: ['Very Low', 'Low', 'Medium', 'High', 'Very High']
      },
      {
        id: 'mood',
        question: 'How\'s your mood today?',
        type: 'scale',
        range: [1, 10],
        labels: { 1: '😔 Low', 5: '😐 Neutral', 10: '😊 Great' }
      },
      {
        id: 'situation',
        question: 'Anything special happening today?',
        type: 'multi-select',
        options: [
          'Normal day',
          'Feeling sick',
          'Traveling',
          'High stress/busy',
          'Period/PMS',
          'Special event/celebration',
          'Extra active day',
          'Working late'
        ]
      },
      {
        id: 'hungerLevel',
        question: 'How hungry are you feeling?',
        type: 'scale',
        range: [1, 10],
        labels: { 1: 'Not hungry', 5: 'Moderately hungry', 10: 'Very hungry' }
      }
    ];

    // In real app, show these questions in UI
    // For now, return structure
    return {
      questions,
      onComplete: (responses) => this.processCheckInResponses(responses)
    };
  }

  processCheckInResponses(responses) {
    const context = {
      date: new Date().toISOString().split('T')[0],
      responses,
      activeProfiles: [],
      adjustments: {},
      recommendations: [],
      insights: []
    };

    // Activate relevant life situation profiles
    const situation = Array.isArray(responses.situation) ? responses.situation : [];
    
    if (situation.includes('Feeling sick')) {
      context.activeProfiles.push('sick');
    }
    if (situation.includes('Traveling')) {
      context.activeProfiles.push('travel');
    }
    if (responses.stress === 'High' || responses.stress === 'Very High') {
      context.activeProfiles.push('highStress');
    }
    if (situation.includes('Period/PMS')) {
      context.activeProfiles.push('period');
    }
    if (situation.includes('Special event/celebration')) {
      context.activeProfiles.push('bigEvent');
    }
    if (situation.includes('Extra active day')) {
      context.activeProfiles.push('highActivity');
    }

    // Generate insights from check-in data
    context.insights = this.generateInsights(responses);

    // Merge adjustments from active profiles
    context.activeProfiles.forEach(profileKey => {
      const profile = this.lifeSituationProfiles[profileKey];
      context.adjustments = this.mergeAdjustments(
        context.adjustments,
        profile.adjustments
      );
      context.recommendations.push(...profile.recommendations);
    });

    // Add insights-based adjustments
    context.adjustments = {
      ...context.adjustments,
      ...this.getInsightAdjustments(responses)
    };

    // Store in history for pattern detection
    this.contextHistory.push(context);

    return context;
  }

  mergeAdjustments(base, additional) {
    const merged = { ...base };
    Object.keys(additional).forEach(key => {
      if (typeof additional[key] === 'number') {
        merged[key] = (merged[key] || 0) + additional[key];
      } else {
        merged[key] = additional[key];
      }
    });
    return merged;
  }

  generateInsights(responses) {
    const insights = [];

    // Sleep + Weight connection
    if (responses.sleep < 7) {
      insights.push({
        type: 'sleep_impact',
        priority: 'high',
        title: 'Sleep affects hunger',
        detail: `You got ${responses.sleep} hours of sleep. Research shows less than 7 hours increases hunger hormones.`,
        action: 'Try to get 7-9 hours tonight',
        icon: '😴'
      });
    }

    // Stress + Eating pattern
    if (responses.stress === 'High' || responses.stress === 'Very High') {
      insights.push({
        type: 'stress_eating',
        priority: 'high',
        title: 'Stress and eating',
        detail: 'High stress can trigger emotional eating and cravings for high-calorie foods.',
        action: 'Try a 5-minute walk or breathing exercise before eating',
        icon: '🧘‍♀️'
      });
    }

    // Energy + Previous day's intake
    if (responses.energy === 'Very Low' || responses.energy === 'Low') {
      const yesterday = this.contextHistory[this.contextHistory.length - 1];
      if (yesterday && yesterday.responses.caloriesLogged < yesterday.responses.calorieTarget * 0.8) {
        insights.push({
          type: 'underfueling',
          priority: 'critical',
          title: 'Low energy may be from undereating',
          detail: 'You logged significantly below your target yesterday. Not eating enough can cause fatigue.',
          action: 'Aim to hit your calorie range today',
          icon: '⚡'
        });
      }
    }

    // Mood + Exercise connection
    if (responses.mood <= 5) {
      insights.push({
        type: 'mood_boost',
        priority: 'medium',
        title: 'Movement can boost mood',
        detail: 'Feeling low? Even 10 minutes of movement releases endorphins—your body\'s natural mood boosters.',
        action: 'Try a short walk or gentle stretching',
        icon: '🏃‍♀️'
      });
    }

    // High hunger + Sleep
    if (responses.hungerLevel >= 7 && responses.sleep < 7) {
      insights.push({
        type: 'hunger_sleep_link',
        priority: 'high',
        title: 'Poor sleep increases hunger',
        detail: 'The combination of high hunger and low sleep is common—sleep deprivation affects hunger hormones.',
        action: 'This is biological, not a lack of willpower. Honor your hunger today.',
        icon: '🍽️'
      });
    }

    return insights;
  }

  getInsightAdjustments(responses) {
    const adjustments = {};

    // Adjust calories based on sleep
    if (responses.sleep < 6) {
      adjustments.sleepCalorieAdjustment = (7 - responses.sleep) * 50;
    } else if (responses.sleep > 9) {
      adjustments.sleepCalorieAdjustment = -30; // Slightly lower if oversleeping
    }

    // Adjust workout intensity based on energy
    const energyMap = {
      'Very Low': 0.4,
      'Low': 0.6,
      'Medium': 1.0,
      'High': 1.1,
      'Very High': 1.2
    };
    adjustments.energyMultiplier = energyMap[responses.energy] || 1.0;

    // Stress-based workout selection
    if (responses.stress === 'High' || responses.stress === 'Very High') {
      adjustments.preferredWorkoutTypes = ['yoga', 'walking', 'swimming', 'stretching'];
      adjustments.avoidWorkoutTypes = ['HIIT', 'heavy_lifting'];
    }

    return adjustments;
  }

  // Generate holistic daily plan
  generateDailyPlan(baseGoals, context) {
    const plan = {
      date: context.date,
      calories: this.adjustCaloriesForContext(baseGoals.calories, context),
      macros: this.adjustMacrosForContext(baseGoals.macros, context),
      workout: this.selectWorkoutForContext(baseGoals.workout, context),
      priorities: this.getDailyPriorities(context),
      recommendations: context.recommendations,
      insights: context.insights,
      mindset: this.getDailyMindset(context),
      activeProfiles: context.activeProfiles.map(key => ({
        name: this.lifeSituationProfiles[key].name,
        priority: this.lifeSituationProfiles[key].priority
      }))
    };

    return plan;
  }

  adjustCaloriesForContext(baseCalories, context) {
    let adjusted = { ...baseCalories };

    // Apply all calorie adjustments
    const totalAdjustment = Object.values(context.adjustments)
      .filter(val => typeof val === 'number')
      .reduce((sum, val) => sum + val, 0);

    adjusted.min += totalAdjustment;
    adjusted.target += totalAdjustment;
    adjusted.max += totalAdjustment;

    return adjusted;
  }

  adjustMacrosForContext(baseMacros, context) {
    const adjusted = { ...baseMacros };

    // Increase protein if sick or high activity
    if (context.activeProfiles.includes('sick')) {
      adjusted.protein += 10;
    }
    if (context.activeProfiles.includes('highActivity')) {
      adjusted.protein += 20;
      adjusted.carbs += 50;
    }

    // Iron focus during period
    if (context.activeProfiles.includes('period')) {
      adjusted.iron = { target: 18, priority: 'high' };
    }

    return adjusted;
  }

  selectWorkoutForContext(baseWorkout, context) {
    // Provide default workout if baseWorkout is undefined
    const defaultWorkout = {
      type: 'general',
      duration: 30,
      intensity: 'medium',
      message: 'Standard workout for today'
    };
    
    const workout = baseWorkout || defaultWorkout;

    // Sick = rest
    if (context.activeProfiles.includes('sick')) {
      return {
        type: 'rest',
        message: 'Your body needs rest to recover. Take the day off!',
        alternative: 'Gentle stretching if you feel up to it'
      };
    }

    // Travel = bodyweight
    if (context.activeProfiles.includes('travel')) {
      return {
        type: 'bodyweight',
        duration: 20,
        exercises: ['push-ups', 'squats', 'lunges', 'planks', 'burpees'],
        message: 'Quick hotel room workout—no equipment needed!'
      };
    }

    // High stress = gentle
    if (context.activeProfiles.includes('highStress')) {
      return {
        type: 'stress-relief',
        options: ['yoga', 'walking', 'swimming', 'stretching'],
        duration: 30,
        message: 'Focus on movement that feels good, not punishing'
      };
    }

    // Adjust intensity based on energy
    const energyMultiplier = context.adjustments.energyMultiplier || 1.0;
    const adjustedWorkout = { ...workout };

    if (energyMultiplier < 0.7) {
      adjustedWorkout.intensity = 'light';
      // Only adjust duration if workout has a duration property
      if (workout && workout.duration) {
        adjustedWorkout.duration = Math.round(workout.duration * 0.7);
      }
      adjustedWorkout.message = 'Low energy day—we\'ve lightened your workout';
    } else if (energyMultiplier > 1.1) {
      adjustedWorkout.intensity = 'high';
      adjustedWorkout.message = 'You\'re feeling energized—let\'s make it count!';
    }

    return adjustedWorkout;
  }

  getDailyPriorities(context) {
    const priorities = [];

    // Sick = recovery
    if (context.activeProfiles.includes('sick')) {
      priorities.push(
        { rank: 1, priority: 'Rest and hydration', icon: '🛌' },
        { rank: 2, priority: 'Protein-rich meals', icon: '🥩' },
        { rank: 3, priority: 'Don\'t stress about goals', icon: '💙' }
      );
      return priorities;
    }

    // High stress = mental health
    if (context.activeProfiles.includes('highStress')) {
      priorities.push(
        { rank: 1, priority: 'Stress management (10 min meditation)', icon: '🧘‍♀️' },
        { rank: 2, priority: 'Get 7-9 hours sleep tonight', icon: '😴' },
        { rank: 3, priority: 'Gentle movement', icon: '🚶‍♀️' }
      );
      return priorities;
    }

    // Normal day
    priorities.push(
      { rank: 1, priority: 'Hit protein goal', icon: '🥩' },
      { rank: 2, priority: 'Stay within calorie range', icon: '📊' },
      { rank: 3, priority: 'Complete workout', icon: '💪' },
      { rank: 4, priority: 'Drink 8 glasses of water', icon: '💧' }
    );

    return priorities;
  }

  getDailyMindset(context) {
    if (context.activeProfiles.includes('sick')) {
      return 'Recovery is progress. Your body is working hard to heal.';
    }
    
    if (context.activeProfiles.includes('bigEvent')) {
      return 'Enjoy the moment! One day of celebration won\'t derail your progress.';
    }
    
    if (context.activeProfiles.includes('highStress')) {
      return 'Be gentle with yourself. Managing stress IS health progress.';
    }
    
    if (context.responses.energy === 'Very Low') {
      return 'Low energy days happen. Do what you can, and that\'s enough.';
    }
    
    return 'Consistency over perfection. Every healthy choice counts!';
  }

  // Pattern detection over time
  detectPatterns() {
    if (this.contextHistory.length < 7) {
      return { message: 'Building your pattern data...' };
    }

    const patterns = [];

    // Sleep pattern
    const avgSleep = this.contextHistory.slice(-7).reduce((sum, day) => 
      sum + day.responses.sleep, 0) / 7;

    if (avgSleep < 7) {
      patterns.push({
        type: 'chronic_sleep_deficit',
        severity: 'high',
        message: `You've averaged ${avgSleep.toFixed(1)} hours of sleep this week.`,
        impact: 'This can significantly affect hunger, energy, and progress.',
        action: 'Consider making sleep a top priority',
        resources: ['Sleep hygiene tips', 'Bedtime routine guide']
      });
    }

    // Stress pattern
    const highStressDays = this.contextHistory.slice(-7).filter(day => 
      day.responses.stress === 'High' || day.responses.stress === 'Very High'
    ).length;

    if (highStressDays >= 5) {
      patterns.push({
        type: 'chronic_stress',
        severity: 'critical',
        message: `You've reported high stress on ${highStressDays} out of 7 days.`,
        impact: 'Chronic stress affects cortisol, which can hinder weight loss and increase cravings.',
        action: 'Consider stress management resources or professional support',
        resources: ['Meditation app recommendations', 'Stress management techniques']
      });
    }

    return { patterns, count: patterns.length };
  }

  // Weekly summary with context
  generateWeeklySummary() {
    const weekData = this.contextHistory.slice(-7);

    const summary = {
      averageCalories: this.calculateAverage(weekData, 'caloriesLogged'),
      averageSleep: this.calculateAverage(weekData, 'sleep'),
      averageStress: this.calculateModeValue(weekData, 'stress'),
      workoutsCompleted: weekData.filter(d => d.workout?.completed).length,
      loggedDays: weekData.filter(d => d.responses.logged).length,
      patterns: this.detectPatterns(),
      topPriority: this.getWeeklyTopPriority(weekData),
      celebration: this.getWeeklyCelebration(weekData),
      recommendations: this.getWeeklyRecommendations(weekData)
    };

    return summary;
  }

  calculateAverage(data, field) {
    const sum = data.reduce((total, day) => total + (day.responses[field] || 0), 0);
    return Math.round((sum / data.length) * 10) / 10;
  }

  calculateModeValue(data, field) {
    const values = data.map(d => d.responses[field]);
    const counts = {};
    values.forEach(val => counts[val] = (counts[val] || 0) + 1);
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  }

  getWeeklyTopPriority(weekData) {
    const patterns = this.detectPatterns();

    if (patterns.patterns.length === 0) {
      return 'Keep up the great work! Focus on consistency.';
    }

    // Prioritize by severity
    const critical = patterns.patterns.find(p => p.severity === 'critical');
    if (critical) return critical.action;

    const high = patterns.patterns.find(p => p.severity === 'high');
    if (high) return high.action;

    return patterns.patterns[0].action;
  }

  getWeeklyCelebration(weekData) {
    const celebrations = [];

    const loggedDays = weekData.filter(d => d.responses.logged).length;
    if (loggedDays >= 6) celebrations.push('7 days of logging! 🎉');
    else if (loggedDays >= 5) celebrations.push('5+ days logged! 📊');

    const workouts = weekData.filter(d => d.workout?.completed).length;
    if (workouts >= 5) celebrations.push('5+ workouts completed! 💪');

    const avgSleep = this.calculateAverage(weekData, 'sleep');
    if (avgSleep >= 7.5) celebrations.push('Great sleep average! 😴');

    if (celebrations.length === 0) {
      return 'You showed up this week—that\'s what matters! 💙';
    }

    return celebrations.join(' ');
  }

  getWeeklyRecommendations(weekData) {
    const recommendations = [];

    const avgSleep = this.calculateAverage(weekData, 'sleep');
    if (avgSleep < 7) {
      recommendations.push({
        priority: 'high',
        text: 'Prioritize sleep this week—aim for 7-9 hours nightly',
        icon: '😴'
      });
    }

    const highStressDays = weekData.filter(d => 
      d.responses.stress === 'High' || d.responses.stress === 'Very High'
    ).length;
    if (highStressDays >= 4) {
      recommendations.push({
        priority: 'high',
        text: 'Add daily stress management—even 5 minutes helps',
        icon: '🧘‍♀️'
      });
    }

    const workouts = weekData.filter(d => d.workout?.completed).length;
    if (workouts < 3) {
      recommendations.push({
        priority: 'medium',
        text: 'Try shorter workouts (15-20 min) if time is tight',
        icon: '⏰'
      });
    }

    return recommendations;
  }
}
