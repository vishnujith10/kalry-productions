/**
 * Progressive Overload Engine
 * 
 * Tracks progressive overload in resistance training by monitoring:
 * - Weight increases
 * - Rep increases
 * - Set increases
 * - Volume progression
 * 
 * Detects stagnation and provides actionable suggestions for breaking plateaus.
 * 
 * References:
 * - https://www.hevyapp.com/progressive-overload/
 * - https://gymaware.com/progressive-overload-the-ultimate-guide/
 * - https://strengthlab360.com/blogs/reviews-and-tests/ultimate-guide-to-progressive-overload-apps
 */

export class ProgressiveOverloadEngine {
  constructor() {
    // Map exercise names to arrays of session logs: { weight, reps, sets, date, volume }
    this.exerciseHistory = {};
  }

  /**
   * Log a workout session for an exercise
   * @param {string} exercise - Exercise name
   * @param {Object} data - Session data
   * @param {number} data.weight - Weight used (kg)
   * @param {number} data.reps - Reps performed
   * @param {number} data.sets - Sets completed
   * @param {Date|string} data.date - Session date
   */
  logSession(exercise, { weight, reps, sets, date }) {
    if (!this.exerciseHistory[exercise]) {
      this.exerciseHistory[exercise] = [];
    }
    
    const volume = weight * reps * sets;
    this.exerciseHistory[exercise].push({
      weight,
      reps,
      sets,
      date: new Date(date),
      volume
    });
    
    // Sort by date to ensure chronological order
    this.exerciseHistory[exercise].sort((a, b) => a.date - b.date);
  }

  /**
   * Load exercise history from database format
   * @param {Array} sessions - Array of session objects from database
   */
  loadHistory(sessions) {
    this.exerciseHistory = {};
    sessions.forEach(session => {
      const exerciseName = session.exercise_name || session.name;
      this.logSession(exerciseName, {
        weight: session.weight || 0,
        reps: session.reps || 0,
        sets: session.sets || 1,
        date: session.date || session.created_at
      });
    });
  }

  /**
   * Suggest progression for an exercise
   * @param {string} exercise - Exercise name
   * @returns {Object} - { type, message, emoji, suggestion }
   */
  suggestIncrease(exercise) {
    const logs = this.exerciseHistory[exercise] || [];
    
    if (logs.length < 2) {
      return {
        type: 'info',
        message: 'Keep logging to unlock personalized insights!',
        emoji: '📊',
        suggestion: null
      };
    }

    // Get most recent two sessions
    const last = logs[logs.length - 1];
    const prev = logs[logs.length - 2];

    // Check for improvement
    if (last.weight > prev.weight) {
      const increase = ((last.weight - prev.weight) / prev.weight * 100).toFixed(1);
      return {
        type: 'progress',
        message: `Progress! You increased your weight by ${increase}%`,
        emoji: '💪',
        suggestion: 'Keep up the momentum! Try maintaining this weight for 2-3 sessions before increasing again.'
      };
    }

    if (last.reps > prev.reps) {
      const repIncrease = last.reps - prev.reps;
      return {
        type: 'progress',
        message: `Progress! You did ${repIncrease} more rep${repIncrease > 1 ? 's' : ''}`,
        emoji: '👏',
        suggestion: 'Great work! Once you can do 12+ reps comfortably, consider increasing the weight.'
      };
    }

    if (last.sets > prev.sets) {
      return {
        type: 'progress',
        message: 'Progress! You added more sets',
        emoji: '🔥',
        suggestion: 'Nice volume increase! Monitor your recovery and adjust if needed.'
      };
    }

    if (last.volume > prev.volume) {
      const volumeIncrease = ((last.volume - prev.volume) / prev.volume * 100).toFixed(1);
      return {
        type: 'progress',
        message: `Progress! Total volume increased by ${volumeIncrease}%`,
        emoji: '📈',
        suggestion: 'Excellent! Your total work output is improving.'
      };
    }

    // Check for stagnation - a true plateau is same numbers for 6+ sessions (4-6 weeks typically)
    // 3-4 sessions with same numbers might be intentional periodization or maintenance
    let stagnantCount = 0;
    const checkLimit = Math.min(6, logs.length); // Check last 6 sessions minimum
    
    for (let i = logs.length - 1; i >= 0 && (logs.length - i) <= checkLimit; i--) {
      if (logs[i].weight === last.weight &&
          logs[i].reps === last.reps &&
          logs[i].sets === last.sets) {
        stagnantCount++;
      }
    }

    // Only warn if 6+ sessions with identical numbers (true plateau)
    // For 4-5 sessions, give a gentler suggestion
    if (stagnantCount >= 6) {
      return {
        type: 'stagnation',
        message: `Plateau detected: ${last.weight}kg, ${last.reps} reps for ${last.sets} sets for ${stagnantCount} sessions.`,
        emoji: '⚠️',
        suggestion: this.getProgressionSuggestion(last)
      };
    } else if (stagnantCount >= 4) {
      // Gentler suggestion for 4-5 sessions
      return {
        type: 'consistency',
        message: `You've maintained ${last.weight}kg, ${last.reps} reps for ${stagnantCount} sessions.`,
        emoji: '💡',
        suggestion: 'Maintaining is fine, but consider progressive overload soon. Try adding weight, reps, or sets.'
      };
    }

    return {
      type: 'consistent',
      message: 'Keep up the consistency!',
      emoji: '✅',
      suggestion: 'You\'re building a solid foundation. Progress will come!'
    };
  }

  /**
   * Get specific progression suggestion based on current performance
   * @param {Object} lastSession - Last session data
   * @returns {string} - Progression suggestion
   */
  getProgressionSuggestion(lastSession) {
    const { weight, reps, sets } = lastSession;
    const suggestions = [];

    // Professional progression standards:
    // - Weight: 2.5-5kg increments for heavier weights (20kg+), 1-2.5kg for lighter
    // - Reps: Optimal range 8-12 for hypertrophy, 5-8 for strength
    // - Sets: 3-5 sets optimal for most exercises
    
    // 1. Weight progression (most effective for strength)
    if (weight >= 20) {
      suggestions.push(`1️⃣ **Add Weight**: Increase to ${(weight + 2.5).toFixed(1)}-${(weight + 5).toFixed(1)}kg (5-10% increase)`);
    } else if (weight >= 5) {
      suggestions.push(`1️⃣ **Add Weight**: Increase to ${(weight + 1).toFixed(1)}-${(weight + 2.5).toFixed(1)}kg (5-10% increase)`);
    } else {
      suggestions.push(`1️⃣ **Add Weight**: Increase by 0.5-1kg`);
    }

    // 2. Rep progression (good for hypertrophy)
    if (reps < 8) {
      // Low reps - focus on getting to 8-12 range for hypertrophy
      suggestions.push(`2️⃣ **Add Reps**: Aim for ${reps + 1}-${reps + 2} reps (target: 8-12 for growth)`);
    } else if (reps < 12) {
      // In optimal range - can add reps or move to higher weight at lower reps
      suggestions.push(`2️⃣ **Add Reps**: Aim for ${reps + 1}-${reps + 2} reps OR increase weight and drop to 6-8 reps`);
    } else {
      // High reps - time to increase weight
      suggestions.push(`2️⃣ **Increase Weight**: You're doing 12+ reps. Increase weight by 5-10% and aim for 6-8 reps`);
    }

    // 3. Set progression (volume increase)
    if (sets < 3) {
      suggestions.push(`3️⃣ **Add Sets**: Increase to 3-4 sets for better volume`);
    } else if (sets < 5) {
      suggestions.push(`3️⃣ **Add Sets**: Consider adding 1 more set (total: ${sets + 1} sets)`);
    } else {
      suggestions.push(`3️⃣ **Volume is sufficient**: ${sets} sets is plenty. Focus on weight/reps instead.`);
    }

    // 4. Advanced techniques
    suggestions.push(`4️⃣ **Tempo Training**: Slow down eccentric (3-2-1 tempo: 3 sec down, 2 sec pause, 1 sec up)`);
    
    if (reps >= 12) {
      suggestions.push(`5️⃣ **Time Under Tension**: Reduce rest time by 15-30 seconds between sets`);
    } else {
      suggestions.push(`5️⃣ **Rest Optimization**: Ensure 2-3 min rest between sets for strength work`);
    }
    
    suggestions.push(`6️⃣ **Exercise Variation**: Try a similar exercise (e.g., dumbbell → barbell, or vice versa)`);
    suggestions.push(`7️⃣ **Deload Week**: If feeling fatigued, reduce weight by 20% for 1 week, then return stronger`);

    return suggestions.join('\n');
  }

  /**
   * Get progress summary for an exercise
   * @param {string} exercise - Exercise name
   * @returns {Object} - Progress statistics
   */
  getProgressSummary(exercise) {
    const logs = this.exerciseHistory[exercise] || [];
    
    if (logs.length === 0) {
      return null;
    }

    const first = logs[0];
    const last = logs[logs.length - 1];

    const weightProgress = last.weight - first.weight;
    const weightProgressPercent = ((weightProgress / first.weight) * 100).toFixed(1);
    const volumeProgress = last.volume - first.volume;
    const volumeProgressPercent = ((volumeProgress / first.volume) * 100).toFixed(1);

    return {
      totalSessions: logs.length,
      firstWeight: first.weight,
      currentWeight: last.weight,
      weightProgress,
      weightProgressPercent,
      firstVolume: first.volume,
      currentVolume: last.volume,
      volumeProgress,
      volumeProgressPercent,
      firstDate: first.date,
      lastDate: last.date,
      daysTracking: Math.floor((last.date - first.date) / (1000 * 60 * 60 * 24))
    };
  }

  /**
   * Get all exercises with stagnation
   * @returns {Array} - Array of exercises showing stagnation
   */
  getStagnantExercises() {
    const stagnant = [];
    
    for (const exercise in this.exerciseHistory) {
      const result = this.suggestIncrease(exercise);
      if (result.type === 'stagnation') {
        stagnant.push({
          exercise,
          ...result
        });
      }
    }
    
    return stagnant;
  }

  /**
   * Get personal records for an exercise
   * @param {string} exercise - Exercise name
   * @returns {Object} - Personal records
   */
  getPersonalRecords(exercise) {
    const logs = this.exerciseHistory[exercise] || [];
    
    if (logs.length === 0) {
      return null;
    }

    const maxWeight = Math.max(...logs.map(l => l.weight));
    const maxReps = Math.max(...logs.map(l => l.reps));
    const maxVolume = Math.max(...logs.map(l => l.volume));
    const maxWeightSession = logs.find(l => l.weight === maxWeight);
    const maxRepsSession = logs.find(l => l.reps === maxReps);
    const maxVolumeSession = logs.find(l => l.volume === maxVolume);

    return {
      maxWeight: {
        value: maxWeight,
        date: maxWeightSession.date,
        reps: maxWeightSession.reps,
        sets: maxWeightSession.sets
      },
      maxReps: {
        value: maxReps,
        date: maxRepsSession.date,
        weight: maxRepsSession.weight,
        sets: maxRepsSession.sets
      },
      maxVolume: {
        value: maxVolume,
        date: maxVolumeSession.date,
        weight: maxVolumeSession.weight,
        reps: maxVolumeSession.reps,
        sets: maxVolumeSession.sets
      }
    };
  }

  /**
   * Check if user achieved a new personal record
   * @param {string} exercise - Exercise name
   * @param {Object} session - Current session data
   * @returns {Object|null} - PR info if achieved, null otherwise
   */
  checkForPR(exercise, session) {
    const logs = this.exerciseHistory[exercise] || [];
    
    if (logs.length === 0) {
      return {
        type: 'first',
        message: 'First time logging this exercise! 🎉'
      };
    }

    const maxWeight = Math.max(...logs.map(l => l.weight));
    const maxReps = Math.max(...logs.map(l => l.reps));
    const maxVolume = Math.max(...logs.map(l => l.volume));
    const currentVolume = session.weight * session.reps * session.sets;

    const prs = [];

    if (session.weight > maxWeight) {
      prs.push({
        type: 'weight',
        message: `New weight PR! ${session.weight}kg (previous: ${maxWeight}kg)`,
        emoji: '🏆'
      });
    }

    if (session.reps > maxReps) {
      prs.push({
        type: 'reps',
        message: `New rep PR! ${session.reps} reps (previous: ${maxReps} reps)`,
        emoji: '💥'
      });
    }

    if (currentVolume > maxVolume) {
      prs.push({
        type: 'volume',
        message: `New volume PR! ${currentVolume}kg total (previous: ${maxVolume}kg)`,
        emoji: '📊'
      });
    }

    return prs.length > 0 ? prs : null;
  }
}

// Export singleton instance
export const progressiveOverloadEngine = new ProgressiveOverloadEngine();

