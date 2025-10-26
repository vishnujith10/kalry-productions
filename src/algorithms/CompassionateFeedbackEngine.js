/**
 * COMPASSIONATE FEEDBACK SYSTEM
 * Addresses: Shame, demotivation, judgment
 */
export class CompassionateFeedbackEngine {
  constructor() {
    // Tone profiles based on Google's wellness design principles
    this.tones = {
      celebration: {
        voice: 'energetic',
        emojis: true,
        examples: ['Amazing!', 'You\'re crushing it!', 'Incredible work!']
      },
      encouragement: {
        voice: 'warm',
        emojis: true,
        examples: ['Keep going!', 'You\'re doing great!', 'Every step counts!']
      },
      supportive: {
        voice: 'calm',
        emojis: false,
        examples: ['We\'re here for you', 'Take it one day at a time', 'Progress, not perfection']
      },
      educational: {
        voice: 'clear',
        emojis: false,
        examples: ['Here\'s why...', 'Research shows...', 'This is how...']
      }
    };

    // Words to NEVER use
    this.bannedWords = [
      'fail', 'failed', 'failure',
      'bad', 'wrong', 'mistake',
      'warning', 'danger', 'penalty',
      'cheat', 'cheating', 'cheat day',
      'unhealthy', 'junk',
      'punish', 'punishment',
      'guilt', 'guilty'
    ];
  }

  // Replace judgment with education for foods
  generateFoodFeedback(food) {
    const { name, calories, protein, carbs, fat, fiber, micronutrients } = food;
    
    // Focus on nutritional BENEFITS, not warnings
    const benefits = [];

    if (protein > 15) benefits.push(`${protein}g protein for muscle support`);
    if (fiber > 5) benefits.push(`${fiber}g fiber for digestion and fullness`);
    if (micronutrients?.iron) benefits.push('good source of iron');
    if (micronutrients?.potassium) benefits.push('potassium for heart health');
    if (micronutrients?.vitaminC) benefits.push('vitamin C for immune function');
    
    // Even "unhealthy" foods get positive framing
    if (benefits.length === 0) {
      if (food.category === 'treat') {
        return {
          message: `${name} logged. Enjoying treats is part of a balanced life! 🍰`,
          tone: 'supportive',
          educationalNote: 'Balance over time matters more than perfection in one meal.'
        };
      }
      
      // Find something positive about ANY food
      if (carbs > 20) {
        benefits.push('quick energy from carbohydrates');
      }
      if (fat > 10) {
        benefits.push('healthy fats for hormone production');
      }
    }
    
    return {
      message: `${name} logged! ${benefits.length > 0 ? benefits.join(', ') + '.' : ''}`,
      tone: 'neutral',
      calories: calories,
      showCalories: true // Display info, don't judge
    };
  }

  // Forgiving streak system
  calculateStreakWithForgiveness(history) {
    let currentStreak = 0;
    let longestStreak = 0;
    let freezesUsed = 0;
    const maxFreezes = 3; // Per month
    
    let tempStreak = 0;
    let consecutiveMisses = 0;
    
    for (let i = history.length - 1; i >= 0; i--) {
      const day = history[i];
      
      if (day.logged) {
        tempStreak++;
        consecutiveMisses = 0;
      } else {
        consecutiveMisses++;
        
        // Grace period: 1 missed day doesn't break streak
        if (consecutiveMisses === 1 && tempStreak > 0) {
          // Streak continues with a "freeze"
          if (freezesUsed < maxFreezes) {
            freezesUsed++;
            tempStreak++; // Maintain streak
          } else {
            // No freezes left, streak breaks
            break;
          }
        } else if (consecutiveMisses >= 2) {
          // 2+ consecutive misses = streak ends
          break;
        }
      }
      
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    }
    
    currentStreak = tempStreak;
    
    // Alternative: Weekly consistency (less punishing)
    const last7Days = history.slice(-7);
    const loggedLast7 = last7Days.filter(d => d.logged).length;
    const weeklyConsistency = (loggedLast7 / 7) * 100;
    
    return {
      currentStreak,
      longestStreak,
      freezesRemaining: maxFreezes - freezesUsed,
      weeklyConsistency: Math.round(weeklyConsistency),
      message: this.getStreakMessage(currentStreak, weeklyConsistency, freezesUsed)
    };
  }

  getStreakMessage(streak, weeklyConsistency, freezesUsed) {
    // Celebrate milestones
    if (streak === 7) return "One week streak! 🎉 You're building momentum!";
    if (streak === 30) return "30 days! 🔥 This is becoming a habit!";
    if (streak === 90) return "90 days! 🏆 You're a consistency champion!";
    
    // Focus on weekly consistency if daily streak is low
    if (streak < 3 && weeklyConsistency >= 70) {
      return `You logged ${Math.round(weeklyConsistency / 100 * 7)} out of 7 days this week. That's consistency! 📊`;
    }
    
    // Encourage without shaming
    if (streak === 0) {
      return "Every journey starts with a single step. Let's log today! 🌟";
    }
    
    // Standard streak message
    return `${streak} day streak! Keep it going! ${freezesUsed > 0 ? `(${3 - freezesUsed} freezes left)` : ''} 🔥`;
  }

  // Return-after-absence messaging (no shame)
  generateWelcomeBackMessage(daysSinceLastLog) {
    if (daysSinceLastLog === 1) {
      return {
        message: "Welcome back! Ready to log today? 😊",
        tone: 'warm'
      };
    }
    
    if (daysSinceLastLog <= 7) {
      return {
        message: `Hey! It's been ${daysSinceLastLog} days. Life gets busy—let's get back on track! 💪`,
        tone: 'supportive',
        action: 'Quick log your last meal?'
      };
    }
    
    if (daysSinceLastLog <= 30) {
      return {
        message: `Welcome back! No judgment—${daysSinceLastLog} days is just a pause, not a failure. 🌟`,
        tone: 'compassionate',
        action: 'Start fresh today'
      };
    }
    
    // Long absence
    return {
      message: "Welcome back! We're glad you're here. Every day is a new opportunity to be kind to yourself. 💙",
      tone: 'warm',
      action: 'Let\'s update your goals',
      resetSuggestion: true // Offer to reset goals/profile
    };
  }

  // Over-goal messaging (no shame for "failures")
  generateOverGoalFeedback(actual, target, context) {
    const overage = actual - target.max;
    const percentOver = (overage / target.target) * 100;
    
    // Small overage (<10%) = not worth mentioning
    if (percentOver < 10) {
      return {
        message: `${actual} calories today. Right in your flexible range! ✅`,
        tone: 'positive'
      };
    }
    
    // Medium overage (10-25%) = normalize, provide context
    if (percentOver < 25) {
      return {
        message: `You logged ${actual} calories today—about ${Math.round(overage)} more than usual. That's totally normal! 📊`,
        tone: 'neutral',
        educationalNote: 'Your body averages over days and weeks, not individual meals.',
        action: 'Focus on tomorrow'
      };
    }
    
    // Large overage (>25%) = check in, offer support (NOT shame)
    return {
      message: `Today was higher than usual at ${actual} calories. That's okay—we all have days like this! 🤗`,
      tone: 'compassionate',
      question: 'How are you feeling? Any insights about today?',
      suggestions: [
        'Social event or celebration?',
        'Stressful day?',
        'Just hungry?',
        'All of the above—and that\'s human!'
      ],
      action: 'Tomorrow is a fresh start',
      educationalNote: 'Research shows occasional higher days don\'t impact long-term progress.'
    };
  }

  // Under-goal messaging (avoid pressure to "eat more")
  generateUnderGoalFeedback(actual, target) {
    const shortage = target.min - actual;
    const percentUnder = (shortage / target.target) * 100;
    
    // Slightly under (<10%) = fine
    if (percentUnder < 10) {
      return {
        message: `${actual} calories logged—within your flexible range. Well done! ✅`,
        tone: 'positive'
      };
    }
    
    // Significantly under (10-30%) = gentle check-in
    if (percentUnder < 30) {
      return {
        message: `You've logged ${actual} calories so far. Your target range is ${target.min}-${target.max}.`,
        tone: 'neutral',
        question: 'Are you satisfied, or would a small snack feel good?',
        suggestions: [
          'A protein-rich snack (Greek yogurt, nuts)',
          'I\'m satisfied for today',
          'I\'ll have a balanced dinner'
        ]
      };
    }
    
    // Very under (>30%) = health check
    return {
      message: `You've logged ${actual} calories today, which is quite a bit below your range. Are you feeling okay? 🤔`,
      tone: 'concerned',
      question: 'Are you feeling okay? Eating enough is important for energy and health.',
      educationalNote: 'Very low calorie days can slow metabolism and make you extra hungry tomorrow.',
      action: 'Try to add a balanced meal or snack',
      flagForReview: true // Potential disordered eating pattern if repeated
    };
  }

  // Notification language (never nagging)
  generateNotification(type, context) {
    const notifications = {
      mealReminder: [
        "Ready to log your meal? 🍽️",
        "Time to fuel up! Log when you're ready.",
        "Meal time! No pressure, just a friendly reminder."
      ],
      
      waterReminder: [
        "Hydration check! 💧",
        "Time for some water?",
        "Stay hydrated today!"
      ],
      
      exerciseReminder: [
        "Feel like moving today? 🏃‍♀️",
        "Your body might enjoy some movement!",
        "Exercise reminder—but rest is valid too!"
      ],
      
      checkIn: [
        "How's your day going?",
        "Quick check-in: How are you feeling?",
        "We'd love to hear how you're doing!"
      ],
      
      celebration: [
        "🎉 You hit your goal 3 days this week!",
        "Way to go! You've been consistent!",
        "Your progress this week is amazing!"
      ]
    };
    
    // Pick random variant to avoid repetition
    const options = notifications[type];
    const message = options[Math.floor(Math.random() * options.length)];
    
    return {
      message,
      tone: 'friendly',
      sound: type === 'celebration' ? 'celebratory' : 'gentle',
      priority: type === 'celebration' ? 'high' : 'low', // Celebrations stand out
      action: this.getNotificationAction(type)
    };
  }

  getNotificationAction(type) {
    const actions = {
      mealReminder: 'Log meal',
      waterReminder: 'Log water',
      exerciseReminder: 'View workouts',
      checkIn: 'Quick check-in',
      celebration: 'View progress'
    };
    
    return actions[type];
  }

  // Validation: Check if any feedback contains banned words
  validateFeedback(message) {
    const lowerMessage = message.toLowerCase();
    const foundBanned = this.bannedWords.filter(word => 
      lowerMessage.includes(word)
    );
    
    if (foundBanned.length > 0) {
      console.error(`⚠️ Banned words found: ${foundBanned.join(', ')}`);
      return false;
    }
    
    return true;
  }
}
