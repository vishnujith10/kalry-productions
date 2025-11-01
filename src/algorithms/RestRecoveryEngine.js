/**
 * Rest & Recovery Engine
 * 
 * Monitors training load and recovery needs by tracking:
 * - Weekly session frequency per muscle group
 * - Total rest days per week
 * - Overtraining detection
 * - Recovery recommendations
 * 
 * References:
 * - https://sci-fit.net/how-many-rest-days-a-week/
 * - https://coros.com/stories/coros-metrics/c/your-coros-recovery-metrics-explained
 */

export class RestRecoveryEngine {
  constructor() {
    // Array of { muscleGroup, date, intensity, duration }
    this.sessions = [];
  }

  /**
   * Log a workout session
   * @param {string} muscleGroup - Primary muscle group trained
   * @param {Date|string} date - Session date
   * @param {string} intensity - 'light', 'moderate', 'vigorous'
   * @param {number} duration - Duration in minutes
   */
  logSession(muscleGroup, date, intensity = 'moderate', duration = 45) {
    this.sessions.push({
      muscleGroup: muscleGroup.toLowerCase(),
      date: new Date(date),
      intensity,
      duration
    });
    
    // Sort by date
    this.sessions.sort((a, b) => a.date - b.date);
  }

  /**
   * Load sessions from database format
   * @param {Array} sessions - Array of session objects
   */
  loadSessions(sessions) {
    this.sessions = [];
    sessions.forEach(session => {
      const muscleGroup = this.extractMuscleGroup(session);
      this.logSession(
        muscleGroup,
        session.date || session.created_at,
        session.intensity || 'moderate',
        session.duration || 45
      );
    });
  }

  /**
   * Extract primary muscle group from session data
   * @param {Object} session - Session object
   * @returns {string} - Primary muscle group
   */
  extractMuscleGroup(session) {
    // Try to get from body_parts or muscle_group field
    if (session.body_parts) {
      const parts = session.body_parts.toLowerCase();
      if (parts.includes('chest')) return 'chest';
      if (parts.includes('back')) return 'back';
      if (parts.includes('shoulder')) return 'shoulders';
      if (parts.includes('leg') || parts.includes('quad') || parts.includes('hamstring')) return 'legs';
      if (parts.includes('arm') || parts.includes('bicep') || parts.includes('tricep')) return 'arms';
      if (parts.includes('core') || parts.includes('ab')) return 'core';
    }
    
    if (session.muscle_group) {
      return session.muscle_group.toLowerCase();
    }
    
    // Default to 'full body' if can't determine
    return 'full body';
  }

  /**
   * Get rest and recovery advice
   * @param {Date} currentDate - Current date (defaults to today)
   * @returns {Object} - { advice: Array, metrics: Object, status: string }
   */
  getRestAdvice(currentDate = new Date()) {
    const advice = [];
    const warnings = [];
    
    // Count sessions in last 7 days per muscle group
    const groups = {};
    const workoutDates = new Set();
    let totalSessions = 0;
    let totalDuration = 0;
    let vigorousSessions = 0;
    
    for (const session of this.sessions) {
      const daysAgo = (currentDate - session.date) / (1000 * 3600 * 24);
      
      if (daysAgo <= 7 && daysAgo >= 0) {
        const group = session.muscleGroup;
        groups[group] = (groups[group] || 0) + 1;
        workoutDates.add(session.date.toISOString().slice(0, 10));
        totalSessions++;
        totalDuration += session.duration;
        
        if (session.intensity === 'vigorous' || session.intensity === 'high') {
          vigorousSessions++;
        }
      }
    }

    // Check each muscle group frequency
    for (const group in groups) {
      const frequency = groups[group];
      
      if (frequency > 5) {
        warnings.push({
          type: 'overtraining',
          severity: 'high',
          message: `⚠️ Too many ${group} workouts (${frequency}/week)`,
          suggestion: `Consider a rest or active recovery day for ${group}. Overtraining can lead to injury and decreased performance.`,
          emoji: '🚨'
        });
      } else if (frequency === 1) {
        advice.push({
          type: 'undertraining',
          severity: 'low',
          message: `Only 1 ${group} workout this week`,
          suggestion: `Consider adding 1-2 more ${group} sessions for optimal growth and strength gains.`,
          emoji: '💡'
        });
      } else if (frequency >= 3 && frequency <= 5) {
        advice.push({
          type: 'optimal',
          severity: 'none',
          message: `Great ${group} training frequency (${frequency}/week)`,
          suggestion: 'This is an optimal training frequency for most people.',
          emoji: '✅'
        });
      }
    }

    // Check rest days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - i);
      return d.toISOString().slice(0, 10);
    });
    
    const restDays = last7Days.filter(d => !workoutDates.has(d)).length;

    if (restDays < 1) {
      warnings.push({
        type: 'no_rest',
        severity: 'critical',
        message: '🚨 You had 0 rest days this week!',
        suggestion: 'Rest is crucial for muscle recovery and growth. Schedule at least 1-2 complete rest days per week.',
        emoji: '⛔'
      });
    } else if (restDays < 2) {
      warnings.push({
        type: 'insufficient_rest',
        severity: 'medium',
        message: `⚠️ Only ${restDays} rest day this week`,
        suggestion: 'Aim for 1-2 rest days per week to optimize recovery and prevent burnout.',
        emoji: '😴'
      });
    } else if (restDays >= 2 && restDays <= 3) {
      advice.push({
        type: 'good_rest',
        severity: 'none',
        message: `Perfect! ${restDays} rest days this week`,
        suggestion: 'Great balance between training and recovery.',
        emoji: '💯'
      });
    }

    // Check total weekly volume
    if (totalSessions > 6) {
      warnings.push({
        type: 'high_volume',
        severity: 'medium',
        message: `High training volume: ${totalSessions} sessions this week`,
        suggestion: 'Monitor your recovery. Consider deload week if feeling fatigued.',
        emoji: '📊'
      });
    }

    // Check vigorous session ratio
    const vigorousRatio = totalSessions > 0 ? vigorousSessions / totalSessions : 0;
    if (vigorousRatio > 0.7 && totalSessions >= 4) {
      warnings.push({
        type: 'high_intensity',
        severity: 'medium',
        message: `${Math.round(vigorousRatio * 100)}% of your sessions were high intensity`,
        suggestion: 'Consider mixing in some moderate intensity sessions to aid recovery.',
        emoji: '🔥'
      });
    }

    // Determine overall status
    let status = 'good';
    if (warnings.some(w => w.severity === 'critical')) {
      status = 'critical';
    } else if (warnings.some(w => w.severity === 'high')) {
      status = 'warning';
    } else if (warnings.some(w => w.severity === 'medium')) {
      status = 'caution';
    } else if (advice.length === 0 && warnings.length === 0) {
      status = 'excellent';
    }

    // Combine warnings and advice
    const allAdvice = [...warnings, ...advice];

    // Add default message if everything is balanced
    if (allAdvice.length === 0) {
      allAdvice.push({
        type: 'balanced',
        severity: 'none',
        message: '🎉 Great job! Training and rest are perfectly balanced.',
        suggestion: 'Keep up this routine for optimal results.',
        emoji: '⚖️'
      });
    }

    return {
      advice: allAdvice,
      metrics: {
        totalSessions,
        restDays,
        totalDuration,
        vigorousSessions,
        muscleGroupBreakdown: groups,
        averageSessionDuration: totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0
      },
      status
    };
  }

  /**
   * Check if a rest day is recommended for today
   * @param {Date} currentDate - Current date
   * @returns {Object} - { recommended: boolean, reason: string }
   */
  shouldRestToday(currentDate = new Date()) {
    const yesterday = new Date(currentDate);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const twoDaysAgo = new Date(currentDate);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Check if worked out yesterday and day before
    const recentSessions = this.sessions.filter(s => {
      const sessionDate = s.date.toISOString().slice(0, 10);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      const twoDaysAgoStr = twoDaysAgo.toISOString().slice(0, 10);
      return sessionDate === yesterdayStr || sessionDate === twoDaysAgoStr;
    });

    if (recentSessions.length >= 2) {
      // Check if both were vigorous
      const vigorousCount = recentSessions.filter(s => 
        s.intensity === 'vigorous' || s.intensity === 'high'
      ).length;

      if (vigorousCount >= 2) {
        return {
          recommended: true,
          reason: 'You had 2 consecutive high-intensity sessions. Rest is recommended for optimal recovery.',
          emoji: '😴'
        };
      }

      // Check if same muscle group
      const muscleGroups = recentSessions.map(s => s.muscleGroup);
      const uniqueGroups = new Set(muscleGroups);
      
      if (uniqueGroups.size === 1 && recentSessions.length >= 2) {
        return {
          recommended: true,
          reason: `You trained ${recentSessions[0].muscleGroup} 2 days in a row. Consider resting or training a different muscle group.`,
          emoji: '💪'
        };
      }
    }

    // Check weekly volume
    const weeklyAdvice = this.getRestAdvice(currentDate);
    if (weeklyAdvice.status === 'critical' || weeklyAdvice.status === 'warning') {
      return {
        recommended: true,
        reason: 'Your training volume is high this week. A rest day would help with recovery.',
        emoji: '⚠️'
      };
    }

    return {
      recommended: false,
      reason: 'You\'re good to train today! Listen to your body.',
      emoji: '💪'
    };
  }

  /**
   * Get recovery score (0-100)
   * @param {Date} currentDate - Current date
   * @returns {Object} - { score: number, rating: string, advice: string }
   */
  getRecoveryScore(currentDate = new Date()) {
    const advice = this.getRestAdvice(currentDate);
    let score = 100;

    // Deduct points for warnings
    advice.advice.forEach(item => {
      if (item.severity === 'critical') score -= 30;
      else if (item.severity === 'high') score -= 20;
      else if (item.severity === 'medium') score -= 10;
      else if (item.severity === 'low') score -= 5;
    });

    // Bonus points for optimal training
    const optimalCount = advice.advice.filter(a => a.type === 'optimal').length;
    score += optimalCount * 5;

    // Clamp between 0-100
    score = Math.max(0, Math.min(100, score));

    let rating = 'Poor';
    let emoji = '😰';
    let suggestion = 'Take immediate rest days and reduce training volume.';

    if (score >= 90) {
      rating = 'Excellent';
      emoji = '🌟';
      suggestion = 'Your training and recovery are perfectly balanced!';
    } else if (score >= 75) {
      rating = 'Good';
      emoji = '😊';
      suggestion = 'You\'re doing great! Minor adjustments may help.';
    } else if (score >= 60) {
      rating = 'Fair';
      emoji = '😐';
      suggestion = 'Consider adding more rest days or reducing intensity.';
    } else if (score >= 40) {
      rating = 'Poor';
      emoji = '😟';
      suggestion = 'Your recovery needs attention. Add rest days soon.';
    } else {
      rating = 'Critical';
      emoji = '🚨';
      suggestion = 'Take immediate rest! You\'re at risk of overtraining.';
    }

    return {
      score,
      rating,
      emoji,
      advice: suggestion,
      metrics: advice.metrics
    };
  }
}

// Export singleton instance
export const restRecoveryEngine = new RestRecoveryEngine();

