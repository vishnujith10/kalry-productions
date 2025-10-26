/**
 * ADAPTIVE CALORIE GOAL ALGORITHM
 * Addresses: Unrealistic goals, biological factors, context awareness
 */
export class AdaptiveGoalEngine {
  constructor(userProfile) {
    this.user = userProfile;
    this.learningRate = 0.1; // For ML adjustments
    this.historyWindow = 14; // Days to consider for patterns
  }

  // Calculate base metabolic rate using Mifflin-St Jeor equation
  calculateBMR() {
    const { weight, height, age, gender } = this.user;
    
    // Validate required properties
    if (!weight || !height || !age || !gender) {
      throw new Error(`Missing required user properties: weight=${weight}, height=${height}, age=${age}, gender=${gender}`);
    }
    
    if (gender === 'male') {
      return (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else {
      return (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }
  }

  // Calculate Total Daily Energy Expenditure
  calculateTDEE(bmr) {
    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      veryActive: 1.9
    };
    
    const multiplier = activityMultipliers[this.user.activityLevel] || activityMultipliers.moderate;
    return bmr * multiplier;
  }

  // Biology-aware adjustments
  getBiologicalAdjustments(baseCalories) {
    let adjustments = 0;
    const reasons = [];

    // Menstrual cycle phase
    if (this.user.gender === 'female' && this.user.menstrualCycle) {
      const phase = this.user.menstrualCycle.currentPhase;
      
      if (phase === 'luteal' || phase === 'menstruation') {
        adjustments += 150;
        reasons.push({
          factor: 'Menstrual cycle',
          adjustment: +150,
          explanation: 'Your body needs extra energy during this phase'
        });
      }
    }

    // Breastfeeding
    if (this.user.isBreastfeeding) {
      adjustments += 500;
      reasons.push({
        factor: 'Breastfeeding',
        adjustment: +500,
        explanation: 'Essential calories for milk production'
      });
    }

    // Medical conditions affecting metabolism
    if (this.user.medicalConditions) {
      if (this.user.medicalConditions.includes('hypothyroidism')) {
        adjustments -= 100;
        reasons.push({
          factor: 'Thyroid condition',
          adjustment: -100,
          explanation: 'Adjusted for lower metabolic rate'
        });
      }
      
      if (this.user.medicalConditions.includes('PCOS')) {
        adjustments -= 50;
        reasons.push({
          factor: 'PCOS',
          adjustment: -50,
          explanation: 'Adjusted for insulin resistance'
        });
      }
    }

    // Age-related metabolism decline (after 30)
    if (this.user.age > 30) {
      const yearsOver30 = this.user.age - 30;
      const ageAdjustment = Math.floor(yearsOver30 / 10) * -25;
      adjustments += ageAdjustment;
      
      if (ageAdjustment < 0) {
        reasons.push({
          factor: 'Age-related metabolism',
          adjustment: ageAdjustment,
          explanation: 'Metabolic rate naturally decreases with age'
        });
      }
    }

    // Medications that affect metabolism
    if (this.user.medications) {
      const metabolismAffecting = ['antidepressants', 'corticosteroids', 'beta-blockers'];
      const hasMedication = this.user.medications.some(med => 
        metabolismAffecting.includes(med.toLowerCase())
      );
      
      if (hasMedication) {
        adjustments += 100;
        reasons.push({
          factor: 'Medication effects',
          adjustment: +100,
          explanation: 'Some medications can affect metabolism'
        });
      }
    }

    return { adjustments, reasons };
  }

  // Daily context adjustments
  getDailyContextAdjustments(dailyCheckIn) {
    let adjustments = 0;
    const recommendations = [];

    // Sleep quality impact (research shows <7hrs increases hunger hormones)
    if (dailyCheckIn.sleepHours < 7) {
      const sleepDeficit = 7 - dailyCheckIn.sleepHours;
      adjustments += sleepDeficit * 50; // 50 cal per hour of sleep deficit
      
      recommendations.push({
        type: 'sleep',
        priority: 'high',
        message: `You got ${dailyCheckIn.sleepHours}hrs sleep. We've added ${sleepDeficit * 50} calories for energy.`,
        action: 'Try to get 7-9 hours tonight'
      });
    }

    // Stress level
    if (dailyCheckIn.stressLevel === 'high') {
      adjustments += 100;
      recommendations.push({
        type: 'stress',
        priority: 'high',
        message: 'High stress increases cortisol and energy needs.',
        action: 'Try 10-min meditation or a walk'
      });
    }

    // Life situations
    if (dailyCheckIn.situation) {
      switch (dailyCheckIn.situation) {
        case 'sick':
          adjustments += 150;
          recommendations.push({
            type: 'recovery',
            priority: 'critical',
            message: 'Your body needs extra energy to heal. Focus on rest and nutrition.',
            action: 'Pause weight loss goals temporarily'
          });
          break;
          
        case 'travel':
          adjustments += 75;
          recommendations.push({
            type: 'flexibility',
            priority: 'medium',
            message: 'Travel disrupts routines. Be gentle with yourself.',
            action: 'Aim for protein at each meal'
          });
          break;
          
        case 'highActivity':
          adjustments += 200;
          recommendations.push({
            type: 'fueling',
            priority: 'high',
            message: 'Extra active day! Your body needs more fuel.',
            action: 'Add a protein-rich snack'
          });
          break;
      }
    }

    // Energy level
    if (dailyCheckIn.energyLevel === 'low') {
      adjustments += 50;
      recommendations.push({
        type: 'energy',
        priority: 'medium',
        message: 'Low energy today. Make sure you\'re eating enough.',
        action: 'Have a balanced snack if hungry'
      });
    }

    return { adjustments, recommendations };
  }

  // Adherence-based learning (rewards consistency)
  getAdherenceAdjustment() {
    console.log('AdaptiveGoalEngine: Getting adherence adjustment...');
    const recentHistory = this.user.history.slice(-this.historyWindow);
    const loggedDays = recentHistory.filter(day => day.logged).length;
    const adherenceRate = loggedDays / this.historyWindow;
    
    console.log('AdaptiveGoalEngine: History length:', this.user.history.length);
    console.log('AdaptiveGoalEngine: Logged days:', loggedDays);

    // If no history, return default values
    if (loggedDays === 0) {
      console.log('AdaptiveGoalEngine: No history, returning default values');
      return {
        adjustment: 0,
        feedback: {
          type: 'new_user',
          message: 'Welcome! We\'ll learn your patterns as you log more days.',
          tone: 'welcoming'
        },
        adherenceRate: 0
      };
    }

    // Pattern detection: Are goals too aggressive?
    const daysUnderGoal = recentHistory.filter(day => 
      day.logged && day.calories < day.target * 0.8
    ).length;
    
    const daysOverGoal = recentHistory.filter(day => 
      day.logged && day.calories > day.target * 1.2
    ).length;

    let adjustment = 0;
    let feedback = null;

    // Consistently under goal = goals too aggressive
    if (daysUnderGoal / loggedDays > 0.6) {
      adjustment += 150;
      feedback = {
        type: 'goal_adjustment',
        message: 'We noticed you\'re often below target. We\'ve increased your goal to be more realistic.',
        tone: 'supportive'
      };
    }

    // Consistently over goal = either goals too easy or binge patterns
    if (daysOverGoal / loggedDays > 0.6) {
      // Check if it's consistent overeating or periodic binges
      const isConsistent = recentHistory.every((day, i) => {
        if (i === 0) return true;
        return Math.abs(day.calories - recentHistory[i-1].calories) < 300;
      });

      if (isConsistent) {
        adjustment -= 100;
        feedback = {
          type: 'goal_adjustment',
          message: 'You\'re consistently eating more. Let\'s adjust your goal to match your actual needs.',
          tone: 'neutral'
        };
      } else {
        // Binge pattern detected - don't lower calories, address behavior
        feedback = {
          type: 'pattern_alert',
          message: 'We noticed some variation in your intake. This is normal! Focus on consistency.',
          tone: 'compassionate',
          action: 'Would you like tips for managing cravings?'
        };
      }
    }

    // High adherence = user is engaged, maintain current approach
    if (adherenceRate > 0.8) {
      feedback = {
        type: 'celebration',
        message: `Amazing! You've logged ${loggedDays} out of ${this.historyWindow} days.`,
        tone: 'celebratory'
      };
    }

    return { adjustment, feedback, adherenceRate };
  }

  // Weight trend analysis (prevent plateau frustration)
  getWeightTrendAdjustment() {
    const recentWeights = this.user.weightHistory.slice(-28); // 4 weeks
    
    if (recentWeights.length < 14) {
      return { adjustment: 0, message: 'Building your baseline data...' };
    }

    // Calculate trend using linear regression
    const trend = this.calculateTrendLine(recentWeights);
    const weeklyChange = trend.slope * 7;

    let adjustment = 0;
    let message = '';

    // Goal: 0.5-1kg per week loss (healthy range)
    if (this.user.goal === 'weightLoss') {
      if (weeklyChange > -0.25) {
        // Not losing weight - very slight deficit increase
        adjustment -= 50;
        message = 'Progress has slowed. Let\'s make a small adjustment.';
      } else if (weeklyChange < -1.2) {
        // Losing too fast - increase calories
        adjustment += 100;
        message = 'Great progress, but let\'s slow down slightly for sustainability.';
      } else {
        message = `Perfect pace! You're losing about ${Math.abs(weeklyChange).toFixed(1)}kg per week.`;
      }
    }

    return { adjustment, message, weeklyChange };
  }

  // Helper: Simple linear regression for trend
  calculateTrendLine(data) {
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    data.forEach((point, i) => {
      sumX += i;
      sumY += point.weight;
      sumXY += i * point.weight;
      sumX2 += i * i;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  // MAIN ALGORITHM: Generate daily adaptive goal
  generateDailyGoal(dailyCheckIn) {
    console.log('AdaptiveGoalEngine: Starting generateDailyGoal with:', dailyCheckIn);
    console.log('AdaptiveGoalEngine: User profile:', this.user);
    
    // Step 1: Calculate baseline
    console.log('AdaptiveGoalEngine: Step 1 - Calculating BMR...');
    const bmr = this.calculateBMR();
    console.log('AdaptiveGoalEngine: BMR calculated:', bmr);
    
    console.log('AdaptiveGoalEngine: Step 1 - Calculating TDEE...');
    const tdee = this.calculateTDEE(bmr);
    console.log('AdaptiveGoalEngine: TDEE calculated:', tdee);
    
    // Step 2: Apply goal-based deficit/surplus
    let targetCalories = tdee;
    
    if (this.user.goal === 'weightLoss') {
      targetCalories -= 500; // 0.5kg per week deficit
    } else if (this.user.goal === 'weightGain') {
      targetCalories += 300; // Lean mass gain
    }
    console.log('AdaptiveGoalEngine: Step 2 - Target calories after goal adjustment:', targetCalories);

    // Step 3: Biology adjustments
    console.log('AdaptiveGoalEngine: Step 3 - Getting biological adjustments...');
    const bioAdjustments = this.getBiologicalAdjustments(targetCalories);
    targetCalories += bioAdjustments.adjustments;
    console.log('AdaptiveGoalEngine: Target calories after bio adjustments:', targetCalories);

    // Step 4: Daily context
    console.log('AdaptiveGoalEngine: Step 4 - Getting daily context adjustments...');
    const contextAdjustments = this.getDailyContextAdjustments(dailyCheckIn);
    targetCalories += contextAdjustments.adjustments;
    console.log('AdaptiveGoalEngine: Target calories after context adjustments:', targetCalories);

    // Step 5: Adherence learning
    console.log('AdaptiveGoalEngine: Step 5 - Getting adherence adjustments...');
    const adherenceAdjustment = this.getAdherenceAdjustment();
    targetCalories += adherenceAdjustment.adjustment;
    console.log('AdaptiveGoalEngine: Target calories after adherence adjustments:', targetCalories);

    // Step 6: Weight trend correction
    console.log('AdaptiveGoalEngine: Step 6 - Getting weight trend adjustments...');
    const trendAdjustment = this.getWeightTrendAdjustment();
    targetCalories += trendAdjustment.adjustment;
    console.log('AdaptiveGoalEngine: Final target calories:', targetCalories);

    // Step 7: Create flexible range (not rigid number)
    console.log('AdaptiveGoalEngine: Step 7 - Creating calorie goal object...');
    const flexibilityRange = 150; // ±150 calories

    const calorieGoal = {
      min: Math.round(targetCalories - flexibilityRange),
      target: Math.round(targetCalories),
      max: Math.round(targetCalories + flexibilityRange),
      
      // Metadata for transparency
      breakdown: {
        bmr: Math.round(bmr),
        tdee: Math.round(tdee),
        goalAdjustment: this.user.goal === 'weightLoss' ? -500 : 
                       this.user.goal === 'weightGain' ? +300 : 0,
        biologicalFactors: bioAdjustments.adjustments,
        dailyContext: contextAdjustments.adjustments,
        adherencePattern: adherenceAdjustment.adjustment,
        progressTrend: trendAdjustment.adjustment
      }
    };
    
    console.log('AdaptiveGoalEngine: Basic calorie goal created:', calorieGoal);
    
    // Add reasons
    console.log('AdaptiveGoalEngine: Adding reasons...');
    calorieGoal.reasons = [
      ...bioAdjustments.reasons,
      ...contextAdjustments.recommendations,
      adherenceAdjustment.feedback,
      { factor: 'Progress', message: trendAdjustment.message }
    ].filter(Boolean);
    
    console.log('AdaptiveGoalEngine: Reasons added:', calorieGoal.reasons);
    
    // Add display message
    console.log('AdaptiveGoalEngine: Generating display message...');
    calorieGoal.displayMessage = this.generateDisplayMessage(calorieGoal, dailyCheckIn);
    
    console.log('AdaptiveGoalEngine: Display message generated:', calorieGoal.displayMessage);

    console.log('AdaptiveGoalEngine: Generated calorie goal successfully:', calorieGoal);
    return calorieGoal;
  }

  generateDisplayMessage(goal, checkIn) {
    if (checkIn.situation === 'sick') {
      return `Focus on recovery today. Aim for ${goal.min}-${goal.max} calories with plenty of protein.`;
    }
    
    if (checkIn.sleepHours < 6) {
      return `You're tired today. Your goal is ${goal.min}-${goal.max} cal — we've adjusted for your energy needs.`;
    }
    
    if (checkIn.stressLevel === 'high') {
      return `High stress day. Your flexible goal: ${goal.min}-${goal.max} cal. Be kind to yourself.`;
    }
    
    return `Today's goal: ${goal.min}-${goal.max} calories. Any number in this range is a win!`;
  }
}
