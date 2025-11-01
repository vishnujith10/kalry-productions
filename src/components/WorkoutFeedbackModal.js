/**
 * Workout Feedback Modal
 * 
 * Displays post-workout analytics including:
 * - Personal Records (PRs)
 * - Plateau breaks
 * - Progressive overload suggestions
 * - Recovery warnings
 * - Motivational messages
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#7c3aed',
  secondary: '#a855f7',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  white: '#ffffff',
  gray: '#64748b',
  lightGray: '#f1f5f9',
  dark: '#1e293b',
};

export default function WorkoutFeedbackModal({ visible, onClose, feedback }) {
  if (!feedback) return null;

  const { achievements = [], warnings = [], suggestions = [], workout = {} } = feedback;

  const hasAchievements = achievements.length > 0;
  const hasWarnings = warnings.length > 0;
  const hasSuggestions = suggestions.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Workout Summary</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Achievements Section */}
            {hasAchievements && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionIcon}>🏆</Text>
                  <Text style={styles.sectionTitle}>Achievements</Text>
                </View>
                {achievements.map((achievement, index) => (
                  <View key={index} style={[styles.card, styles.achievementCard]}>
                    <Text style={styles.achievementEmoji}>{achievement.emoji || '🎉'}</Text>
                    <View style={styles.achievementContent}>
                      <Text style={styles.achievementTitle}>{achievement.message}</Text>
                      {achievement.improvements && (
                        <Text style={styles.achievementSubtitle}>
                          {achievement.improvements}
                        </Text>
                      )}
                      {achievement.celebration && (
                        <Text style={styles.achievementDescription}>
                          {achievement.celebration}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Warnings Section */}
            {hasWarnings && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionIcon}>⚠️</Text>
                  <Text style={styles.sectionTitle}>Recovery Alerts</Text>
                </View>
                {warnings.map((warning, index) => (
                  <View key={index} style={[styles.card, styles.warningCard]}>
                    <Text style={styles.warningEmoji}>{warning.emoji || '⚠️'}</Text>
                    <View style={styles.warningContent}>
                      <Text style={styles.warningTitle}>{warning.message}</Text>
                      <Text style={styles.warningDescription}>{warning.suggestion}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Suggestions Section */}
            {hasSuggestions && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionIcon}>💡</Text>
                  <Text style={styles.sectionTitle}>Progression Tips</Text>
                </View>
                {suggestions.map((suggestion, index) => (
                  <View key={index} style={[styles.card, styles.suggestionCard]}>
                    <Text style={styles.suggestionEmoji}>{suggestion.emoji || '💪'}</Text>
                    <View style={styles.suggestionContent}>
                      {suggestion.exercise && (
                        <Text style={styles.suggestionExercise}>{suggestion.exercise}</Text>
                      )}
                      <Text style={styles.suggestionTitle}>{suggestion.message}</Text>
                      {suggestion.suggestion && (
                        <Text style={styles.suggestionDescription}>
                          {suggestion.suggestion}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* No Feedback Message */}
            {!hasAchievements && !hasWarnings && !hasSuggestions && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateEmoji}>💪</Text>
                <Text style={styles.emptyStateTitle}>Great Workout!</Text>
                <Text style={styles.emptyStateDescription}>
                  Keep logging your workouts to unlock personalized insights and track your progress.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.continueButton} onPress={onClose}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.dark,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.dark,
  },
  card: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  achievementCard: {
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  achievementEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.dark,
    marginBottom: 4,
  },
  achievementSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
  },
  warningCard: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  warningEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.dark,
    marginBottom: 4,
  },
  warningDescription: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
  },
  suggestionCard: {
    backgroundColor: '#ede9fe',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  suggestionEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionExercise: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.dark,
    marginBottom: 4,
  },
  suggestionDescription: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.dark,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});

