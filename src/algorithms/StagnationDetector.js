/**
 * Stagnation Detector
 * 
 * Detects workout plateaus and provides actionable feedback:
 * - Identifies repeated weights/reps/sets across sessions
 * - Celebrates progress when plateaus are broken
 * - Offers specific suggestions for progression
 * - Tracks motivation and engagement
 * 
 * References:
 * - https://orbit.dtu.dk/files/262411144/_EvoCOP21_Stagnation_Detection_with_Randomized_Local_Search.pdf
 * - https://fivestarrphysique.com/beginning-bodybuilding/effectively-logging-your-workouts/
 */

export class StagnationDetector {
  constructor() {
    // { exercise: [{ weight, reps, sets, date, volume }] }
    this.exerciseLogs = {};
    
    // Track when we last notified about stagnation to avoid spam
    this.lastNotification = {};
  }

  /**
   * Log an exercise session
   * @param {string} exercise - Exercise name
   * @param {number} weight - Weight used (kg)
   * @param {number} reps - Reps performed
   * @param {number} sets - Sets completed
   * @param {Date|string} date - Session date
   */
  logExercise(exercise, weight, reps, sets, date) {
    if (!this.exerciseLogs[exercise]) {
      this.exerciseLogs[exercise] = [];
    }

    const volume = weight * reps * sets;
    this.exerciseLogs[exercise].push({
      weight,
      reps,
      sets,
      date: new Date(date),
      volume
    });

    // Sort by date
    this.exerciseLogs[exercise].sort((a, b) => a.date - b.date);
  }

  /**
   * Load exercise logs from database format
   * @param {Array} logs - Array of exercise log objects
   */
  loadLogs(logs) {
    this.exerciseLogs = {};
    logs.forEach(log => {
      this.logExercise(
        log.exercise_name || log.name,
        log.weight || 0,
        log.reps || 0,
        log.sets || 1,
        log.date || log.created_at
      );
    });
  }

  /**
   * Check for stagnation in an exercise
   * @param {string} exercise - Exercise name
   * @param {number} threshold - Number of sessions to check (default: 6 for true plateau)
   * @returns {Object|null} - Stagnation info or null
   */
  checkStagnation(exercise, threshold = 6) {
    const logs = this.exerciseLogs[exercise] || [];
    
    if (logs.length < threshold) {
      return null;
    }

    // Get last N sessions
    const recentLogs = logs.slice(-threshold);
    
    // Check if all weights are the same
    const weights = recentLogs.map(l => l.weight);
    const reps = recentLogs.map(l => l.reps);
    const sets = recentLogs.map(l => l.sets);
    
    const uniqueWeights = new Set(weights);
    const uniqueReps = new Set(reps);
    const uniqueSets = new Set(sets);

    // Complete stagnation: all three metrics are identical
    if (uniqueWeights.size === 1 && uniqueReps.size === 1 && uniqueSets.size === 1) {
      const lastLog = recentLogs[recentLogs.length - 1];
      const daysSinceFirst = Math.floor(
        (lastLog.date - recentLogs[0].date) / (1000 * 60 * 60 * 24)
      );

      return {
        type: 'complete_stagnation',
        severity: 'high',
        message: `Plateau detected: ${exercise} at ${lastLog.weight}kg, ${lastLog.reps} reps, ${lastLog.sets} sets for ${threshold}+ sessions (${daysSinceFirst} days)`,
        emoji: '⚠️',
        suggestion: this.getSuggestionForStagnation(lastLog),
        data: {
          weight: lastLog.weight,
          reps: lastLog.reps,
          sets: lastLog.sets,
          sessions: threshold,
          days: daysSinceFirst
        }
      };
    }

    // Partial stagnation: weight hasn't changed but reps/sets varied
    if (uniqueWeights.size === 1) {
      const lastLog = recentLogs[recentLogs.length - 1];
      return {
        type: 'weight_stagnation',
        severity: 'medium',
        message: `Weight plateau: ${exercise} at ${lastLog.weight}kg for ${threshold} sessions`,
        emoji: '💭',
        suggestion: `You've been at ${lastLog.weight}kg for a while. Try adding 2.5-5kg, or focus on increasing reps to 12+ before adding weight.`,
        data: {
          weight: lastLog.weight,
          sessions: threshold
        }
      };
    }

    // Volume stagnation: total volume hasn't increased meaningfully
    // Less than 10% variation over 6+ sessions indicates stagnation
    const volumes = recentLogs.map(l => l.volume);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const volumeVariation = Math.max(...volumes) - Math.min(...volumes);
    const volumeVariationPercent = (volumeVariation / avgVolume) * 100;

    if (volumeVariationPercent < 10 && avgVolume > 0) {
      return {
        type: 'volume_stagnation',
        severity: 'low',
        message: `Volume plateau: ${exercise} total volume hasn't changed much`,
        emoji: '📊',
        suggestion: 'Your total volume has been flat for several sessions. Try increasing weight, reps, or sets to progress.',
        data: {
          avgVolume: Math.round(avgVolume),
          variation: volumeVariationPercent.toFixed(1)
        }
      };
    }

    return null;
  }

  /**
   * Get specific suggestions for breaking stagnation
   * @param {Object} lastLog - Last session data
   * @returns {string} - Detailed suggestions
   */
  getSuggestionForStagnation(lastLog) {
    const { weight, reps, sets } = lastLog;
    const suggestions = [];

    suggestions.push('**Try one of these evidence-based strategies:**\n');

    // Professional progression standards:
    // - 5-10% weight increases are standard
    // - Rep ranges: 8-12 for hypertrophy, 5-8 for strength
    // - 3-5 sets optimal for most exercises

    // 1. Weight progression (5-10% rule)
    if (weight >= 20) {
      suggestions.push(`1️⃣ **Add Weight**: Increase to ${(weight * 1.05).toFixed(1)}-${(weight * 1.10).toFixed(1)}kg (5-10% increase)`);
    } else if (weight >= 5) {
      suggestions.push(`1️⃣ **Add Weight**: Increase to ${(weight + 1).toFixed(1)}-${(weight * 1.10).toFixed(1)}kg (5-10% increase)`);
    } else {
      suggestions.push(`1️⃣ **Add Weight**: Increase by 0.5-1kg`);
    }

    // 2. Rep progression
    if (reps < 8) {
      suggestions.push(`2️⃣ **Add Reps**: Aim for ${reps + 1}-${reps + 2} reps (target: 8-12 for hypertrophy)`);
    } else if (reps < 12) {
      suggestions.push(`2️⃣ **Add Reps**: Aim for ${reps + 1}-${reps + 2} reps OR increase weight and use 6-8 reps`);
    } else {
      suggestions.push(`2️⃣ **Increase Weight**: You're doing 12+ reps. Increase weight by 5-10% and aim for 6-8 reps`);
    }

    // 3. Set progression
    if (sets < 3) {
      suggestions.push(`3️⃣ **Add Sets**: Increase to 3-4 sets (optimal for most exercises)`);
    } else if (sets < 5) {
      suggestions.push(`3️⃣ **Add Sets**: Consider adding 1 more set (${sets + 1} sets total)`);
    } else {
      suggestions.push(`3️⃣ **Focus on Intensity**: ${sets} sets is sufficient. Focus on weight/reps instead.`);
    }

    // 4. Tempo manipulation (time under tension)
    suggestions.push(`4️⃣ **Tempo Training**: Use 3-2-1 tempo (3 sec eccentric, 2 sec pause, 1 sec concentric)`);

    // 5. Rest time optimization
    if (reps >= 12) {
      suggestions.push(`5️⃣ **Time Under Tension**: Reduce rest to 60-90 seconds for hypertrophy`);
    } else {
      suggestions.push(`5️⃣ **Rest Optimization**: Ensure 2-3 min rest between sets for strength work`);
    }

    // 6. Exercise variation (muscle confusion)
    suggestions.push(`6️⃣ **Exercise Variation**: Try a similar exercise (e.g., barbell → dumbbell, or vice versa)`);

    // 7. Deload/Periodization
    suggestions.push(`7️⃣ **Deload Week**: Reduce weight by 20% for 1 week, then return stronger`);

    // 8. Additional techniques
    suggestions.push(`8️⃣ **Drop Sets**: After your working sets, reduce weight by 20-30% and do 1 more set to failure`);
    suggestions.push(`9️⃣ **Progressive Overload**: Try increasing one variable per week (weight OR reps OR sets, not all)`);

    return suggestions.join('\n');
  }

  /**
   * Check if user broke through a plateau
   * @param {string} exercise - Exercise name
   * @returns {Object|null} - Celebration info or null
   */
  checkPlateauBreak(exercise) {
    const logs = this.exerciseLogs[exercise] || [];
    
    // Need at least 7 sessions to detect a plateau break (6 stagnant + 1 breakthrough)
    if (logs.length < 7) {
      return null;
    }

    // Check if previous 5-6 sessions were stagnant (needs at least 5 identical sessions)
    const previousLogs = logs.slice(-7, -1);
    const lastLog = logs[logs.length - 1];

    const prevWeights = previousLogs.map(l => l.weight);
    const prevReps = previousLogs.map(l => l.reps);
    const prevSets = previousLogs.map(l => l.sets);

    const wasStagnant = 
      new Set(prevWeights).size === 1 &&
      new Set(prevReps).size === 1 &&
      new Set(prevSets).size === 1;

    if (!wasStagnant) {
      return null;
    }

    const prevLog = previousLogs[previousLogs.length - 1];
    const improvements = [];

    // Check what improved
    if (lastLog.weight > prevLog.weight) {
      const increase = ((lastLog.weight - prevLog.weight) / prevLog.weight * 100).toFixed(1);
      improvements.push(`weight (+${increase}%)`);
    }

    if (lastLog.reps > prevLog.reps) {
      improvements.push(`reps (+${lastLog.reps - prevLog.reps})`);
    }

    if (lastLog.sets > prevLog.sets) {
      improvements.push(`sets (+${lastLog.sets - prevLog.sets})`);
    }

    if (lastLog.volume > prevLog.volume) {
      const increase = ((lastLog.volume - prevLog.volume) / prevLog.volume * 100).toFixed(1);
      improvements.push(`volume (+${increase}%)`);
    }

    if (improvements.length > 0) {
      return {
        type: 'plateau_broken',
        message: `🎉 Plateau broken on ${exercise}!`,
        improvements: improvements.join(', '),
        emoji: '🔥',
        celebration: `You broke through! Improved: ${improvements.join(', ')}. Keep this momentum going!`
      };
    }

    return null;
  }

  /**
   * Get all exercises with detected stagnation
   * @returns {Array} - Array of stagnant exercises with details
   */
  getAllStagnantExercises() {
    const stagnant = [];

    for (const exercise in this.exerciseLogs) {
      const stagnation = this.checkStagnation(exercise);
      if (stagnation) {
        stagnant.push({
          exercise,
          ...stagnation
        });
      }
    }

    // Sort by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    stagnant.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return stagnant;
  }

  /**
   * Get motivation message based on recent activity
   * @param {string} exercise - Exercise name
   * @returns {Object} - Motivation message
   */
  getMotivationMessage(exercise) {
    const logs = this.exerciseLogs[exercise] || [];
    
    if (logs.length === 0) {
      return {
        message: 'Start your journey! Log your first session.',
        emoji: '🚀',
        type: 'start'
      };
    }

    if (logs.length === 1) {
      return {
        message: 'Great start! Keep logging to track your progress.',
        emoji: '💪',
        type: 'beginner'
      };
    }

    // Check for recent progress
    const recentLogs = logs.slice(-3);
    const hasProgress = recentLogs.some((log, i) => {
      if (i === 0) return false;
      const prev = recentLogs[i - 1];
      return log.weight > prev.weight || log.reps > prev.reps || log.volume > prev.volume;
    });

    if (hasProgress) {
      return {
        message: 'You\'re making progress! Keep pushing!',
        emoji: '📈',
        type: 'progress'
      };
    }

    // Check for consistency
    if (logs.length >= 5) {
      const lastDate = logs[logs.length - 1].date;
      const firstDate = logs[logs.length - 5].date;
      const daysBetween = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
      
      if (daysBetween <= 14) {
        return {
          message: 'Consistency is key! You\'re building solid habits.',
          emoji: '🔥',
          type: 'consistent'
        };
      }
    }

    // Check for stagnation
    const stagnation = this.checkStagnation(exercise);
    if (stagnation) {
      return {
        message: 'Time to level up! Try increasing intensity.',
        emoji: '⚡',
        type: 'challenge'
      };
    }

    return {
      message: 'Keep going! Every rep counts.',
      emoji: '💯',
      type: 'general'
    };
  }

  /**
   * Get exercise streak (consecutive sessions with progress)
   * @param {string} exercise - Exercise name
   * @returns {Object} - Streak info
   */
  getProgressStreak(exercise) {
    const logs = this.exerciseLogs[exercise] || [];
    
    if (logs.length < 2) {
      return { streak: 0, message: 'Start logging to build a streak!' };
    }

    let streak = 0;
    for (let i = logs.length - 1; i > 0; i--) {
      const current = logs[i];
      const previous = logs[i - 1];
      
      if (current.volume > previous.volume) {
        streak++;
      } else {
        break;
      }
    }

    let message = '';
    let emoji = '';

    if (streak === 0) {
      message = 'No current streak. Time to progress!';
      emoji = '💭';
    } else if (streak === 1) {
      message = 'Progress streak started! Keep it going!';
      emoji = '🔥';
    } else if (streak < 5) {
      message = `${streak} sessions of progress! You're on fire!`;
      emoji = '🔥';
    } else {
      message = `Amazing ${streak}-session streak! Unstoppable!`;
      emoji = '🏆';
    }

    return { streak, message, emoji };
  }

  /**
   * Should we show a notification for this exercise?
   * @param {string} exercise - Exercise name
   * @returns {boolean} - True if should notify
   */
  shouldNotify(exercise) {
    const lastNotified = this.lastNotification[exercise];
    if (!lastNotified) {
      this.lastNotification[exercise] = new Date();
      return true;
    }

    // Only notify once per week about the same exercise
    const daysSinceNotification = (new Date() - lastNotified) / (1000 * 60 * 60 * 24);
    if (daysSinceNotification >= 7) {
      this.lastNotification[exercise] = new Date();
      return true;
    }

    return false;
  }
}

// Export singleton instance
export const stagnationDetector = new StagnationDetector();

